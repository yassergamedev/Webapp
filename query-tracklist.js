import { MongoClient } from "mongodb";

const uri = "mongodb+srv://mezragyasser2002:mezrag.yasser123...@8bbjukebox.w1btiwn.mongodb.net/"; 

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db("jukebox");
    
    // Query tracklist collection
    await queryTracklist(db);

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

async function queryTracklist(db) {
  try {
    const tracklistCollection = db.collection("tracklist");
    
    console.log("\n" + "=".repeat(60));
    console.log("📋 TRACKLIST QUERY RESULTS");
    console.log("=".repeat(60));
    
    // Get total count
    const totalCount = await tracklistCollection.countDocuments();
    console.log(`\n📊 Total entries: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log("\n❌ Tracklist is empty");
      return;
    }
    
    // Get all entries
    const allEntries = await tracklistCollection.find({}).sort({ priority: 1, createdAt: 1 }).toArray();
    
    console.log("\n🎵 ALL TRACKLIST ENTRIES (JSON):");
    console.log(JSON.stringify(allEntries, null, 2));
    
    // Query by status
    const queuedSongs = await tracklistCollection.find({ status: "queued" }).sort({ priority: 1, createdAt: 1 }).toArray();
    const playingSongs = await tracklistCollection.find({ status: "playing" }).toArray();
    const playedSongs = await tracklistCollection.find({ status: "played" }).sort({ playedAt: -1 }).toArray();
    const skippedSongs = await tracklistCollection.find({ status: "skipped" }).toArray();
    
    console.log("\n📈 STATUS BREAKDOWN:");
    console.log(`  🎵 Queued: ${queuedSongs.length}`);
    console.log(`  ▶️  Playing: ${playingSongs.length}`);
    console.log(`  ✅ Played: ${playedSongs.length}`);
    console.log(`  ⏭️  Skipped: ${skippedSongs.length}`);
    
    // Query by existsAtMaster
    const existsAtMaster = await tracklistCollection.find({ existsAtMaster: true }).toArray();
    const notExistsAtMaster = await tracklistCollection.find({ existsAtMaster: false }).toArray();
    
    console.log("\n🎛️  MASTER FILE STATUS:");
    console.log(`  ✅ Exists at master: ${existsAtMaster.length}`);
    console.log(`  ❌ Missing at master: ${notExistsAtMaster.length}`);
    
    // Query by master
    const masterGroups = await tracklistCollection.aggregate([
      { $group: { _id: "$masterId", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log("\n🎛️  BY MASTER:");
    masterGroups.forEach(master => {
      console.log(`  Master ${master._id}: ${master.count} songs`);
    });
    
    // Query by slave
    const slaveGroups = await tracklistCollection.aggregate([
      { $group: { _id: "$slaveId", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log("\n🎧 BY SLAVE:");
    slaveGroups.forEach(slave => {
      console.log(`  Slave ${slave._id || 'Unassigned'}: ${slave.count} songs`);
    });
    
    // Query by requestedBy
    const userGroups = await tracklistCollection.aggregate([
      { $group: { _id: "$requestedBy", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log("\n👤 BY USER:");
    userGroups.forEach(user => {
      console.log(`  User ${user._id}: ${user.count} songs`);
    });
    
    // Show queued songs details
    if (queuedSongs.length > 0) {
      console.log("\n🎵 QUEUED SONGS:");
      queuedSongs.forEach((song, index) => {
        console.log(`  ${index + 1}. ${song.title} by ${song.artist}`);
        console.log(`     Priority: ${song.priority} | Master: ${song.masterId} | Requested by: ${song.requestedBy}`);
        console.log(`     Length: ${song.length}s | Exists at master: ${song.existsAtMaster}`);
      });
    }
    
    // Show currently playing
    if (playingSongs.length > 0) {
      console.log("\n▶️  CURRENTLY PLAYING:");
      playingSongs.forEach((song, index) => {
        console.log(`  ${index + 1}. ${song.title} by ${song.artist}`);
        console.log(`     Slave: ${song.slaveId} | Started: ${song.playedAt}`);
        console.log(`     Length: ${song.length}s | Exists at master: ${song.existsAtMaster}`);
      });
    }
    
    // Show recent played songs
    if (playedSongs.length > 0) {
      console.log("\n✅ RECENTLY PLAYED:");
      playedSongs.slice(0, 5).forEach((song, index) => {
        console.log(`  ${index + 1}. ${song.title} by ${song.artist}`);
        console.log(`     Played at: ${song.playedAt} | Duration: ${song.length}s`);
        console.log(`     Requested by: ${song.requestedBy}`);
      });
      
      if (playedSongs.length > 5) {
        console.log(`  ... and ${playedSongs.length - 5} more played songs`);
      }
    }
    
    // Length statistics
    const lengthStats = await tracklistCollection.aggregate([
      { $group: { 
        _id: null, 
        totalLength: { $sum: "$length" },
        avgLength: { $avg: "$length" },
        minLength: { $min: "$length" },
        maxLength: { $max: "$length" }
      }}
    ]).toArray();
    
    if (lengthStats.length > 0) {
      const stats = lengthStats[0];
      console.log("\n⏱️  LENGTH STATISTICS:");
      console.log(`  Total duration: ${Math.floor(stats.totalLength / 60)}:${(stats.totalLength % 60).toString().padStart(2, '0')}`);
      console.log(`  Average length: ${Math.floor(stats.avgLength)}s`);
      console.log(`  Shortest: ${stats.minLength}s`);
      console.log(`  Longest: ${stats.maxLength}s`);
    }
    
    console.log("\n" + "=".repeat(60));
    
  } catch (err) {
    console.error("Error querying tracklist:", err);
  }
}

run();






