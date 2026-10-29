// Register, login and "me".
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { requireLogin } = require("../auth");

const router = express.Router();

// After 5 wrong passwords for the same email from the same IP, login is blocked for 15 minutes.
// This is kept in memory, so it resets when the server restarts.
const MAX_FAILED_LOGINS = 5;
const BLOCK_TIME = 15 * 60 * 1000;
const failedLogins = new Map(); // "email|ip" -> { count, firstFailedAt }

function isBlocked(key) {
  const entry = failedLogins.get(key);
  if (!entry) {
    return false;
  }
  if (Date.now() - entry.firstFailedAt > BLOCK_TIME) {
    failedLogins.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILED_LOGINS;
}

function recordFailedLogin(key) {
  const entry = failedLogins.get(key);
  if (entry) {
    entry.count = entry.count + 1;
  } else {
    failedLogins.set(key, { count: 1, firstFailedAt: Date.now() });
  }
}

// what we send back to the frontend - never the password
function publicUser(user) {
  return { _id: user._id, name: user.name, email: user.email, city: user.city, isAdmin: user.isAdmin };
}

function makeToken(user) {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function isText(value) {
  return typeof value === "string" && value.trim() !== "";
}

// POST /api/users/register
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, city } = req.body;
    if (!isText(name) || !isText(email) || !isText(password)) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }
    // bcrypt only looks at the first 72 bytes of a password
    if (password.length < 6 || password.length > 72) {
      return res.status(400).json({ message: "Password must be 6 to 72 characters" });
    }

    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "This email is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name,
      email: email,
      password: hashedPassword,
      city: typeof city === "string" ? city : "",
    });
    res.status(201).json({ data: { token: makeToken(user), user: publicUser(user) } });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!isText(email) || !isText(password)) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const attemptKey = email.trim().toLowerCase() + "|" + req.ip;
    if (isBlocked(attemptKey)) {
      return res.status(429).json({ message: "Too many wrong attempts. Please wait 15 minutes and try again." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    const isPasswordCorrect = user && (await bcrypt.compare(password, user.password));
    // same message for wrong email and wrong password
    if (!isPasswordCorrect) {
      recordFailedLogin(attemptKey);
      return res.status(401).json({ message: "Wrong email or password" });
    }

    failedLogins.delete(attemptKey);
    res.json({ data: { token: makeToken(user), user: publicUser(user) } });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/me
router.get("/me", requireLogin, (req, res) => {
  res.json({ data: publicUser(req.user) });
});

module.exports = router;
