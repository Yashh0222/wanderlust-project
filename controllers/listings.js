const Listing = require("../Models/listing");
const axios = require("axios");
const cloudinary = require("../cloudConfig");
const fs = require("fs");

module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index.ejs", { allListings });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: { path: "author" }
    })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing you requested does not exist");
    return res.redirect("/listings");
  }

  const safeListing = {
    _id: listing._id,
    title: listing.title,
    description: listing.description,
    image: listing.image,
    price: listing.price,
    location: listing.location,
    country: listing.country,
    owner: listing.owner,
    geometry: listing.geometry,
    reviews: listing.reviews
  };

  res.render("listings/show.ejs", { listing: safeListing });
};

module.exports.createListing = async (req, res) => {
  const { listing } = req.body;

  const geoResponse = await axios.get(
    "https://nominatim.openstreetmap.org/search",
    {
      params: {
        q: listing.location,
        format: "json",
        limit: 1
      },
      headers: {
        "User-Agent": "WanderlustProject (koparkaryash41@gmail.com)"
      }
    }
  );

  let coords = [0, 0];
  if (geoResponse.data.length > 0) {
    const place = geoResponse.data[0];
    coords = [parseFloat(place.lon), parseFloat(place.lat)];
  }

  const newListing = new Listing(listing);
  newListing.owner = req.user._id;

  newListing.geometry = {
    type: "Point",
    coordinates: coords
  };

  if (req.file) {
    newListing.image = {
      url: "/" + req.file.path.replace(/\\/g, "/"),
      filename: req.file.filename
    };
  }

  await newListing.save();
  res.redirect(`/listings/${newListing._id}`);
};

module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing does not exist");
    return res.redirect("/listings");
  }

  res.render("listings/edit.ejs", { listing });
};

module.exports.updateListing = async (req, res) => {
  const { id } = req.params;
  const { listing } = req.body;

  const updatedListing = await Listing.findByIdAndUpdate(id, listing, { new: true });

  // re-geocode new location
  if (listing.location) {
    const geoResponse = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: listing.location,
          format: "json",
          limit: 1
        },
        headers: {
          "User-Agent": "WanderlustProject (koparkaryash41@gmail.com)"
        }
      }
    );

    if (geoResponse.data.length > 0) {
      const place = geoResponse.data[0];

      updatedListing.geometry = {
        type: "Point",
        coordinates: [
          parseFloat(place.lon),
          parseFloat(place.lat)
        ]
      };
    }
  }

  // handle new image if uploaded
  if (req.file) {
    updatedListing.image = {
      url: "/" + req.file.path.replace(/\\/g, "/"),
      filename: req.file.filename
    };
  }

  // save changes
  await updatedListing.save();
  res.redirect(`/listings/${updatedListing._id}`);
};

module.exports.destroyListing = async (req, res) => {
  const { id } = req.params;
  await Listing.findByIdAndDelete(id);

  req.flash("success", "Listing Deleted!");
  res.redirect("/listings");
};
