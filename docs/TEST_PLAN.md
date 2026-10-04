# TruckDesk — Full Manual Test Plan

Work through these on the simulator and/or a real device. Check each box as it
passes; for anything that fails, note the screen + what you saw.

---

## 0. Setup & accounts

**Driver login (has the WhatsApp phone + data) — "Demo Driver"**
- Email: `appreview@numdaanalytics.com`
- Code: `954259` (type into the 6‑digit boxes — no email is sent for this account)
- WhatsApp number on file: **`19178701273`** — MilesBot files WhatsApp data under this driver.

**Owner login — "Kwame Agyekum"**
- Email: `cagyekum26@gmail.com`
- Code: tap "Send Email Code" → use the 6‑digit code emailed to that inbox.
- Fleet: Demo Driver + Daniel Mensah are linked to this owner.

**How the WhatsApp side works (important):**
- MilesBot runs on **Railway** (not your laptop). Real WhatsApp messages go to the
  Railway deployment → Supabase → the app. You do **not** need to run anything locally.
- MilesBot matches you by the **phone number you text from** (`users.phone`). Text from
  `19178701273` and the data lands under **Demo Driver** — so log into the app as Demo
  Driver (or as the owner to see it in the fleet).
- After each WhatsApp reply, give it a few seconds, then pull‑to‑refresh / reopen the
  screen in the app.

**Trigger values that change AI/recommendation output:**
- Load calculator: **$1,900 / 1,000 mi** ($1.90/mi) → "Counter" + negotiation script.
  **2,200 / 1,000** → "Go" (no script). **1,500 / 1,000** → "Pass" (no script).
- Per diem uses the "Days Away From Home" slider (defaults to 15 → ~$1,035).

---

# PART 1 — MilesBot (WhatsApp): text, voice, image, PDF

MilesBot reads your plain‑language message (or voice note, or receipt photo),
figures out the type, and writes it into the app's tables. You type/speak
naturally — no codes. Send each item, wait for the reply, then check the app.

### 1A. TEXT messages

| Text MilesBot something like… | Lands in | Check in app |
|---|---|---|
| "Finished a load from Atlanta GA to Charlotte NC, 280 miles, got $1,840 from Echo Global" | `loads` | Driver → **Loads** (+ Home, Taxes revenue, Owner → Fleet) |
| "Fueled up at Pilot in Memphis TN, $180, 47.5 gallons" | `expenses` (fuel) | Driver → **Expenses**; **Compliance → IFTA** (under TN) |
| "Paid $12 toll on I‑40" | `expenses` (toll) | Driver → **Expenses** |
| "$23 for dinner on the road" | `expenses` (food) | Driver → **Expenses** |
| "Drove 180 miles in Tennessee today" | `daily_mileage` | Driver → Home → **Daily Mileage**; Miles (last 7 days) |
| "Put $500 into my Solo 401k" | `retirement_log` | Driver → **Taxes → Retirement** |
| "Echo Global just paid the $1,840 invoice" | `invoices` | Owner → **Invoices** |

- [ ] **T1** Load message → appears in Loads with the right origin/destination/rate, and **Home** (Last 7 Days) and Owner Fleet update.
- [ ] **T2** Fuel message with a **state + gallons** → appears in Expenses **and** Compliance → IFTA grouped under that state.
- [ ] **T3** Toll message → Expense, category **toll**.
- [ ] **T4** Food message → Expense, category **food**.
- [ ] **T5** Mileage message ("drove N miles in <state>") → Home → Daily Mileage + Miles (Last 7 Days).
- [ ] **T6** Retirement message → Taxes → Retirement; YTD/donut update.
- [ ] **T7** Invoice‑paid message → Owner → Invoices with the right status.
- [ ] **T8** **Multiple items in one message** ("paid $12 toll and $23 for dinner") → **two** separate expenses are created (not just one).
- [ ] **T9** MilesBot's reply **logs immediately** — it should confirm what it logged, **not** ask you to "say confirm" first, and should address you by the right name (not "Daniel").
- [ ] **T10** MilesBot does **not** invent numbers (no "you've already logged N miles" unless you actually asked for a summary).

### 1B. VOICE messages
Send a WhatsApp **voice note** saying the same kinds of things.

- [ ] **V1** Voice note: "Finished a load from Dallas TX to Oklahoma City, 210 miles, $1,650 from TQL" → transcribed and logged as a **load**.
- [ ] **V2** Voice note: "Fueled up in Little Rock Arkansas, 52 gallons, 190 dollars" → logged as a **fuel expense** with AR + gallons for IFTA.
- [ ] **V3** Voice note that's unclear/garbled → MilesBot asks a clarifying question rather than logging a wrong value.

### 1C. IMAGE messages (receipt / fuel slip photos)
Send a **photo** (camera or gallery) of a receipt.

- [ ] **I1** Photo of a **fuel receipt** → an **expense** is created; amount, vendor, and **state + gallons** read off the image (check Expenses + IFTA).
- [ ] **I2** Photo of a **meal/other receipt** → expense with the right category + amount.
- [ ] **I3** Photo that is **not** a receipt (random picture) → MilesBot says it couldn't read a receipt and logs **nothing** (no bogus expense).
- [ ] **I4** The created expense has a **receipt image** attached (viewable on the expense).

### 1D. PDF / document messages
Attach a receipt/invoice as a **document** (paperclip → Document), not a photo.

- [ ] **P1** **PDF invoice/receipt** → expense created from the PDF (amount/vendor read correctly).
- [ ] **P2** Image sent **as a file** (paperclip → Document, image/jpeg) → still routed through the receipt reader → expense created.
- [ ] **P3** **Unsupported file** (e.g. a `.csv` or `.txt`) → MilesBot replies it can't read that type, logs nothing, no crash.

### 1E. MilesBot edge cases
- [ ] **E1** Text from a **number that isn't on file** → MilesBot does not write app data for an unknown driver (logs stay empty for that number).
- [ ] **E2** A plain chat message ("how am I doing this week?") → MilesBot replies with a summary using **real** numbers; nothing wrong is written.
- [ ] **E3** After sending several items, open the app and confirm **each** one landed in the correct section.

**Known gaps (expected — not bugs):**
- The in‑app **"MilesBot Log / WhatsApp Log" page stays empty** — MilesBot writes to the real tables (loads, expenses, …), not the `whatsapp_submissions` table that page reads. Your data shows up in Loads/Expenses/etc.
- **Maintenance messages** ("tire repair $320 at 142000 mi") go to Google Sheets only, **not** Supabase — so they won't appear in Compliance → Maintenance.

---

# PART 2 — Driver app

## A. Authentication
- [ ] **A1** Email tab → demo email → "Send Email Code" jumps straight to the 6‑digit screen (no email needed for the demo account).
- [ ] **A2** Enter `954259` → lands on the driver Home as "Demo Driver".
- [ ] **A3** Wrong 6‑digit code → "Invalid verification code", stays on screen.
- [ ] **A4** Close & reopen the app → still signed in (session persists). *(A fresh install resets this — you'll sign in once after reinstalling.)*
- [ ] **A5** Account → Sign out → returns to login.
- [ ] **A6** Owner account signs in → lands on **Fleet Overview**, not the driver Home.

## B. Driver — Home  *(now a rolling "Last 7 Days" window, not a Sunday‑reset week)*
- [ ] **B1** **Net Profit (Last 7 Days)** and **Miles (Last 7 Days)** include loads from the past 7 days — a load from yesterday still counts today (does **not** reset on Sunday).
- [ ] **B2** Empty account: Net Profit $0 / Miles 0 mi — **no error toast**, no fake rows.
- [ ] **B3** A **failed** load (airplane mode) shows "—" / "Couldn't load", distinct from a real $0.
- [ ] **B4** Recent Activity lists real loads, expenses, and MilesBot miles, newest first.
- [ ] **B5** Quick Actions (New Load, Add Expense, MilesBot Log) navigate correctly.
- [ ] **B6** "Text MilesBot" button appears only if the WhatsApp number is configured (otherwise hidden, not a dead link).

## C. Driver — Loads
- [ ] **C1** Loads list shows your loads; empty account shows "No loads yet".
- [ ] **C2** New Load: rate 1900 + miles 1000 → calculator shows fuel cost, rate/mile, **Counter** recommendation.
- [ ] **C3** Negotiation script appears after ~1s and does **not** regenerate on every keystroke.
- [ ] **C4** If the script says "template" + mentions $3.82/gal → the AI call fell back (honest fallback).
- [ ] **C5** 2200/1000 → "Go" (no script); 1500/1000 → "Pass" (no script).
- [ ] **C6** Save a load → appears in the list; Home/Taxes numbers move.
- [ ] **C7** Load detail: gross rate, total expenses, net profit, RPM, linked expenses; delete works.
- [ ] **C8** Airplane mode → "Couldn't load" + Try again (not an empty list, not fake data).
- [ ] **C9** A load logged by **MilesBot** (null pickup date) appears correctly and counts in Home (this was a fixed bug).

## D. Driver — Expenses
- [ ] **D1** List / empty state; category filter pills show only categories you actually have.
- [ ] **D2** Add Expense → **Camera** receipt (permission prompt uses TruckDesk wording).
- [ ] **D3** Add Expense → **Photo Library** receipt.
- [ ] **D4** Save → appears; form keeps input if a save fails.
- [ ] **D5** Receipt upload fails → "Expense saved, but the receipt photo couldn't be uploaded" (partial save, not a hard fail).
- [ ] **D6** Swipe to delete → removed.

## E. Driver — Compliance
- [ ] **E1** All four tabs fit and are tappable (Maintenance, Documents, HOS, IFTA) — **no sideways scrolling**.
- [ ] **E2** Current Odometer reads **"Not set"** (the `vehicles` table isn't provisioned) — no error toast.
- [ ] **E3** Update Odometer with no truck on file → honest message ("no truck on file… can't be saved"), not a fake success.
- [ ] **E4** Log a completed service → appears in the schedule.
- [ ] **E5** Documents: each slot shows expiry status or "Not provided"; "Scan on file: Yes/No" (never a fake "Verified").
- [ ] **E6** Upload a document scan → card updates; a failed upload shows an error + keeps the dialog open.
- [ ] **E7** HOS tab shows the "not tracked in TruckDesk — use your ELD" notice. **No fake clocks, no "you're in compliance" claim.**
- [ ] **E8** IFTA tab groups fuel by state for the **current quarter + year**; CSV export filename has the right year; fuel logged via WhatsApp shows here.

## F. Driver — Taxes (Financial Intelligence)
- [ ] **F1** If locked: "Unlock for Free" (Free during beta, nothing charged) → unlocks.
- [ ] **F2** KPIs: YTD Gross Revenue, Write‑Offs, Est. Per Diem, Net Taxable Profit reflect real data ($0 when empty).
- [ ] **F3** Drag "Days Away From Home" → per diem + net taxable update; only **one** advisor request fires after you stop (not per tick).
- [ ] **F4** Headline advice: a real one‑sentence tip tied to your numbers (or honestly labeled "General tax tip" on fallback).
- [ ] **F5** **Ask a question** → chat opens cleanly: header visible, suggested questions, keyboard not jammed.
- [ ] **F6** Tap a suggestion → grounded answer referencing your actual figures, plain text (no literal `**asterisks**`).
- [ ] **F7** Type a custom question + Return → sends and answers; send button stays on‑screen with a long question.
- [ ] **F8** Typing in chat does **not** shift the page sideways or hide the tabs.
- [ ] **F9** Offline / AI down → an error bubble with "Try again" (not a crash, not blank).
- [ ] **F10** Quarterly scheduler shows the current quarter + year; "Mark as paid" logs a non‑deductible expense.
- [ ] **F11** Log a retirement contribution (in‑app **or** via WhatsApp) → appears; donut updates.
- [ ] **F12** Rate chart: your $/mile per week vs the target line; weeks with no loads are a gap (no invented "national average").

---

# PART 3 — Owner app & multi‑tenancy

## G. Owner — Fleet
- [ ] **G1** Fleet Overview KPIs (miles, revenue, active drivers, flagged receipts) from real data. *(Note: Daniel Mensah is now a **real linked driver** of this owner and will legitimately appear — that's expected.)*
- [ ] **G2** Driver status grid lists the owner's drivers with real "last logged" times (not a hardcoded "Active 1 day ago").
- [ ] **G3** Fleet KPIs reset on the same window the driver Home uses — confirm consistency with the driver view.
- [ ] **G4** View Fleet Directory → tap a driver → detail with their loads/expenses/retirement; dates read correctly (no off‑by‑one).
- [ ] **G5** Driver detail → **Open driver view** → puts you in that driver's experience (incl. Home, Loads, Taxes); a failing load shows an error, not an empty driver. **Exit to owner** returns you.
- [ ] **G6** Invoices: list + Outstanding/Paid/Overdue totals; "Mark Paid" works; empty state when none.
- [ ] **G7** Fleet Compliance: each driver's status (Clear/Attention/Critical) from their real documents; tap a row → their detail.

## M. Multi‑tenancy / data isolation  *(new — the core of this session)*
- [ ] **M1** Signed in as **Kwame**, the fleet shows **only Kwame's drivers** (Demo Driver + Daniel) — nobody else in the database.
- [ ] **M2** A WhatsApp load from `19178701273` (Demo Driver) rolls up into **Kwame's** fleet totals.
- [ ] **M3** *(If you create a second owner + driver)* that second owner sees **only** their own driver — **not** Kwame's drivers — and vice‑versa.
- [ ] **M4** A **driver** account (Demo Driver) sees only their **own** loads/expenses/mileage — no fleet view, no other drivers' data.
- [ ] **M5** *(Security)* Isolation holds at the database level (RLS), not just the UI — a driver/owner can't read another tenant's rows even by bypassing the app. *(Spot‑check: the `supabase/rls_policies.sql` policies are applied.)*

---

# PART 4 — Cross‑cutting

## H. Layout & navigation
- [ ] **H1** On every screen the bottom bar shows **all five tabs** with no horizontal scrolling; Taxes always reachable.
- [ ] **H2** No screen scrolls left/right; the Compliance tab row fits without pushing the page sideways.
- [ ] **H3** Dates display the day you entered — enter a pickup date, reopen the load: **no off‑by‑one** (this was fixed across Loads, Expenses, Retirement, Load detail).

## I. Data integrity (no fake data / honest failures)
- [ ] **I1** Nowhere: a "Houston → Dallas" mock trip, a $154,620 odometer, or demo invoices.
- [ ] **I2** Empty account = genuinely empty everywhere (honest empty states), never seeded‑looking numbers.
- [ ] **I3** A failed read shows "Couldn't load" + retry, distinct from "nothing here yet".
- [ ] **I4** A failed save shows an error and keeps your input — never a fake success.

## J. Platform & AI
- [ ] **J1** Works logged‑in on the **physical phone** (ACE), not just the simulator.
- [ ] **J2** AI features reach the deployed `claude-proxy` (answers vary and reference your numbers) — not just fallback text.
- [ ] **J3** No Anthropic API key in the shipped app (it lives only in the Edge Function).
- [ ] **J4** MilesBot (WhatsApp) runs on Railway and logs to Supabase — send a text and confirm the row appears under the right driver.

---

### Notes / known gaps
- The **`vehicles` table doesn't exist** yet, so odometer / maintenance‑distance read "Not set" by design.
- Everything runs against the **live Supabase project**, the deployed **`claude-proxy`**, and the **Railway** MilesBot. AI/WhatsApp tests cost a small amount each.
- "Last 7 Days" is a **rolling** window (today + the previous 6 days), so recent work doesn't vanish at week boundaries.
