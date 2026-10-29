# Manual test checklist

Browser checks for the main journeys. The automated API tests (`npm test` in `server/`, see README) cover the same rules from the API side. These checks confirm the pages show them correctly.

## Before you start

- Backend running (`cd server && npm start`); <http://localhost:5000/api/health> says `"database":"connected"`.
- Demo data loaded (`cd server && npm run seed`).
- Frontend running (`cd client && npm run dev`), open <http://localhost:5173>.
- Demo accounts: Priya, Arjun (owners and renters) and Admin. The emails and the shared password are in the README under "Demo logins".
- Use a private window per user, or log out between steps (avatar menu → **Log out**).

Mark each row ✅ / ❌ as you go.

## A. Accounts and access

| # | Steps | Expected |
|---|---|---|
| A1 | **Sign up** with email `test@bad` | Red message "Please enter a valid email address" |
| A2 | Sign up with a valid new email, 6+ character password | You land on Home, logged in; your name is in the navbar menu |
| A3 | Avatar menu → **Log out** | Toast "You have been logged out"; My Listings now asks you to log in |
| A4 | Log in with a wrong password | "Wrong email or password" |
| A5 | Enter a wrong password 5 times, then the right one | "Too many wrong attempts. Please wait 15 minutes and try again." (restart the backend to reset) |
| A6 | Logged out, open `/my-bookings`, `/requests`, `/add` | Each page asks you to log in instead of showing data |
| A7 | As Priya, open `/admin` | "Admins only" |

## B. Listings

| # | Steps | Expected |
|---|---|---|
| B1 | **List an item** with image URL `ftp://x.jpg` | "Image URL must start with http:// or https://" |
| B2 | Fill in the form properly (price 100, deposit 1000, an `https://` image) | Toast "Your item is now listed"; it appears in My Listings and on Home |
| B3 | Price 0, or a negative deposit | Error message, nothing saved |
| B4 | My Listings → **Pause**, then search for it on Home | It no longer appears on Home; **Activate** brings it back |
| B5 | As Arjun, open `/edit/<id of Priya's listing>` | "You can only edit your own listings." |
| B6 | As Arjun, try to **Delete** the "Camera Drone" (it has bookings) | Refused: "This item has rental history, so it cannot be deleted. Pause it instead." |
| B7 | Home: search "camera"; choose a category; sort "Price: high to low"; set min/max price | Only matching items, in the right order |

## C. Booking request and owner decision

| # | Steps | Expected |
|---|---|---|
| C1 | As the owner, open your own item | An owner box instead of the booking form |
| C2 | As Arjun, open your new item, set an end date before the start date | "End date cannot be before start date"; **Request to Rent** disabled |
| C3 | Choose 3 days | Price box shows "₹100 × 3 days" plus the deposit |
| C4 | **Request to Rent** | Toast "Request sent to <owner>"; it appears under My Bookings → Pending |
| C5 | As the owner, **Requests** → **Approve** | Toast "Approved. A rental agreement was created for you both to accept." |
| C6 | Overlapping request: as another user, request the same item for overlapping dates, then approve it as the owner | Red toast "Another approved booking already uses these dates"; it stays pending |
| C7 | As the renter, cancel a *pending* request (My Bookings → **Cancel request** → confirm) | Status becomes cancelled |

## D. Agreement, pickup, return, dispute, review

Continue with the booking approved in C5.

| # | Steps | Expected |
|---|---|---|
| D1 | Owner: open the booking → the agreement | 8 lines of terms, including the late fee line; button **I agree to these terms** |
| D2 | Owner agrees; renter agrees | Toast "You accepted the agreement" each time; the progress bar marks "Agreement" |
| D3 | Owner: before both agree, there is no pickup form. After both agree, fill **Save pickup checklist** | "Pickup checklist saved. The rental is now active." |
| D4 | Renter: **I confirm this condition** | "Pickup confirmed and locked"; the owner can no longer edit pickup |
| D5 | Owner: return checklist with deduction ₹5000 (above the ₹1000 deposit) | The browser refuses the value (max is the deposit); nothing saved |
| D6 | Owner: deduction ₹300, damage text | "Return recorded. Waiting for the renter's answer." |
| D7 | Renter: **Disagree** | Deposit shows "Disputed, admin will decide" |
| D8 | Renter: pick 4 stars, write a comment, **Post review** | "Thanks for your review!"; the review appears; no second review form |
| D9 | Admin: **Admin** → Disputes → set ₹150, leave the reason empty → **Save decision** | Error "Please write a short reason for the decision" |
| D10 | Add a reason → **Save decision** | Toast "Decision saved for …"; the dispute count drops by 1 |
| D11 | Renter: open the booking | "₹150 kept, ₹850 returned" and the admin's reason |

## E. Late return warning

| # | Steps | Expected |
|---|---|---|
| E1 | As the owner, open an **active**, pickup-confirmed booking whose end date has passed | Yellow note "This item is N days late. The agreement's late fee is ₹X per day (₹Y so far). It is not added automatically." |

The seeded active booking ("Wireless Headphones", Arjun's item) ends 2 days after you seed, so this check only shows once its end date has passed. Before that, the note correctly doesn't appear.

## F. Resilience

| # | Steps | Expected |
|---|---|---|
| F1 | Stop the backend, reload Home | "Cannot reach the server. Is the backend running?" |
| F2 | Double-click **Approve** or **Agree** quickly | The button is disabled after the first click; only one action happens |
| F3 | Open `/nonsense` | "This page does not exist" with a link back |
| F4 | Browser phone view (375 px wide), visit every page | No sideways scrolling; the navbar collapses into a menu |
