// Middleware for protected routes: requireLogin checks the JWT, requireAdmin checks isAdmin.
const jwt = require("jsonwebtoken");
const { User } = require("./models");

async function requireLogin(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please log in first" });
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired login, please log in again" });
  }
}

// use after requireLogin
function requireAdmin(req, res, next) {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Admins only" });
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
