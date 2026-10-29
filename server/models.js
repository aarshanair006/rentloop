// All Mongoose models in one file, plus the booking status rules and the agreement text.
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // bcrypt hash, never the plain password
    password: { type: String, required: true },
    city: { type: String, default: "", trim: true },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// same list as CATEGORIES in client/src/api.js
const CATEGORIES = ["Electronics", "Cameras", "Vehicles", "Books", "Fashion", "Sports"];

const listingSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    category: { type: String, required: true, enum: CATEGORIES },
    // listings.js checks it is more than 0
    pricePerDay: { type: Number, required: true, min: 0 },
    deposit: { type: Number, default: 0, min: 0 },
    city: { type: String, default: "", trim: true },
    condition: { type: String, enum: ["new", "good", "used"], default: "good" },
    imageUrl: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Listing = mongoose.model("Listing", listingSchema);

const bookingSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
    renter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true },
    totalRent: { type: Number, required: true },
    deposit: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled", "active", "completed"],
      default: "pending",
    },
    // recorded only, no real money moves
    depositStatus: {
      type: String,
      enum: ["recorded", "refunded", "deducted", "disputed"],
      default: "recorded",
    },
    // filled by the owner at pickup, locked once the renter confirms
    pickupCheck: {
      condition: String,
      defects: String,
      accessories: String, // comma separated
      photoUrl: String,
      notes: String,
      recordedAt: Date,
      renterConfirmedAt: Date,
    },
    // filled by the owner at return, then the renter agrees or disagrees
    returnCheck: {
      condition: String,
      missingAccessories: String,
      damageDescription: String,
      damagePhotoUrl: String,
      deductionAmount: Number,
      notes: String,
      recordedAt: Date,
      renterResponse: { type: String, enum: ["agree", "disagree"] },
      renterComment: String,
      respondedAt: Date,
    },
    // set by an admin when resolving a dispute
    adminDecision: {
      finalDeduction: Number,
      reason: String,
      decidedAt: Date,
    },
  },
  { timestamps: true }
);

// "owner", "renter" or null
bookingSchema.methods.roleOf = function (userId) {
  if (this.owner.toString() === userId.toString()) {
    return "owner";
  }
  if (this.renter.toString() === userId.toString()) {
    return "renter";
  }
  return null;
};

const Booking = mongoose.model("Booking", bookingSchema);

// Used by every route that works on one booking.
// Returns { booking, role } if the user is its owner or renter, otherwise { status, message }.
async function loadBookingForUser(bookingId, userId) {
  if (!mongoose.isValidObjectId(bookingId)) {
    return { status: 404, message: "Booking not found" };
  }
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return { status: 404, message: "Booking not found" };
  }
  const role = booking.roleOf(userId);
  if (!role) {
    return { status: 403, message: "This is not your booking" };
  }
  return { booking: booking, role: role };
}

// the only allowed status changes and who can make them - anything else is refused
const STATUS_RULES = {
  "pending->approved": "owner",
  "pending->rejected": "owner",
  "pending->cancelled": "renter",
  "approved->active": "owner", // when the pickup checklist is saved
  "active->completed": "owner", // when the return checklist is saved
};

function canChangeStatus(fromStatus, toStatus, role) {
  return STATUS_RULES[fromStatus + "->" + toStatus] === role;
}

// created when the owner approves; the terms are never edited after that
const agreementSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    termsText: { type: String, required: true },
    ownerAcceptedAt: { type: Date, default: null },
    renterAcceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const RentalAgreement = mongoose.model("RentalAgreement", agreementSchema);

// one rule per line; booking must have listing, owner and renter populated
function buildTermsText(booking) {
  const start = booking.startDate.toDateString();
  const end = booking.endDate.toDateString();
  return [
    "Rental agreement between " + booking.owner.name + " (owner) and " + booking.renter.name + " (renter).",
    "Item: " + booking.listing.title + ".",
    "Rental period: " + start + " to " + end + " (" + booking.days + " days).",
    "Return deadline: the item must be returned by the end of " + end + ".",
    "Total rent: Rs " + booking.totalRent + ". Deposit: Rs " + booking.deposit + " (recorded only, no real payment).",
    "Late fee: one day's rent (Rs " + booking.listing.pricePerDay + ") for every day the item is returned late.",
    "Damage: judged by comparing the pickup checklist with the return checklist. Any deduction can never be more than the deposit.",
    "Cancellation: the renter can cancel only while the request is still pending.",
  ].join("\n");
}

// unique booking = one review per booking
const reviewSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

const Review = mongoose.model("Review", reviewSchema);

module.exports = {
  User,
  Listing,
  Booking,
  RentalAgreement,
  Review,
  CATEGORIES,
  loadBookingForUser,
  canChangeStatus,
  buildTermsText,
};
