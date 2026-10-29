// Entry point: checks .env, connects to MongoDB and starts the API on PORT (5000).
require("dotenv").config();
const mongoose = require("mongoose");
const app = require("./app");

const port = process.env.PORT || 5000;

async function startServer() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.log("MONGO_URI or JWT_SECRET is missing. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
    app.listen(port, () => console.log("Server running on http://localhost:" + port));
  } catch (error) {
    console.log("Could not connect to MongoDB:", error.message);
    process.exit(1);
  }
}

startServer();
