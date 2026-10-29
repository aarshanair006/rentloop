// Demo data: run "node seed.js". Removes old @rentloop.demo users and everything linked to them first.
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { User, Listing, Booking, RentalAgreement, Review, buildTermsText } = require("./models");

const DEMO_PASSWORD = "demo1234";

const demoUsers = [
  { name: "Priya Sharma", email: "priya@rentloop.demo", city: "Pune", isAdmin: false },
  { name: "Arjun Mehta", email: "arjun@rentloop.demo", city: "Pune", isAdmin: false },
  { name: "Neha Admin", email: "admin@rentloop.demo", city: "Mumbai", isAdmin: true },
];

function unsplash(photoId) {
  return "https://images.unsplash.com/photo-" + photoId + "?w=600&q=80";
}

// ownerIndex: 0 = Priya, 1 = Arjun
const demoListings = [
  { ownerIndex: 0, title: "Canon DSLR Camera", category: "Cameras", pricePerDay: 600, deposit: 5000, condition: "good", image: "1516035069371-29a1b244cc32", description: "Canon DSLR with 18-55mm lens, battery and charger." },
  { ownerIndex: 0, title: "Mirrorless Camera Kit", category: "Cameras", pricePerDay: 800, deposit: 8000, condition: "new", image: "1502920917128-1aa500764cbd", description: "Light mirrorless camera, great for travel photos." },
  { ownerIndex: 1, title: "Camera Drone", category: "Cameras", pricePerDay: 900, deposit: 10000, condition: "good", image: "1473968512647-3e447244af8f", description: "Drone with 4K camera and two batteries." },
  { ownerIndex: 0, title: "Laptop for Projects", category: "Electronics", pricePerDay: 400, deposit: 6000, condition: "used", image: "1496181133206-80ce9b88a853", description: "Core i5 laptop, 8GB RAM. Good for coding and presentations." },
  { ownerIndex: 1, title: "Wireless Headphones", category: "Electronics", pricePerDay: 100, deposit: 1000, condition: "good", image: "1505740420928-5e560c06d30e", description: "Over-ear headphones with long battery life." },
  { ownerIndex: 1, title: "Bluetooth Party Speaker", category: "Electronics", pricePerDay: 250, deposit: 2000, condition: "good", image: "1608043152269-423dbba4e7e1", description: "Loud speaker for parties and events." },
  { ownerIndex: 0, title: "Office Laptop (Light)", category: "Electronics", pricePerDay: 350, deposit: 5000, condition: "good", image: "1593642632559-0c6d3fc62b89", description: "Thin laptop with charger, perfect for online exams." },
  { ownerIndex: 0, title: "City Bicycle", category: "Vehicles", pricePerDay: 80, deposit: 1000, condition: "used", image: "1485965120184-e220f721d03e", description: "Simple city cycle with a basket. Lock included." },
  { ownerIndex: 1, title: "Road Bike", category: "Vehicles", pricePerDay: 200, deposit: 3000, condition: "good", image: "1532298229144-0ec0c57515c7", description: "Lightweight road bike for long rides." },
  { ownerIndex: 1, title: "Motorbike for Weekend Trips", category: "Vehicles", pricePerDay: 700, deposit: 7000, condition: "good", image: "1558981806-ec527fa84c39", description: "Valid papers. Helmet included. Driving licence needed." },
  { ownerIndex: 0, title: "Novel Collection (10 books)", category: "Books", pricePerDay: 30, deposit: 500, condition: "used", image: "1512820790803-83ca734da794", description: "Ten popular novels, rent all of them together." },
  { ownerIndex: 1, title: "Engineering Textbooks Set", category: "Books", pricePerDay: 40, deposit: 800, condition: "good", image: "1495446815901-a7297e633e8d", description: "Third-year B.Tech textbooks for exam season." },
  { ownerIndex: 0, title: "Party Dress", category: "Fashion", pricePerDay: 300, deposit: 1500, condition: "new", image: "1595777457583-95e059d581b8", description: "Elegant dress for weddings and parties. Size M." },
  { ownerIndex: 1, title: "Formal Suit", category: "Fashion", pricePerDay: 350, deposit: 2000, condition: "good", image: "1507679799987-c73779587ccf", description: "Two-piece suit, size 40. Good for interviews and functions." },
  { ownerIndex: 0, title: "Camping Tent (4 person)", category: "Sports", pricePerDay: 150, deposit: 1500, condition: "good", image: "1504280390367-361c6d9f38f4", description: "Waterproof tent for four people, easy to set up." },
];

// n days from today at midnight UTC, same as the app stores dates
function daysFromToday(n) {
  const today = new Date(new Date().toLocaleDateString("en-CA"));
  return new Date(today.getTime() + n * 24 * 60 * 60 * 1000);
}

async function createDemoBooking(renter, listing, startOffset, endOffset, extraFields) {
  const days = endOffset - startOffset + 1;
  return Booking.create({
    listing: listing._id,
    renter: renter._id,
    owner: listing.owner,
    startDate: daysFromToday(startOffset),
    endDate: daysFromToday(endOffset),
    days: days,
    totalRent: days * listing.pricePerDay,
    deposit: listing.deposit,
    ...extraFields,
  });
}

// Expects an open mongoose connection. Also used by the tests in tests/api.test.js.
async function seedDemoData() {
  // remove old demo data
  const oldUsers = await User.find({ email: { $regex: "@rentloop\\.demo$" } });
  const oldUserIds = oldUsers.map((user) => user._id);
  const oldBookings = await Booking.find({ $or: [{ owner: { $in: oldUserIds } }, { renter: { $in: oldUserIds } }] });
  const oldBookingIds = oldBookings.map((booking) => booking._id);
  await Review.deleteMany({ booking: { $in: oldBookingIds } });
  await RentalAgreement.deleteMany({ booking: { $in: oldBookingIds } });
  await Booking.deleteMany({ _id: { $in: oldBookingIds } });
  await Listing.deleteMany({ owner: { $in: oldUserIds } });
  await User.deleteMany({ _id: { $in: oldUserIds } });

  // users
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [];
  for (const demoUser of demoUsers) {
    const user = await User.create({ ...demoUser, password: hashedPassword });
    users.push(user);
  }

  // listings, kept by title so the bookings below can find them
  const listingByTitle = {};
  for (const item of demoListings) {
    const owner = users[item.ownerIndex];
    listingByTitle[item.title] = await Listing.create({
      owner: owner._id,
      title: item.title,
      description: item.description,
      category: item.category,
      pricePerDay: item.pricePerDay,
      deposit: item.deposit,
      city: owner.city,
      condition: item.condition,
      imageUrl: unsplash(item.image),
    });
  }

  // one booking in each stage
  const priya = users[0];
  const arjun = users[1];
  const goodPickup = { condition: "good", defects: "None", accessories: "charger, bag", photoUrl: "", notes: "Working well", recordedAt: daysFromToday(-20), renterConfirmedAt: daysFromToday(-20) };

  await createDemoBooking(arjun, listingByTitle["Mirrorless Camera Kit"], 10, 12, { status: "pending" });
  const approved = await createDemoBooking(arjun, listingByTitle["City Bicycle"], 5, 7, { status: "approved" });
  const active = await createDemoBooking(priya, listingByTitle["Wireless Headphones"], -1, 2, { status: "active", pickupCheck: goodPickup });
  const refunded = await createDemoBooking(arjun, listingByTitle["Canon DSLR Camera"], -20, -18, {
    status: "completed",
    depositStatus: "refunded",
    pickupCheck: goodPickup,
    returnCheck: { condition: "good", missingAccessories: "", damageDescription: "", deductionAmount: 0, recordedAt: daysFromToday(-18), renterResponse: "agree", respondedAt: daysFromToday(-18) },
  });
  const disputed = await createDemoBooking(priya, listingByTitle["Camera Drone"], -15, -13, {
    status: "completed",
    depositStatus: "disputed",
    pickupCheck: goodPickup,
    returnCheck: { condition: "damaged", missingAccessories: "", damageDescription: "Cracked propeller", deductionAmount: 2000, recordedAt: daysFromToday(-13), renterResponse: "disagree", renterComment: "The propeller was already loose at pickup", respondedAt: daysFromToday(-13) },
  });

  // agreements for the approved ones, accepted by both
  for (const booking of [approved, active, refunded, disputed]) {
    const fullBooking = await Booking.findById(booking._id).populate("listing").populate("owner renter", "name");
    await RentalAgreement.create({
      booking: booking._id,
      termsText: buildTermsText(fullBooking),
      ownerAcceptedAt: booking.createdAt,
      renterAcceptedAt: booking.createdAt,
    });
  }

  // reviews on the two completed bookings
  await Review.create({ booking: refunded._id, listing: refunded.listing, reviewer: arjun._id, rating: 5, comment: "Camera was clean and worked perfectly." });
  await Review.create({ booking: disputed._id, listing: disputed.listing, reviewer: priya._id, rating: 3, comment: "Good drone, but we disagree about the propeller." });
  return users;
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.log("MONGO_URI is missing. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  const users = await seedDemoData();
  console.log("Removed old demo data, then created 3 users, " + demoListings.length + " listings, 5 bookings and 2 reviews");

  console.log("\nDemo logins (for local testing only):");
  for (const user of users) {
    const role = user.isAdmin ? "(admin)" : "";
    console.log("  " + user.email + "  /  " + DEMO_PASSWORD + "  " + role);
  }
  await mongoose.disconnect();
}

// "node seed.js" runs main(); the tests only import seedDemoData
if (require.main === module) {
  main().catch((error) => {
    console.log("Seeding failed:", error.message);
    process.exit(1);
  });
}

module.exports = { seedDemoData };
