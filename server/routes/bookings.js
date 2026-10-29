// Bookings: request an item, my bookings, requests for my items, approve/reject/cancel.
const express = require("express");
const mongoose = require("mongoose");
const { Listing, Booking, RentalAgreement, loadBookingForUser, canChangeStatus, buildTermsText } = require("../models");
const { requireLogin } = require("../auth");

const router = express.Router();
const ONE_DAY = 24 * 60 * 60 * 1000;

// today as "YYYY-MM-DD" (the en-CA locale prints dates in that format)
function todayText() {
  return new Date().toLocaleDateString("en-CA");
}

// "2026-02-31" matches the YYYY-MM-DD pattern, but new Date() quietly turns it into 3 March,
// so we convert it back and make sure we get the same text
function isRealDate(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }
  const date = new Date(text);
  return !isNaN(date) && date.toISOString().slice(0, 10) === text;
}

// two bookings overlap if existing.start <= new.end AND existing.end >= new.start
async function findOverlap(listingId, startDate, endDate, ignoreBookingId) {
  return Booking.findOne({
    _id: { $ne: ignoreBookingId },
    listing: listingId,
    status: { $in: ["approved", "active"] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });
}

// POST /api/bookings  { listingId, startDate, endDate }
router.post("/", requireLogin, async (req, res, next) => {
  try {
    const { listingId, startDate, endDate } = req.body;
    if (!isRealDate(startDate) || !isRealDate(endDate)) {
      return res.status(400).json({ message: "Please choose a valid start and end date" });
    }
    if (startDate < todayText()) {
      return res.status(400).json({ message: "Start date cannot be in the past" });
    }
    if (endDate < startDate) {
      return res.status(400).json({ message: "End date cannot be before start date" });
    }

    if (!mongoose.isValidObjectId(listingId)) {
      return res.status(404).json({ message: "Listing not found" });
    }
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }
    if (!listing.isActive) {
      return res.status(400).json({ message: "This item is not available right now" });
    }
    if (listing.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot rent your own item" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (await findOverlap(listing._id, start, end, null)) {
      return res.status(400).json({ message: "The item is already booked for some of these dates" });
    }

    // both days count, so 1st to 3rd = 3 days
    const days = Math.round((end - start) / ONE_DAY) + 1;
    const booking = await Booking.create({
      listing: listing._id,
      renter: req.user._id,
      owner: listing.owner,
      startDate: start,
      endDate: end,
      days: days,
      totalRent: days * listing.pricePerDay,
      deposit: listing.deposit,
    });
    res.status(201).json({ data: booking });
  } catch (error) {
    next(error);
  }
});

// GET /api/bookings/mine - bookings I made as a renter
router.get("/mine", requireLogin, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ renter: req.user._id })
      .sort({ createdAt: -1 })
      .populate("listing", "title imageUrl")
      .populate("owner", "name");
    res.json({ data: bookings });
  } catch (error) {
    next(error);
  }
});

// GET /api/bookings/requests - requests for my items
router.get("/requests", requireLogin, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .populate("listing", "title imageUrl")
      .populate("renter", "name city");
    res.json({ data: bookings });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/bookings/:id/status  { status: "approved" | "rejected" | "cancelled" }
router.patch("/:id/status", requireLogin, async (req, res, next) => {
  try {
    const newStatus = req.body.status;
    const { booking, role, status, message } = await loadBookingForUser(req.params.id, req.user._id);
    if (!booking) {
      return res.status(status).json({ message: message });
    }
    if (newStatus === "active" || newStatus === "completed") {
      return res.status(400).json({ message: "Use the pickup / return checklist to change to this status" });
    }
    if (!canChangeStatus(booking.status, newStatus, role)) {
      return res.status(400).json({ message: "You cannot change this booking from " + booking.status + " to " + newStatus });
    }

    // The status is part of the filter, so this only works if nobody changed the booking
    // since we read it. Otherwise a cancel and an approve sent together could overwrite each other.
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: booking.status },
      { status: newStatus },
      { new: true }
    );
    if (!updated) {
      return res.status(409).json({ message: "This booking was just changed by someone else. Please refresh the page." });
    }

    if (newStatus === "approved") {
      // Approve first, then look for a clash, and undo if there is one. If two overlapping
      // requests are approved at the same moment, the one that checks second always sees the
      // first, so the item can never be double-booked. A plain "check, then save" can't promise that.
      if (await findOverlap(updated.listing, updated.startDate, updated.endDate, updated._id)) {
        await Booking.updateOne({ _id: updated._id, status: "approved" }, { status: "pending" });
        return res.status(400).json({ message: "Another approved booking already uses these dates" });
      }
      const fullBooking = await Booking.findById(updated._id).populate("listing").populate("owner renter", "name");
      await RentalAgreement.create({ booking: updated._id, termsText: buildTermsText(fullBooking) });
    }

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
