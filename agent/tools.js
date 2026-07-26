const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const Listing = require("../Models/listing");

const VALID_CATEGORIES = [
  "Trending",
  "Rooms",
  "Iconic Cities",
  "Mountains",
  "Castles",
  "Amazing Pools",
  "Camping",
  "Farms",
  "Arctic",
];

const searchListings = tool(
  async ({ query, minPrice, maxPrice, category }) => {
    const minP = minPrice ? Number(minPrice) : undefined;
    const maxP = maxPrice ? Number(maxPrice) : undefined;
    let listings = [];

    // Try semantic search first (requires Atlas Vector Search)
    try {
      const {
        semanticSearchListingsWithRange,
      } = require("../utils/semanticSearch");
      listings = await semanticSearchListingsWithRange(
        query || "",
        { minPrice: minP, maxPrice: maxP },
        10
      );
    } catch (err) {
      // Semantic search not available, fall through to text search
    }

    // Filter by category if semantic search returned results
    if (category && category.trim() !== "" && listings.length > 0) {
      listings = listings.filter((l) => l.category === category);
    }

    // If semantic search failed or returned nothing, use text search
    if (listings.length === 0) {
      const filter = {};

      if (query && query.trim() !== "") {
        const regex = { $regex: query, $options: "i" };
        filter.$or = [
          { title: regex },
          { description: regex },
          { location: regex },
        ];
      }

      if (minP || maxP) {
        filter.price = {};
        if (minP) filter.price.$gte = minP;
        if (maxP) filter.price.$lte = maxP;
      }

      if (category && category.trim() !== "") {
        filter.category = category;
      }

      listings = await Listing.find(filter)
        .select("title description price location category image")
        .limit(10);
    }

    // Broader fallback: try category-only if still nothing
    if (listings.length === 0 && (category || minP || maxP)) {
      const fallback = {};
      if (category && category.trim() !== "") fallback.category = category;
      if (minP || maxP) {
        fallback.price = {};
        if (minP) fallback.price.$gte = minP;
        if (maxP) fallback.price.$lte = maxP;
      }
      listings = await Listing.find(fallback)
        .select("title description price location category image")
        .limit(10);
    }

    // Last resort: return whatever is in DB
    if (listings.length === 0) {
      listings = await Listing.find({})
        .select("title description price location category image")
        .limit(10);
    }

    if (listings.length === 0) {
      return "No listings found in the database. The database may be empty. Please try again later.";
    }

    const formatted = listings.map((l, i) => {
      const id = l._id.toString();
      return `${i + 1}. ${l.title} | ${l.location} | ${l.country || ""} | Rs.${l.price}/night | Category: ${l.category || "N/A"} | ID: ${id}`;
    });

    return (
      `Found ${listings.length} listing(s):\n\n` +
      formatted.join("\n") +
      "\n\nIMPORTANT: When the user wants to book one of these, extract the listing ID (the string after 'ID: ') and pass it to the book_listing tool. Do NOT search again - use the listing ID from these results."
    );
  },
  {
    name: "search_listings",
    description:
      "Search the Wanderlust database for available places to stay. You MUST call this tool whenever the user wants to find, search, or browse listings. NEVER generate listing results yourself — only show what this tool returns. Returns real listings with IDs, titles, prices, locations, and categories.",
    schema: z.object({
      query: z
        .string()
        .describe(
          "Search keywords like location, title, or vibe (e.g. 'mountains', 'beach', 'cozy', 'river', 'city center')"
        ),
      minPrice: z
        .string()
        .optional()
        .describe(
          "Minimum price per night in INR as a string (e.g. '500')"
        ),
      maxPrice: z
        .string()
        .optional()
        .describe(
          "Maximum price per night in INR as a string (e.g. '2000')"
        ),
      category: z
        .string()
        .optional()
        .describe(
          "Category to filter by. Options: Trending, Rooms, Iconic Cities, Mountains, Castles, Amazing Pools, Camping, Farms, Arctic"
        ),
    }),
  }
);

const bookListing = tool(
  async ({ listingId, checkIn, checkOut, guests }) => {
    const guestCount = parseInt(String(guests), 10) || 1;

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return "Error: Listing not found with that ID. Please search again and use the correct listing ID from the search results.";
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime())) {
      return "Error: Invalid check-in date. Please provide a valid date in YYYY-MM-DD format.";
    }

    if (isNaN(checkOutDate.getTime())) {
      return "Error: Invalid check-out date. Please provide a valid date in YYYY-MM-DD format.";
    }

    if (checkInDate >= checkOutDate) {
      return "Error: Check-out date must be after check-in date.";
    }

    if (checkInDate < new Date()) {
      return "Error: Check-in date cannot be in the past.";
    }

    const nights = Math.ceil(
      (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)
    );
    const totalPrice = nights * listing.price;

    return JSON.stringify({
      listingId: listing._id.toString(),
      listingTitle: listing.title,
      listingLocation: listing.location,
      pricePerNight: listing.price,
      checkIn: checkIn,
      checkOut: checkOut,
      guests: guestCount,
      nights: nights,
      totalPrice: totalPrice,
      status: "pending_confirmation",
    });
  },
  {
    name: "book_listing",
    description:
      "Prepare a booking for a listing. This will be sent to the user for confirmation before finalizing. You need the listing ID (from search results), check-in date, check-out date, and number of guests.",
    schema: z.object({
      listingId: z
        .string()
        .describe(
          "The MongoDB ObjectId of the listing to book (the long string ID from search results)"
        ),
      checkIn: z
        .string()
        .describe("Check-in date in YYYY-MM-DD format (e.g. '2025-07-20')"),
      checkOut: z
        .string()
        .describe("Check-out date in YYYY-MM-DD format (e.g. '2025-07-22')"),
      guests: z
        .string()
        .describe(
          "Number of guests as a string (e.g. '2' for two guests)"
        ),
    }),
  }
);

const getCategories = tool(
  async () => {
    try {
      const categories = await Listing.aggregate([
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
            minPrice: { $min: "$price" },
            maxPrice: { $max: "$price" },
          },
        },
        { $sort: { count: -1 } },
      ]);

      if (categories.length === 0) {
        return "No categories found. The database may be empty. Try searching for places first.";
      }

      return (
        "Available categories:\n" +
        categories
          .map(
            (c) =>
              `${c._id}: ${c.count} listings (Rs.${c.minPrice} - Rs.${c.maxPrice}/night)`
          )
          .join("\n")
      );
    } catch (err) {
      console.error("get_categories error:", err);
      return "Error fetching categories. Please try again.";
    }
  },
  {
    name: "get_categories",
    description:
      "Get all available listing categories from the Wanderlust database. You MUST call this tool when the user asks about categories, types of places, or what's available. NEVER make up categories — only show what this tool returns.",
    schema: z.object({}),
  }
);

const getListingDetails = tool(
  async ({ listingId }) => {
    try {
      const listing = await Listing.findById(listingId).select(
        "title description price location country category image"
      );

      if (!listing) {
        return "Error: Listing not found with that ID.";
      }

      return [
        `Title: ${listing.title}`,
        `Category: ${listing.category || "N/A"}`,
        `Location: ${listing.location}, ${listing.country}`,
        `Price: Rs.${listing.price}/night`,
        `Description: ${listing.description}`,
      ].join("\n");
    } catch (err) {
      console.error("get_listing_details error:", err);
      return "Error fetching listing details. Please try again.";
    }
  },
  {
    name: "get_listing_details",
    description:
      "Get full details of a specific listing by its ID. Use when the user wants more info about a specific listing from search results.",
    schema: z.object({
      listingId: z
        .string()
        .describe("The MongoDB ObjectId of the listing"),
    }),
  }
);

module.exports = {
  searchListings,
  bookListing,
  getCategories,
  getListingDetails,
};
