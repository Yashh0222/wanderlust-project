const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment");
const { isLoggedIn } = require("../middleware");
const wrapAsync = require("../utils/wrapAsync");

router.post("/create-order", isLoggedIn, wrapAsync(paymentController.createOrder));
router.post("/verify-payment", isLoggedIn, wrapAsync(paymentController.verifyPayment));
router.post("/create-payment-order", isLoggedIn, wrapAsync(paymentController.createPaymentOrderForBooking));
router.post("/verify-booking-payment", isLoggedIn, wrapAsync(paymentController.verifyBookingPayment));

module.exports = router;