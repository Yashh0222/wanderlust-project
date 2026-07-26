const mongoose = require("mongoose");
const { embedText } = require("./embeddings");

async function semanticSearchListings(queryText, maxPrice = null, limit = 5) {
  const Listing = mongoose.model("Listing");
  const queryVector = await embedText(queryText);

  const pipeline = [
    {
      $vectorSearch: {
        index: "listing_vector_index",
        path: "embedding",
        queryVector: queryVector,
        numDimensions: 384,
        limit: limit,
      },
    },
    {
      $addFields: {
        score: { $meta: "vectorSearchScore" },
      },
    },
    {
      $project: {
        title: 1,
        description: 1,
        price: 1,
        location: 1,
        category: 1,
        image: 1,
        score: 1,
      },
    },
  ];

  if (maxPrice) {
    pipeline.splice(1, 0, {
      $match: { price: { $lte: maxPrice } },
    });
  }

  const results = await Listing.aggregate(pipeline);
  return results;
}

async function semanticSearchListingsWithRange(queryText, { minPrice, maxPrice } = {}, limit = 5) {
  const Listing = mongoose.model("Listing");
  const queryVector = await embedText(queryText);

  const matchStage = {};
  if (minPrice) matchStage.price = { ...matchStage.price, $gte: minPrice };
  if (maxPrice) matchStage.price = { ...matchStage.price, $lte: maxPrice };

  const pipeline = [
    {
      $vectorSearch: {
        index: "listing_vector_index",
        path: "embedding",
        queryVector: queryVector,
        numDimensions: 384,
        limit: limit,
      },
    },
  ];

  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  pipeline.push(
    {
      $addFields: {
        score: { $meta: "vectorSearchScore" },
      },
    },
    {
      $project: {
        title: 1,
        description: 1,
        price: 1,
        location: 1,
        category: 1,
        image: 1,
        score: 1,
      },
    }
  );

  const results = await Listing.aggregate(pipeline);
  return results;
}

module.exports = { semanticSearchListings, semanticSearchListingsWithRange };
