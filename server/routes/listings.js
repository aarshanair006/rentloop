// Listings: search, view, add, edit, delete. Only the owner can edit or delete.
const express = require("express");
const mongoose = require("mongoose");
const { Listing, Booking, CATEGORIES } = require("../models");
const { requireLogin } = require("../auth");

const router = express.Router();

// returns an error message, or "" if the form is fine
function checkListingInput(body) {
  if (typeof body.title !== "string" || !body.title.trim()) {
    return "Title is required";
  }
  if (!CATEGORIES.includes(body.category)) {
    return "Please choose a valid category";
  }
  if (!["new", "good", "used"].includes(body.condition)) {
    return "Condition must be new, good or used";
  }
  if (!(Number(body.pricePerDay) > 0)) {
    return "Price per day must be more than 0";
  }
  if (!(Number(body.deposit) >= 0)) {
    return "Deposit cannot be negative";
  }
  if (typeof body.imageUrl !== "string" || !/^https?:\/\//i.test(body.imageUrl.trim())) {
    return "Image URL must start with http:// or https://";
  }
  return "";
}

// only copy fields the user is allowed to set (so nobody can change "owner")
function pickListingFields(body) {
  return {
    title: body.title,
    description: body.description,
    category: body.category,
    pricePerDay: Number(body.pricePerDay),
    deposit: Number(body.deposit),
    city: body.city,
    condition: body.condition,
    imageUrl: body.imageUrl,
    isActive: body.isActive !== false,
  };
}

// GET /api/listings?search=&category=&minPrice=&maxPrice=&sort=
router.get("/", async (req, res, next) => {
  try {
    // Express turns ?search=a&search=b into an array and ?category[$ne]=x into an object,
    // so anything that is not plain text is ignored
    const query = {};
    for (const key of ["search", "category", "minPrice", "maxPrice", "sort"]) {
      query[key] = typeof req.query[key] === "string" ? req.query[key] : "";
    }
    const { search, category, minPrice, maxPrice, sort } = query;
    const filter = { isActive: true };

    if (search) {
      // escape regex characters so searching "c++" doesn't break
      const safeText = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = { $regex: safeText, $options: "i" };
    }
    if (category) {
      filter.category = category;
    }
    if (minPrice || maxPrice) {
      filter.pricePerDay = {};
      if (minPrice) {
        filter.pricePerDay.$gte = Number(minPrice);
      }
      if (maxPrice) {
        filter.pricePerDay.$lte = Number(maxPrice);
      }
    }

    let sortOrder = { createdAt: -1 };
    if (sort === "priceLow") {
      sortOrder = { pricePerDay: 1 };
    }
    if (sort === "priceHigh") {
      sortOrder = { pricePerDay: -1 };
    }

    const listings = await Listing.find(filter).sort(sortOrder).populate("owner", "name city");
    res.json({ data: listings });
  } catch (error) {
    next(error);
  }
});

// GET /api/listings/mine
router.get("/mine", requireLogin, async (req, res, next) => {
  try {
    const listings = await Listing.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json({ data: listings });
  } catch (error) {
    next(error);
  }
});

// GET /api/listings/:id
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Listing not found" });
    }
    const listing = await Listing.findById(req.params.id).populate("owner", "name city");
    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }
    res.json({ data: listing });
  } catch (error) {
    next(error);
  }
});

// POST /api/listings
router.post("/", requireLogin, async (req, res, next) => {
  try {
    const inputError = checkListingInput(req.body);
    if (inputError) {
      return res.status(400).json({ message: inputError });
    }
    const listing = await Listing.create({ ...pickListingFields(req.body), owner: req.user._id });
    res.status(201).json({ data: listing });
  } catch (error) {
    next(error);
  }
});

// returns { listing } if the user owns it, otherwise { status, message }
async function findOwnListing(listingId, userId) {
  if (!mongoose.isValidObjectId(listingId)) {
    return { status: 404, message: "Listing not found" };
  }
  const listing = await Listing.findById(listingId);
  if (!listing) {
    return { status: 404, message: "Listing not found" };
  }
  if (listing.owner.toString() !== userId.toString()) {
    return { status: 403, message: "You can only change your own listings" };
  }
  return { listing: listing };
}

// PUT /api/listings/:id
router.put("/:id", requireLogin, async (req, res, next) => {
  try {
    const result = await findOwnListing(req.params.id, req.user._id);
    if (!result.listing) {
      return res.status(result.status).json({ message: result.message });
    }
    const inputError = checkListingInput(req.body);
    if (inputError) {
      return res.status(400).json({ message: inputError });
    }
    Object.assign(result.listing, pickListingFields(req.body));
    await result.listing.save();
    res.json({ data: result.listing });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/listings/:id
router.delete("/:id", requireLogin, async (req, res, next) => {
  try {
    const result = await findOwnListing(req.params.id, req.user._id);
    if (!result.listing) {
      return res.status(result.status).json({ message: result.message });
    }
    // keep items that were ever booked, otherwise old bookings and reviews lose their item
    const anyBooking = await Booking.findOne({ listing: result.listing._id });
    if (anyBooking) {
      return res.status(400).json({ message: "This item has rental history, so it cannot be deleted. Pause it instead." });
    }
    await result.listing.deleteOne();
    res.json({ data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
