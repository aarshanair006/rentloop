# RentLoop

RentLoop is a website where people list things they own (cameras, laptops, cycles, books, party wear...) and other people rent them for a few days.

## The problem

Students and young professionals often need an expensive item for a few days, like a DSLR for a trip or a suit for an interview. Buying it is wasteful, and lending to a stranger is risky for the owner: "it was already scratched" is hard to disprove. RentLoop makes short rentals between people easier and gives both sides a written record: an agreement, a confirmed condition at pickup, a condition report at return, and an admin to settle disagreements about the deposit.

**Users**
- **Owner:** lists items and approves or rejects requests.
- **Renter:** requests items for dates and confirms condition. One account can be both owner and renter.
- **Admin:** a flagged account that sees all users and listings, deactivates listings and decides deposit disputes.

## What is implemented

Everything in this list is in the code and covered by the automated tests or the manual checklist:

- Sign up, log in, log out. Passwords are hashed with bcrypt, and logins use JWT tokens that expire after 7 days.
- After 5 wrong passwords for one email from one IP address, that login is blocked for 15 minutes.
- Listings: create, edit, pause, delete (only if never booked), and search by text, category and price, sorted by newest or price.
- Booking requests with date checks. Rent is worked out on the server: days × price per day, counting both the first and last day.
- The owner approves or rejects; the renter can cancel while the request is pending. Overlapping approved bookings are refused, including when two approvals arrive at the same moment.
- A rental agreement is generated on approval, and both people must click "I agree" before pickup.
- Pickup checklist (owner) → renter confirms, which locks it → return checklist with an optional deduction (owner) → renter agrees or disagrees.
- Deposit status: `recorded` → `refunded` / `deducted` / `disputed`. The admin resolves disputes with a final amount and a reason.
- Reviews: the renter of a completed booking, once, with a rating from 1 to 5.
- Admin page: disputes, all users, all listings, deactivate a listing.

**Not implemented (planned):** real payments, automatic late fees, image uploads, notifications and pagination. See [Known limitations](#known-limitations).

> The deposit is **recorded only**. No real money moves anywhere in this project.

---

## Tech stack

| Part | Used |
|---|---|
| Backend | Node.js, Express, MongoDB with Mongoose, bcryptjs, jsonwebtoken, cors, dotenv |
| Frontend | React (Vite), react-router-dom, framer-motion (animations), lucide-react (icons), plain CSS in one file (`style.css`) |
| Tests | Node's built-in test runner (`node --test`). No extra test libraries. |

No TypeScript, Tailwind, Redux, Axios, component libraries or file uploads. Images are pasted as URLs.

## Folder structure

```
rentloop/
├── README.md                  this file
├── API_DOCUMENTATION.md       every endpoint, with inputs and errors
├── MANUAL_TEST_CHECKLIST.md   click-through checks for the browser
├── EXPLAIN.md                 what every source file does
├── VIVA_GUIDE.md              how it works, plus likely viva questions
├── DEMO_SCRIPT.md             a 5-minute live demo plan
├── RUBRIC_CHECKLIST.md        evidence for each marking criterion
├── server/
│   ├── .env.example     template for MONGO_URI, JWT_SECRET, PORT, CLIENT_URL
│   ├── server.js        checks .env, connects MongoDB, starts listening
│   ├── app.js           the Express app: middleware, routes, error handler
│   ├── models.js        Mongoose models, status-change rules, loadBookingForUser, agreement text
│   ├── auth.js          requireLogin (JWT) and requireAdmin middleware
│   ├── seed.js          demo users, listings, bookings, reviews
│   ├── tests/api.test.js  automated API tests
│   └── routes/
│       ├── users.js       register, login, me
│       ├── listings.js    search + create/read/update/delete
│       ├── bookings.js    request, my bookings, owner requests, approve/reject/cancel
│       ├── agreements.js  view and accept the rental agreement
│       ├── checklists.js  booking details, pickup and return checklists, deposit answer
│       ├── reviews.js     add and read reviews
│       └── admin.js       users, listings, deactivate, resolve disputes
└── client/
    ├── .env.example     template for VITE_API_URL
    ├── vite.config.js
    └── src/
        ├── main.jsx, App.jsx, api.js, style.css
        ├── components/  Navbar, Footer, ListingCard, BookingRow, BookingActions,
        │                PickupForm, ReturnForm, Toast, ui (small shared pieces)
        └── pages/       Home, ListingDetails, Login, Register, ListingForm, MyListings,
                         MyBookings, OwnerRequests, BookingDetails, Agreement, Admin
```

---

## How to install and run

You need **Node.js 18 or newer** (tested on Node 24) and a **MongoDB** database. The steps below use a free MongoDB Atlas cluster; a local MongoDB works too.

### 1. Get a MongoDB connection string (MONGO_URI)

1. Sign up at <https://www.mongodb.com/atlas> and create a **free M0 cluster**.
2. **Database Access** → *Add New Database User*. Choose a username and password.
3. **Network Access** → *Add IP Address*. Add your current IP.
4. **Connect** → *Drivers*, then copy the string. It looks like:
   `mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/?retryWrites=true&w=majority`
5. Put your password in, and add the database name `rentloop` before the `?`.

For a local MongoDB the string is `mongodb://127.0.0.1:27017/rentloop`.

### 2. Set up `server/.env`

```bash
cd server
cp .env.example .env
```

| Variable | Required | What it is |
|---|---|---|
| `MONGO_URI` | yes | the connection string from step 1 |
| `JWT_SECRET` | yes | a long random string used to sign login tokens. Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PORT` | no | defaults to `5000` |
| `CLIENT_URL` | no | leave it empty locally. In production, the frontend's address, so browsers only allow API calls from that site. |

The server stops at startup with a clear message if `MONGO_URI` or `JWT_SECRET` is missing.

`.env` is in `.gitignore`. Never commit it or put it in a zip you share. If a password leaks, change it in Atlas (**Database Access**) and update `MONGO_URI`.

### 3. Start the backend

```bash
cd server
npm install
npm start
```

You should see `MongoDB connected` and `Server running on http://localhost:5000`. Check <http://localhost:5000/api/health>. (`npm run dev` restarts the server automatically when a file changes.)

### 4. Add demo data

```bash
cd server
npm run seed
```

This first deletes old demo data (users with `@rentloop.demo` emails and everything linked to them), then creates 3 users (one admin), 15 listings, 5 bookings (pending, approved, active, completed with deposit refunded, completed with deposit disputed), their agreements and 2 reviews. Running it again is safe; other users' data is not touched.

### 5. Start the frontend

```bash
cd client
npm install
npm run dev
```

Open <http://localhost:5173>.

### 6. Where the frontend sends API calls

`client/src/api.js` uses `VITE_API_URL`, or `http://localhost:5000/api` if it isn't set, so locally you don't need to do anything. When the backend runs somewhere else:

```bash
cd client
cp .env.example .env
# edit .env:  VITE_API_URL=https://your-backend.example.com/api
npm run build
```

Vite copies the value into the built files in `client/dist`, so set it **before** `npm run build`. It is not a secret; anyone can see it in the browser. Then set `CLIENT_URL` in `server/.env` to the frontend's address.

### Demo logins (created by `npm run seed`)

| Email | Password | Role |
|---|---|---|
| priya@rentloop.demo | demo1234 | owner and renter |
| arjun@rentloop.demo | demo1234 | owner and renter |
| admin@rentloop.demo | demo1234 | admin |

These are made-up demo accounts, not real credentials. In `npm run dev` the Login page shows buttons that fill them in; the buttons use `import.meta.env.DEV`, so they don't appear in a production build.

---

## Build and test

| What | Command | Notes |
|---|---|---|
| Frontend production build | `cd client && npm run build` | output in `client/dist` |
| Preview the build | `cd client && npm run preview` | |
| Backend API tests | see below | 42 tests |
| Browser checks | [MANUAL_TEST_CHECKLIST.md](MANUAL_TEST_CHECKLIST.md) | |

There is no linter configured in this project.

### Running the API tests

The tests start the Express app inside the test process and talk to it over HTTP. They need a MongoDB database **only for testing**. The test **wipes that database first**, so the database name must contain `test`, or every test is skipped.

```bash
cd server
# macOS / Linux / Git Bash
TEST_MONGO_URI=mongodb://127.0.0.1:27017/rentloop_test npm test
```

```powershell
# Windows PowerShell
cd server
$env:TEST_MONGO_URI="mongodb://127.0.0.1:27017/rentloop_test"; npm test
```

With Atlas, use the same cluster as `MONGO_URI` but a different database name, for example `.../rentloop_test?retryWrites=true&w=majority`. Without `TEST_MONGO_URI`, the run shows the suite as skipped. **That is not a pass.**

The tests cover:
- registration and login input
- missing, fake and expired tokens
- admin-only routes
- listing ownership and validation
- dates and rent calculation
- overlapping and simultaneous approvals
- the agreement, pickup, return, dispute and review rules
- the login limit

---

## How it works (short version)

```
Browser (React, port 5173) --fetch + JWT--> Express API (port 5000) --Mongoose--> MongoDB
```

Booking life cycle:

```
pending --owner approves--> approved --owner saves pickup checklist--> active --owner saves return checklist--> completed
   |                         (agreement created;                       (renter must confirm
   +--owner rejects--> rejected   both must accept                       pickup first)
   +--renter cancels--> cancelled before pickup)
```

Deposit status after the return: the renter **agrees** → `refunded` (no deduction) or `deducted`; the renter **disagrees** → `disputed` → the admin decides → `refunded` or `deducted`.

All rules are checked on the server. The full list is in [API_DOCUMENTATION.md](API_DOCUMENTATION.md#business-rules). The main ones:

- A request is refused if:
  - a date isn't real (e.g. 31 Feb)
  - the end is before the start
  - the start is in the past
  - the item is inactive
  - you own it
  - it overlaps an `approved` or `active` booking
- `days = (end − start) + 1`, and `totalRent = days × pricePerDay`.
- Approving switches the booking to `approved` first, then checks for a clash, and undoes the approval if one is found. Two approvals at the same moment therefore can't double-book. Each status change also only applies if the status hasn't changed since it was read; otherwise the request gets 409.

Important API routes (all under `/api`):
- users: `POST /users/register`, `POST /users/login`
- listings: `GET /listings`, `POST /listings`
- bookings: `POST /bookings`, `PATCH /bookings/:id/status`
- agreements: `POST /agreements/:bookingId/accept`
- checklists: `PUT /bookings/:id/pickup`, `PUT /bookings/:id/return`, `POST /bookings/:id/return/respond`
- reviews: `POST /reviews`
- admin: `POST /admin/bookings/:id/resolve`

The complete list is in [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

## Design

- **One design system in `style.css`:** colours, corner sizes and shadows are CSS variables in `:root`. The font is Plus Jakarta Sans, the accent is teal, and the background is warm off-white.
- **Animations (framer-motion):**
  - pages fade in
  - cards appear one after another
  - a pill slides between navbar links
  - dialogs and toasts pop in and out
  - animations switch off for people who turned off motion in their operating system (`MotionConfig reducedMotion="user"`)
- **Feedback:**
  - skeletons while loading
  - toast messages after each action
  - a confirm dialog before deleting or cancelling
  - an empty state with a next step on every list
  - buttons are disabled while a request is being sent, so a double click doesn't send it twice
- **Booking Details** shows a 6-step progress bar, a panel with only the action that fits you right now, and the pickup and return checklists side by side.
- **Mobile:** the navbar collapses into a menu, forms stack into one column, and wide tables scroll inside their own box.

---

## Troubleshooting

| What you see | Usual cause and fix |
|---|---|
| "Cannot reach the server. Is the backend running?" | The backend isn't started, or `VITE_API_URL` points at the wrong address. Open `http://localhost:5000/api/health`. |
| `Could not connect to MongoDB` when the server starts | The wrong password in `MONGO_URI`, or your IP isn't in Atlas **Network Access**. |
| `MONGO_URI or JWT_SECRET is missing` | There is no `server/.env` yet. Copy `.env.example` to `.env`. |
| `EADDRINUSE: address already in use :::5000` | Another backend is already running. Stop it, or set a different `PORT` (and `VITE_API_URL`). |
| "Too many wrong attempts" on login | 5 wrong passwords in a row. Wait 15 minutes or restart the server. |
| `npm test` shows the suite as skipped | `TEST_MONGO_URI` is not set, or its database name doesn't contain `test`. |
| A CORS error in the browser console after deploying | `CLIENT_URL` doesn't exactly match the frontend address (including `https://`). |
| "Something went wrong on the server" | Look at the backend terminal. The real error is printed there with the time and URL. |

## Security notes

- **Login token in `localStorage`.** It is simple and works without cookies, but any JavaScript running on the page can read it. If an XSS bug ever let someone run their own script, they could steal the token and act as that user for up to 7 days. React escapes everything it shows, and the project never uses `dangerouslySetInnerHTML`, which lowers that risk but doesn't remove it. An httpOnly cookie hides the token from scripts, but then the server needs CSRF protection and the right cookie settings. Moving to a cookie is a trade-off, not an automatic fix.
- **CORS** only matters for browsers. With `CLIENT_URL` set, other websites can't call the API from their pages. Tools like Postman can still call it, which is why every route checks the token and ownership itself.
- **Login limit** is kept in the server's memory. It resets when the server restarts and isn't shared between several servers. Behind a hosting proxy, `req.ip` may be the proxy's address unless Express's `trust proxy` setting is turned on. Sign-up has no limit.
- **Errors:** unexpected errors are logged on the server with the time and URL. The user only sees "Something went wrong on the server".

## Known limitations

- **No real payments.** Rent, deposit, deductions and "refunded" are numbers stored in MongoDB. No money is held, charged or returned, and "refunded" means "the record says the owner should return it".
- **The late fee is shown, not charged.** The agreement says "one day's rent for every day the item is returned late". After the deadline, the return checklist shows how many days late the item is and what the fee would be. The policy doesn't say whether the fee comes out of the deposit or is paid separately, or whether it counts toward the "never more than the deposit" limit, so the app doesn't apply it. Decide that rule first, then store `daysLate` and `lateFee` on the return checklist.
- **An admin's "deactivate" is not permanent.** The owner can switch the listing back on from the edit form.
- **Approval and agreement are two separate writes.** If the database fails exactly between them, the booking is approved but has no agreement. A MongoDB transaction would fix this, but transactions need a replica set (Atlas has one; a plain local MongoDB doesn't).
- If two overlapping requests are approved at exactly the same moment, both may be undone ("Another approved booking already uses these dates"). The owner simply approves one again. It fails safe: never double-booked.
- Several pending requests can overlap. Only approval is blocked.
- The agreement can be accepted at any stage after it exists. Pickup is what requires both acceptances.
- "Today" for the past-date check is the server's local date. Dates are saved as midnight UTC.
- Images are URLs, not uploads. There is no pagination. "I agree" is a simple digital acceptance, **not a legally verified signature**.

## Future improvements

- A real payment gateway for deposits (hold and release).
- ID verification for owners and renters, and insurance for expensive items.
- Legally valid e-signatures for the agreement.
- A MongoDB transaction for "approve + create agreement".
- An automatic late fee, once the collection rule is decided.
- Storing the login token in an httpOnly cookie, with CSRF protection.
- Image uploads, notifications, pagination, and search by city or distance.
- A linter (ESLint) and frontend component tests.
