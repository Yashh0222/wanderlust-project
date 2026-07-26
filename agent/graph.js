const { ChatGroq } = require("@langchain/groq");
const {
  StateGraph,
  MemorySaver,
  START,
  END,
  Annotation,
  interrupt,
} = require("@langchain/langgraph");
const { HumanMessage, AIMessage, SystemMessage, ToolMessage } = require("@langchain/core/messages");
const Listing = require("../Models/listing");
const Booking = require("../Models/booking");

const GraphState = Annotation.Root({
  messages: Annotation({
    reducer: (curr, prev) => [...curr, ...prev],
    default: () => [],
  }),
  action: Annotation({
    reducer: (curr, prev) => (prev !== null ? prev : curr),
    default: () => null,
  }),
  actionResult: Annotation({
    reducer: (curr, prev) => (prev !== null ? prev : curr),
    default: () => null,
  }),
  pendingListingId: Annotation({
    reducer: (curr, prev) => (prev !== undefined ? prev : curr),
    default: () => null,
  }),
});

function getDateContext() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const opts = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  return {
    todayStr: now.toLocaleDateString("en-IN", opts),
    isoDate: now.toISOString().split("T")[0],
    tomorrowDate: tomorrow.toISOString().split("T")[0],
    year: now.getFullYear(),
  };
}

function buildClassifyPrompt() {
  const d = getDateContext();
  return `You are a intent classifier. Analyze the user message and output a JSON object.

TODAY: ${d.todayStr} (${d.isoDate}) | TOMORROW: ${d.tomorrowDate}

INTENTS AND EXAMPLES:
- "greeting": hi, hello, hey, good morning
- "search": find places in mumbai, show me cabins, beach house near goa, places near mountains, rooms in delhi
- "categories": show categories, what categories, what types of places
- "book": book 1, book this, book the taj hotel, book listing 2
- "navigate": take me to my bookings, go to my wishlist, open my profile, go home, add a listing, my bookings, go to bookings
- "change_dates": change my dates, update check-in, modify checkout
- "change_guests": change guests, update number of guests
- "help": what can you do, how does this work
- "other": anything else

CRITICAL RULES:
1. If user says "my bookings", "take me to bookings", "go to bookings", "open bookings" → intent "navigate", navigatePage "bookings"
2. If user says "my wishlist", "go to wishlist" → intent "navigate", navigatePage "wishlist"
3. If user says "my profile", "go to profile", "account" → intent "navigate", navigatePage "profile"
4. If user says "go home", "home", "explore", "all listings" → intent "navigate", navigatePage "home"
5. If user says "add listing", "create listing", "new listing" → intent "navigate", navigatePage "new-listing"
6. If user provides dates like "2026-07-28" or "check-in: 2026-07-28" → intent "book" (they are providing dates for a pending booking)
7. If user says a category name (trending, mountains, rooms, etc) → intent "search" with category set
8. If user says "1" or a number after categories were shown → intent "search" with category set

CATEGORIES: Trending, Rooms, Iconic Cities, Mountains, Castles, Amazing Pools, Camping, Farms, Arctic

OUTPUT ONLY valid JSON:
{
  "intent": "<intent>",
  "query": "<search keywords only, else null>",
  "category": "<category name if applicable, else null>",
  "minPrice": "<min price as string, else null>",
  "maxPrice": "<max price as string, else null>",
  "listingRef": "<listing number if booking, else null>",
  "checkIn": "<YYYY-MM-DD if mentioned, else null>",
  "checkOut": "<YYYY-MM-DD if mentioned, else null>",
  "guests": "<number as string if mentioned, else null>",
  "dateChange": null,
  "newDate": null,
  "newGuests": null,
  "navigatePage": "<'bookings','wishlist','profile','home','new-listing' if navigate, else null>"
}`;
}

function buildRespondPrompt() {
  const d = getDateContext();
  return `You are Wanderlust's AI booking assistant.

TODAY: ${d.todayStr} (${d.isoDate}) | TOMORROW: ${d.tomorrowDate}

RULES:
- Only show data provided in the context. NEVER fabricate listings.
- Available categories: Trending, Rooms, Iconic Cities, Mountains, Castles, Amazing Pools, Camping, Farms, Arctic
- Prices in INR. Be warm but concise.
- When showing listings, include the LISTING NUMBER (position in list), title, location, price.
- When booking, ask for check-in date, check-out date, and number of guests if not provided.
- For confirmations, show all booking details clearly.`;
}

const llm = new ChatGroq({
  model: "llama-3.1-8b-instant",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0.1,
});

function extractJSON(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (e) {}
  }
  return null;
}

// ── NODE: classify user intent ──
const classifyNode = async (state) => {
  const lastUserMsg = [...state.messages].reverse().find(m => {
    if (m._getType) return m._getType() === "human";
    return m.role === "human" || m.role === "user";
  });
  if (!lastUserMsg) return {};

  const userText = lastUserMsg.content || "";
  const history = state.messages.slice(-4).map(m => {
    const type = m._getType ? m._getType() : (m.role || "unknown");
    const role = type === "human" ? "user" : type === "ai" ? "assistant" : type;
    return `${role}: ${(m.content || "").substring(0, 300)}`;
  }).join("\n");

  let pendingCtx = "";
  if (state.pendingListingId) {
    pendingCtx = `\n\nNOTE: There is a pending booking for listing ID ${state.pendingListingId}. If the user is providing dates/guests without mentioning a listing, assume they mean this listing.`;
  }

  const response = await llm.invoke([
    new SystemMessage(buildClassifyPrompt() + pendingCtx),
    new HumanMessage(`CONVERSATION SO FAR:\n${history}\n\nCURRENT USER MESSAGE: ${userText}\n\nOutput JSON:`),
  ]);

  const parsed = extractJSON(response.content);
  if (parsed) {
    return { action: parsed };
  }
  return { action: { intent: "other" } };
};

// ── NODE: execute action based on classification ──
const actionNode = async (state) => {
  const act = state.action;
  if (!act) return {};

  try {
    switch (act.intent) {
      case "greeting": {
        return { actionResult: {
          type: "text",
          content: "Hi there! Welcome to Wanderlust! I can help you find amazing places to stay. What kind of getaway are you looking for? You can tell me a location, vibe (like mountains, beach, cozy), or I can show you our categories."
        }};
      }
      case "help": {
        return { actionResult: {
          type: "text",
          content: "I can help you:\n- Search for places (e.g., \"find me a cozy cabin\" or \"places in mountains\")\n- Browse categories (e.g., \"show me categories\")\n- Book a listing (e.g., \"book listing 1\")\n- Change booking dates or guests\n\nJust tell me what you're looking for!"
        }};
      }
      case "categories": {
        const categories = await Listing.aggregate([
          { $match: { category: { $ne: null, $exists: true } } },
          { $group: { _id: "$category", count: { $sum: 1 }, minPrice: { $min: "$price" }, maxPrice: { $max: "$price" } } },
          { $sort: { count: -1 } },
        ]);
        if (categories.length === 0) {
          return { actionResult: { type: "text", content: "No categories found. The database may be empty." }};
        }
        const list = categories.map((c, i) =>
          `${i + 1}. ${c._id} (${c.count} listings, Rs.${c.minPrice} - Rs.${c.maxPrice}/night)`
        ).join("\n");
        return { actionResult: { type: "text", content: `Available categories:\n${list}\n\nTell me which category interests you, or search by location/vibe!` }};
      }
      case "search": {
        const filter = {};
        if (act.query && act.query.trim()) {
          const regex = { $regex: act.query, $options: "i" };
          filter.$or = [{ title: regex }, { description: regex }, { location: regex }];
        }
        if (act.category) {
          const num = parseInt(act.category, 10);
          const validCategories = ["Trending", "Rooms", "Iconic Cities", "Mountains", "Castles", "Amazing Pools", "Camping", "Farms", "Arctic"];
          if (!isNaN(num) && num >= 1 && num <= validCategories.length) {
            filter.category = validCategories[num - 1];
          } else {
            const catRegex = new RegExp("^" + act.category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
            const matched = validCategories.find(c => catRegex.test(c));
            filter.category = matched || act.category;
          }
        }
        if (act.minPrice || act.maxPrice) {
          filter.price = {};
          if (act.minPrice) filter.price.$gte = Number(act.minPrice);
          if (act.maxPrice) filter.price.$lte = Number(act.maxPrice);
        }

        let listings = await Listing.find(filter)
          .select("title description price location country category image")
          .limit(10);

        // Fallback: try broader search with meaningful words only
        if (listings.length === 0 && act.query) {
          const stopWords = new Set(["i", "me", "my", "we", "our", "you", "your", "a", "an", "the", "in", "on", "at", "to", "for", "of", "with", "by", "from", "is", "it", "and", "or", "but", "not", "no", "do", "does", "did", "was", "were", "are", "be", "been", "has", "have", "had", "find", "show", "get", "give", "list", "all", "some", "near", "place", "places", "listing", "listings", "suggest", "looking"]);
          const words = act.query.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
          if (words.length > 0) {
            const orFilters = words.map(w => ({
              $or: [
                { title: { $regex: w, $options: "i" } },
                { description: { $regex: w, $options: "i" } },
                { location: { $regex: w, $options: "i" } },
              ]
            }));
            listings = await Listing.find({ $or: orFilters })
              .select("title description price location country category image")
              .limit(10);
          }
        }

        if (listings.length === 0) {
          return { actionResult: { type: "text", content: "No listings found matching your search. Try different keywords or browse our categories!" }};
        }

        const formatted = listings.map((l, i) =>
          `${i + 1}. ${l.title} — Rs.${l.price}/night | ${l.location}, ${l.country || ""} | Category: ${l.category} | ID: ${l._id}`
        ).join("\n");

        return { actionResult: {
          type: "listings",
          content: `Found ${listings.length} listing(s):\n\n${formatted}`,
          listings: listings.map((l, i) => ({
            number: i + 1,
            id: l._id.toString(),
            title: l.title,
            price: l.price,
            location: l.location,
            country: l.country,
            category: l.category,
            description: l.description,
          })),
        }};
      }
      case "book": {
        const ref = act.listingRef;
        let listing = null;

        // Try to find listing by ID directly
        if (ref && /^[a-f0-9]{24}$/i.test(ref)) {
          try { listing = await Listing.findById(ref); } catch (e) {}
        }

        // Try to find by title/description in recent bot messages
        if (!listing && ref) {
          const actHistory = state.messages.slice(-10);
          for (const m of actHistory) {
            if (!m.content) continue;
            const num = parseInt(ref, 10);
            if (!isNaN(num) && num >= 1) {
              const lines = m.content.split("\n");
              for (const line of lines) {
                if (line.startsWith(`${num}.`)) {
                  const idMatch = line.match(/ID:\s*([a-f0-9]{24})/i);
                  if (idMatch) {
                    try { listing = await Listing.findById(idMatch[1]); } catch (e) {}
                    if (listing) break;
                  }
                }
              }
            }
            if (listing) break;
            const titleRegex = new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            if (titleRegex.test(m.content)) {
              const idMatch = m.content.match(/ID:\s*([a-f0-9]{24})/i);
              if (idMatch) {
                try { listing = await Listing.findById(idMatch[1]); } catch (e) {}
                if (listing) break;
              }
            }
          }
        }

        // Try pending listing from previous turn
        if (!listing && state.pendingListingId) {
          try { listing = await Listing.findById(state.pendingListingId); } catch (e) {}
        }

        // Try by title search in DB
        if (!listing && ref) {
          listing = await Listing.findOne({ title: { $regex: ref, $options: "i" } });
        }

        if (!listing) {
          return { actionResult: { type: "text", content: "I couldn't find that listing. Please search first and tell me the listing number you'd like to book." }, pendingListingId: null };
        }

        if (!act.checkIn || !act.checkOut || !act.guests) {
          const missing = [];
          if (!act.checkIn) missing.push("check-in date");
          if (!act.checkOut) missing.push("check-out date");
          if (!act.guests) missing.push("number of guests");
          return { actionResult: {
            type: "booking_form",
            content: `Great choice! **${listing.title}** in ${listing.location} — Rs.${listing.price}/night.\n\nI still need: ${missing.join(", ")}.\nPlease provide: check-in date (YYYY-MM-DD), check-out date (YYYY-MM-DD), and number of guests.`,
            listingId: listing._id.toString(),
            listingTitle: listing.title,
            listingLocation: listing.location,
            pricePerNight: listing.price,
            missing,
          }, pendingListingId: listing._id.toString() };
        }

        const checkInDate = new Date(act.checkIn);
        const checkOutDate = new Date(act.checkOut);
        if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
          return { actionResult: { type: "text", content: "Invalid date format. Please use YYYY-MM-DD (e.g., 2026-08-01)." }, pendingListingId: null };
        }
        if (checkInDate >= checkOutDate) {
          return { actionResult: { type: "text", content: "Check-out date must be after check-in date." }, pendingListingId: null };
        }
        if (checkInDate < new Date()) {
          return { actionResult: { type: "text", content: "Check-in date cannot be in the past." }, pendingListingId: null };
        }

        const nights = Math.ceil((checkOutDate - checkInDate) / (86400000));
        const guests = parseInt(String(act.guests), 10) || 1;
        const totalPrice = nights * listing.price;

        const decision = interrupt({
          type: "booking_confirmation",
          booking: {
            listingId: listing._id.toString(),
            listingTitle: listing.title,
            listingLocation: listing.location,
            pricePerNight: listing.price,
            checkIn: act.checkIn,
            checkOut: act.checkOut,
            guests,
            nights,
            totalPrice,
            status: "pending_confirmation",
          },
        });

        if (decision && decision.confirmed === true) {
          const booking = new Booking({
            user: decision.userId || null,
            listing: listing._id,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            guests,
            totalPrice,
            status: "pending",
          });
          await booking.save();
          return { actionResult: {
            type: "text",
            content: `Booking confirmed!\n\n**${listing.title}** in ${listing.location}\nCheck-in: ${act.checkIn} | Check-out: ${act.checkOut}\nGuests: ${guests} | Nights: ${nights}\nTotal: Rs.${totalPrice}\n\nYou can view and pay for this booking in My Bookings.`,
          }, pendingListingId: null };
        } else {
          return { actionResult: { type: "text", content: "No worries! The booking has been cancelled. Let me know if you'd like to search for something else." }, pendingListingId: null };
        }
      }
      case "navigate": {
        const pages = {
          "bookings": { url: "/bookings/my-bookings", label: "My Bookings" },
          "wishlist": { url: "/wishlist", label: "Your Wishlist" },
          "profile": { url: "/profile", label: "Your Profile" },
          "home": { url: "/listings", label: "Explore Listings" },
          "new-listing": { url: "/listings/new", label: "Add New Listing" },
        };
        const page = pages[act.navigatePage] || pages["home"];
        return { actionResult: {
          type: "navigation",
          content: `Taking you to ${page.label}...`,
          url: page.url,
          label: page.label,
        }};
      }
      case "change_dates": {
        return { actionResult: {
          type: "text",
          content: "To change dates, please provide the new date in YYYY-MM-DD format (e.g., 2026-08-05). You can also tell me which date to change (check-in or check-out).",
        }};
      }
      case "change_guests": {
        return { actionResult: {
          type: "text",
          content: "To change the number of guests, please tell me the new number (e.g., \"3 guests\"). Note: changes to existing bookings can be made from the My Bookings page.",
        }};
      }
      default: {
        return { actionResult: {
          type: "text",
          content: "I can help you search for places, book listings, or check categories. What would you like to do?",
        }};
      }
    }
  } catch (err) {
    if (err && err.constructor && err.constructor.name === "GraphInterrupt") throw err;
    console.error("Action error:", err);
    return { actionResult: { type: "text", content: "Something went wrong. Please try again." }};
  }
};

// ── NODE: generate natural language response ──
const respondNode = async (state) => {
  const result = state.actionResult;
  if (!result) return {};

  let text = result.content;
  if (!text && result.message) text = result.message;
  if (!text) return {};

  if (typeof text !== "string") {
    text = typeof text === "object" ? JSON.stringify(text) : String(text);
  }

  return { messages: [new AIMessage(text)] };
};

// ── ROUTING ──
const routeAfterClassify = (state) => {
  if (state.action && state.action.intent === "book") return "execute";
  if (state.action && state.action.intent === "search") return "execute";
  if (state.action && state.action.intent === "categories") return "execute";
  if (state.action && state.action.intent === "greeting") return "execute";
  if (state.action && state.action.intent === "help") return "execute";
  if (state.action && state.action.intent === "navigate") return "execute";
  if (state.action && state.action.intent === "change_dates") return "execute";
  if (state.action && state.action.intent === "change_guests") return "execute";
  return "respond";
};

const graph = new StateGraph(GraphState)
  .addNode("classify", classifyNode)
  .addNode("execute", actionNode)
  .addNode("respond", respondNode)
  .addEdge(START, "classify")
  .addConditionalEdges("classify", routeAfterClassify, {
    execute: "execute",
    respond: "respond",
  })
  .addEdge("execute", "respond")
  .addEdge("respond", END);

const checkpointer = new MemorySaver();
const app = graph.compile({ checkpointer });

module.exports = { app };
