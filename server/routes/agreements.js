// Rental agreement: view it and accept it. It is created in bookings.js when the owner approves.
const express = require("express");
const { RentalAgreement, loadBookingForUser } = require("../models");
const { requireLogin } = require("../auth");

const router = express.Router();

// returns { booking, agreement, role } or { status, message }
async function loadAgreement(bookingId, userId) {
  const result = await loadBookingForUser(bookingId, userId);
  if (!result.booking) {
    return result;
  }
  const agreement = await RentalAgreement.findOne({ booking: result.booking._id });
  if (!agreement) {
    return { status: 404, message: "No agreement yet. It is created when the owner approves the request." };
  }
  return { booking: result.booking, agreement: agreement, role: result.role };
}

// GET /api/agreements/:bookingId
router.get("/:bookingId", requireLogin, async (req, res, next) => {
  try {
    const result = await loadAgreement(req.params.bookingId, req.user._id);
    if (!result.agreement) {
      return res.status(result.status).json({ message: result.message });
    }
    await result.booking.populate("listing", "title");
    res.json({ data: { agreement: result.agreement, booking: result.booking, role: result.role } });
  } catch (error) {
    next(error);
  }
});

// POST /api/agreements/:bookingId/accept
router.post("/:bookingId/accept", requireLogin, async (req, res, next) => {
  try {
    const result = await loadAgreement(req.params.bookingId, req.user._id);
    if (!result.agreement) {
      return res.status(result.status).json({ message: result.message });
    }
    const { agreement, role } = result;

    if (role === "owner") {
      if (agreement.ownerAcceptedAt) {
        return res.status(400).json({ message: "You have already accepted" });
      }
      agreement.ownerAcceptedAt = new Date();
    }
    if (role === "renter") {
      if (agreement.renterAcceptedAt) {
        return res.status(400).json({ message: "You have already accepted" });
      }
      agreement.renterAcceptedAt = new Date();
    }
    await agreement.save();
    res.json({ data: agreement });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
