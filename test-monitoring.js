import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb+srv://romariodiaz:8bbjukebox@8bbjukebox.w1btiwn.mongodb.net/jukebox?retryWrites=true&w=majority';

async function testMonitoring() {
    const client = new MongoClient(MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db('jukebox');
        const tracklistCollection = db.collection('tracklist');
        
        console.log('🧪 Testing monitoring by adding a test song...');
        
        // Add a test song
        const testSong = {
            title: 'Test Song for Monitoring',
            artist: 'Test Artist',
            album: 'Test Album',
            status: 'queued',
            priority: 1,
            requestedBy: 'test',
            masterId: 'test-master',
            existsAtMaster: true,
            length: 180,
            createdAt: new Date()
        };
        
        const result = await tracklistCollection.insertOne(testSong);
        console.log('✅ Test song added:', result.insertedId);
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update status to playing
        console.log('🔄 Updating status to playing...');
        await tracklistCollection.updateOne(
            { _id: result.insertedId },
            { $set: { status: 'playing', playedAt: new Date() } }
        );
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update status to paused
        console.log('⏸️ Updating status to paused...');
        await tracklistCollection.updateOne(
            { _id: result.insertedId },
            { $set: { status: 'paused', pausedAt: new Date() } }
        );
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update status to playing again
        console.log('▶️ Updating status to playing again...');
        await tracklistCollection.updateOne(
            { _id: result.insertedId },
            { $set: { status: 'playing', resumedAt: new Date() } }
        );
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Delete the test song
        console.log('🗑️ Deleting test song...');
        await tracklistCollection.deleteOne({ _id: result.insertedId });
        
        console.log('✅ Test completed! Check the monitoring server logs for updates.');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

testMonitoring();

