const Listing = require("./Models/listing");
const Review = require("./Models/review");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");

module.exports.isLoggedIn = (req, res, next)=>{
     if(!req.isAuthenticated()){
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to create listing!");
        return res.redirect("/login");
    }
    next();
};

//this is added  bcz when a user try to crate listing he has to login and rather than goiiing to /listing
//this takes us to what we selected to do 
module.exports.saveRedirectUrl = (req, res, next) =>{
    if(req.session.redirectUrl){
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
}

//this middleware is to check the owner of everry listing 
module.exports.isOwner = async(req, res, next) =>{
    let {id} = req.params;
    let listing = await Listing.findById(id);
        if(!listing.owner.equals(res.locals.currUser._id)){
            req.flash("error", "You are not the Owner of this Listing!");
            return res.redirect(`/listings/${id}`);
        }

        next();
};

module.exports.isReviewAuthor = async(req, res, next) =>{
    let { id, reviewId } = req.params;
    let review = await Review.findById( reviewId );
        if(!review.author.equals(res.locals.currUser._id)){
            req.flash("error", "You are not the Owner of this review!");
            return res.redirect(`/listings/${id}`);
        }

        next();
};

module.exports.validateListing = (req, res, next) => {
    //if any user don not enter any data and try to submit form then 400 error
    //we will use joy to identify the schema and if any info is missing this will give error
    let { error } = listingSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

module.exports.validateReview = (req, res, next) => {
  //if any user don not enter any data and try to submit form then 400 error
  //we will use joy to identify the schema and if any info is missing this will give error
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

