import { MongoClient } from "mongodb";

// Keep this in sync with test.js
const uri = "mongodb+srv://dbuser:dbuser@cluster0.qlpwlae.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("jukebox");
    const albumsCol = db.collection("albums");
    const songsCol = db.collection("songs");

    const albumCount = await albumsCol.countDocuments();
    console.log(`📀 Albums count: ${albumCount}`);

    const firstAlbums = await albumsCol.find({}).sort({ title: 1 }).limit(10).toArray();
    console.log("\nFirst 10 albums (title):");
    for (const a of firstAlbums) {
      const songCount = await songsCol.countDocuments({ album: a.title });
      console.log(`- ${a.title} (${songCount} songs)`);
    }

    // Show a few songs sample
    const songSample = await songsCol.find({}).limit(10).toArray();
    console.log("\n🎵 Sample songs (title, album, familyFriendly):");
    for (const s of songSample) {
      console.log(`- ${s.title} | ${s.album} | ${s.familyFriendly}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();


