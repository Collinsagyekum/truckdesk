# ElbowPay — Ghana Flow: Backend Spec, DB Schema & Challenge Analysis

> **Scope:** GHS ↔ USD peer-to-peer swap. User A has cedis in Ghana; User B (in the US) needs cedis. They swap without a bank in the middle.

---

## 1. State Machine

```
PENDING → MATCHED → BOTH_ESCROWED → COUNTERPARTY_SENT → CONFIRMED → COMPLETED
                                                       ↘ DISPUTED → RESOLVED / REFUNDED
          ↘ EXPIRED (no match in 24h)
```

Every state transition is an immutable ledger event, not an UPDATE. You append events; you derive state.

---

## 2. Database Schema (PostgreSQL)

```sql
-- Users & KYC
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  phone_gh      TEXT,            -- +233…
  phone_us      TEXT,            -- +1…
  kyc_status    TEXT NOT NULL DEFAULT 'unverified', -- unverified | pending | verified | rejected
  ghana_card_no TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Wallets (internal ledger)
CREATE TABLE wallets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  currency    TEXT NOT NULL,    -- 'GHS' | 'USD'
  balance     NUMERIC(18,4) NOT NULL DEFAULT 0,
  locked      NUMERIC(18,4) NOT NULL DEFAULT 0,
  UNIQUE(user_id, currency)
);

-- Trade orders
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  direction       TEXT NOT NULL,     -- 'GHS_TO_USD' | 'USD_TO_GHS'
  amount_in       NUMERIC(18,4),     -- what user is offering
  currency_in     TEXT,              -- 'GHS' or 'USD'
  amount_out      NUMERIC(18,4),     -- what user wants to receive
  currency_out    TEXT,
  rate_locked     NUMERIC(10,6),     -- GHS/USD rate at time of match
  rate_expires_at TIMESTAMPTZ,       -- rate valid for 10 minutes
  pay_method      TEXT,              -- 'momo' | 'bank_gh' | 'zelle' | 'cashapp'
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT now() + INTERVAL '24 hours'
);

-- Matches
CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_a_id      UUID REFERENCES orders(id),  -- GHS_TO_USD side
  order_b_id      UUID REFERENCES orders(id),  -- USD_TO_GHS side
  matched_at      TIMESTAMPTZ DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'matched'
  -- matched | both_escrowed | counterparty_sent | confirmed | completed | disputed | refunded
);

-- Immutable event log (source of truth)
CREATE TABLE trade_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID REFERENCES matches(id),
  actor_id   UUID REFERENCES users(id),
  event_type TEXT NOT NULL,
  -- types: escrow_locked | payment_initiated | payment_confirmed
  --        payment_disputed | dispute_resolved | escrow_released | refunded
  payload    JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Escrow accounts (maps to real money)
CREATE TABLE escrow_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID REFERENCES matches(id),
  currency      TEXT,
  amount        NUMERIC(18,4),
  provider      TEXT,    -- 'paystack' | 'stripe_connect'
  provider_ref  TEXT,    -- external payment reference
  status        TEXT DEFAULT 'held',  -- held | released | refunded
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Rate feed cache
CREATE TABLE fx_rates (
  id          SERIAL PRIMARY KEY,
  pair        TEXT NOT NULL,   -- 'GHS_USD'
  mid_rate    NUMERIC(10,6),
  source      TEXT,            -- 'bog_official' | 'ecb' | 'manual'
  fetched_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. API Routes

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Email + phone signup |
| POST | `/auth/verify-otp` | Phone OTP |
| POST | `/auth/kyc/initiate` | Start Smile Identity / Onfido check |
| GET  | `/auth/kyc/status` | Poll KYC result |

### Orders
| Method | Path | Description |
|--------|------|-------------|
| POST | `/orders` | Create trade order |
| GET  | `/orders/:id` | Get order status |
| DELETE | `/orders/:id` | Cancel before match |
| GET  | `/orders/rate` | Get current locked rate |

### Matches
| Method | Path | Description |
|--------|------|-------------|
| POST | `/matches/:id/escrow` | Lock funds into escrow |
| POST | `/matches/:id/confirm-sent` | "I sent the payment" |
| POST | `/matches/:id/confirm-received` | "I received it — release escrow" |
| POST | `/matches/:id/dispute` | Open dispute |
| GET  | `/matches/:id/events` | Full event log |

### Admin / Ops
| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/disputes/:id/resolve` | Ops resolves dispute |
| GET  | `/admin/trades/flagged` | AML flags for review |

---

## 4. Matching Algorithm

```
1. User creates order (direction, amount, rate tolerance ±2%)
2. Cron every 30s: SELECT unmatched orders WHERE:
   - direction is opposite
   - amount overlap (partial fill allowed)
   - rate within tolerance
   - both users KYC verified
   ORDER BY created_at ASC (FIFO)
3. If match found:
   - Lock rate for 10 min
   - Notify both users via push + SMS
   - Move both orders to MATCHED status
4. Both must lock escrow within 15 min or match expires
```

**Partial fills:** If A wants GHS 5,000 and B only has GHS 2,000, create a partial match and leave A's remaining GHS 3,000 in the queue.

---

## 5. Escrow Flow (Technical)

### Ghana side (GHS)
- **Provider:** Paystack (licensed in Ghana, supports GHS)
- User sends GHS to ElbowPay's Paystack virtual account
- Paystack webhook confirms receipt → escrow record created
- On confirmation: Paystack transfer API sends GHS to counterparty's MoMo/bank

### US side (USD)
- **Provider:** Stripe Connect (or Plaid + ACH)
- User sends USD to ElbowPay Stripe escrow
- On confirmation: Stripe payout to counterparty's Zelle/bank
- **Zelle limitation:** Zelle is bank-direct, no API. Workaround: use ACH + display Zelle as UX wrapper, or partner with a bank.

### Escrow release condition
```
Both escrow_locked = true
AND confirm_received event from receiving party
AND < dispute_window (15 min after confirmation)
THEN: release_escrow() for both sides atomically
```

---

## 6. What Works Well

| Feature | Status |
|---------|--------|
| Matching engine (FIFO queue) | ✅ Straightforward to build |
| GHS escrow via Paystack | ✅ Paystack has solid Ghana APIs |
| MoMo confirmation via webhook | ✅ MTN Ghana has MoMo API |
| KYC via Smile Identity | ✅ Best Ghana Card verification |
| Rate locking (10 min window) | ✅ Simple Redis TTL |
| Event sourcing / audit trail | ✅ Required for BoG reporting |
| Push notifications | ✅ Firebase / OneSignal |

---

## 7. What's Hard — The Real Challenges

### 🏦 Regulatory (Highest Risk)
1. **Bureau de Change licence** — BoG may classify ElbowPay as a forex dealer under the Foreign Exchange Act 2006. Without a BDC licence, you're operating illegally. Cost: ~$50k + 6-12 months.
2. **AML reporting** — Every transaction above GHS 1,000 must be reported to the Financial Intelligence Centre. Need automated STR (Suspicious Transaction Report) pipeline.
3. **US FinCEN** — If handling USD in the US, Money Services Business (MSB) registration required per state. 50-state licensing is expensive (~$500k+). Workaround: partner with a licensed MSB.
4. **FATF Travel Rule** — For transactions >$1,000 (≈GHS 15,000), you must transmit originator and beneficiary info between VASPs.

### 💸 Liquidity
5. **Cold-start matching** — Day 1 has no counterparties. Options: a) seed with a licensed forex dealer as liquidity provider, b) use a synthetic hedge via stablecoin bridge, c) build a waitlist.
6. **Rate volatility** — GHS depreciated ~30% in 2022. A 10-min rate lock window may not be enough during a BoG policy shock. Need dynamic rate tolerance.
7. **MoMo daily limits** — MTN MoMo caps at GHS 10,000/day for personal accounts. Business accounts are higher but require MTN business onboarding.

### 🔐 Fraud Vectors
8. **False confirmation** — User A claims GHS was received, triggers USD release, but GHS wasn't actually sent. Mitigation: require MoMo API webhook (not user screenshot) before enabling the confirm button.
9. **Chargeback after release** — US user sends via ACH, GHS releases in Ghana, then ACH reversal 3-5 days later. Mitigation: hold USD in escrow for 5 business days for ACH; instant for Zelle/RTP.
10. **Account takeover** — Ghana phone SIM swaps are common. Require biometric re-auth for trades >GHS 500.

### ⚙️ Technical
11. **No Zelle API** — Zelle has no public API. Options: Dwolla ACH, Modern Treasury, or partner with a bank that has Zelle integration.
12. **Ghana Card NIA API** — National Identification Authority's API has SLA issues. Need fallback to manual review queue.
13. **Dispute resolution ops** — Need a human ops team in both Ghana and the US to resolve disputes within the 15-min release window. This doesn't scale cheaply.
14. **Double-entry accounting** — GHS books and USD books must reconcile nightly. Need accounting software integration (e.g. Accounting Seed, QuickBooks API) or build your own GL.

---

## 8. Recommended Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| API | Node.js + Fastify | Fast, typed, good fintech ecosystem |
| DB | PostgreSQL + pgBoss (job queue) | ACID transactions critical for money |
| KYC | Smile Identity | Best Ghana Card + liveness in West Africa |
| GHS payments | Paystack | Licensed in Ghana, MoMo + bank |
| USD payments | Stripe Connect or Modern Treasury | Escrow accounts, ACH, RTP |
| Rate feed | ExchangeRate-API + BoG official | Cross-reference for integrity |
| Cache/locks | Redis | Rate locks, deduplication, matching queue |
| Notifications | Firebase + Twilio (SMS Ghana) | Twilio has Ghana numbers |
| Infra | Railway or Render (MVP) → AWS after scale | |
| Monitoring | Datadog + Sentry | Required for fintech audit logs |

---

## 9. MVP Scope Recommendation

**Phase 1 (3 months) — Prove the match:**
- KYC via Smile Identity
- GHS ↔ USD matching engine
- Paystack escrow (GHS side only)
- Manual USD payout via ops team
- <10 trades/day, Ghana-only users
- Operate under legal advice as a "technology intermediary" (grey area)

**Phase 2 (6 months) — Automate both rails:**
- USD escrow via Stripe Connect
- Automated MoMo confirmation webhooks
- Apply for BoG BDC licence
- FinCEN MSB registration via partner

**Phase 3 (12 months) — Scale:**
- Partial fills & order book
- Rate locking with dynamic tolerance
- Dispute ops team in Accra + US
- Multi-currency expansion (NGN, KES)
