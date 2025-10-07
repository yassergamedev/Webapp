import { MongoClient } from "mongodb";
import fs from "fs/promises";

// Update to your new cluster URI. This script will recreate the DB structure and seed albums.
const uri = "mongodb+srv://dbuser:dbuser@cluster0.qlpwlae.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db("jukebox");

    await ensureCollectionsAndIndexes(db);

    // Re-seed albums exactly like before from albums_list.txt
    await seedAlbumsFromList(db, "albums_list.txt");

    // Ensure tracklist structure and indexes match previous cluster
    await clearTracklistEntries(db);
    await ensureTracklistStructureAndIndexes(db);

    await showAlbumSummary(db);
    await showTracklistCollection(db);

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

async function ensureTracklistStructureAndIndexes(db) {
  try {
    const tracklistCollection = db.collection("tracklist");
    
    console.log("🔄 Updating tracklist collection structure...");
    
    // Add existsAtMaster field to all existing documents that don't have it
    const result1 = await tracklistCollection.updateMany(
      { existsAtMaster: { $exists: false } },
      { $set: { existsAtMaster: true } }
    );
    
    // Add length field to all existing documents that don't have it
    const result2 = await tracklistCollection.updateMany(
      { length: { $exists: false } },
      { $set: { length: 0 } }
    );
    
    console.log(`✅ Updated ${result1.modifiedCount} documents with existsAtMaster field`);
    console.log(`✅ Updated ${result2.modifiedCount} documents with length field`);
    
    // Create indexes for better performance
    await tracklistCollection.createIndex({ status: 1 });
    await tracklistCollection.createIndex({ createdAt: 1 });
    await tracklistCollection.createIndex({ priority: 1 });
    await tracklistCollection.createIndex({ existsAtMaster: 1 });
    await tracklistCollection.createIndex({ length: 1 });
    
    console.log("✅ Indexes created/updated");
    
  } catch (err) {
    console.error("Error updating tracklist structure:", err);
  }
}

async function ensureCollectionsAndIndexes(db) {
  // Ensure albums and tracklist collections exist and base indexes are set
  const collections = await db.listCollections().toArray();
  const existing = new Set(collections.map(c => c.name));

  if (!existing.has("albums")) {
    await db.createCollection("albums");
  }
  if (!existing.has("songs")) {
    await db.createCollection("songs");
  }
  if (!existing.has("tracklist")) {
    await db.createCollection("tracklist");
  }

  const albums = db.collection("albums");
  // Albums: ensure legacy index on {name:1} is removed, then enforce {title:1} unique
  try {
    await albums.dropIndex("name_1");
    console.log("🗑️ Dropped legacy albums index name_1");
  } catch (_) {}
  try {
    await albums.createIndex({ title: 1 }, { unique: true });
  } catch (_) {}
  // Remove createdAt field from albums
  try {
    const removeCreatedAt = await albums.updateMany(
      { createdAt: { $exists: true } },
      { $unset: { createdAt: 1 } }
    );
    if (removeCreatedAt.modifiedCount) {
      console.log(`🗑️ Removed createdAt from ${removeCreatedAt.modifiedCount} albums`);
    }
  } catch (_) {}

  const songs = db.collection("songs");
  try {
    await songs.createIndex({ album: 1, title: 1 }, { unique: true });
    await songs.createIndex({ familyFriendly: 1 });
  } catch (_) {}
}

function parseAlbumsListFile(content) {
  const lines = content.split(/\r?\n/);
  const albums = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("Album:")) {
      if (current) albums.push(current);
      const name = line.substring(6).trim();
      current = { name, songs: [], images: [] };
      continue;
    }
    if (!current) continue;

    // image files
    if (/\.(jpg|jpeg|png|gif)$/i.test(line)) {
      current.images.push(line);
      continue;
    }
    // song line like: "01 - Thunderstruck - ACDC.mp3" or "Artist - Title.mp3"
    if (/\.mp3$/i.test(line) || /\.flac$/i.test(line)) {
      let trackNumber = null;
      let title = line;
      let artist = null;

      const numbered = line.match(/^(\d{2})\s*-\s*(.+)$/);
      if (numbered) {
        trackNumber = parseInt(numbered[1], 10);
        title = numbered[2];
      }

      // Try to split "Title - Artist.mp3" vs "Artist - Title.mp3" forms; keep raw if ambiguous
      const parts = title.replace(/\.(mp3|flac)$/i, "").split(" - ");
      if (parts.length >= 2) {
        // Heuristic: if first token is a number two-digit track, we already removed it
        // Use last token as artist if file list matches pattern from source
        // Known format in many lines: "Song Title - Artist"
        const maybeArtistLast = parts[parts.length - 1];
        const maybeTitle = parts.slice(0, parts.length - 1).join(" - ");
        title = maybeTitle;
        artist = maybeArtistLast;
      } else {
        title = parts[0];
      }

      current.songs.push({
        trackNumber,
        title: title.trim(),
        artist: artist ? artist.trim() : null,
        filename: line,
        length: null
      });
    }
  }
  if (current) albums.push(current);
  return albums;
}

async function seedAlbumsFromList(db, filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parseAlbumsListFile(content);

  const albumsCol = db.collection("albums");
  const songsCol = db.collection("songs");
  console.log("🧹 Clearing existing albums and songs...");
  await albumsCol.deleteMany({});
  await songsCol.deleteMany({});

  if (parsed.length === 0) {
    console.log("⚠️ No albums parsed from file; skipping seed.");
    return;
  }

  // Insert albums: { title }
  const albumDocs = parsed
    .filter(a => a.name && a.name.trim().length > 0)
    .map(a => ({ title: a.name.trim() }));
  console.log(`📥 Inserting ${albumDocs.length} albums...`);
  if (albumDocs.length) {
    await albumsCol.insertMany(albumDocs, { ordered: false });
  }

  // Insert songs: { title, album, familyFriendly }
  const songDocs = [];
  for (const a of parsed) {
    if (!a.name || !a.name.trim()) continue;
    for (const s of a.songs) {
      songDocs.push({
        title: s.title,
        album: a.name.trim(),
        familyFriendly: true
      });
    }
  }
  if (songDocs.length) {
    console.log(`🎵 Inserting ${songDocs.length} songs...`);
    // Use ordered:false to skip duplicates gracefully if any
    await songsCol.insertMany(songDocs, { ordered: false });
  }
  console.log("✅ Albums and songs seeded");
}

async function showTracklistCollection(db) {
  try {
    const tracklistCollection = db.collection("tracklist");
    
    console.log("\n" + "=".repeat(50));
    console.log("📋 TRACKLIST COLLECTION");
    console.log("=".repeat(50));
    
    // Get document count
    const count = await tracklistCollection.countDocuments();
    console.log(`📊 Total songs: ${count}`);
    
    if (count > 0) {
      // Get all tracklist entries
      const allEntries = await tracklistCollection.find({}).sort({ priority: 1, createdAt: 1 }).toArray();
      
      console.log("\n🎵 All Tracklist Entries (JSON):");
      console.log(JSON.stringify(allEntries, null, 2));
      
      // Show by existsAtMaster status
      const existsAtMaster = await tracklistCollection.find({ existsAtMaster: true }).toArray();
      const notExistsAtMaster = await tracklistCollection.find({ existsAtMaster: false }).toArray();
      
      console.log(`\n📈 Master File Status:`);
      console.log(`  ✅ Exists at master: ${existsAtMaster.length}`);
      console.log(`  ❌ Missing at master: ${notExistsAtMaster.length}`);
      
    } else {
      console.log("\n❌ Tracklist is empty");
    }
    
    console.log("\n" + "=".repeat(50));
    
  } catch (err) {
    console.error("Error showing tracklist collection:", err);
  }
}

async function addSampleData(db) {
  try {
    const tracklistCollection = db.collection("tracklist");
    
    console.log("\n🔄 Adding sample data to demonstrate structure...");
    
    const sampleData = [
      {
        songId: "68c4c2100b6fb92383d66a5d",
        title: "Sample Song 1",
        artist: "Sample Artist",
        album: "Sample Album",
        duration: 180,
        status: "queued",
        priority: 1,
        createdAt: new Date(),
        playedAt: null,
        requestedBy: "user123",
        masterId: "master001",
        slaveId: null,
        existsAtMaster: true,
        length: 180
      },
      {
        songId: "68c4c2150b6fb92383d66a70",
        title: "Sample Song 2",
        artist: "Sample Artist 2",
        album: "Sample Album 2",
        duration: 240,
        status: "playing",
        priority: 2,
        createdAt: new Date(),
        playedAt: new Date(),
        requestedBy: "user456",
        masterId: "master001",
        slaveId: "slave001",
        existsAtMaster: false,
        length: 240
      },
      {
        songId: "68c4c2200b6fb92383d66a85",
        title: "Sample Song 3",
        artist: "Sample Artist 3",
        album: "Sample Album 3",
        duration: 200,
        status: "played",
        priority: 3,
        createdAt: new Date(),
        playedAt: new Date(),
        requestedBy: "user789",
        masterId: "master002",
        slaveId: "slave002",
        existsAtMaster: true,
        length: 200
      }
    ];
    
    await tracklistCollection.insertMany(sampleData);
    console.log("✅ Sample data added");
    
  } catch (err) {
    console.error("Error adding sample data:", err);
  }
}

async function clearTracklistEntries(db) {
  try {
    const tracklistCollection = db.collection("tracklist");
    
    console.log("\n🧹 Clearing all tracklist entries...");
    
    const result = await tracklistCollection.deleteMany({});
    console.log(`✅ Cleared ${result.deletedCount} entries from tracklist`);
    
  } catch (err) {
    console.error("Error clearing tracklist entries:", err);
  }
}

run();