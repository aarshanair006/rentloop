# RentLoop: 5-minute demo script

The seed data already has one booking at each stage, so you can show the whole life cycle in 5 minutes without creating everything from scratch.

## Setup (do this 15 minutes before)

1. `cd server && npm run seed`. **Reseed on the day of the demo**: the seeded dates are relative to "today".
2. `cd server && npm start` → wait for `MongoDB connected`.
3. `cd client && npm run dev` → open <http://localhost:5173>.
4. In a second terminal, run the tests once and leave the output on screen (see README → "Running the API tests").
5. Use **two browser windows**: a normal one and a private one, so two users can be logged in at once. Zoom to 110–125% so the room can read it.
6. Accounts: the three demo accounts from `seed.js` (Priya, Arjun, Admin). In dev mode the Login page has buttons that fill them in, so you never have to type a password on the projector.

| Seeded booking | Owner → Renter | Stage | Used in step |
|---|---|---|---|
| Mirrorless Camera Kit | Priya → Arjun | pending | 2 |
| City Bicycle | Priya → Arjun | approved, both agreed | 3 |
| Wireless Headphones | Arjun → Priya | active, pickup confirmed | 4 |
| Camera Drone | Arjun → Priya | completed, deposit disputed | 5 |

## Script

| Time | Do this | Say / expect |
|---|---|---|
| **0:00–0:30** Intro | Home page. Type "camera" in search, pick the **Cameras** category, sort by price. | "People list items, others rent them. The server does the search, by title, category and price." Results filter instantly. |
| **0:30–1:15** Request and approval | Window A: log in as **Priya** → **Requests** → **Approve** on the Mirrorless Camera Kit. Open it → **Agreement**. | Toast: "Approved. A rental agreement was created…". "The server checked for overlapping dates, then wrote this agreement: rent, deposit, return deadline, late fee, damage rule." |
| **1:15–2:00** Pickup and lock | Window A (Priya): **Requests** → City Bicycle → **View details** → fill the **pickup checklist** → save. Window B: log in as **Arjun** → My Bookings → City Bicycle → **I confirm this condition**. | "Saved. The rental is now active." Then "Pickup confirmed and locked". "Now the owner can't change the starting condition, and the renter can't deny it." |
| **2:00–2:45** Return and dispute | Window B (Arjun is the owner here): **Requests** → Wireless Headphones → return checklist, condition "damaged", deduction ₹200 → save. Window A (Priya): My Bookings → Wireless Headphones → **Disagree**. | "Return recorded…", then the deposit shows "Disputed, admin will decide". "The deduction can't be more than the deposit; the server checks that too." |
| **2:45–3:30** Admin decision and review | Window B: log out → log in as **Admin** → **Admin** page → Disputes (2) → Camera Drone: enter ₹500 and a reason → **Save decision**. Window A (Priya): open the Camera Drone booking. | Toast "Decision saved…". Priya sees "₹500 kept, ₹… returned" and the reason. "Every decision needs a written reason." |
| **3:30–4:15** Proof it's enforced | Show the terminal with `npm test`: **42 pass**. Point at "never double-books when overlapping approvals arrive at the same moment". Window A (Priya): open `/admin` in the address bar. | "These tests call the API directly, like Postman. Hiding a button isn't security; the server refuses it." Priya sees "Admins only". |
| **4:15–5:00** Honest limits and close | README → Known limitations. | "Deposits are records, not payments. The late fee is shown on the return form but not charged, because the collection rule isn't decided. Next would be a payment gateway and a database transaction around approval." |

## If something goes wrong

| Problem | Fallback |
|---|---|
| Atlas unreachable (Wi-Fi, IP not allowed) | Add the venue IP in Atlas → Network Access. Or point `MONGO_URI` at a local MongoDB (`mongodb://127.0.0.1:27017/rentloop`), run `npm run seed`, and restart. |
| No internet at all | Use a local MongoDB as above. Item photos come from Unsplash URLs, so cards show a placeholder; the flow still works. |
| Seeded booking already used (you rehearsed on it) | `npm run seed` again; it resets only the demo accounts' data. |
| "Too many wrong attempts" | Restart the backend (the limit is in memory). |
| Laptop can't run anything | Show the `npm test` output saved as a screenshot, and walk through `VIVA_GUIDE.md` §4 using the code. |

## Check these the day before

- [ ] `npm run build` in `client` succeeds
- [ ] `npm test` in `server` shows **42 pass**, not "skipped"
- [ ] Log in as each demo account
- [ ] Each seeded booking is at the stage in the table above
- [ ] Home loads images (internet) or you've accepted the placeholders
- [ ] `/api/health` says `"database":"connected"` on the venue network
- [ ] You can explain: the overlap condition, why approval saves first and checks after, and what "locked" means
