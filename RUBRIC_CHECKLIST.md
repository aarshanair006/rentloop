# Rubric evidence checklist

This collects the evidence for each marking criterion. It doesn't predict a mark; it points the evaluator at what can be checked.

Status key: **PASS** = checked and worked · **FAIL** = checked and broken · **NOT RUN** = not checked.

The checks below were run on 29 Oct 2026 on Windows 11 with Node 24.14.1 and npm 11.11.0.

---

## A. Project implementation and functionality (10)

| Feature | Where it is implemented | Evidence | Status | Gaps |
|---|---|---|---|---|
| Sign up and login (bcrypt + JWT) | `server/routes/users.js`, `server/auth.js` | tests: "registers a user and never returns the password", "refuses bad sign-up input with 400", "gives the same message for a wrong password and an unknown email" | PASS | — |
| Protected routes | `requireLogin` in `auth.js` | tests: "needs a token", "rejects a fake token", "rejects an expired token" | PASS | The token is in `localStorage` (see README → Security notes) |
| Admin-only routes | `requireAdmin`, `routes/admin.js` | test "keeps admin routes for admins"; browser: Priya on `/admin` sees "Admins only" | PASS | Admins are created only by the seed |
| Login attempt limit | `isBlocked`/`recordFailedLogin` in `users.js` | test "blocks an email after 5 wrong passwords, without blocking other users" | PASS | In memory: resets on restart, not shared between servers; no sign-up limit |
| Listings: create, edit, pause, delete, search | `routes/listings.js` | 9 listing tests (ownership 403, validation 400, pause hides from search, no delete with bookings, filters and sort, query injection ignored); browser: created a listing, the bad image URL was refused | PASS | An admin's deactivation can be undone by the owner |
| Booking request, dates, price | `routes/bookings.js` (`isRealDate`, `findOverlap`) | tests: "refuses wrong dates" (end before start, past, 31 Feb), "counts both days and works out the rent on the server" (3 days × ₹600) | PASS | "Today" is the server's local date |
| Owner decision and life cycle | `STATUS_RULES`/`canChangeStatus` in `models.js` | tests: "only lets the owner approve", "approves and creates the agreement", "lets the renter cancel a pending request" | PASS | — |
| Overlap and simultaneous approvals | approve-then-verify in `bookings.js` | tests: "refuses to approve an overlapping request…", "never double-books when overlapping approvals arrive at the same moment" (8 parallel rounds), "handles a double-clicked approve without a server error", "lets only one of approve and cancel win…". Before this change the same checks failed: 8/8 rounds double-booked, and a double click gave a 500. | PASS | Simultaneous approvals may both be undone; the owner retries |
| Rental agreement | `buildTermsText` in `models.js`, `routes/agreements.js` | tests: "approves and creates the agreement", "keeps the agreement private…", "blocks pickup until both have accepted" (includes accepting twice → 400) | PASS | Approve and agreement creation aren't one transaction |
| Pickup checklist and lock | `routes/checklists.js` | tests: "lets only the owner fill the pickup checklist…", "locks the pickup checklist once the renter confirms" | PASS | — |
| Return, deposit record, dispute | `routes/checklists.js`, `routes/admin.js` | tests: "keeps the deduction between 0 and the deposit", "completes the booking on return…", "lets only the renter answer…", "lets the admin resolve the dispute once, with a reason" | PASS | Deposit is a record only; no payment |
| Late fee | agreement text; `ReturnForm.jsx` shows days late | browser: an overdue test booking showed "This item is 3 days late… ₹300 so far. It is not added automatically." | PASS (display only) | **Not charged.** The collection rule is undecided; see README |
| Reviews | `routes/reviews.js` | tests: "does not allow a review before the rental is completed", "lets only the renter review, once, with a rating from 1 to 5" | PASS | — |
| Safe errors | error handler in `server/app.js` | tests: "hides internal error text for a wrong field type", "answers broken JSON with a JSON 400" | PASS | — |
| Double-submit protection (UI) | `busyId` in `OwnerRequests.jsx`, `sending` in `BookingActions.jsx`, `saving` in `Admin.jsx` and the forms | browser: 3 fast clicks on Approve → the button was disabled after the first, and 1 request was sent | PASS | Pause/Delete/Cancel-request buttons rely on the server's checks instead |
| Frontend production build | `client` | `npm run build` → `✓ built` (in the project and in a clean copy) | PASS | — |
| Full journey in the browser | all pages | Run on a local test database: register → list → request → approve → both agree → pickup → confirm → return → disagree → review → admin decision; every step showed its expected message | PASS | Not run on your Atlas database, to keep it clean |
| Lint | — | no linter is configured | NOT RUN | Adding ESLint is a possible improvement |

**Automated test command and result:**
`TEST_MONGO_URI=mongodb://127.0.0.1:27999/rentloop_test npm test` → `tests 42, pass 42, fail 0`. It was run in the project and again in a clean copy installed with `npm ci`.

---

## B. GitHub repository and documentation (5)

| Check | How it was checked | Result |
|---|---|---|
| `.gitignore` covers dependencies, build output and env files | Read the file: `node_modules`, `dist`, `.env`, `.env.*`, `!.env.example` | PASS |
| Example env files have placeholders only | `server/.env.example`, `client/.env.example` | PASS |
| No real secret in any file except `server/.env` | Searched the project for the Atlas user, password, cluster name and the JWT secret | PASS (0 hits) |
| Submission zip has no `.env`, `node_modules` or `dist` | Listed and searched the zip contents (see the final report) | PASS |
| Clean install works | Copied the project without `.env`/`node_modules`/`dist` → `npm ci` (server, client) → `npm run build` → server without `.env` prints the "missing" message → `npm test` 42/42 → seeded a fresh DB and ran the demo script in the browser | PASS |
| Docs match the code | Every endpoint, message and rule in the docs was checked against the source or seen in a test or browser run | PASS |
| Git repository | This folder is **not a Git repository** (`git status` fails). No commits or pushes were made. | To do before submission (see below) |

**Documentation in the project:**

| File | What it contains |
|---|---|
| `README.md` | problem, users, implemented vs planned, stack, structure, setup, env table, run/build/test commands, workflow, troubleshooting, security notes, limitations |
| `API_DOCUMENTATION.md` | every endpoint: auth, fields, rules, responses, errors, business rules |
| `MANUAL_TEST_CHECKLIST.md` | 30+ browser checks with preconditions and expected messages |
| `EXPLAIN.md` | file-by-file explanation |
| `VIVA_GUIDE.md` | intro, architecture, flows, security, 25 viva questions |
| `DEMO_SCRIPT.md` | 5-minute timed demo, fallbacks, pre-demo checks |

**Remaining gaps:**
- Put the project on GitHub yourself. Run `git init`, check that `git status` doesn't list `.env`, then commit and push. A few commits that tell the story of the work are better than one big one.
- Change the Atlas database password before publishing anything, because it was shared earlier.

---

## C. Demonstration and viva (5)

| Item | Where |
|---|---|
| Timed 5-minute demo using seeded bookings at every stage | `DEMO_SCRIPT.md`. A dry run on a clean install passed every step: approve, pickup, confirm, return, disagree, admin decision with an empty-reason error first, "Admins only". |
| Things worth showing in code | `models.js` (`STATUS_RULES`, `loadBookingForUser`), `routes/bookings.js` (approve-then-verify, `isRealDate`), `auth.js` (`jwt.verify`), `app.js` (error handler), `tests/api.test.js` (the simultaneous-approval test) |
| Viva questions to prepare | `VIVA_GUIDE.md` §9 (25 questions). The most likely: hashing vs encryption, what's in the JWT, the overlap formula, simultaneous approvals, why the deposit isn't real money, why the late fee isn't charged |
| Risks before presenting | Atlas IP allow-list on the venue network; reseeding on the day; internet for Unsplash images; the login limit is in memory (restart to reset). The fallbacks are in `DEMO_SCRIPT.md`. |
