require("dotenv").config();
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../Models/listing.js");

const MONGO_URL = process.env.ATLASDB_URL;

async function main(){
    await mongoose.connect(MONGO_URL);
    console.log("Connected to Atlas for seeding");
}

main();

const initDB = async () =>{
    await Listing.deleteMany({});
    initData.data = initData.data.map((obj) => ({ ...obj, owner:"69252a0929e3104f275321e2"}));
    await Listing.insertMany(initData.data);
    console.log("Data initialized in Atlas");
};

initDB();
