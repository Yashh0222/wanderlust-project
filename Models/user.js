const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    googleId: String,
    googleProfile: {
        name: String,
        picture: String
    },
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Listing"
    }]
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
