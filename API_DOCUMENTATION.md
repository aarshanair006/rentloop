# RentLoop API

Base URL in development: `http://localhost:5000/api`. Every route is in `server/routes/`, and `server/app.js` mounts them.

## Conventions

- Request and response bodies are JSON (`Content-Type: application/json`, max 100 KB).
- Success: `{ "data": ... }`. Error: `{ "message": "..." }`.
- 🔒 = needs the header `Authorization: Bearer <token>` (the token comes from register or login and is valid for 7 days).
- 👑 = admin accounts only (`isAdmin: true`). Admin accounts are created by `seed.js`; there is no sign-up for admins.
- IDs are MongoDB ObjectIds. An ID that isn't valid gives `404`, not a server error.
- Dates are sent as `YYYY-MM-DD` and stored as midnight UTC.

| Status | Meaning |
|---|---|
| 400 | bad input or an action not allowed at this stage (the message says why) |
| 401 | no token, a wrong or expired token, or a wrong email or password |
| 403 | logged in, but not allowed (not the owner, renter or admin) |
| 404 | not found, or no route |
| 409 | the booking was changed by someone else at the same moment, or a duplicate record |
| 429 | too many wrong passwords for this email from this IP |
| 500 | unexpected server error. The message is always "Something went wrong on the server. Please try again."; details only go to the server log |

---

## Health

### `GET /health`
Returns `{ server: "running", database: "connected" | "not connected" }`.

---

## Users (`routes/users.js`)

### `POST /users/register`
| Field | Rules |
|---|---|
| `name` | required text |
| `email` | required, looks like `x@y.z`, unique (stored in lowercase) |
| `password` | 6 to 72 characters (bcrypt only uses the first 72 bytes) |
| `city` | optional text |

`201` → `{ token, user }`, where `user` is `{ _id, name, email, city, isAdmin }` and never includes the password.
Errors: `400` missing or invalid field, or "This email is already registered".

### `POST /users/login`
`{ email, password }` → `200 { token, user }`.
Errors:
- `400` a field is missing or isn't text
- `401` "Wrong email or password" (the same message for an unknown email)
- `429` after 5 wrong passwords for the same email and IP within 15 minutes. This is kept in memory and resets when the server restarts.

### `GET /users/me` 🔒
The logged-in user, same shape as above. The frontend calls it on page load to check that a saved token still works.

---

## Listings (`routes/listings.js`)

### `GET /listings`
Public. Only active listings. Query parameters (all optional, plain text):

| Param | Effect |
|---|---|
| `search` | title contains this text (case-insensitive; regex characters are escaped) |
| `category` | one of `Electronics, Cameras, Vehicles, Books, Fashion, Sports` |
| `minPrice`, `maxPrice` | bounds on `pricePerDay` |
| `sort` | `priceLow`, `priceHigh`, anything else = newest first |

Arrays (`?search=a&search=b`) and objects (`?category[$ne]=x`) are ignored. Each listing has `owner: { name, city }`.

### `GET /listings/mine` 🔒
The user's own listings, active and paused.

### `GET /listings/:id`
One listing (active or not), with `owner: { name, city }`. `404` if missing.

### `POST /listings` 🔒
| Field | Rules |
|---|---|
| `title` | required text |
| `category` | one of the 6 categories |
| `condition` | `new`, `good` or `used` |
| `pricePerDay` | number > 0 |
| `deposit` | number ≥ 0 |
| `imageUrl` | starts with `http://` or `https://` |
| `description`, `city` | optional text |
| `isActive` | optional, default `true` |

`201` → the listing. The owner is always the logged-in user; an `owner` field in the body is ignored.

### `PUT /listings/:id` 🔒
The owner only (`403` otherwise). Same fields and rules as create, so send the whole listing.

### `DELETE /listings/:id` 🔒
The owner only. `400` if the item has ever been booked ("Pause it instead"), so old bookings and reviews never point at a missing item.

---

## Bookings (`routes/bookings.js`)

### `POST /bookings` 🔒
`{ listingId, startDate, endDate }`

Checked in this order:
1. Both dates are real calendar dates in `YYYY-MM-DD` form (`2026-02-31` is refused).
2. The start is not before today (the server's date).
3. The end is not before the start.
4. The listing exists (`404`) and is active.
5. You are not the owner.
6. No `approved` or `active` booking of this item overlaps. Overlap means `existing.start <= new.end AND existing.end >= new.start`.

`201` → the booking with `status: "pending"`. The server computes:
- `days = (end − start) / 1 day + 1`
- `totalRent = days × pricePerDay`
- `deposit = listing.deposit`

### `GET /bookings/mine` 🔒
Bookings where you are the renter. Each includes `listing: { title, imageUrl }` and `owner: { name }`.

### `GET /bookings/requests` 🔒
Bookings for your items. Each includes `listing: { title, imageUrl }` and `renter: { name, city }`.

### `PATCH /bookings/:id/status` 🔒
`{ status: "approved" | "rejected" | "cancelled" }`

| Change | Who |
|---|---|
| `pending → approved` | owner |
| `pending → rejected` | owner |
| `pending → cancelled` | renter |

Anything else gives `400` ("You cannot change this booking from X to Y"). `active` and `completed` can only be reached through the checklists.

- The change only applies if the status is still the one the server just read. Otherwise you get `409` "This booking was just changed by someone else".
- On approve, the server checks for an overlapping `approved` or `active` booking **after** switching the status. If it finds one, it puts the booking back to `pending` and returns `400` "Another approved booking already uses these dates". If not, it creates the rental agreement.
- `403` if you are neither owner nor renter.

---

## Booking details and checklists (`routes/checklists.js`, also under `/bookings`)

Only the booking's owner and renter can use these (`403` for anyone else).

### `GET /bookings/:id` 🔒
`{ booking, role: "owner" | "renter", agreement | null, review | null }`. The booking includes `listing: { title, imageUrl, pricePerDay }`, `owner` and `renter: { name, city }`.

### `PUT /bookings/:id/pickup` 🔒 (owner)
`{ condition (required), defects, accessories, photoUrl, notes }`
- The booking must be `approved` or `active`.
- Both people must have accepted the agreement.
- Refused once the renter has confirmed it (locked).

Saving switches `approved → active`. The owner can correct it until the renter confirms.

### `POST /bookings/:id/pickup/confirm` 🔒 (renter)
The booking must be `active` with a pickup checklist. Saves `pickupCheck.renterConfirmedAt`, which locks the checklist. A second confirm gives `400`.

### `PUT /bookings/:id/return` 🔒 (owner)
`{ condition (required), missingAccessories, damageDescription, damagePhotoUrl, deductionAmount, notes }`
- The booking must be `active`, and the renter must have confirmed pickup.
- `deductionAmount` must be between 0 and the booking's deposit.

The booking becomes `completed`. `depositStatus` stays `recorded` until the renter answers.

### `POST /bookings/:id/return/respond` 🔒 (renter)
`{ response: "agree" | "disagree", comment }`. The return must be recorded and not answered yet.
- `agree` with a deduction of 0 → `refunded`
- `agree` with a deduction above 0 → `deducted`
- `disagree` → `disputed` (it goes to the admin)

---

## Agreements (`routes/agreements.js`)

The agreement is created by the approve action above. Its `termsText` (8 lines, built by `buildTermsText()` in `models.js`) is never edited afterwards.

### `GET /agreements/:bookingId` 🔒 (owner or renter)
`{ agreement, booking (with listing title), role }`. `404` "No agreement yet" before approval.

### `POST /agreements/:bookingId/accept` 🔒 (owner or renter)
Sets `ownerAcceptedAt` or `renterAcceptedAt`, depending on who calls. A second accept by the same person gives `400`. The booking status isn't checked here; pickup is what requires both acceptances.

---

## Reviews (`routes/reviews.js`)

### `POST /reviews` 🔒
`{ bookingId, rating, comment }`.
- Only the renter of that booking (`403` otherwise).
- Only when the booking is `completed`.
- `rating` must be a whole number from 1 to 5.
- One review per booking (`400` for a second one; the database also has a unique index).

`201` → the review.

### `GET /reviews/listing/:listingId`
Public. `{ reviews (newest first, with reviewer name), averageRating }`. The average is rounded to 1 decimal place, or 0 if there are no reviews.

---

## Admin (`routes/admin.js`) 🔒👑

Every route first runs `requireLogin` and then `requireAdmin` (`403` "Admins only").

| Route | Does |
|---|---|
| `GET /admin/users` | all users, without passwords |
| `GET /admin/listings` | all listings with the owner's name |
| `PATCH /admin/listings/:id/deactivate` | sets `isActive: false` (the owner can turn it back on) |
| `GET /admin/disputes` | bookings with `depositStatus: "disputed"`, with the listing title and owner and renter names |
| `POST /admin/bookings/:id/resolve` | `{ finalDeduction, reason }`, see below |

For `resolve`:
- The booking must be `disputed`.
- `finalDeduction` must be between 0 and the deposit.
- `reason` is required.

It saves `adminDecision` and sets `depositStatus` to `deducted` (if more than 0) or `refunded`. A second resolve gives `400`, because the booking is no longer disputed.

---

## Business rules

All of these are checked on the server, so calling the API directly (for example with Postman) cannot get around them:

- Passwords are bcrypt-hashed (10 rounds) and never returned.
- Only the owner edits, pauses or deletes a listing. A listing with bookings can't be deleted.
- You can't book your own item. Dates must be real, the start not in the past, and the end not before the start.
- No two `approved`/`active` bookings of one item overlap. This holds even when two approvals arrive at the same moment (it is checked after the change and undone on a clash).
- Status changes follow the table above. Each one only applies if nobody changed the booking in between.
- Pickup needs both agreement acceptances. Return needs the renter's pickup confirmation. A confirmed pickup checklist can't be edited.
- A deduction or the admin's final deduction is between 0 and the deposit.
- Reviews: the renter, a completed booking, once.
- Deposits are records only; no payment is made.
