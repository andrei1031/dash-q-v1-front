const { db } = require('./firebaseAdmin'); // Import from your setup file

async function testConnection() {
  try {
    const collections = await db.listCollections();
    console.log("Connected! Found collections:", collections.map(c => c.id));
  } catch (error) {
    console.error("Connection failed:", error);
  }
}

testConnection();