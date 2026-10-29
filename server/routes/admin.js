// Admin only: all users and listings, deactivate a listing, resolve deposit disputes.
const express = require("express");
const mongoose = require("mongoose");
const { User, Listing, Booking } = require("../models");
const { requireLogin, requireAdmin } = require("../auth");

const router = express.Router();

router.use(requireLogin, requireAdmin);

// GET /api/admin/users
router.get("/users", async (req, res, next) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ data: users });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/listings
router.get("/listings", async (req, res, next) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 }).populate("owner", "name");
    res.json({ data: listings });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/listings/:id/deactivate
router.patch("/listings/:id/deactivate", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Listing not found" });
    }
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }
    listing.isActive = false;
    await listing.save();
    res.json({ data: listing });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/disputes
router.get("/disputes", async (req, res, next) => {
  try {
    const bookings = await Booking.find({ depositStatus: "disputed" })
      .sort({ updatedAt: -1 })
      .populate("listing", "title")
      .populate("owner renter", "name");
    res.json({ data: bookings });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/bookings/:id/resolve  { finalDeduction, reason }
router.post("/bookings/:id/resolve", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Booking not found" });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.depositStatus !== "disputed") {
      return res.status(400).json({ message: "This booking is not disputed" });
    }
    const finalDeduction = Number(req.body.finalDeduction);
    if (!(finalDeduction >= 0) || finalDeduction > booking.deposit) {
      return res.status(400).json({ message: "Final deduction must be between 0 and the deposit (Rs " + booking.deposit + ")" });
    }
    if (typeof req.body.reason !== "string" || !req.body.reason.trim()) {
      return res.status(400).json({ message: "Please write a short reason for the decision" });
    }

    booking.adminDecision = { finalDeduction: finalDeduction, reason: req.body.reason, decidedAt: new Date() };
    if (finalDeduction > 0) {
      booking.depositStatus = "deducted";
    } else {
      booking.depositStatus = "refunded";
    }
    await booking.save();
    res.json({ data: booking });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
