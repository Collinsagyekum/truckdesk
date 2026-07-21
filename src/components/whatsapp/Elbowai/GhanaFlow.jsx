import { useState, useEffect } from "react";

// ─── Brand tokens ────────────────────────────────────────────────────────────
const C = {
  purple: "#5B30F6",
  purpleLight: "#7B52F8",
  purpleDark: "#3D1FD4",
  gold: "#F5A623",
  white: "#FFFFFF",
  offWhite: "#F4F3FF",
  gray: "#9CA3AF",
  grayLight: "#F9F8FF",
  textDark: "#1A1A2E",
  green: "#10B981",
  red: "#EF4444",
};

// ─── Shared helpers ───────────────────────────────────────────────────────────
const purpleGrad = `linear-gradient(135deg, ${C.purpleDark} 0%, ${C.purple} 60%, ${C.purpleLight} 100%)`;

const btn = (variant = "primary") => ({
  padding: "14px 28px",
  borderRadius: 50,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 15,
  transition: "all .2s",
  ...(variant === "primary" && {
    background: C.white,
    color: C.purple,
  }),
  ...(variant === "secondary" && {
    background: C.purple,
    color: C.white,
    border: `2px solid ${C.white}`,
  }),
  ...(variant === "ghost" && {
    background: "transparent",
    color: C.white,
    border: `1px solid rgba(255,255,255,.4)`,
  }),
  ...(variant === "danger" && {
    background: C.red,
    color: C.white,
  }),
  ...(variant === "success" && {
    background: C.green,
    color: C.white,
  }),
});

const card = {
  background: C.white,
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 4px 24px rgba(91,48,246,.12)",
};

const pill = (color = C.purple) => ({
  display: "inline-block",
  background: color + "22",
  color: color,
  borderRadius: 50,
  padding: "4px 12px",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: "uppercase",
});

function Avatar({ name, size = 40 }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: purpleGrad,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: C.white, fontWeight: 700, fontSize: size * 0.35,
      flexShrink: 0,
    }}>{initials}</div>
  );
}

function StepDots({ total, current }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 24 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 24 : 8, height: 8,
          borderRadius: 4,
          background: i === current ? C.white : "rgba(255,255,255,.35)",
          transition: "all .3s",
        }} />
      ))}
    </div>
  );
}

function Badge({ status }) {
  const map = {
    pending: [C.gold, "Pending"],
    matched: [C.purpleLight, "Matched"],
    escrowed: [C.purple, "Escrowed"],
    confirmed: [C.green, "Confirmed"],
    completed: [C.green, "Completed"],
    disputed: [C.red, "Disputed"],
    cancelled: [C.gray, "Cancelled"],
  };
  const [color, label] = map[status] || [C.gray, status];
  return <span style={pill(color)}>{label}</span>;
}

function ProgressBar({ pct, color = C.purple }) {
  return (
    <div style={{ background: "#E5E7EB", borderRadius: 8, height: 8, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%",
        background: color,
        transition: "width .5s ease",
      }} />
    </div>
  );
}

// ─── Mock exchange rate ───────────────────────────────────────────────────────
const GHS_PER_USD = 15.4; // mock mid-market rate
function toUSD(ghs) { return (ghs / GHS_PER_USD).toFixed(2); }
function toGHS(usd) { return (usd * GHS_PER_USD).toFixed(2); }

// ─── SCREENS ──────────────────────────────────────────────────────────────────

// 1. Welcome / Value prop
function WelcomeScreen({ onNext }) {
  return (
    <div style={{ background: purpleGrad, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, color: C.white }}>
      <StepDots total={6} current={0} />
      <div style={{ fontSize: 48, marginBottom: 12 }}>⇄</div>
      <h1 style={{ fontSize: 28, fontWeight: 900, textAlign: "center", lineHeight: 1.2, margin: "0 0 12px" }}>
        Your money lives<br />where <span style={{ color: C.gold }}>you</span> are.
      </h1>
      <p style={{ textAlign: "center", opacity: .8, marginBottom: 32, maxWidth: 300 }}>
        Have cedis in Ghana? Need dollars here? We match you with someone who needs the exact opposite.
      </p>
      <div style={{ ...card, width: "100%", maxWidth: 320, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 24 }}>🇬🇭</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: C.textDark }}>They want your cedis in Ghana</div>
            <div style={{ fontSize: 13, color: C.gray }}>They pay in USD to your US account</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 24 }}>🇺🇸</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: C.textDark }}>You want dollars in the US</div>
            <div style={{ fontSize: 13, color: C.gray }}>You send cedis to their Ghana account</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["Protected escrow", "ID-verified", "No fees"].map(t => (
          <span key={t} style={{ ...pill(C.white), color: C.white, border: "1px solid rgba(255,255,255,.4)", background: "rgba(255,255,255,.15)" }}>{t}</span>
        ))}
      </div>
      <button style={{ ...btn("primary"), width: "100%", maxWidth: 320, fontSize: 17, padding: "16px 0" }} onClick={onNext}>
        Get Started
      </button>
    </div>
  );
}

// 2. KYC / Identity verification
function KYCScreen({ onNext, onBack }) {
  const [step, setStep] = useState(0); // 0=intro, 1=form, 2=verifying, 3=done
  const [form, setForm] = useState({ name: "", phone: "", ghanaId: "", bvn: "" });

  const handleVerify = () => {
    setStep(2);
    setTimeout(() => setStep(3), 2200);
  };

  if (step === 3) return (
    <div style={{ background: purpleGrad, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, color: C.white }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", margin: "0 0 8px" }}>Identity Verified!</h2>
      <p style={{ opacity: .8, textAlign: "center", marginBottom: 32 }}>You're now a trusted ElbowPay user.</p>
      <button style={{ ...btn("primary"), padding: "16px 48px", fontSize: 16 }} onClick={onNext}>Continue to Trade</button>
    </div>
  );

  if (step === 2) return (
    <div style={{ background: purpleGrad, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, color: C.white }}>
      <div style={{ fontSize: 48, marginBottom: 16, animation: "spin 1s linear infinite" }}>⏳</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: "center", margin: "0 0 8px" }}>Verifying your identity…</h2>
      <p style={{ opacity: .8, textAlign: "center", marginBottom: 32 }}>Checking Ghana Card / Passport</p>
      <div style={{ width: "100%", maxWidth: 300 }}>
        <ProgressBar pct={75} color={C.gold} />
      </div>
    </div>
  );

  if (step === 1) return (
    <div style={{ background: purpleGrad, minHeight: "100vh", display: "flex", flexDirection: "column", padding: 32, color: C.white }}>
      <button style={{ ...btn("ghost"), width: 80, marginBottom: 24 }} onClick={() => setStep(0)}>← Back</button>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>Verify your identity</h2>
      <p style={{ opacity: .75, marginBottom: 24, fontSize: 14 }}>Required by Bank of Ghana regulations</p>
      {[
        ["Full name", "name", "Kwame Mensah"],
        ["Ghana phone (+233)", "phone", "+233 20 000 0000"],
        ["Ghana Card / Passport no.", "ghanaId", "GHA-XXXXXXXXX-X"],
      ].map(([label, key, ph]) => (
        <div key={key} style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, opacity: .8, display: "block", marginBottom: 6 }}>{label}</label>
          <input
            style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "none", fontSize: 15, boxSizing: "border-box", outline: "none" }}
            placeholder={ph}
            value={form[key]}
            onChange={e => setForm({ ...form, [key]: e.target.value })}
          />
        </div>
      ))}
      <div style={{ ...card, marginTop: 8, marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: C.gray }}>⚠️ Ghana requires identity verification for all forex transactions above GHS 1,000 under the Foreign Exchange Act 2006.</div>
      </div>
      <button style={{ ...btn("primary"), fontSize: 16, padding: "15px 0" }} onClick={handleVerify}>
        Verify Identity
      </button>
    </div>
  );

  // intro
  return (
    <div style={{ background: purpleGrad, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, color: C.white }}>
      <StepDots total={6} current={1} />
      <div style={{ fontSize: 48, marginBottom: 16 }}>🪪</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", margin: "0 0 12px" }}>Every user is verified</h2>
      <p style={{ textAlign: "center", opacity: .8, marginBottom: 32, maxWidth: 300 }}>
        Before you trade, we confirm who you are. No anonymous transactions.
      </p>
      {[
        ["🪪", "Ghana Card or Passport"],
        ["📱", "Phone number (Ghana or US)"],
        ["🤳", "Quick liveness check"],
      ].map(([icon, text]) => (
        <div key={text} style={{ ...card, width: "100%", maxWidth: 320, marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>{icon}</span>
          <span style={{ fontWeight: 600, color: C.textDark }}>{text}</span>
        </div>
      ))}
      <div style={{ display: "flex", gap: 12, marginTop: 24, width: "100%", maxWidth: 320 }}>
        <button style={{ ...btn("ghost"), flex: 1 }} onClick={onBack}>Back</button>
        <button style={{ ...btn("primary"), flex: 2 }} onClick={() => setStep(1)}>Start KYC</button>
      </div>
    </div>
  );
}

// 3. Create Trade
function CreateTradeScreen({ onNext, onBack, setTrade }) {
  const [direction, setDirection] = useState("GHS_TO_USD"); // or USD_TO_GHS
  const [amount, setAmount] = useState("");
  const [payMethod, setPayMethod] = useState("momo"); // momo | bank
  const [receiveMethod, setReceiveMethod] = useState("zelle"); // zelle | bank | cashapp

  const isGhsTousd = direction === "GHS_TO_USD";
  const converted = amount
    ? isGhsTousd
      ? `≈ $${toUSD(parseFloat(amount))} USD`
      : `≈ GHS ${toGHS(parseFloat(amount))}`
    : "";

  const fee = amount ? (parseFloat(amount) * 0.005).toFixed(2) : "0.00";

  const handleCreate = () => {
    setTrade({
      id: "TXN-GH-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      direction,
      amount: parseFloat(amount),
      currency: isGhsTousd ? "GHS" : "USD",
      converted,
      payMethod,
      receiveMethod,
      status: "pending",
    });
    onNext();
  };

  return (
    <div style={{ background: C.offWhite, minHeight: "100vh", display: "flex", flexDirection: "column", padding: 24 }}>
      {/* Header */}
      <div style={{ background: purpleGrad, borderRadius: 20, padding: "24px 20px", color: C.white, marginBottom: 20 }}>
        <StepDots total={6} current={2} />
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>Create your trade</h2>
        <p style={{ margin: 0, opacity: .8, fontSize: 14 }}>Mid-market rate · No hidden markups</p>
      </div>

      {/* Direction toggle */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.gray, marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>I want to…</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            ["GHS_TO_USD", "🇬🇭 GHS → 🇺🇸 USD", "Cedis in Ghana → Dollars here"],
            ["USD_TO_GHS", "🇺🇸 USD → 🇬🇭 GHS", "Dollars here → Cedis back home"],
          ].map(([val, label, sub]) => (
            <button key={val} onClick={() => setDirection(val)} style={{
              flex: 1, padding: "12px 8px", borderRadius: 12, border: `2px solid ${direction === val ? C.purple : "#E5E7EB"}`,
              background: direction === val ? C.purple + "11" : C.white,
              cursor: "pointer", textAlign: "center",
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: direction === val ? C.purple : C.textDark }}>{label}</div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.gray, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>
          Amount ({isGhsTousd ? "GHS" : "USD"})
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 18, fontWeight: 700, color: C.purple }}>
            {isGhsTousd ? "₵" : "$"}
          </span>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ width: "100%", padding: "14px 16px 14px 36px", borderRadius: 12, border: `2px solid ${amount ? C.purple : "#E5E7EB"}`, fontSize: 24, fontWeight: 700, boxSizing: "border-box", outline: "none", color: C.textDark }}
          />
        </div>
        {converted && (
          <div style={{ marginTop: 8, fontSize: 14, color: C.purple, fontWeight: 600 }}>
            {converted} <span style={{ color: C.gray, fontWeight: 400 }}>· Rate: 1 USD = GHS {GHS_PER_USD}</span>
          </div>
        )}
        {/* Quick amounts */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {(isGhsTousd ? [500, 1000, 2000, 5000] : [50, 100, 200, 500]).map(a => (
            <button key={a} onClick={() => setAmount(String(a))} style={{
              flex: 1, padding: "8px 4px", borderRadius: 8, border: `1px solid ${C.purple}33`,
              background: C.offWhite, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.purple,
            }}>
              {isGhsTousd ? "₵" : "$"}{a}
            </button>
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.gray, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>
          {isGhsTousd ? "Send via (Ghana)" : "Send via (US)"}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(isGhsTousd
            ? [["momo", "📱 MoMo"], ["bank", "🏦 Bank"]]
            : [["zelle", "💸 Zelle"], ["bank", "🏦 Wire"], ["cashapp", "💚 Cash App"]]
          ).map(([val, label]) => (
            <button key={val} onClick={() => setPayMethod(val)} style={{
              flex: 1, padding: "10px 8px", borderRadius: 10, border: `2px solid ${payMethod === val ? C.purple : "#E5E7EB"}`,
              background: payMethod === val ? C.purple + "11" : C.white,
              cursor: "pointer", fontWeight: 600, fontSize: 13, color: payMethod === val ? C.purple : C.textDark,
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Fee breakdown */}
      {amount && (
        <div style={{ ...card, marginBottom: 20, background: C.purpleDark + "08" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gray, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Fee breakdown</div>
          {[
            ["Amount", `${isGhsTousd ? "₵" : "$"}${parseFloat(amount).toFixed(2)}`],
            ["ElbowPay fee (0.5%)", `${isGhsTousd ? "₵" : "$"}${fee}`],
            ["Exchange spread", "None — mid-market rate"],
            ["You receive", converted],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
              <span style={{ color: C.gray }}>{k}</span>
              <span style={{ fontWeight: 600, color: k === "You receive" ? C.green : C.textDark }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button style={{ ...btn("ghost"), flex: 1, color: C.purple, border: `1px solid ${C.purple}44` }} onClick={onBack}>Back</button>
        <button
          style={{ ...btn("secondary"), flex: 2, opacity: amount ? 1 : .5 }}
          onClick={handleCreate}
          disabled={!amount}
        >
          Find my match →
        </button>
      </div>
    </div>
  );
}

// 4. Matching
function MatchingScreen({ trade, onNext, onBack }) {
  const [phase, setPhase] = useState(0); // 0=searching, 1=found

  const mockMatch = {
    name: "Abena K.",
    rating: 4.9,
    trades: 34,
    location: "Accra, Ghana",
    payMethod: trade?.direction === "GHS_TO_USD" ? "MTN MoMo" : "Zelle",
  };

  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 3000);
    return () => clearTimeout(t);
  }, []);

  if (phase === 0) return (
    <div style={{ background: purpleGrad, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, color: C.white }}>
      <StepDots total={6} current={3} />
      <div style={{ fontSize: 52, marginBottom: 16 }}>🔍</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", margin: "0 0 12px" }}>Finding your match…</h2>
      <p style={{ opacity: .8, textAlign: "center", marginBottom: 32, maxWidth: 300 }}>
        Scanning verified users who need the exact opposite trade.
      </p>
      <div style={{ width: "100%", maxWidth: 300 }}>
        <ProgressBar pct={60} color={C.gold} />
      </div>
      <div style={{ marginTop: 20, fontSize: 13, opacity: .7 }}>Checking 247 active traders…</div>
    </div>
  );

  return (
    <div style={{ background: C.offWhite, minHeight: "100vh", display: "flex", flexDirection: "column", padding: 24 }}>
      <div style={{ background: purpleGrad, borderRadius: 20, padding: "24px 20px", color: C.white, marginBottom: 20 }}>
        <StepDots total={6} current={3} />
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>Match found! 🎉</h2>
        <p style={{ margin: 0, opacity: .8, fontSize: 14 }}>Verified trader ready to swap</p>
      </div>

      {/* Match card */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <Avatar name={mockMatch.name} size={52} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.textDark }}>{mockMatch.name}</div>
            <div style={{ fontSize: 13, color: C.gray }}>{mockMatch.location}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <span style={pill(C.gold)}>⭐ {mockMatch.rating}</span>
              <span style={pill(C.purple)}>{mockMatch.trades} trades</span>
            </div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${C.offWhite}`, paddingTop: 16 }}>
          {[
            ["They send", trade?.direction === "GHS_TO_USD" ? `$${toUSD(trade?.amount)} USD` : `GHS ${toGHS(trade?.amount)}`],
            ["You send", trade?.direction === "GHS_TO_USD" ? `GHS ${trade?.amount}` : `$${trade?.amount} USD`],
            ["Via", mockMatch.payMethod],
            ["Escrow protection", "✅ Active"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
              <span style={{ color: C.gray }}>{k}</span>
              <span style={{ fontWeight: 700, color: k === "Escrow protection" ? C.green : C.textDark }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* How escrow works */}
      <div style={{ ...card, marginBottom: 20, background: C.purple + "08" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, marginBottom: 10 }}>HOW THE SWAP WORKS</div>
        {[
          ["1", "You both lock your amounts in escrow"],
          ["2", "Abena sends MoMo to your Ghana contact"],
          ["3", "You confirm receipt"],
          ["4", "Your USD releases to her US account"],
        ].map(([n, text]) => (
          <div key={n} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.purple, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{n}</div>
            <div style={{ fontSize: 14, color: C.textDark, lineHeight: 1.5 }}>{text}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button style={{ ...btn("ghost"), flex: 1, color: C.gray, border: `1px solid ${C.gray}44` }} onClick={onBack}>Decline</button>
        <button style={{ ...btn("secondary"), flex: 2 }} onClick={onNext}>Accept & Lock Escrow →</button>
      </div>
    </div>
  );
}

// 5. Escrow + Confirmation
function EscrowScreen({ trade, onNext, onBack }) {
  const [myStep, setMyStep] = useState(0); // 0=waiting to lock, 1=locked, 2=partner locked, 3=both locked
  const [confirmed, setConfirmed] = useState(false);

  const lockEscrow = () => {
    setMyStep(1);
    setTimeout(() => setMyStep(2), 1500);
    setTimeout(() => setMyStep(3), 3000);
  };

  const confirmReceipt = () => setConfirmed(true);

  return (
    <div style={{ background: C.offWhite, minHeight: "100vh", display: "flex", flexDirection: "column", padding: 24 }}>
      <div style={{ background: purpleGrad, borderRadius: 20, padding: "24px 20px", color: C.white, marginBottom: 20 }}>
        <StepDots total={6} current={4} />
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>Protected Escrow</h2>
        <p style={{ margin: 0, opacity: .8, fontSize: 14 }}>Funds held until both sides confirm</p>
      </div>

      {/* Escrow status */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.gray, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>Escrow status</div>
        {[
          ["You", myStep >= 1, trade?.direction === "GHS_TO_USD" ? `GHS ${trade?.amount}` : `$${trade?.amount}`],
          ["Abena K.", myStep >= 2, trade?.direction === "GHS_TO_USD" ? `$${toUSD(trade?.amount)}` : `GHS ${toGHS(trade?.amount)}`],
        ].map(([name, locked, amount]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.offWhite}` }}>
            <Avatar name={name === "You" ? "KW" : name} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
              <div style={{ fontSize: 13, color: C.gray }}>{amount}</div>
            </div>
            <span style={pill(locked ? C.green : C.gold)}>{locked ? "🔒 Locked" : "⏳ Pending"}</span>
          </div>
        ))}
        {myStep === 3 && (
          <div style={{ marginTop: 12, padding: 12, background: C.green + "11", borderRadius: 12, fontSize: 14, color: C.green, fontWeight: 600 }}>
            ✅ Both funds locked. Abena is sending your GHS now.
          </div>
        )}
      </div>

      {/* Payment instructions */}
      {myStep === 3 && !confirmed && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, marginBottom: 12 }}>ABENA WILL SEND VIA MTN MOMO</div>
          <div style={{ fontSize: 14, color: C.gray, marginBottom: 12 }}>She'll send <strong>GHS {trade?.amount}</strong> to the Ghana number you registered:</div>
          <div style={{ background: C.offWhite, borderRadius: 10, padding: "10px 14px", fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 16 }}>
            +233 20 ••• •••7
          </div>
          <div style={{ fontSize: 13, color: C.gray }}>
            ⏰ She has <strong>30 minutes</strong> to complete the transfer. Both parties are notified.
          </div>
        </div>
      )}

      {myStep === 3 && confirmed && (
        <div style={{ ...card, marginBottom: 16, background: C.green + "11" }}>
          <div style={{ fontSize: 24, textAlign: "center", marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 700, textAlign: "center", color: C.green, marginBottom: 4 }}>Payment confirmed!</div>
          <div style={{ fontSize: 14, color: C.gray, textAlign: "center" }}>Releasing your USD from escrow now…</div>
        </div>
      )}

      {myStep < 1 && (
        <button style={{ ...btn("secondary"), fontSize: 16, padding: "15px 0" }} onClick={lockEscrow}>
          🔒 Lock my funds in escrow
        </button>
      )}
      {myStep === 3 && !confirmed && (
        <button style={{ ...btn("success"), fontSize: 16, padding: "15px 0" }} onClick={confirmReceipt}>
          ✅ I received the GHS — release USD
        </button>
      )}
      {confirmed && (
        <button style={{ ...btn("secondary"), fontSize: 16, padding: "15px 0" }} onClick={onNext}>
          View receipt →
        </button>
      )}
      {myStep < 1 && (
        <button style={{ color: C.gray, background: "transparent", border: "none", marginTop: 12, cursor: "pointer", fontSize: 14 }} onClick={onBack}>
          ← Back
        </button>
      )}
    </div>
  );
}

// 6. Success
function SuccessScreen({ trade, onRestart }) {
  return (
    <div style={{ background: purpleGrad, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, color: C.white }}>
      <StepDots total={6} current={5} />
      <div style={{ fontSize: 72, marginBottom: 16 }}>🎊</div>
      <h1 style={{ fontSize: 28, fontWeight: 900, textAlign: "center", margin: "0 0 8px" }}>Swap complete!</h1>
      <p style={{ opacity: .8, textAlign: "center", marginBottom: 32 }}>Your money is where you are.</p>

      <div style={{ ...card, width: "100%", maxWidth: 320, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.gray, marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>Receipt</div>
        {[
          ["Transaction ID", trade?.id],
          ["You sent", trade?.direction === "GHS_TO_USD" ? `GHS ${trade?.amount}` : `$${trade?.amount}`],
          ["You received", trade?.converted],
          ["Fee paid", `${trade?.direction === "GHS_TO_USD" ? "₵" : "$"}${(trade?.amount * 0.005).toFixed(2)}`],
          ["Status", "Completed"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
            <span style={{ color: C.gray }}>{k}</span>
            <span style={{ fontWeight: 700, color: k === "Status" ? C.green : C.textDark }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["Share receipt", "Rate Abena"].map(t => (
          <button key={t} style={{ ...btn("ghost"), fontSize: 14, padding: "10px 16px" }}>{t}</button>
        ))}
      </div>

      <button style={{ ...btn("primary"), width: "100%", maxWidth: 320, fontSize: 16, padding: "15px 0" }} onClick={onRestart}>
        Make another trade
      </button>
    </div>
  );
}

// ─── Challenges sidebar ───────────────────────────────────────────────────────
function ChallengesPanel({ onClose }) {
  const sections = [
    {
      title: "🏦 Regulatory",
      color: C.red,
      items: [
        "Bank of Ghana forex rules — P2P forex is a grey area; BoG may classify ElbowPay as a Bureau de Change, requiring a licence.",
        "AML/KYC threshold — transactions above GHS 1,000 require full KYC under the Anti-Money Laundering Act 2008.",
        "Foreign Exchange Act 2006 — all foreign currency transactions must be reported to BoG. Real-time reporting API needed.",
        "SEC Ghana oversight if token/stablecoin rails are ever used.",
      ],
    },
    {
      title: "💸 Liquidity & Matching",
      color: C.gold,
      items: [
        "Cold-start problem — zero users means zero matches. Need bootstrapped liquidity or market-maker on day 1.",
        "Rate disagreement — mid-market rate changes between match and confirmation. Need rate-lock window (e.g. 10 min).",
        "Partial fills — user wants GHS 5,000 but best match only covers GHS 2,000. Need order-splitting logic.",
        "Cedi volatility — GHS/USD has historically been volatile; large swings between escrow lock and release.",
      ],
    },
    {
      title: "📱 MoMo / Payment Rails",
      color: C.purple,
      items: [
        "MTN MoMo & AirtelTigo APIs require business registration in Ghana and can be slow to onboard.",
        "MoMo daily limits (GHS 10,000/day for MTN) constrain large trades.",
        "US side: Zelle has $500/day limits for new users; Cash App has $1,000/week until verified.",
        "No instant payment confirmation — MoMo receipts can be spoofed. Need server-to-server confirmation, not user screenshot.",
      ],
    },
    {
      title: "🔐 Trust & Fraud",
      color: C.red,
      items: [
        "Confirmation fraud — malicious user falsely confirms receipt before GHS arrives, then disputes.",
        "Chargeback risk on US side (Zelle/bank) after GHS already released.",
        "Collusion between two verified users to wash funds.",
        "Ghana Card API availability — Ghana's NIA API for card verification has uptime issues.",
      ],
    },
    {
      title: "⚙️ Technical",
      color: C.purple,
      items: [
        "Escrow needs real money movement — a Stripe Connect / Paystack escrow account, not just a DB flag.",
        "Rate feed — need reliable GHS/USD mid-market feed (ECB or BoG official rate).",
        "Dispute resolution workflow — need human ops + timeline for blocked trades.",
        "Multi-currency accounting — double-entry ledger to reconcile GHS and USD books separately.",
      ],
    },
  ];

  return (
    <div style={{ position: "fixed", top: 0, right: 0, width: 360, height: "100vh", background: C.white, boxShadow: "-4px 0 24px rgba(0,0,0,.15)", overflowY: "auto", zIndex: 100, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Known Challenges</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>✕</button>
      </div>
      {sections.map(({ title, color, items }) => (
        <div key={title} style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color, marginBottom: 10 }}>{title}</div>
          {items.map((item, i) => (
            <div key={i} style={{ fontSize: 13, color: C.textDark, lineHeight: 1.6, marginBottom: 8, paddingLeft: 12, borderLeft: `3px solid ${color}44` }}>
              {item}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function GhanaFlow() {
  const [screen, setScreen] = useState(0);
  const [trade, setTrade] = useState(null);
  const [showChallenges, setShowChallenges] = useState(false);

  const screens = [
    <WelcomeScreen onNext={() => setScreen(1)} />,
    <KYCScreen onNext={() => setScreen(2)} onBack={() => setScreen(0)} />,
    <CreateTradeScreen onNext={() => setScreen(3)} onBack={() => setScreen(1)} setTrade={setTrade} />,
    <MatchingScreen trade={trade} onNext={() => setScreen(4)} onBack={() => setScreen(2)} />,
    <EscrowScreen trade={trade} onNext={() => setScreen(5)} onBack={() => setScreen(3)} />,
    <SuccessScreen trade={trade} onRestart={() => { setTrade(null); setScreen(0); }} />,
  ];

  const screenNames = ["Welcome", "KYC", "Trade", "Match", "Escrow", "Done"];

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", maxWidth: 430, margin: "0 auto", position: "relative", minHeight: "100vh" }}>
      {/* Top nav */}
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 50, background: "rgba(255,255,255,.9)", backdropFilter: "blur(12px)", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 16 }}>⇄</span>
          <span style={{ fontWeight: 800, color: C.purple, fontSize: 14 }}>ElbowPay</span>
          <span style={{ ...pill(C.gray), fontSize: 10 }}>Ghana Flow</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.gray }}>{screenNames[screen]}</span>
          <button
            onClick={() => setShowChallenges(!showChallenges)}
            style={{ background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: C.red, cursor: "pointer" }}
          >
            ⚠️ Challenges
          </button>
        </div>
      </div>

      <div style={{ paddingTop: 52 }}>
        {screens[screen]}
      </div>

      {showChallenges && <ChallengesPanel onClose={() => setShowChallenges(false)} />}
    </div>
  );
}
