if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const mongoose = require("mongoose");
const Listing = require("./Models/listing");
const { embedText } = require("./utils/embeddings");

async function backfill() {
  await mongoose.connect(process.env.ATLASDB_URL);
  console.log("Connected to MongoDB");

  const listings = await Listing.find({ embedding: { $exists: false } }).or([
    { embedding: { $eq: [] } },
    { embedding: { $size: 0 } },
  ]);

  console.log(`Found ${listings.length} listings without embeddings`);

  for (const listing of listings) {
    const text = [
      listing.title || "",
      listing.description || "",
      listing.location || "",
      listing.category || "",
    ].join(" ");

    try {
      const vector = await embedText(text);
      listing.embedding = vector;
      await listing.save();
      console.log(`Embedded: ${listing.title}`);
    } catch (err) {
      console.error(`Failed to embed "${listing.title}":`, err.message);
    }
  }

  console.log("Backfill complete");
  await mongoose.disconnect();
}

backfill().catch(console.error);
