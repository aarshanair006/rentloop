# RentLoop viva guide

How RentLoop works, explained from the actual code, plus likely questions. For a file-by-file tour, see [EXPLAIN.md](EXPLAIN.md).

---

## 1. Project introduction (about 90 seconds)

> "RentLoop is a peer-to-peer rental website. Anyone can list something they own, like a camera, a laptop or a suit, and anyone else can rent it for a few days.
>
> The hard part of renting to a stranger is trust. The owner worries about damage, and the renter worries about being blamed for damage that was already there. So RentLoop doesn't stop at 'request and approve'. When the owner approves, the system writes a rental agreement that both people must accept. At handover, the owner records the item's condition, and the renter confirms it, which locks that record. At return, the owner records the condition again and can ask to keep part of the deposit. If the renter disagrees, an admin compares the two checklists and decides.
>
> It's built with React and Vite on the frontend, and Node, Express and MongoDB on the backend. Passwords are hashed with bcrypt, and logins use JWT tokens. Every rule, like who can approve, overlapping dates, and the deposit limits, is checked on the server, and there are 42 automated API tests that prove it, including a test where two approvals arrive at the same moment.
>
> The deposit is only a record. No real payment happens, and I'll show what isn't implemented as well."

## 2. Problem, users and use cases

| Role | Main use cases |
|---|---|
| Owner | list an item, pause or edit it, approve or reject requests, accept the agreement, fill the pickup and return checklists, ask for a deduction |
| Renter | search, request dates, cancel while pending, accept the agreement, confirm pickup condition, agree or disagree with the return, review |
| Admin | see users and listings, deactivate a listing, resolve deposit disputes |

One account can be owner and renter. Admin is a database flag (`isAdmin`) set by `seed.js`.

## 3. Architecture

```
Browser: React pages (client/src/pages)
   | callApi() in client/src/api.js  -> fetch + "Authorization: Bearer <token>"
   v
Express API (server/app.js mounts server/routes/*.js)
   | requireLogin / requireAdmin (server/auth.js)
   | business rules in the route + helpers in server/models.js
   v
MongoDB via Mongoose models (User, Listing, Booking, RentalAgreement, Review)
```

- The frontend never talks to MongoDB, and it never decides anything important. It only shows what the API returns.
- `server/server.js` reads `.env`, connects to MongoDB, then starts `app.js` on port 5000.
- `app.js` is separate so the tests can start the same app in-process.

## 4. Two request/response flows

### Login
1. `Login.jsx` calls `callApi("/users/login", "POST", { email, password })`.
2. `routes/users.js`:
   - checks the fields are text
   - checks the login limit (5 wrong tries per email+IP in 15 min, kept in a `Map`)
   - finds the user by lowercase email
   - runs `bcrypt.compare(password, user.password)`
3. If it's wrong: it records the failure and returns `401 "Wrong email or password"`, the same message for an unknown email.
4. If it's right: `jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" })` and it returns `{ token, user }` (without the password).
5. `App.jsx` `handleLogin` saves the token and user in `localStorage` and in React state, and the navbar updates.
6. On every later call, `api.js` adds `Authorization: Bearer <token>`. On page load, `App.jsx` calls `/users/me` to check the saved token still works.

### Owner approves a booking
1. In `OwnerRequests.jsx`, clicking **Approve** disables the button and calls `PATCH /api/bookings/:id/status { status: "approved" }`.
2. `requireLogin` verifies the JWT and loads `req.user`.
3. `loadBookingForUser()` (models.js) finds the booking and works out whether you are its `owner` or `renter`, otherwise 404/403.
4. `canChangeStatus("pending", "approved", role)` looks the change up in `STATUS_RULES`. Only `"owner"` may do it.
5. `findOneAndUpdate({ _id, status: "pending" }, { status: "approved" })`. If someone changed it in between, it returns `null` → `409`.
6. `findOverlap()` looks for another `approved`/`active` booking with `start <= myEnd AND end >= myStart`. If one exists, the approval is undone (back to `pending`) → `400`.
7. Otherwise `buildTermsText()` writes the agreement and `RentalAgreement.create()` saves it → `200`.
8. The page shows a toast and reloads the list.

## 5. Key files

| Path | Purpose |
|---|---|
| `server/server.js` | checks `MONGO_URI`/`JWT_SECRET`, connects, listens |
| `server/app.js` | CORS, JSON body limit, mounts routes, 404, error handler (safe messages) |
| `server/auth.js` | `requireLogin` (verify the JWT, load the user without the password), `requireAdmin` |
| `server/models.js` | 5 schemas, `roleOf()`, `loadBookingForUser()`, `STATUS_RULES` + `canChangeStatus()`, `buildTermsText()` |
| `server/routes/bookings.js` | request (date checks, rent calculation), lists, approve/reject/cancel |
| `server/routes/checklists.js` | booking details, pickup, confirm, return, renter's answer |
| `server/routes/agreements.js` | view and accept |
| `server/routes/admin.js` | `router.use(requireLogin, requireAdmin)` and then the admin actions |
| `server/tests/api.test.js` | 42 API tests (`npm test`) |
| `client/src/api.js` | the one place that calls `fetch`; adds the token; turns errors into messages |
| `client/src/App.jsx` | logged-in user state and the route → page table |
| `client/src/pages/BookingDetails.jsx` + `components/BookingActions.jsx` | progress bar and "what you can do next" panels |

## 6. Security in this implementation

- **Hashing:** `bcrypt.hash(password, 10)` at sign-up. The salt is stored inside the hash, and the database never holds the plain password. `publicUser()` and `.select("-password")` keep the hash out of responses.
- **JWT:** it is signed with `JWT_SECRET` and holds only `userId`. It is verified on every protected request, and an expired or edited token → 401. The server doesn't store sessions.
- **Authorization on the server:**
  - listing changes compare `listing.owner` with `req.user._id`
  - booking actions use `roleOf()` and `STATUS_RULES`
  - admin routes use `requireAdmin`
  - Hiding a button on the page is only for convenience; the API refuses the action anyway.
- **Input:**
  - type checks (so an object like `{ "$gt": "" }` can't be used as an email)
  - the regex in search is escaped
  - dates are checked with `isRealDate()`
  - image URLs must be `http(s)`
  - a 100 KB body limit
- **Errors:** routes call `next(error)`. The handler in `app.js` returns a short message and logs the details. Raw database text never reaches the user.
- **Limits:**
  - The token is in `localStorage`, so an XSS bug could steal it.
  - The login limit lives in memory, so it resets on restart.
  - Sign-up has no rate limit.

## 7. Dates, prices, overlaps and states

- **Dates:**
  - They arrive as `"YYYY-MM-DD"` and are stored as midnight UTC.
  - `isRealDate()` turns the text into a date and back, so `2026-02-31` (which JavaScript silently turns into 3 March) is refused.
  - The start can't be before today, and the end can't be before the start.
- **Price:** `days = Math.round((end - start) / ONE_DAY) + 1` (both days count), `totalRent = days × pricePerDay`. It is computed on the server, so the browser can't send its own price.
- **Overlap:** `existing.start <= new.end AND existing.end >= new.start`, against `approved` and `active` bookings only. It is checked when a request is made and again when it's approved.
- **States:**
  - `pending → approved/rejected` (owner)
  - `pending → cancelled` (renter)
  - `approved → active` (pickup saved, both agreed)
  - `active → completed` (return saved, pickup confirmed)
- **Simultaneous approvals:**
  - "Check, then save" has a gap where two requests both pass the check.
  - RentLoop saves first, then checks, and undoes on a clash. The second checker always sees the first approval.
  - The test "never double-books when overlapping approvals arrive at the same moment" fires two approvals together 8 times. Before this change, the item was double-booked 8 out of 8 times.

## 8. Agreements, checklists, deposits, disputes, reviews

- **Agreement:**
  - created on approval with 8 fixed lines of terms (`buildTermsText`), never edited afterwards
  - the owner and the renter each click "I agree" (stored as `ownerAcceptedAt`/`renterAcceptedAt`)
  - pickup is refused until both have agreed
- **Pickup:**
  - the owner records condition, defects, accessories, photo URL and notes, and the booking becomes `active`
  - the owner can correct it until the renter clicks "I confirm this condition", which sets `renterConfirmedAt` and locks it
- **Return:**
  - only after the pickup is confirmed
  - the owner records the condition and a deduction from 0 up to the deposit, and the booking becomes `completed`
- **Deposit status:**
  - `recorded` until the renter answers
  - agree → `refunded` (no deduction) or `deducted`
  - disagree → `disputed` → the admin sets `finalDeduction` (0 up to the deposit) with a reason → `refunded`/`deducted`
- **Reviews:** only the renter, only for a `completed` booking, once (also a unique index), rating 1–5.
- **Not implemented:**
  - real payments (no money moves)
  - automatic late fees (the return form only *shows* days late and the fee from the agreement)
  - legally valid signatures
  - admin blocking that the owner can't undo

## 9. Likely viva questions

1. **Why hash passwords instead of encrypting them?** Hashing is one-way: even we can't get the password back. Login hashes what you type and compares (`bcrypt.compare`). Encryption can be reversed by anyone who has the key.
2. **What does the 10 in `bcrypt.hash(password, 10)` mean?** The cost factor: 2¹⁰ rounds. It makes each guess slow, which hurts attackers trying millions of passwords.
3. **What is inside your JWT?** Only `{ userId }`, plus the issued-at and expiry times. It is signed, not encrypted, so we never put secrets in it.
4. **How does the server know the token is real?** `jwt.verify` recomputes the signature with `JWT_SECRET`. If anyone changed the token, or it has expired, it throws, and we answer 401.
5. **What happens if a user is deleted but still has a token?** `requireLogin` loads the user from the database; if it doesn't exist → 401 "User no longer exists".
6. **Where is the token stored, and is that safe?** In `localStorage`. It's simple, but a script injected by an XSS bug could read it. React escaping lowers that risk. An httpOnly cookie is an alternative, but it then needs CSRF protection.
7. **How do you stop Arjun editing Priya's listing?** `findOwnListing()` compares `listing.owner` with `req.user._id` → 403. The test "stops other users editing or deleting the listing" checks it.
8. **Couldn't someone just call the API with Postman to approve their own request?** No. `canChangeStatus(from, to, role)` only allows `pending→approved` for the owner. The test "only lets the owner approve" checks it.
9. **How do you calculate the rent?** On the server: days = difference in days + 1, times `pricePerDay`. 5 Nov to 7 Nov = 3 days.
10. **What is your overlap condition, and why does it work?** `existing.start <= new.end && existing.end >= new.start`. Two ranges are apart only if one ends before the other starts; this is the opposite of that.
11. **What if two approvals happen at the same time?** We save the approval first, then check for a clash, and undo it if there is one. A plain check-then-save can't guarantee this. The test fires approvals in parallel 8 times and never gets a double booking.
12. **What is the 409 error?** The status change uses `findOneAndUpdate({ _id, status: <what we read> })`. If the renter cancelled at the same moment, the filter doesn't match, and we say "changed by someone else".
13. **Why not a MongoDB transaction?** It needs a replica set. Atlas has one, but a plain local MongoDB doesn't. Our approach works on both. A transaction would still help to make "approve + create agreement" all-or-nothing, which is a known limitation.
14. **Why must both accept the agreement before pickup?** So neither side can say they didn't know the terms (deposit, late fee, damage rule). The pickup route checks both timestamps.
15. **What does "locked" mean for the pickup checklist?** Once the renter confirms, `renterConfirmedAt` is set, and the pickup route refuses any edit. It is the agreed starting condition.
16. **Can the owner keep the whole deposit for no reason?** They can only *ask* for up to the deposit. If the renter disagrees, the admin decides, and the decision needs a written reason.
17. **Is any real money involved?** No. Deposit and deduction are recorded numbers. "Refunded" means the record says the owner should return it.
18. **Is the late fee charged?** No. The agreement mentions it, and the return form shows days late × the daily rent. The collection rule (from the deposit or separate, and capped or not) isn't decided, so we don't invent one.
19. **Who can write a review?** Only the renter of a completed booking, once. That's 3 checks in `reviews.js`, plus a unique index on `booking`.
20. **Why can't an item with bookings be deleted?** Old bookings and reviews would point at nothing, and the renter's history page would break. The owner can pause it instead.
21. **How do you handle errors without leaking details?** Every route's `catch` calls `next(error)`. The handler in `app.js` logs the error with the time and URL, and replies "Something went wrong on the server". Validation and parse errors become 400.
22. **What does CORS do here?** With `CLIENT_URL` set, browsers only let our frontend call the API. It isn't a security boundary for tools like Postman, which is why the server checks every request.
23. **How does the frontend know where the API is?** `VITE_API_URL` at build time, otherwise `http://localhost:5000/api`.
24. **How did you test it?** 42 automated API tests with Node's built-in test runner (`npm test`) against a separate test database, plus the browser checklist in `MANUAL_TEST_CHECKLIST.md` and a full click-through of the main journey.
25. **What would you add next?** A payment gateway with deposit hold and release, a transaction for approve + agreement, an automatic late fee once the rule is decided, image uploads, and httpOnly cookie sessions.

## 10. Honest limitations and future work

The full list is in the README under "Known limitations". Be ready to say these without being asked:

- payments are records only
- the late fee is shown, not charged
- the login limit is in memory
- the token is in `localStorage`
- approve + agreement isn't one transaction
- an admin's deactivation can be undone by the owner
- there's no linter and no frontend unit tests
