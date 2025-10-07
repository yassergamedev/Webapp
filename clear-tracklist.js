import { MongoClient } from "mongodb";

const uri = "mongodb+srv://mezragyasser2002:mezrag.yasser123...@8bbjukebox.w1btiwn.mongodb.net/"; 

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db("jukebox");
    
    // Clear tracklist collection
    await clearTracklist(db);

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

async function clearTracklist(db) {
  try {
    const tracklistCollection = db.collection("tracklist");
    
    console.log("\n" + "=".repeat(50));
    console.log("🧹 CLEARING TRACKLIST COLLECTION");
    console.log("=".repeat(50));
    
    // Get count before clearing
    const countBefore = await tracklistCollection.countDocuments();
    console.log(`\n📊 Entries before clearing: ${countBefore}`);
    
    if (countBefore === 0) {
      console.log("\n✅ Tracklist is already empty - nothing to clear");
      return;
    }
    
    // Show what will be cleared
    const entriesToClear = await tracklistCollection.find({}).toArray();
    console.log("\n🎵 Entries to be cleared:");
    entriesToClear.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.title} by ${entry.artist} (${entry.status})`);
    });
    
    // Clear all entries
    const result = await tracklistCollection.deleteMany({});
    
    console.log(`\n✅ Successfully cleared ${result.deletedCount} entries from tracklist`);
    
    // Verify collection is empty
    const countAfter = await tracklistCollection.countDocuments();
    console.log(`📊 Entries after clearing: ${countAfter}`);
    
    if (countAfter === 0) {
      console.log("\n🎉 Tracklist collection is now completely empty!");
    } else {
      console.log(`\n⚠️  Warning: ${countAfter} entries still remain`);
    }
    
    // Show collection status
    console.log("\n📋 Collection Status:");
    console.log(`  Collection: tracklist`);
    console.log(`  Database: jukebox`);
    console.log(`  Total documents: ${countAfter}`);
    console.log(`  Status: ${countAfter === 0 ? 'Empty' : 'Contains data'}`);
    
    console.log("\n" + "=".repeat(50));
    console.log("✅ Tracklist clearing completed successfully!");
    
  } catch (err) {
    console.error("❌ Error clearing tracklist:", err);
  }
}

run();






