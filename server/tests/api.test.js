// API tests for RentLoop, using Node's built-in test runner (no extra libraries).
//
// Run with:  TEST_MONGO_URI=mongodb://127.0.0.1:27017/rentloop_test npm test
// The test database is wiped at the start, so its name must contain "test".
// The tests run in order and share data, like one long story: sign up, list, book, return, review.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const TEST_MONGO_URI = process.env.TEST_MONGO_URI || "";
const databaseName = TEST_MONGO_URI.split("?")[0].split("/").pop();
const canRun = databaseName.toLowerCase().includes("test");

process.env.JWT_SECRET = process.env.JWT_SECRET || "only-for-tests";
const app = require("../app");
const { seedDemoData } = require("../seed");

let server;
let API;

async function call(method, path, token, body) {
  const options = { method: method, headers: { "Content-Type": "application/json" } };
  if (token) {
    options.headers.Authorization = "Bearer " + token;
  }
  if (body !== undefined) {
    options.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const response = await fetch(API + path, options);
  const json = await response.json();
  return { status: response.status, data: json.data, message: json.message };
}

async function login(email, password = "demo1234") {
  const result = await call("POST", "/users/login", null, { email: email, password: password });
  return result.data.token;
}

// n days from today as "YYYY-MM-DD", like the date picker sends
function day(n) {
  return new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA");
}

function book(token, listingId, startDate, endDate) {
  return call("POST", "/bookings", token, { listingId: listingId, startDate: startDate, endDate: endDate });
}

describe("RentLoop API", { skip: canRun ? false : "set TEST_MONGO_URI to a database whose name contains 'test'" }, () => {
  let priya, arjun, admin, tester;
  const testerEmail = "tester@test.example";
  const lamp = { title: "Test Lamp", category: "Electronics", condition: "good", pricePerDay: 50, deposit: 500, imageUrl: "https://example.com/lamp.jpg" };

  before(async () => {
    await mongoose.connect(TEST_MONGO_URI);
    await mongoose.connection.dropDatabase();
    await seedDemoData();
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    API = "http://localhost:" + server.address().port + "/api";
    priya = await login("priya@rentloop.demo");
    arjun = await login("arjun@rentloop.demo");
    admin = await login("admin@rentloop.demo");
  });

  after(async () => {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
  });

  describe("registration and login", () => {
    it("registers a user and never returns the password", async () => {
      const r = await call("POST", "/users/register", null, { name: "Tester", email: testerEmail, password: "secret12", city: "Pune" });
      assert.equal(r.status, 201);
      assert.ok(r.data.token);
      assert.equal(r.data.user.password, undefined);
      tester = r.data.token;
    });

    it("refuses a duplicate email in any letter case", async () => {
      const r = await call("POST", "/users/register", null, { name: "X", email: testerEmail.toUpperCase(), password: "secret12" });
      assert.equal(r.status, 400);
    });

    it("refuses bad sign-up input with 400", async () => {
      const cases = [
        { name: "   ", email: "a@test.example", password: "secret12" },
        { name: "X", email: "not-an-email", password: "secret12" },
        { name: "X", email: "b@test.example", password: "123" },
        { name: "X", email: { $gt: "" }, password: "secret12" },
      ];
      for (const body of cases) {
        const r = await call("POST", "/users/register", null, body);
        assert.equal(r.status, 400, JSON.stringify(body));
      }
    });

    it("gives the same message for a wrong password and an unknown email", async () => {
      const wrongPassword = await call("POST", "/users/login", null, { email: "arjun@rentloop.demo", password: "nope" });
      const unknownEmail = await call("POST", "/users/login", null, { email: "nobody@test.example", password: "nope" });
      assert.equal(wrongPassword.status, 401);
      assert.equal(unknownEmail.status, 401);
      assert.equal(wrongPassword.message, unknownEmail.message);
    });

    it("refuses an operator object as the login email", async () => {
      const r = await call("POST", "/users/login", null, { email: { $gt: "" }, password: "x" });
      assert.equal(r.status, 400);
    });

    it("answers broken JSON with a JSON 400", async () => {
      const r = await call("POST", "/users/login", null, "{bad json");
      assert.equal(r.status, 400);
    });
  });

  describe("protected routes", () => {
    it("needs a token", async () => {
      assert.equal((await call("GET", "/users/me")).status, 401);
    });

    it("rejects a fake token", async () => {
      assert.equal((await call("GET", "/users/me", "fake.token.here")).status, 401);
    });

    it("rejects an expired token", async () => {
      const user = (await call("GET", "/users/me", priya)).data;
      const expired = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: -10 });
      assert.equal((await call("GET", "/users/me", expired)).status, 401);
    });

    it("keeps admin routes for admins", async () => {
      assert.equal((await call("GET", "/admin/users", priya)).status, 403);
      const r = await call("GET", "/admin/users", admin);
      assert.equal(r.status, 200);
      assert.ok(r.data.every((user) => user.password === undefined));
    });
  });

  describe("listings", () => {
    let lampId;

    it("lists the 15 seeded items, newest first by default", async () => {
      const r = await call("GET", "/listings");
      assert.equal(r.data.length, 15);
    });

    it("filters by category and sorts by price", async () => {
      const r = await call("GET", "/listings?category=Cameras&sort=priceLow");
      const prices = r.data.map((listing) => listing.pricePerDay);
      assert.ok(r.data.every((listing) => listing.category === "Cameras"));
      assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
    });

    it("ignores arrays and operator objects in the query string", async () => {
      assert.equal((await call("GET", "/listings?search=a&search=b")).status, 200);
      const r = await call("GET", "/listings?category[$ne]=Cameras");
      assert.equal(r.data.length, 15);
    });

    it("creates a listing for the logged-in owner", async () => {
      const r = await call("POST", "/listings", priya, lamp);
      assert.equal(r.status, 201);
      lampId = r.data._id;
    });

    it("validates price, deposit and image URL", async () => {
      for (const change of [{ pricePerDay: 0 }, { deposit: -1 }, { imageUrl: "" }, { imageUrl: "javascript:alert(1)" }]) {
        const r = await call("POST", "/listings", priya, { ...lamp, ...change });
        assert.equal(r.status, 400, JSON.stringify(change));
      }
    });

    it("hides internal error text for a wrong field type", async () => {
      const r = await call("POST", "/listings", priya, { ...lamp, description: { a: 1 } });
      assert.equal(r.status, 400);
      assert.doesNotMatch(r.message, /validation failed|Cast to/i);
    });

    it("stops other users editing or deleting the listing", async () => {
      assert.equal((await call("PUT", "/listings/" + lampId, arjun, lamp)).status, 403);
      assert.equal((await call("DELETE", "/listings/" + lampId, arjun)).status, 403);
    });

    it("hides a paused listing from search, then deletes it", async () => {
      await call("PUT", "/listings/" + lampId, priya, { ...lamp, isActive: false });
      assert.equal((await call("GET", "/listings?search=Test%20Lamp")).data.length, 0);
      assert.equal((await call("DELETE", "/listings/" + lampId, priya)).status, 200);
    });

    it("refuses to delete an item that has bookings", async () => {
      const drone = (await call("GET", "/listings?search=Drone")).data[0];
      assert.equal((await call("DELETE", "/listings/" + drone._id, arjun)).status, 400);
    });
  });

  describe("booking requests and owner decisions", () => {
    let dslr, first, second;

    before(async () => {
      dslr = (await call("GET", "/listings?search=DSLR")).data[0];
    });

    it("refuses wrong dates", async () => {
      const nextYear = new Date().getFullYear() + 1;
      assert.equal((await book(arjun, dslr._id, day(40), day(38))).status, 400, "end before start");
      assert.equal((await book(arjun, dslr._id, day(-3), day(-1))).status, 400, "start in the past");
      assert.equal((await book(arjun, dslr._id, nextYear + "-02-31", nextYear + "-03-01")).status, 400, "31 February");
    });

    it("refuses renting your own item", async () => {
      assert.equal((await book(priya, dslr._id, day(40), day(42))).status, 400);
    });

    it("counts both days and works out the rent on the server", async () => {
      const r = await book(arjun, dslr._id, day(40), day(42));
      assert.equal(r.status, 201);
      assert.equal(r.data.days, 3);
      assert.equal(r.data.totalRent, 3 * 600);
      assert.equal(r.data.deposit, 5000);
      first = r.data._id;
    });

    it("allows an overlapping request while nothing is approved", async () => {
      const r = await book(tester, dslr._id, day(42), day(44));
      assert.equal(r.status, 201);
      second = r.data._id;
    });

    it("only lets the owner approve", async () => {
      assert.equal((await call("PATCH", "/bookings/" + first + "/status", arjun, { status: "approved" })).status, 400);
      assert.equal((await call("PATCH", "/bookings/" + first + "/status", tester, { status: "cancelled" })).status, 403);
      assert.equal((await call("PATCH", "/bookings/" + first + "/status", priya, { status: "active" })).status, 400);
    });

    it("approves and creates the agreement", async () => {
      const r = await call("PATCH", "/bookings/" + first + "/status", priya, { status: "approved" });
      assert.equal(r.status, 200);
      assert.equal(r.data.status, "approved");
      const agreement = await call("GET", "/agreements/" + first, arjun);
      assert.equal(agreement.status, 200);
      assert.match(agreement.data.agreement.termsText, /Late fee/);
    });

    it("refuses to approve an overlapping request and leaves it pending", async () => {
      const r = await call("PATCH", "/bookings/" + second + "/status", priya, { status: "approved" });
      assert.equal(r.status, 400);
      const after = await call("GET", "/bookings/" + second, tester);
      assert.equal(after.data.booking.status, "pending");
    });

    it("refuses new requests on approved dates, including the edge day", async () => {
      assert.equal((await book(tester, dslr._id, day(42), day(42))).status, 400);
      assert.equal((await book(tester, dslr._id, day(43), day(45))).status, 201);
    });

    it("lets the renter cancel a pending request", async () => {
      const r = await call("PATCH", "/bookings/" + second + "/status", tester, { status: "cancelled" });
      assert.equal(r.data.status, "cancelled");
    });

    it("never double-books when overlapping approvals arrive at the same moment", async () => {
      const laptop = (await call("GET", "/listings?search=Laptop%20for")).data[0];
      for (let round = 0; round < 8; round++) {
        const a = (await book(arjun, laptop._id, day(60 + round * 5), day(62 + round * 5))).data._id;
        const b = (await book(tester, laptop._id, day(61 + round * 5), day(63 + round * 5))).data._id;
        const results = await Promise.all([
          call("PATCH", "/bookings/" + a + "/status", priya, { status: "approved" }),
          call("PATCH", "/bookings/" + b + "/status", priya, { status: "approved" }),
        ]);
        const approvedCount = results.filter((result) => result.status === 200).length;
        assert.ok(approvedCount <= 1, "round " + round + " approved " + approvedCount);
      }
    });

    it("handles a double-clicked approve without a server error", async () => {
      const laptop = (await call("GET", "/listings?search=Laptop%20for")).data[0];
      const id = (await book(arjun, laptop._id, day(120), day(121))).data._id;
      const results = await Promise.all([
        call("PATCH", "/bookings/" + id + "/status", priya, { status: "approved" }),
        call("PATCH", "/bookings/" + id + "/status", priya, { status: "approved" }),
      ]);
      assert.equal(results.filter((result) => result.status === 200).length, 1);
      assert.ok(results.every((result) => result.status < 500));
    });

    it("lets only one of approve and cancel win when sent together", async () => {
      const laptop = (await call("GET", "/listings?search=Laptop%20for")).data[0];
      const id = (await book(arjun, laptop._id, day(130), day(131))).data._id;
      const results = await Promise.all([
        call("PATCH", "/bookings/" + id + "/status", priya, { status: "approved" }),
        call("PATCH", "/bookings/" + id + "/status", arjun, { status: "cancelled" }),
      ]);
      assert.equal(results.filter((result) => result.status === 200).length, 1);
    });

    // the rest of the story continues with the approved DSLR booking
    describe("agreement, pickup, return, dispute and review", () => {
      const pickup = { condition: "good", defects: "none", accessories: "strap", photoUrl: "", notes: "" };

      it("keeps the agreement private to owner and renter", async () => {
        assert.equal((await call("GET", "/agreements/" + first, tester)).status, 403);
      });

      it("blocks pickup until both have accepted the agreement", async () => {
        assert.equal((await call("PUT", "/bookings/" + first + "/pickup", priya, pickup)).status, 400);
        assert.equal((await call("POST", "/agreements/" + first + "/accept", priya)).status, 200);
        assert.equal((await call("POST", "/agreements/" + first + "/accept", priya)).status, 400, "accepting twice");
        assert.equal((await call("POST", "/agreements/" + first + "/accept", arjun)).status, 200);
      });

      it("lets only the owner fill the pickup checklist, which makes the booking active", async () => {
        assert.equal((await call("PUT", "/bookings/" + first + "/pickup", arjun, pickup)).status, 403);
        const r = await call("PUT", "/bookings/" + first + "/pickup", priya, pickup);
        assert.equal(r.data.status, "active");
      });

      it("locks the pickup checklist once the renter confirms", async () => {
        assert.equal((await call("PUT", "/bookings/" + first + "/return", priya, { condition: "good" })).status, 400, "return before confirm");
        assert.equal((await call("POST", "/bookings/" + first + "/pickup/confirm", arjun)).status, 200);
        assert.equal((await call("PUT", "/bookings/" + first + "/pickup", priya, pickup)).status, 400, "edit after lock");
      });

      it("does not allow a review before the rental is completed", async () => {
        assert.equal((await call("POST", "/reviews", arjun, { bookingId: first, rating: 5 })).status, 400);
      });

      it("keeps the deduction between 0 and the deposit", async () => {
        const r = await call("PUT", "/bookings/" + first + "/return", priya, { condition: "damaged", deductionAmount: 99999 });
        assert.equal(r.status, 400);
      });

      it("completes the booking on return and leaves the deposit as recorded", async () => {
        const r = await call("PUT", "/bookings/" + first + "/return", priya, { condition: "damaged", damageDescription: "scratch", deductionAmount: 700 });
        assert.equal(r.data.status, "completed");
        assert.equal(r.data.depositStatus, "recorded");
      });

      it("lets only the renter answer, and disagreeing opens a dispute", async () => {
        assert.equal((await call("POST", "/bookings/" + first + "/return/respond", priya, { response: "agree" })).status, 403);
        const r = await call("POST", "/bookings/" + first + "/return/respond", arjun, { response: "disagree", comment: "was there before" });
        assert.equal(r.data.depositStatus, "disputed");
      });

      it("lets only the renter review, once, with a rating from 1 to 5", async () => {
        assert.equal((await call("POST", "/reviews", priya, { bookingId: first, rating: 5 })).status, 403);
        assert.equal((await call("POST", "/reviews", arjun, { bookingId: first, rating: 6 })).status, 400);
        assert.equal((await call("POST", "/reviews", arjun, { bookingId: first, rating: 4, comment: "ok" })).status, 201);
        assert.equal((await call("POST", "/reviews", arjun, { bookingId: first, rating: 5 })).status, 400);
      });

      it("lets the admin resolve the dispute once, with a reason", async () => {
        assert.equal((await call("POST", "/admin/bookings/" + first + "/resolve", priya, { finalDeduction: 300, reason: "x" })).status, 403);
        assert.equal((await call("POST", "/admin/bookings/" + first + "/resolve", admin, { finalDeduction: 300 })).status, 400);
        const r = await call("POST", "/admin/bookings/" + first + "/resolve", admin, { finalDeduction: 300, reason: "Partly worn" });
        assert.equal(r.data.depositStatus, "deducted");
        assert.equal(r.data.adminDecision.finalDeduction, 300);
        assert.equal((await call("POST", "/admin/bookings/" + first + "/resolve", admin, { finalDeduction: 0, reason: "x" })).status, 400);
      });
    });
  });

  describe("login protection", () => {
    it("blocks an email after 5 wrong passwords, without blocking other users", async () => {
      for (let i = 0; i < 5; i++) {
        await call("POST", "/users/login", null, { email: testerEmail, password: "wrong-" + i });
      }
      assert.equal((await call("POST", "/users/login", null, { email: testerEmail, password: "secret12" })).status, 429);
      assert.equal((await call("POST", "/users/login", null, { email: "arjun@rentloop.demo", password: "demo1234" })).status, 200);
    });
  });
});
