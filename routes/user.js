const express = require("express");
const router = express.Router();
const User = require("../Models/user.js");
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");
const { saveRedirectUrl, isLoggedIn } = require("../middleware.js");

const userController = require("../controllers/user.js");

router.route("/signup")
  .get(userController.renderSignUpForm)
  .post(wrapAsync(userController.signup));

router.get("/verify/:token", wrapAsync(userController.verifyEmail));

router.route("/login")
  .get(userController.renderLoginForm)
  .post(saveRedirectUrl, passport.authenticate("local", { failureRedirect: "/login", failureFlash: true }), userController.login)

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    req.flash("success", "Welcome! You are now logged in with Google.");
    const redirectUrl = res.locals.redirectUrl || "/listings";
    delete res.locals.redirectUrl;
    res.redirect(redirectUrl);
  }
);

router.get("/logout", userController.logout);

router.get("/profile", isLoggedIn, wrapAsync(userController.renderProfile));

router.get("/wishlist", isLoggedIn, wrapAsync(userController.renderWishlist));

router.post("/wishlist/:id", isLoggedIn, wrapAsync(userController.addToWishlist));

router.delete("/wishlist/:id", isLoggedIn, wrapAsync(userController.removeFromWishlist));

module.exports = router;