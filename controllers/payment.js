const Razorpay = require("razorpay");
const Booking = require("../Models/booking");
const Listing = require("../Models/listing");

const razorpay = new Razorpay({
    key_id: "rzp_test_SpND9HiHlg8y9r",
    key_secret: "5K4sSLEYyQ9SjwTPc0WBc0Yb"
});

module.exports.createOrder = async (req, res) => {
    try {
        const { listingId, checkIn, checkOut, guests } = req.body;
        
        const listing = await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ error: "Listing not found" });
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        if (checkInDate >= checkOutDate) {
            return res.status(400).json({ error: "Check-out date must be after check-in date" });
        }

        if (checkInDate < new Date()) {
            return res.status(400).json({ error: "Check-in date cannot be in the past" });
        }

        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        const totalPrice = nights * listing.price;
        const amountInPaise = Math.round(totalPrice * 100);

        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: `booking_${Date.now()}`,
            notes: {
                listingId: listingId,
                userId: req.user._id.toString(),
                checkIn: checkIn,
                checkOut: checkOut,
                guests: guests
            }
        };

        const order = await razorpay.orders.create(options);
        
        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            bookingDetails: {
                listingId,
                checkIn,
                checkOut,
                guests,
                totalPrice
            }
        });
    } catch (error) {
        console.error("Error creating order:", error.message);
        res.status(500).json({ error: "Failed to create payment order: " + error.message });
    }
};

module.exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingDetails } = req.body;

        const crypto = require("crypto");
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "5K4sSLEYyQ9SjwTPc0WBc0Yb")
            .update(razorpay_order_id + "." + razorpay_payment_id)
            .digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ error: "Payment verification failed" });
        }

        const { listingId, checkIn, checkOut, guests, totalPrice } = bookingDetails;

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        const booking = new Booking({
            user: req.user._id,
            listing: listingId,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            guests: parseInt(guests),
            totalPrice: totalPrice,
            status: "confirmed",
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id
        });

        await booking.save();

        req.flash("success", "Booking confirmed and payment successful!");
        res.json({ success: true, bookingId: booking._id });
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: "Payment verification failed" });
    }
};

module.exports.createPaymentOrderForBooking = async (req, res) => {
    try {
        const { bookingId } = req.body;

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        if (booking.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorized" });
        }

        if (booking.status !== "pending") {
            return res.status(400).json({ error: "Booking is not pending payment" });
        }

        const amountInPaise = Math.round(booking.totalPrice * 100);

        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: `booking_${booking._id}`,
            notes: {
                bookingId: bookingId.toString()
            }
        };

        const order = await razorpay.orders.create(options);

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency
        });
    } catch (error) {
        console.error("Error creating payment order:", error.message);
        res.status(500).json({ error: "Failed to create payment order: " + error.message });
    }
};

module.exports.verifyBookingPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

        const crypto = require("crypto");
        const keySecret = process.env.RAZORPAY_KEY_SECRET || "5K4sSLEYyQ9SjwTPc0WBc0Yb";

        const signaturePayload = razorpay_order_id + "|" + razorpay_payment_id;
        const generatedSignature = crypto
            .createHmac("sha256", keySecret)
            .update(signaturePayload)
            .digest("hex");

        console.log("Generated:", generatedSignature);
        console.log("Received:", razorpay_signature);

        if (generatedSignature !== razorpay_signature) {
            console.log("Signature mismatch!");
            return res.status(400).json({ error: "Payment verification failed" });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        booking.status = "confirmed";
        booking.paymentId = razorpay_payment_id;
        booking.orderId = razorpay_order_id;
        await booking.save();

        req.flash("success", "Payment successful! Booking confirmed.");
        res.json({ success: true });
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: "Payment verification failed" });
    }
};