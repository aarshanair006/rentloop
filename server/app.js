// The Express app: middleware, routes and the error handler.
// Kept apart from server.js so the tests can start it without the real database.
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

// In production set CLIENT_URL so only our own frontend can call the API from a browser.
// Without it (local development) any origin is allowed.
app.use(cors(process.env.CLIENT_URL ? { origin: process.env.CLIENT_URL } : {}));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (req, res) => {
  const isDatabaseConnected = mongoose.connection.readyState === 1;
  res.json({ data: { server: "running", database: isDatabaseConnected ? "connected" : "not connected" } });
});

app.use("/api/users", require("./routes/users"));
app.use("/api/listings", require("./routes/listings"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/bookings", require("./routes/checklists"));
app.use("/api/agreements", require("./routes/agreements"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/admin", require("./routes/admin"));

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Every route passes unexpected errors here with next(error).
// The full error goes to the server log; the user only gets a short, safe message.
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "The request body is not valid JSON" });
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: "Some of the details you sent are not valid" });
  }
  // a unique index was hit, e.g. two sign-ups with the same email at the same moment
  if (error.code === 11000) {
    return res.status(409).json({ message: "This already exists. Please refresh and try again." });
  }
  console.error(new Date().toISOString(), req.method, req.originalUrl, error);
  res.status(500).json({ message: "Something went wrong on the server. Please try again." });
});

module.exports = app;
