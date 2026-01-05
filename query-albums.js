import { MongoClient } from "mongodb";

// Keep this in sync with test.js
const uri = "mongodb+srv://8bbjukebox:8bbjukebox123...@8bbjukebox.w1btiwn.mongodb.net/?retryWrites=true&w=majority&appName=8bbJukebox";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("jukebox");
    const albumsCol = db.collection("albums");
    const songsCol = db.collection("songs");

    const albumCount = await albumsCol.countDocuments();
    console.log(`📀 Albums count: ${albumCount}`);

    const firstAlbums = await albumsCol.find({}).sort({ title: 1 }).limit(40).toArray();
    console.log("\nFirst 10 albums (title, artist):");
    for (const a of firstAlbums) {
      const songCount = await songsCol.countDocuments({ album: a.title });
      console.log(`- ${a.title} | ${a.artist || 'No Artist'} (${songCount} songs)`);
    }

    // Show a few songs sample
  const songSample = await songsCol.find({}).limit(10).toArray();
    console.log("\n🎵 Sample songs (title, artist, album, familyFriendly):");
    for (const s of songSample) {
      console.log(`- ${s.title} | ${s.artist || 'No Artist'} | ${s.album} | ${s.familyFriendly}`);
    }

  // List songs for Pophits 00-24 Vol* albums
  const pophitsAlbums = await albumsCol.find({ title: { $regex: /^Pophits 00-24 Vol\d+$/i } })
    .sort({ title: 1 })
    .toArray();

  if (pophitsAlbums.length > 0) {
    console.log("\n================ Pophits 00-24 Albums ================");
    for (const a of pophitsAlbums) {
      const popSongs = await songsCol.find({ album: a.title }).sort({ title: 1 }).toArray();
      console.log(`\n📀 ${a.title} — ${popSongs.length} songs`);
      popSongs.forEach((song, idx) => {
        console.log(`  ${String(idx + 1).padStart(2, '0')}. ${song.title}`);
      });
    }
  } else {
    console.log("\n⚠️  No 'Pophits 00-24 Vol*' albums found.");
  }

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();


