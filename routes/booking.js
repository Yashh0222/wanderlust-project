const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/booking");
const { isLoggedIn } = require("../middleware");
const wrapAsync = require("../utils/wrapAsync");

router.get("/my-bookings", isLoggedIn, wrapAsync(bookingController.renderUserBookings));
router.post("/reserve/:listingId", isLoggedIn, wrapAsync(bookingController.createBooking));
router.get("/test-booking", (req, res) => res.send("Booking route works!"));
router.post("/cancel-booking/:bookingId", isLoggedIn, wrapAsync(bookingController.cancelBooking));

module.exports = router;
