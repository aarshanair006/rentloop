// Reviews: the renter of a completed booking can review it once.
const express = require("express");
const mongoose = require("mongoose");
const { Booking, Review } = require("../models");
const { requireLogin } = require("../auth");

const router = express.Router();

// POST /api/reviews  { bookingId, rating, comment }
router.post("/", requireLogin, async (req, res, next) => {
  try {
    const { bookingId, comment } = req.body;
    const rating = Number(req.body.rating);
    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(404).json({ message: "Booking not found" });
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.renter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the renter of this booking can review it" });
    }
    if (booking.status !== "completed") {
      return res.status(400).json({ message: "You can review only after the rental is completed" });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be a whole number from 1 to 5" });
    }
    const existingReview = await Review.findOne({ booking: booking._id });
    if (existingReview) {
      return res.status(400).json({ message: "You have already reviewed this booking" });
    }

    const review = await Review.create({
      booking: booking._id,
      listing: booking.listing,
      reviewer: req.user._id,
      rating: rating,
      comment: comment,
    });
    res.status(201).json({ data: review });
  } catch (error) {
    next(error);
  }
});

// GET /api/reviews/listing/:listingId
router.get("/listing/:listingId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.listingId)) {
      return res.status(404).json({ message: "Listing not found" });
    }
    const reviews = await Review.find({ listing: req.params.listingId })
      .sort({ createdAt: -1 })
      .populate("reviewer", "name");

    let averageRating = 0;
    if (reviews.length > 0) {
      let total = 0;
      for (const review of reviews) {
        total = total + review.rating;
      }
      averageRating = Math.round((total / reviews.length) * 10) / 10;
    }
    res.json({ data: { reviews: reviews, averageRating: averageRating } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
