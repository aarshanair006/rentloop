// Used only on Vercel (server.js is used locally): connects to MongoDB once per warm instance,
// then hands the request to the same Express app.
const mongoose = require("mongoose");
const app = require("./app");

let connecting = null;

function sendError(res, message) {
  res.statusCode = 500;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ message: message }));
}

module.exports = async function handler(req, res) {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    return sendError(res, "MONGO_URI or JWT_SECRET is not set in the Vercel project settings");
  }
  try {
    if (!connecting) connecting = mongoose.connect(process.env.MONGO_URI);
    await connecting;
  } catch (error) {
    connecting = null;
    console.error("Could not connect to MongoDB:", error.message);
    return sendError(res, "Could not connect to the database");
  }
  return app(req, res);
};
