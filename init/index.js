require("dotenv").config();
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../Models/listing.js");

const MONGO_URL = process.env.ATLASDB_URL;

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("Connected to Atlas for seeding");
}

const initDB = async () => {
  const count = await Listing.countDocuments();
  if (count > 0) {
    console.log(`Database already has ${count} listings. Skipping seed.`);
    return;
  }

  const listings = initData.data.map((obj) => ({
    ...obj,
    owner: "69252a0929e3104f275321e2",
    embedding: [],
  }));

  await Listing.insertMany(listings);
  console.log(`Seeded ${listings.length} listings into the database`);
};

main()
  .then(() => initDB())
  .then(() => {
    console.log("Seeding complete");
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("Seed error:", err);
    mongoose.connection.close();
    process.exit(1);
  });
