# RentLoop: Viva Notes

Simple notes to help you explain every part of the project. Part 1 goes file by file. Part 2 explains the main ideas with small examples. Part 3 walks through how an owner's item is protected.

---

# Part 1: Every file

## Backend (`server/`)

### `package.json`
Lists the backend libraries (express, mongoose, bcryptjs, jsonwebtoken, cors, dotenv) and the commands:
- `npm start` runs `node server.js`
- `npm run seed` runs `node seed.js`
- `npm test` runs the API tests with Node's built-in test runner

**Important line:** `"test": "node --test tests/api.test.js"`

### `.env.example`
A template for the settings: `MONGO_URI`, `JWT_SECRET`, `PORT` and the optional `CLIENT_URL`. You copy it to `.env` and fill in real values. The real `.env` is never committed, because it holds your database password.

### `server.js`
The starting point of the backend, and deliberately short:
1. It loads `.env`.
2. It stops with a clear message if `MONGO_URI` or `JWT_SECRET` is missing.
3. It connects to MongoDB **before** it starts listening.

**Important line:** `await mongoose.connect(process.env.MONGO_URI);`

### `app.js`
The Express app itself. It is separate from `server.js` so the tests can start the same app with a test database.
- It allows the React app to call the API (`cors`: every site locally, or only `CLIENT_URL` when that's set).
- It reads JSON bodies up to 100 KB and mounts every route file under `/api/...`.
- Any unknown URL gets `404 { message: "Route not found" }`.
- Every route's `catch` calls `next(error)`, which sends the error to one error handler at the bottom:
  - broken JSON and wrong field types get a 400
  - a duplicate key gets a 409
  - anything else is printed in the terminal with the time and URL, and the user only sees "Something went wrong on the server"

**Important lines:** `app.use("/api/listings", require("./routes/listings"));` and `console.error(new Date().toISOString(), req.method, req.originalUrl, error);`

### `tests/api.test.js`
42 tests that tell the story of one rental: sign up, list, book, approve, agree, pickup, return, dispute, review. They also try the things that must fail: wrong tokens, other users' listings, 31 February, approvals arriving at the same moment, and the 6th wrong password.
- It only runs if `TEST_MONGO_URI` points at a database whose name contains "test", because it wipes that database first.
- It starts `app.js` on a free port and calls it with `fetch`, just like the browser does.

### `models.js`
All database models in one file:
- **User**: email is `unique`, and only the hashed password is stored.
- **Listing**: the category must come from a fixed list.
- **Booking**: dates, rent, `status`, `depositStatus`, the pickup and return checklists, and the admin's decision.
- **RentalAgreement**: the terms and when each side accepted.
- **Review**: `booking` is `unique`, so a booking can't be reviewed twice.

It also holds:
- the **status rules table**
- `booking.roleOf(userId)`, which tells you whether a user is the owner, the renter or neither
- `buildTermsText(booking)`, which writes the agreement terms, one rule per line. It lives here so the approve route and the seed script write exactly the same terms.
**Important lines:** `const STATUS_RULES = { "pending->approved": "owner", ... }` and `return STATUS_RULES[fromStatus + "->" + toStatus] === role;`

### `auth.js`
Two middleware functions that guard routes.
- `requireLogin` reads the `Authorization: Bearer <token>` header and checks the token with `jwt.verify`. It loads the user (without the password) into `req.user`. A missing or fake token gives **401**.
- `requireAdmin` runs after it and gives **403** if `req.user.isAdmin` is false.

**Important line:** `const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);` (`header.slice(7)` cuts off the word "Bearer " to leave just the token)

### `seed.js`
Fills the database with demo data.
1. It deletes old demo data: users with `@rentloop.demo` emails and every booking, agreement and review linked to them. Real accounts are never touched.
2. It creates 3 users with the same hashed password, 15 listings with Unsplash photo links, 5 bookings in different stages, their agreements (with the same full terms the app writes), and 2 reviews.
3. It prints the demo logins.

The work is in `seedDemoData()`, which the tests also use. `node seed.js` connects, calls it and disconnects (`if (require.main === module)` means "only when run directly, not when imported").

**Important line:** `const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);`

### `routes/users.js`
Register, login and "who am I".
- **Register** checks the fields and that the email isn't already used, hashes the password, saves the user and returns a token.
- **Login** finds the user and compares the password with `bcrypt.compare`. A wrong email and a wrong password give the same message, so nobody can find out which emails exist. After 5 wrong passwords for one email from one IP, login is refused with 429 for 15 minutes (`isBlocked` / `recordFailedLogin`, kept in a `Map` in memory).
- `publicUser()` makes sure the password is never sent back.

**Important lines:** `await bcrypt.hash(password, 10)` and `jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" })`

### `routes/listings.js`
Search plus create, read, update and delete for items.
- The search builds a MongoDB filter step by step: active only, title (upper/lower case doesn't matter), category, min/max price, then a sort.
- `findOwnListing()` contains the **owner check** used by edit and delete.
- `pickListingFields()` copies only the allowed fields, so nobody can change `owner` by sending it in the request.
- Deleting is refused if the item was ever booked. Otherwise old bookings, disputes and reviews would point at an item that no longer exists, and the renter's My Bookings page would break. The owner pauses it instead.

**Important lines:** `const filter = { isActive: true };` and `if (listing.owner.toString() !== userId.toString())` → 403

### `routes/bookings.js`
Requesting an item and the first status changes.
- **Request** checks the date format, that the start isn't in the past, that the end isn't before the start, that the item is active, that you're not the owner, and that the dates don't overlap. Then it works out `days`, `totalRent` and `deposit`.
- **Approve / reject / cancel** go through `canChangeStatus`.
- **Approving** first switches the status with `findOneAndUpdate({ _id, status: <the status we read> })`, so it only works if nobody changed the booking in the meantime (otherwise 409). Then it runs the overlap check, and if there's a clash it puts the booking back to `pending`. If it's clear, it creates the rental agreement with `buildTermsText()`.
- **Two approvals at the same time (viva answer):** a normal "check, then save" has a gap. Two requests can both check, both see no clash, and both save, so the item is double-booked. Here the order is "save, then check". Whichever request checks second will always see the first one's approval and undo itself. We tested this by sending two overlapping approvals at once, 8 times. The old code double-booked all 8 times; the new code never did.
- `isRealDate()` rejects dates like `2026-02-31`. `new Date()` quietly turns that into 3 March, which used to give negative days and negative rent.

**Important lines:** `const days = Math.round((end - start) / ONE_DAY) + 1;` and the two lines inside `findOverlap()`: `startDate: { $lte: endDate },` and `endDate: { $gte: startDate },`

### `routes/agreements.js`
Shows the agreement of a booking and saves "I agree" for the owner or the renter. Only the two people in the booking can see it (others get 403). Each person can accept only once. There is no route that edits the terms, so after approval they can never change.
**Important line:** `agreement.ownerAcceptedAt = new Date();` (or `renterAcceptedAt` for the renter)

### `routes/checklists.js`
Booking details plus the protection flow, mounted at `/api/bookings`.
- **Pickup** (owner) is refused until both sides have accepted the agreement. It turns the booking `active`.
- **Confirm** (renter) locks the pickup checklist.
- **Return** (owner) needs the renter's confirmation first. The deduction must be between 0 and the deposit. It turns the booking `completed`.
- **Respond** (renter) sets the deposit to `refunded`, `deducted` or `disputed`.

**Important lines:** `if (!agreement || !agreement.ownerAcceptedAt || !agreement.renterAcceptedAt)` and `booking.depositStatus = "disputed";`

### `routes/reviews.js`
Add a review and read a listing's reviews.
- Only the renter of the booking can review, only when it's `completed`, with a whole-number rating from 1 to 5, and only once.
- Reading reviews also works out the average rating to one decimal place.

**Important line:** `if (booking.status !== "completed")` → 400

### `routes/admin.js`
Admin-only routes: list users and listings, deactivate a listing, list disputed deposits, and resolve a dispute. One line at the top protects every route in the file. Resolving needs a final deduction (0 up to the deposit) and a reason. 0 means `refunded`; anything more means `deducted`.
**Important line:** `router.use(requireLogin, requireAdmin);`

---

## Frontend (`client/`)

### `package.json`
Lists the frontend libraries and tools:
- react, react-dom and react-router-dom
- **framer-motion** for the animations
- **lucide-react** for the icons
- vite and its React plugin

`npm run dev` starts the development server on port 5173.
**Important line:** `"framer-motion": "11.11.17"`

### `index.html`
The only HTML page. It loads the Plus Jakarta Sans font from Google Fonts, sets a small teal logo as the tab icon, and has an empty `<div id="root">`. React draws the whole website inside that div.
**Important line:** `<div id="root"></div>`

### `vite.config.js`
Vite settings: turns on React (JSX) support and sets the port to 5173.
**Important line:** `plugins: [react()]`

### `src/main.jsx`
The entry point. It draws `<App />` inside three wrappers:
- `BrowserRouter`, so page URLs work
- `MotionConfig`, which turns animations off for people who disabled motion in their operating system
- `ToastProvider`, so any page can show a pop-up message

**Important line:** `<MotionConfig reducedMotion="user">`

### `src/App.jsx`
The main component.
- It keeps the logged-in `user` in `useState` and passes it to pages as a prop.
- When the page loads, it checks with `/users/me` that the saved token still works.
- It scrolls to the top whenever the page changes.
- It wraps the routes in a `motion.main` whose `key` is the current URL, so every new page fades in.
- It also has the 404 page.

**Important line:** `<motion.main key={location.pathname} ... initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>`

### `src/api.js`
One small helper, `callApi(path, method, body)`, used by every page. It adds `Authorization: Bearer <token>`, sends JSON, and throws an error with the server's message if the response isn't OK. The address comes from `VITE_API_URL`, or `http://localhost:5000/api` by default. If the answer isn't JSON (for example a hosting error page), it still shows a readable message with the status code. It also holds the category list and `formatDate()`.
**Important line:** `const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";`

### `src/style.css`
The only CSS file, organised into sections (Buttons, Form fields, Navbar, Home, Booking details, Admin...).
- All colours, corner sizes and shadows are **CSS variables** at the top. Changing `--primary` recolours the whole site.
- The "Tablet and phone" section at the bottom stacks grids into one column on small screens.
- The last rule turns animations off for people who asked their operating system for less motion.

**Important lines:** `--primary: #0f766e;` and `@media (max-width: 640px) { ... }`

### `src/components/Navbar.jsx`
The sticky top bar with a blurred background.
- **On a computer:** links in a row. A grey pill slides behind the active link (`layoutId="nav-pill"`). There's a "List an item" button and a user menu with Log out.
- **On a phone (under 860px):** the links hide behind a menu button. They slide down with `AnimatePresence`.
- The Admin link only shows when `user.isAdmin`, but the server checks too.

**Important line:** `{isActive(link.path) && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ duration: 0.25 }} />}`

### `src/components/Footer.jsx`
The footer: the logo and the reminder that deposits are recorded only.
**Important line:** `A student project. Deposits are recorded only, no real payments are made.`

### `src/components/ui.jsx`
Small pieces used on many pages, so each page stays short:
- `StatusBadge`: the coloured "Pending / Approved..." badge
- `Stars` and `Avatar`
- `EmptyState` and `LoginNeeded`
- `Skeleton`: the grey loading boxes
- `Tabs`: the underline slides between tabs with `layoutId`
- `ConfirmDialog`: closes when you click outside it or press Escape

**Important line:** `const STATUS_STYLES = { pending: { color: "badge-yellow", label: "Pending" }, ... }`

### `src/components/Toast.jsx`
The pop-up messages in the corner.
- `ToastProvider` keeps a list of messages in state and draws them with an animation.
- Each message removes itself after 3.5 seconds.
- A page calls `const showToast = useToast();` and then `showToast("Saved")`.

This is the project's only React context: toasts are needed on almost every page, and passing a function through every page as a prop would be messy.
**Important line:** `setTimeout(() => { setToasts((current) => current.filter((toast) => toast.id !== id)); }, 3500);`

### `src/components/ListingCard.jsx`
One card in the Home grid: the photo with a category badge, title, city, price per day and deposit.
- It lifts 4px on hover (`whileHover={{ y: -4 }}`) and the photo zooms slightly.
- If there's no image yet (on the form preview), it shows an image icon instead.

**Important line:** `<motion.div className="full-height" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>`

### `src/components/BookingRow.jsx`
One booking shown as a row on My Bookings and Requests: photo, dates, the other person, rent and a status badge. The buttons are passed in as `children`, so each page decides its own buttons. It also has `bookingTabs()` and `bookingsInTab()`, which group bookings into tabs (Pending, Approved, Active...).
**Important line:** `return bookings.filter((booking) => TAB_STATUSES[tab].includes(booking.status));`

### `src/components/BookingActions.jsx`
The highlighted **"What happens next"** panel on Booking Details. It looks at three things: the booking's stage, whether you're the owner or the renter, and the agreement. Then it adds only the panels that apply to a list called `panels`. For example:
- "Accept the agreement"
- the owner's pickup form
- the renter's "I confirm this condition" button
- Agree / Disagree
- the star rating for a review

**Important line:** `if (role === "renter" && booking.status === "active" && pickup.recordedAt && !pickupLocked) { panels.push(...) }`

### `src/components/PickupForm.jsx`
The owner's pickup checklist: condition, existing defects, accessories given, photo URL and notes. It starts with any saved values, so the owner can fix mistakes until the renter confirms.
**Important line:** `callApi("/bookings/" + booking._id + "/pickup", "PUT", { condition, defects, accessories, photoUrl, notes })`

### `src/components/ReturnForm.jsx`
The owner's return checklist: condition, missing accessories, damage, damage photo, deduction and notes. It checks the deduction is between 0 and the deposit before sending, and the server checks again. If the return deadline has passed, it shows how many days late the item is and the late fee from the agreement. It only shows this; nothing is charged automatically.
**Important line:** `if (!(amount >= 0) || amount > booking.deposit)`

### `src/pages/Home.jsx`
- **Hero:** a big search bar, three "trust" points, and a small photo collage on wide screens.
- **Filters:** category chips with icons that filter straight away, min/max price, and sort.
- **Results:** skeleton cards while loading, cards that fade in one after another, and an empty state with "Clear filters".

**Important lines:** `const params = new URLSearchParams({ search, category, minPrice, maxPrice, sort });` and `transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}`

### `src/pages/ListingDetails.jsx`
The item page.
- **Left:** a big photo, info badges, the description, the owner and the reviews with their average.
- **Right:** a sticky box.
  - Renters see `BookingBox`: dates, the days rule, a live price breakdown and "Request to Rent".
  - The owner sees `OwnerBox`: "This is your listing" and an Edit button.

**Important lines:** `const isOwner = user && user._id === listing.owner._id;` and `days = Math.round((new Date(endDate) - new Date(startDate)) / ONE_DAY) + 1;`

### `src/pages/Login.jsx`
A centred card with email and password, plus a show/hide password button. While developing, it also shows three buttons that fill in the demo accounts. They're hidden in a real build by `import.meta.env.DEV`.
**Important line:** `const data = await callApi("/users/login", "POST", { email, password });`

### `src/pages/Register.jsx`
The same card style, with name, email, password (at least 6 characters) and city. It creates the account and logs the user in straight away.
**Important line:** `await callApi("/users/register", "POST", { name, email, password, city });`

### `src/pages/ListingForm.jsx`
One form for **both** Add and Edit, split into three cards: Basics, Pricing, and Photo and location. Next to it is a **live preview**: the real `ListingCard` updates as you type. The checks are the same as before: title required, price > 0, deposit ≥ 0, image URL required.
**Important line:** `const isEditing = Boolean(id);`

### `src/pages/MyListings.jsx`
My items, with tabs (All / Active / Paused) and Edit, Pause/Activate and Delete buttons.
- Delete opens the `ConfirmDialog` instead of the browser's plain popup.
- Rows slide out smoothly when removed (`AnimatePresence`).

**Important line:** `callApi("/listings/" + listing._id, "PUT", { ...listing, isActive: !listing.isActive })`

### `src/pages/MyBookings.jsx`
Requests I made as a renter, grouped by status tabs and shown with `BookingRow`. Pending requests have a Cancel button that asks first. Approved, active and completed ones have "View details".
**Important line:** `callApi("/bookings/" + booking._id + "/status", "PATCH", { status: "cancelled" })`

### `src/pages/OwnerRequests.jsx`
Requests for my items, with the same tabs and rows. The header says how many requests are waiting. Approve and Reject are disabled while the request is sending (`busyId`), so a double click sends one request. They show a toast, and if approving would overlap another booking, the server's error appears as a red toast.
**Important line:** `changeStatus(booking, "approved")`

### `src/pages/BookingDetails.jsx`
The centre of the protection flow.
- **Progress bar:** 6 steps worked out by `getSteps()` (Requested, Approved, Agreement, Picked up, Returned, Settled).
- **Info tiles:** dates, rent, deposit in plain words, and the people involved.
- **"What happens next":** the `BookingActions` panel.
- **Comparison:** the pickup and return checklists side by side.
- **Extras:** the admin's decision and the review, if there are any.

**Important line:** `const currentStepIndex = steps.findIndex((step) => !step.done);`

### `src/pages/Agreement.jsx`
Shows the agreement like a document. Each line of the saved terms becomes a numbered item. There are two signature boxes (Owner, Renter) that turn green with the time once accepted, and an "I agree" button for whoever hasn't accepted yet. It always notes that this is a simple digital acceptance, not a legal signature.
**Important line:** `const termLines = agreement.termsText.split("\n");`

### `src/pages/Admin.jsx`
For admins only.
- **Numbers:** four stat tiles (users, listings, active listings, open disputes).
- **Tabs:** Disputes, Users and Listings.
- **Disputes:** each `DisputeCard` puts the pickup side next to the return side, shows the owner's claim and the renter's comment, and has a form for the final deduction and reason.

A non-admin only sees "Admins only", because that's what the server replies.
**Important line:** `callApi("/admin/bookings/" + booking._id + "/resolve", "POST", { finalDeduction: Number(finalDeduction), reason })`

---

## How the animations work (framer-motion), in simple words

framer-motion gives you `motion.div`, `motion.img` and so on. They work like normal HTML tags, plus three extra props:
- `initial`: how it looks before appearing, for example `{ opacity: 0, y: 16 }`, which means invisible and 16px lower.
- `animate`: how it should end up, for example `{ opacity: 1, y: 0 }`. framer-motion moves smoothly between the two.
- `transition`: how long it takes, and any delay. On Home each card waits a little longer than the one before (`index * 0.04` seconds), so they appear one after another.

Two more tools are used:
- **`AnimatePresence`** lets something animate *out* before React removes it. The dialog, toasts and mobile menu use it.
- **`layoutId`**: when two elements share the same `layoutId`, framer-motion slides one into the other's place. That's how the navbar pill and the tab underline glide to the clicked item.

---

# Part 2: Key ideas, explained simply

## 1. How a password is hashed and checked

**Hashing** turns a password into a long scrambled string that **can't be turned back**. We store only that string.

```js
// Register
const hashedPassword = await bcrypt.hash("demo1234", 10);
// saved in MongoDB: "$2a$10$Xb7...k2" (never "demo1234")

// Login
const isPasswordCorrect = await bcrypt.compare("demo1234", user.password); // true
await bcrypt.compare("demo999", user.password);                            // false
```

- `10` is the number of "rounds". More rounds make hashing slower, which makes guessing passwords slower for an attacker.
- bcrypt adds a random **salt**, so two users with the same password still get different hashes.
- `compare` hashes the typed password in the same way and checks whether the results match.
- If the database leaked, attackers would see hashes, not real passwords.

## 2. How JWT login works, from button click to protected route

1. The user clicks **Login**. `Login.jsx` sends `POST /api/users/login` with the email and password.
2. The server checks the password with `bcrypt.compare`. If it's right, it creates a token:
   `jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" })`
   The token holds the user's id plus a **signature** made with the secret. Without the secret, nobody can make a valid token.
3. The frontend saves it: `localStorage.setItem("token", token)`.
4. Later, the user opens **My Listings**. `api.js` adds the header `Authorization: Bearer eyJhbGci...`.
5. On the server, `requireLogin` runs first: `jwt.verify(token, JWT_SECRET)`.
   - If someone changed even one character of the token, or it has expired, `verify` throws an error and the server replies **401**.
   - If it's valid, the server loads the user into `req.user`.
6. The route uses `req.user._id`, for example `Listing.find({ owner: req.user._id })`, so you only ever get **your** listings.

The server never trusts a user id sent in the request body. It only trusts the id inside a correctly signed token.

## 3. How the booking overlap check works

Two bookings **overlap** if:

```
existing.startDate <= new.endDate   AND   existing.endDate >= new.startDate
```

Only `approved` and `active` bookings count. Pending requests don't block anyone yet.

**Example A: overlap.** Existing approved booking: **1 Nov – 3 Nov**. New request: **3 Nov – 5 Nov**.
- Is 1 Nov ≤ 5 Nov? **Yes.**
- Is 3 Nov ≥ 3 Nov? **Yes.**
- Both are true, so they overlap (both want 3 Nov). The request is **refused**.

**Example B: no overlap.** Existing: **1 Nov – 3 Nov**. New: **4 Nov – 6 Nov**.
- Is 1 Nov ≤ 6 Nov? Yes.
- Is 3 Nov ≥ 4 Nov? **No.**
- One is false, so there's no overlap. The request is **allowed**.

In MongoDB this becomes:

```js
Booking.findOne({
  listing: listingId,
  status: { $in: ["approved", "active"] },
  startDate: { $lte: endDate },
  endDate: { $gte: startDate },
});
```

The check runs **twice**: when the renter requests, and again when the owner approves. Two people may have sent requests for the same dates. Once the owner approves the first, approving the second fails with "Another approved booking already uses these dates".

**Days rule:** `days = (endDate − startDate in days) + 1`. 1 Nov to 3 Nov = 2 + 1 = **3 days**, because both the first and last day are counted.

## 4. How status changes are controlled

All allowed changes are in one table in `models.js`:

```js
const STATUS_RULES = {
  "pending->approved": "owner",
  "pending->rejected": "owner",
  "pending->cancelled": "renter",
  "approved->active": "owner",   // when the pickup checklist is saved
  "active->completed": "owner",  // when the return checklist is saved
};

function canChangeStatus(fromStatus, toStatus, role) {
  return STATUS_RULES[fromStatus + "->" + toStatus] === role;
}
```

**Example:** Arjun (the renter) tries to approve his own request.
- `booking.roleOf(arjunId)` gives `"renter"`.
- `canChangeStatus("pending", "approved", "renter")` looks up `STATUS_RULES["pending->approved"]`, which is `"owner"`.
- `"owner" === "renter"` is **false**, so the server replies **400**.

**Example:** the owner tries `completed → pending`. There is no `"completed->pending"` key in the table, so the lookup gives `undefined`. That's not equal to `"owner"`, so the change is refused.

`active` and `completed` can't be set through the normal status route at all. They only happen when the pickup or return checklist is saved, so the item's condition is always recorded first.

## 5. How the owner check stops one user editing another user's listing

Each listing stores its owner's id. When someone edits or deletes a listing, the server compares that id with the logged-in user's id, which comes from the **verified token**:

```js
if (listing.owner.toString() !== userId.toString()) {
  return { status: 403, message: "You can only change your own listings" };
}
```

**Example:**
- The Camping Tent has `owner = 6ade...512` (Priya).
- Arjun is logged in. His token says `userId = 6ade...514`.
- Arjun sends `PUT /api/listings/<tent id>`. `"6ade...512" !== "6ade...514"`, so the server replies **403**, and nothing is saved.

Why `.toString()`? MongoDB ids are objects. Two different objects never count as equal with `!==`, even if they hold the same id, so we compare them as text.

Hiding the Edit button in React is just for convenience. Anyone can send requests with a tool like Postman. **The server check is the real protection.**

---

# Part 3: How an owner's item is protected

**Example:** Priya rents out her **Canon DSLR** (₹600/day, deposit ₹5,000) to Arjun from **1 Nov to 3 Nov**.

### Step 1: Deposit is shown up front
Before Arjun sends the request, the Listing Details page shows: ₹600 × 3 days = ₹1,800 rent, plus a **₹5,000 deposit**, for a total of ₹6,800. The deposit is labelled **"Recorded only, no real payment"**. It's the amount at stake if the camera is damaged.

### Step 2: Rental agreement
Priya clicks **Approve**. The server checks the dates again, then **automatically creates the agreement**. It records:
- both names, the item and the dates
- the return deadline (end of 3 Nov)
- the rent and the deposit
- the **late fee** of one day's rent (₹600) for each late day
- that **damage is judged by comparing the pickup and return checklists**
- that Arjun can cancel only while the request is pending

Both click **"I agree"** and the time of each click is saved. Nobody can edit the terms afterwards.
**Pickup is blocked until both have agreed.**

### Step 3: Pickup checklist and photos
At handover, Priya fills in the pickup checklist:
- condition: good
- defects: "tiny scratch on the lens hood"
- accessories: "battery, charger, strap, lens cap"
- a photo URL

The booking becomes **active**. Arjun checks the camera and clicks **"I confirm this condition"**, which saves the time and **locks** the checklist. Now neither side can later claim the camera was different at pickup.

### Step 4: Return and comparison
On 3 Nov Arjun returns the camera. Priya fills in the return checklist:
- condition: damaged
- missing: "lens cap"
- damage: "crack on the LCD screen"
- a damage photo
- **deduction: ₹2,000** (the server never allows more than the ₹5,000 deposit)

The booking becomes **completed**. The **side-by-side table** on Booking Details now shows:

| | At pickup (locked) | At return |
|---|---|---|
| Condition | good | damaged |
| Defects / damage | tiny scratch on the lens hood | crack on the LCD screen |
| Accessories | Given: battery, charger, strap, lens cap | Missing: lens cap |

Anyone can see what changed.

### Step 5: The renter responds
The deposit is still only **"recorded"**. Arjun is **not** penalised just because Priya reported damage. He chooses:
- **Agree** → deposit becomes **deducted** (₹2,000 kept, ₹3,000 returned). With a ₹0 deduction it would be **refunded**.
- **Disagree**, with a comment such as "the crack was already there" → deposit becomes **disputed**, and the booking appears on the **Admin** page.

### Step 6: Admin decision
The admin sees both checklists, Priya's claim and Arjun's comment.
- The **pickup** checklist, which Arjun himself confirmed, says nothing about a cracked screen. So the admin can reasonably decide the damage happened during the rental.
- The admin sets a **final deduction** (for example ₹2,000, or less if only partly justified) and writes a **reason**.
- The deposit becomes **deducted** (or **refunded** if the decision is ₹0). Both Priya and Arjun see the decision on Booking Details.

### Why this protects the owner, and is fair to the renter
- The **agreement** sets the rules before anyone touches the item.
- The **confirmed pickup checklist** is evidence of the starting condition that the renter can't deny later.
- The **return checklist** and side-by-side table make any damage easy to see.
- The **deposit** gives a fixed amount at stake, and the deduction can never be more than it.
- The renter can **disagree**, and a neutral **admin** decides. The owner can't take money just by claiming damage.

> **Limits:** this is a student project. The deposit isn't real money, the "I agree" button is a simple digital acceptance and **not a legally verified signature**, and there is no ID check or insurance. See *Future Improvements* in the README.
