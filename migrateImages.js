// migrateImages.js

// Load environment variables (IMPORTANT)
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const cloudinary = require("./cloudConfig");
const Listing = require("./Models/listing");

// Debug: verify Cloudinary keys are loaded
console.log("CLOUD_NAME:", process.env.CLOUD_NAME);
console.log("API_KEY:", process.env.CLOUD_API_KEY);
console.log("API_SECRET:", process.env.CLOUD_API_SECRET ? "Loaded" : "Missing");


// -------------------------------
// 1. CONNECT TO LOCAL MONGODB
// -------------------------------
mongoose.connect("mongodb://127.0.0.1:27017/wanderlust")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("DB Error:", err));


// -------------------------------
// 2. MAIN MIGRATION FUNCTION
// -------------------------------
async function migrateImages() {
    const listings = await Listing.find({});
    let updatedCount = 0;

    for (let listing of listings) {
        const localUrl = listing.image?.url;

        // Skip Cloudinary images
        if (!localUrl || localUrl.startsWith("http")) continue;

        const fixedPath = localUrl.replace(/^\//, "");   // remove leading slash
        const localPath = path.join(__dirname, fixedPath);

        if (!fs.existsSync(localPath)) {
            console.log("❌ File not found, skipping:", localPath);
            continue;
        }

        try {
            console.log("Uploading:", localPath);

            const uploaded = await cloudinary.uploader.upload(localPath, {
                folder: "Wanderlust",
            });

            // Update listing
            listing.image.url = uploaded.secure_url;
            listing.image.filename = uploaded.public_id;
            await listing.save();

            updatedCount++;
            console.log("✅ Uploaded & Updated:", listing.title);

        } catch (err) {
            console.log("❌ Error uploading:", localUrl);
            console.log(err.message);
        }
    }

    console.log(`\n🎉 Migration Complete! ${updatedCount} listings updated.`);
    mongoose.connection.close();
}

migrateImages();

