const Booking = require("../Models/booking");
const Listing = require("../Models/listing");

module.exports.createBooking = async (req, res) => {
    try {
        const { listingId } = req.params;
        const { checkIn, checkOut, guests } = req.body;

        const listing = await Listing.findById(listingId);
        if (!listing) {
            req.flash("error", "Listing not found");
            return res.redirect(`/listings/${listingId}`);
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        if (checkInDate >= checkOutDate) {
            req.flash("error", "Check-out date must be after check-in date");
            return res.redirect(`/listings/${listingId}`);
        }

        if (checkInDate < new Date()) {
            req.flash("error", "Check-in date cannot be in the past");
            return res.redirect(`/listings/${listingId}`);
        }

        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        const totalPrice = nights * listing.price;

        const booking = new Booking({
            user: req.user._id,
            listing: listingId,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            guests: parseInt(guests),
            totalPrice,
            status: "pending"
        });

        await booking.save();

        req.flash("success", "Booking created! Please complete payment.");
        res.redirect(`/my-bookings?pending=${booking._id}`);
    } catch (e) {
        console.log(e);
        req.flash("error", "Something went wrong");
        res.redirect(`/listings/${req.params.listingId}`);
    }
};

module.exports.renderUserBookings = async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate("listing")
        .sort({ createdAt: -1 });

    res.render("bookings/index.ejs", { bookings });
};

module.exports.cancelBooking = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ _id: bookingId, user: req.user._id });

    if (!booking) {
        req.flash("error", "Booking not found");
        return res.redirect("/my-bookings");
    }

    booking.status = "cancelled";
    await booking.save();

    req.flash("success", "Booking cancelled");
    res.redirect("/my-bookings");
};
