const express = require("express");
const router = express.Router();
const initData = require("../init/data.js");
const Listing = require("../Models/listing.js");

router.get("/api/seed", async (req, res) => {
  try {
    const count = await Listing.countDocuments();

    if (count > 0) {
      return res.json({
        message: `Database already has ${count} listings. No action needed.`,
        count,
      });
    }

    const listings = initData.data.map((obj) => ({
      ...obj,
      owner: "69252a0929e3104f275321e2",
      embedding: [],
    }));

    await Listing.insertMany(listings);

    res.json({
      message: `Successfully seeded ${listings.length} listings into the database.`,
      count: listings.length,
    });
  } catch (err) {
    console.error("Seed API error:", err);
    res.status(500).json({ error: "Seeding failed: " + err.message });
  }
});

module.exports = router;
