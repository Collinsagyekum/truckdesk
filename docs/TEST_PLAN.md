# TruckDesk — Manual Test Plan

Work through these on a real device (ACE) and/or the simulator. Check each box
as it passes. Anything that fails, note the screen + what you saw.

**Demo driver login:** `appreview@numdaanalytics.com` — on the code screen enter
the 6-digit code from `~/Desktop/app-review-login.txt` (currently `954259`). No
email is sent; that code acts as the password for this account.

**Useful trigger values**
- Negotiation script shows only for a "counter" rate: **$1,900 for 1,000 miles** ($1.90/mi).
- "Go" rate: 2,200 / 1,000. "Pass" rate: 1,500 / 1,000.
- Per diem uses the "Days Away" slider (defaults to 15 → $1,035).

---

## A. Authentication
- [ ] **A1** Email tab → enter the demo email → "Send Email Code" jumps straight to the 6-digit screen (no email needed).
- [ ] **A2** Enter `954259` → lands on the driver home as "Demo Driver".
- [ ] **A3** Enter a wrong 6-digit code → shows "Invalid verification code", stays on the screen.
- [ ] **A4** Close and reopen the app → still signed in (session persists).
- [ ] **A5** Account screen → Sign out → returns to the login page.
- [ ] **A6** (Owner) Sign in with an owner account → lands on Fleet Overview, not the driver home.

## B. Driver — Home
- [ ] **B1** With data: Net Profit / Miles / Active Loads show real this-week numbers.
- [ ] **B2** With an empty account: all three read $0 / 0 — **no error toast**, no fake rows.
- [ ] **B3** Notification bell badge reflects real items only (active load / maintenance); "You're all caught up" when none.
- [ ] **B4** Recent Activity lists real loads, expenses, and MilesBot miles (newest first); empty message when nothing logged.
- [ ] **B5** Quick Actions: New Load, Add Expense, MilesBot Log all navigate correctly.
- [ ] **B6** "Text MilesBot" button only appears if `VITE_MILESBOT_WHATSAPP` is set (otherwise hidden, not a dead link).

## C. Driver — Loads
- [ ] **C1** Loads list shows your loads; empty account shows "No loads yet" (not fake loads).
- [ ] **C2** New Load: type rate 1900 + miles 1000 → calculator shows fuel cost, rate/mile, and a **Counter** recommendation.
- [ ] **C3** The negotiation script box appears and fills in after ~1s; it does **not** regenerate on every keystroke.
- [ ] **C4** If the script says "template" + mentions $3.82/gal → the AI call failed (fallback). A real script won't mention that price.
- [ ] **C5** rate 2200/1000 → "Go" (no script). rate 1500/1000 → "Pass" (no script).
- [ ] **C6** Save the load → it appears in the list and the Home/Taxes numbers move.
- [ ] **C7** Load detail: gross rate, total expenses, net profit, RPM; linked expenses list; delete works and returns to the list.
- [ ] **C8** Turn on Airplane Mode, open Loads → shows "Couldn't load" + Try again (not an empty list, not fake data).

## D. Driver — Expenses
- [ ] **D1** Expenses list / empty state; category filter pills only show categories you actually have.
- [ ] **D2** Add Expense → attach a receipt from **Camera** (permission prompt uses TruckDesk's own wording).
- [ ] **D3** Add Expense → attach a receipt from **Photo Library** (permission prompt uses TruckDesk's wording).
- [ ] **D4** Save → appears in the list; the form keeps your input if a save fails.
- [ ] **D5** Save with a receipt that fails to upload → "Expense saved, but the receipt photo couldn't be uploaded" (partial save, not a hard failure).
- [ ] **D6** Swipe to delete an expense → it's removed.

## E. Driver — Compliance
- [ ] **E1** All four tabs fit on screen and are tappable: Maintenance, Documents, HOS, IFTA (no sideways scrolling).
- [ ] **E2** Current Odometer reads **"Not set"** (the vehicles table isn't provisioned) — no error toast.
- [ ] **E3** Update Odometer with no truck on file → honest message ("no truck on file… can't be saved"), not a fake success.
- [ ] **E4** Log a completed service → appears in the schedule.
- [ ] **E5** Documents: each slot shows expiry status or "Not provided"; "Scan on file: Yes/No" (never a fake "Verified").
- [ ] **E6** Upload a document scan → card updates; a failed upload shows an error and keeps the dialog open.
- [ ] **E7** HOS tab shows the "not tracked in TruckDesk — use your ELD" notice. **No fixed clocks, no "you're in compliance" claim.**
- [ ] **E8** IFTA tab groups fuel by state for the **current quarter + year**; CSV export filename includes the right year; empty state when no eligible fuel.

## F. Driver — Taxes (Financial Intelligence)
- [ ] **F1** If locked: "Unlock for Free" (says Free during beta, nothing charged) → unlocks the dashboard.
- [ ] **F2** KPIs: YTD Gross Revenue, Write-Offs, Est. Per Diem, Net Taxable Profit all reflect real data ($0 when empty).
- [ ] **F3** Drag "Days Away From Home" slider → per diem + net taxable update; only **one** advisor request fires after you stop (not one per tick).
- [ ] **F4** Headline advice: a real one-sentence tip tied to your numbers. If it says "General tax tip" → the AI call fell back (still labeled honestly).
- [ ] **F5** **Ask a question** → chat opens cleanly: header visible, four suggested questions, keyboard not jammed over everything.
- [ ] **F6** Tap a suggestion → grounded answer that references your actual figures, in plain text (no literal `**asterisks**`).
- [ ] **F7** Type a custom question + press Return → it sends and answers. Send button stays on-screen with a long question.
- [ ] **F8** Typing in the chat does **not** shift the page sideways or hide the tabs.
- [ ] **F9** Offline / AI down → an error bubble with "Try again" (not a crash, not a blank).
- [ ] **F10** Quarterly tax scheduler shows the current quarter + year; "Mark as paid" logs a non-deductible expense.
- [ ] **F11** Log a retirement contribution → it appears; donut updates.
- [ ] **F12** Rate chart: your $/mile per week vs the target line; weeks with no loads are a gap (no invented "national average").

## G. Owner
- [ ] **G1** Fleet Overview KPIs (miles, revenue, active drivers, flagged receipts) from real data; **"Daniel Mensah" must NOT appear.**
- [ ] **G2** Driver status grid lists only real drivers with real "last logged" times (not a hardcoded "Active 1 day ago").
- [ ] **G3** View Fleet Directory → tap a driver → detail page with their loads/expenses/retirement.
- [ ] **G4** Driver detail → "Open driver view" → puts you in that driver's experience (incl. Taxes); failing load shows an error, not an empty driver.
- [ ] **G5** Invoices: list + Outstanding/Paid/Overdue totals; "Mark Paid" works; empty state when none (no demo invoices).
- [ ] **G6** Fleet Compliance: each driver's status (Clear/Attention/Critical) from their real documents; tap a row → their detail.
- [ ] **G7** Referral card: shows the invite button only if a referral code exists; otherwise "not set up yet" (no shared fallback code).

## H. Layout & navigation (this session's fixes)
- [ ] **H1** On every screen, the bottom bar shows **all five tabs** with no horizontal scrolling; Taxes is always reachable.
- [ ] **H2** No screen scrolls left/right. The Compliance tab row fits without pushing the page sideways.
- [ ] **H3** Dates display the day you entered (enter a pickup date, reopen the load — no off-by-one).

## I. Data integrity (no fake data / honest failures)
- [ ] **I1** Nowhere in the app: "Daniel Mensah", "Houston → Dallas" mock trip, a $154,620 odometer, or demo invoices.
- [ ] **I2** Empty account = genuinely empty everywhere (honest empty states), never seeded-looking numbers.
- [ ] **I3** A failed load/read shows "couldn't load" + retry, distinct from "nothing here yet".
- [ ] **I4** A failed save shows an error and keeps your input — it never reports a fake success.

## J. Platform
- [ ] **J1** Works logged-in on the physical phone (ACE), not just the simulator.
- [ ] **J2** The AI features reach the deployed `claude-proxy` (answers vary and reference your numbers) — not just fallback text.
- [ ] **J3** No Anthropic API key anywhere in the shipped app (it lives only in the Edge Function).

---

### Notes / known gaps
- The **`vehicles` table doesn't exist** in the database yet, so the odometer and
  maintenance-distance features read "Not set" by design. Create that table to
  enable them.
- All of the above runs against the **live Supabase project** and the deployed
  `claude-proxy` function. AI tests cost a small amount per question.
