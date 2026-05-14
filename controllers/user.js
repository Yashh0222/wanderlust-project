const User = require("../Models/user");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const createTransporter = async () => {
    return nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

const transporterPromise = createTransporter();

module.exports.renderSignUpForm = (req, res) => {
    res.render("Users/signup.ejs");
};

module.exports.signup = async (req, res, next) => {
    try {
        let { username, email, password } = req.body;
        const verificationToken = crypto.randomBytes(32).toString("hex");
        
        const newUser = new User({ 
            email, 
            username,
            verificationToken,
            verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000
        });
        
        const registeredUser = await User.register(newUser, password);
        
        const verifyUrl = `${process.env.BASE_URL}/verify/${verificationToken}`;
        
        const transporter = await transporterPromise;
        
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Verify your email - Wanderlust",
            html: `<h3>Welcome to Wanderlust!</h3>
                   <p>Please click the link below to verify your email:</p>
                   <a href="${verifyUrl}">${verifyUrl}</a>
                   <p>This link expires in 24 hours.</p>`
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        
        req.flash("success", `Account created! <a href="${previewUrl}" target="_blank">Click here to verify email</a>`);
        res.redirect("/listings");
    } catch (e) {
        console.log(e);
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};

module.exports.verifyEmail = async (req, res) => {
    const { token } = req.params;
    const user = await User.findOne({
        verificationToken: token,
        verificationTokenExpires: { $gt: Date.now() }
    });
    
    if (!user) {
        req.flash("error", "Invalid or expired verification token.");
        return res.redirect("/signup");
    }
    
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();
    
    req.flash("success", "Email verified! You can now log in.");
    res.redirect("/login");
};

module.exports.renderLoginForm = (req, res) => {
    res.render("Users/login.ejs");
};

module.exports.login = async (req, res, next) => {
    const user = await User.findOne({ username: req.body.username });
    
    if (user && !user.isVerified) {
        req.flash("error", "Please verify your email first.");
        return res.redirect("/login");
    }
    
    req.flash("success", "Welcome back to Wanderlust!");
    let redirectUrl = res.locals.redirectUrl || "/listings";    
    res.redirect(redirectUrl);
};

module.exports.logout = (req, res , next) =>{
    req.logout((err) =>{
        if(err){
            return next(err);
        }
        req.flash("success", "you are logged out!");
        res.redirect("/listings");
    })
};

module.exports.renderProfile = async (req, res) => {
    const user = await User.findById(req.user._id).populate("wishlist");
    res.render("Users/profile.ejs", { user });
};

module.exports.addToWishlist = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    
    if (!user.wishlist.includes(id)) {
        user.wishlist.push(id);
        await user.save();
        req.flash("success", "Added to wishlist!");
    } else {
        req.flash("info", "Already in wishlist!");
    }
    res.redirect(`/listings/${id}`);
};

module.exports.removeFromWishlist = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    
    user.wishlist = user.wishlist.filter(listingId => listingId.toString() !== id);
    await user.save();
    
    req.flash("success", "Removed from wishlist!");
    res.redirect("/wishlist");
};

module.exports.renderWishlist = async (req, res) => {
    const user = await User.findById(req.user._id).populate("wishlist");
    res.render("Users/wishlist.ejs", { wishlist: user.wishlist });
};