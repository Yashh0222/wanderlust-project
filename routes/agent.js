const express = require("express");
const router = express.Router();
const { HumanMessage } = require("@langchain/core/messages");
const { Command, isInterrupted } = require("@langchain/langgraph");
const { app } = require("../agent/graph");
const { isLoggedIn } = require("../middleware");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function invokeWithRetry(invokeFn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await invokeFn();
    } catch (err) {
      const isRateLimit =
        (err.status === 429) ||
        (err.message && err.message.includes("rate_limit")) ||
        (err.message && err.message.includes("Rate limit"));
      if (isRateLimit && attempt < maxRetries) {
        const delay = 15000 + attempt * 10000;
        console.log(`Rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

router.post("/api/agent/chat", async (req, res) => {
  try {
    const { message, threadId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const isLoggedIn = req.isAuthenticated();
    const tid = threadId || (isLoggedIn ? "anon_" + req.ip : "anon_" + Date.now());

    const config = {
      configurable: { thread_id: tid },
    };

    const result = await invokeWithRetry(() =>
      app.invoke(
        { messages: [new HumanMessage(message)] },
        config
      )
    );

    if (isInterrupted(result)) {
      const interruptData = result.__interrupt__;
      if (interruptData && interruptData.length > 0) {
        const interruptValue = interruptData[0].value;
        if (
          interruptValue &&
          interruptValue.type === "booking_confirmation"
        ) {
          if (!isLoggedIn) {
            return res.json({
              reply: "Please log in to complete your booking. You can search and browse listings without logging in, but booking requires an account.",
              pendingBooking: null,
              threadId: tid,
            });
          }
          return res.json({
            reply: "Please confirm this booking:",
            pendingBooking: interruptValue.booking,
            threadId: tid,
          });
        }
      }
    }

    const lastMessage = result.messages[result.messages.length - 1];
    const reply =
      lastMessage && lastMessage.content
        ? lastMessage.content
        : "I'm sorry, I couldn't process that. Please try again.";

    let bookingForm = null;
    let navigation = null;
    const ar = result.actionResult;
    if (ar && ar.type === "booking_form" && result.pendingListingId) {
      if (!isLoggedIn) {
        return res.json({
          reply: "Please log in to book a listing. You can search and browse without an account, but booking requires one.",
          pendingBooking: null,
          bookingForm: null,
          navigation: null,
          threadId: tid,
        });
      }
      bookingForm = {
        listingId: ar.listingId,
        listingTitle: ar.listingTitle,
        listingLocation: ar.listingLocation,
        pricePerNight: ar.pricePerNight,
        missing: ar.missing,
      };
    }
    if (ar && ar.type === "navigation" && ar.url) {
      navigation = { url: ar.url, label: ar.label };
    }

    res.json({
      reply,
      pendingBooking: null,
      bookingForm,
      navigation,
      threadId: tid,
    });
  } catch (err) {
    console.error("Agent chat error:", err.message);
    console.error("Full error:", err);

    const isRateLimit =
      (err.status === 429) ||
      (err.message && err.message.includes("rate_limit"));

    res.status(isRateLimit ? 429 : 500).json({
      error: isRateLimit
        ? "Too many requests. Please wait a moment and try again."
        : "Something went wrong. Please try again.",
    });
  }
});

router.post("/api/agent/confirm", isLoggedIn, async (req, res) => {
  try {
    const { threadId, confirmed } = req.body;

    if (!threadId) {
      return res.status(400).json({ error: "Thread ID is required" });
    }

    const config = {
      configurable: { thread_id: threadId },
    };

    const resumeValue = confirmed
      ? { userId: req.user._id.toString(), confirmed: true }
      : { confirmed: false };

    const result = await invokeWithRetry(() =>
      app.invoke(
        new Command({ resume: resumeValue }),
        config
      )
    );

    const lastMessage = result.messages[result.messages.length - 1];
    const reply =
      lastMessage && lastMessage.content
        ? lastMessage.content
        : "Booking processed.";

    const newThreadId = "thread_" + Date.now();

    res.json({
      reply,
      pendingBooking: null,
      threadId: newThreadId,
    });
  } catch (err) {
    console.error("Agent confirm error:", err.message);
    console.error("Full error:", err);

    res.status(500).json({
      error: "Something went wrong. Please try again.",
    });
  }
});

module.exports = router;
