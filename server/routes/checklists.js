// Booking details, pickup and return checklists, and the renter's answer about the deposit.
// Mounted at /api/bookings.
const express = require("express");
const { RentalAgreement, Review, loadBookingForUser, canChangeStatus } = require("../models");
const { requireLogin } = require("../auth");

const router = express.Router();

// GET /api/bookings/:id
router.get("/:id", requireLogin, async (req, res, next) => {
  try {
    const result = await loadBookingForUser(req.params.id, req.user._id);
    if (!result.booking) {
      return res.status(result.status).json({ message: result.message });
    }
    const booking = await result.booking.populate([
      { path: "listing", select: "title imageUrl pricePerDay" },
      { path: "owner renter", select: "name city" },
    ]);
    const agreement = await RentalAgreement.findOne({ booking: booking._id });
    const review = await Review.findOne({ booking: booking._id });
    res.json({ data: { booking: booking, role: result.role, agreement: agreement, review: review } });
  } catch (error) {
    next(error);
  }
});

// PUT /api/bookings/:id/pickup - owner fills the pickup checklist, booking becomes active
router.put("/:id/pickup", requireLogin, async (req, res, next) => {
  try {
    const { booking, role, status, message } = await loadBookingForUser(req.params.id, req.user._id);
    if (!booking) {
      return res.status(status).json({ message: message });
    }
    if (role !== "owner") {
      return res.status(403).json({ message: "Only the owner fills the pickup checklist" });
    }
    if (booking.status !== "approved" && booking.status !== "active") {
      return res.status(400).json({ message: "Pickup is only possible for an approved booking" });
    }
    if (booking.pickupCheck && booking.pickupCheck.renterConfirmedAt) {
      return res.status(400).json({ message: "The renter has confirmed the pickup checklist, so it is locked" });
    }
    const agreement = await RentalAgreement.findOne({ booking: booking._id });
    if (!agreement || !agreement.ownerAcceptedAt || !agreement.renterAcceptedAt) {
      return res.status(400).json({ message: "Both owner and renter must accept the agreement before pickup" });
    }
    if (!req.body.condition) {
      return res.status(400).json({ message: "Please describe the condition at pickup" });
    }

    booking.pickupCheck = {
      condition: req.body.condition,
      defects: req.body.defects,
      accessories: req.body.accessories,
      photoUrl: req.body.photoUrl,
      notes: req.body.notes,
      recordedAt: new Date(),
    };
    if (booking.status === "approved" && canChangeStatus("approved", "active", role)) {
      booking.status = "active";
    }
    await booking.save();
    res.json({ data: booking });
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings/:id/pickup/confirm - renter confirms, which locks the pickup checklist
router.post("/:id/pickup/confirm", requireLogin, async (req, res, next) => {
  try {
    const { booking, role, status, message } = await loadBookingForUser(req.params.id, req.user._id);
    if (!booking) {
      return res.status(status).json({ message: message });
    }
    if (role !== "renter") {
      return res.status(403).json({ message: "Only the renter confirms the pickup condition" });
    }
    if (booking.status !== "active" || !booking.pickupCheck || !booking.pickupCheck.recordedAt) {
      return res.status(400).json({ message: "The owner has not filled the pickup checklist yet" });
    }
    if (booking.pickupCheck.renterConfirmedAt) {
      return res.status(400).json({ message: "You have already confirmed" });
    }
    booking.pickupCheck.renterConfirmedAt = new Date();
    await booking.save();
    res.json({ data: booking });
  } catch (error) {
    next(error);
  }
});

// PUT /api/bookings/:id/return - owner fills the return checklist, booking becomes completed
router.put("/:id/return", requireLogin, async (req, res, next) => {
  try {
    const { booking, role, status, message } = await loadBookingForUser(req.params.id, req.user._id);
    if (!booking) {
      return res.status(status).json({ message: message });
    }
    if (!canChangeStatus(booking.status, "completed", role)) {
      return res.status(400).json({ message: "Only the owner can record the return of an active booking" });
    }
    if (!booking.pickupCheck || !booking.pickupCheck.renterConfirmedAt) {
      return res.status(400).json({ message: "The renter must confirm the pickup checklist first" });
    }
    const deductionAmount = Number(req.body.deductionAmount || 0);
    if (!req.body.condition) {
      return res.status(400).json({ message: "Please describe the condition at return" });
    }
    if (!(deductionAmount >= 0) || deductionAmount > booking.deposit) {
      return res.status(400).json({ message: "Deduction must be between 0 and the deposit (Rs " + booking.deposit + ")" });
    }

    booking.returnCheck = {
      condition: req.body.condition,
      missingAccessories: req.body.missingAccessories,
      damageDescription: req.body.damageDescription,
      damagePhotoUrl: req.body.damagePhotoUrl,
      deductionAmount: deductionAmount,
      notes: req.body.notes,
      recordedAt: new Date(),
    };
    // depositStatus stays "recorded" until the renter answers
    booking.status = "completed";
    await booking.save();
    res.json({ data: booking });
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings/:id/return/respond  { response: "agree" | "disagree", comment }
router.post("/:id/return/respond", requireLogin, async (req, res, next) => {
  try {
    const { booking, role, status, message } = await loadBookingForUser(req.params.id, req.user._id);
    if (!booking) {
      return res.status(status).json({ message: message });
    }
    if (role !== "renter") {
      return res.status(403).json({ message: "Only the renter can answer the return checklist" });
    }
    if (booking.status !== "completed" || !booking.returnCheck || !booking.returnCheck.recordedAt) {
      return res.status(400).json({ message: "The owner has not recorded the return yet" });
    }
    if (booking.returnCheck.renterResponse) {
      return res.status(400).json({ message: "You have already answered" });
    }
    const response = req.body.response;
    if (response !== "agree" && response !== "disagree") {
      return res.status(400).json({ message: "Please choose Agree or Disagree" });
    }

    booking.returnCheck.renterResponse = response;
    booking.returnCheck.renterComment = req.body.comment || "";
    booking.returnCheck.respondedAt = new Date();
    if (response === "disagree") {
      booking.depositStatus = "disputed";
    } else if (booking.returnCheck.deductionAmount > 0) {
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
