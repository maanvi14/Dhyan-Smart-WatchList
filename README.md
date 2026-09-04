# Dhyan (ध्यान) — Smart Market Watchlist

[![Groww Code 2026](https://img.shields.io/badge/Groww_Code-2026-00D09C?style=for-the-badge&logo=appveyor)](https://github.com/maanvi14/Dhyan-Smart-WatchList)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

> **"Don’t build the obvious watchlist. Build the version you believe should exist — and be ready to explain why."**

---


## 💡 The Problem Statement vs. How Dhyan Solves It

| Problem Statement Prompt | Traditional Watchlists (Groww / Kite / Yahoo) | How Dhyan Re-imagines It |
|---|---|---|
| **What counts as a "meaningful change"?** | Simple % threshold (e.g. ±2%). Treats market-wide beta shifts as individual stock news. | **Causal Triad**: A change is meaningful *only* if there is sector divergence, abnormal volume, and an exchange filing drop (or lack thereof). |
| **What information to surface?** | Endless candlesticks, repetitive tables, and promotional chat widgets. | **Executive Truth**: Contextual *"Time Away"* timeline, **Watermark Delta Sparklines** (muted past vs. glowing delta), **Visual Evidence Cards**, and a **60s Morning Audio Briefing**. |
| **How state persists across sessions?** | Static boolean "seen" flags or lost entirely on browser refresh. | **Watermark Model**: Monotonic per-item timestamp (`lastViewedAt`). Diff queries compute dynamically against this watermark across all devices. |
| **How to handle stale, delayed, or conflicting data?** | Silent freezes, flashing misleading old prices, or infinite loading spinners. | **Honest Graceful Degradation**: 3-state heartbeat (Active/Delayed/Killed). Immediate Redwood tier tagging (🔴 **Uncertain**) if heartbeat lags >30s. |
| **How system scales for large watchlists & users?** | Heavy client polling hitting databases per stock every second. | **Delta Polling + Socket.io**: In-memory Redis/Feed Cache broadcast ticks; heavy NLP/Filing verification runs asynchronously only when thresholds trip. |
| **Where to keep simple vs. add complexity?** | Over-complicated predictive graphs and financial jargon. | **Simple UI, Complex Engine**: Deterministic classification rules (zero LLM hallucinations on tiers), high-contrast bilingual design, client-side SVG card generation. |

---

## ⚔️ Market Competitor Analysis & The Groww Analogy

```
   NOISE / SPECULATION
          ▲
          │      • Telegram Channels & WhatsApp Groups (Unverified noise)
          │      • Twitter/FinTwit "Gurus"
          │
          │                                  • Moneycontrol / ET Markets (Ad-heavy portals)
          │
          │      • Groww / Zerodha Kite (Clean UX, but zero verification or causal context)
          │
          └────────────────────────────────────────────────────────► TRUTH / EVIDENCE
                                             ★ DHYAN (ध्यान)
                                               (Clean Groww-like UX + Deterministic Evidence Trail)
```

### The Groww Analogy & How Dhyan Elevates It
Groww democratized Indian investing by turning confusing demat account forms into a clean, intuitive, one-tap mobile experience. **However, Groww's watchlist still stops at the price.**
- When a Groww user sees Tata Motors up +5%, they close Groww and open WhatsApp or Twitter to ask: *"Why is Tata Motors up?"*
- In those groups, they get targeted by pump-and-dump operators.
- **Dhyan is the natural next step for Groww**: It keeps the clean, calm, accessible fintech ethos of Groww, but answers the *"Why"* right inside the app backed by official SEBI/NSE regulatory filings.

---

## 🌟 Feature-by-Feature Tour

### 1. Watermark Diff Engine (`lastViewedAt`)
- Unlike naive systems with boolean `read: true` flags that break on multiple devices, Dhyan tracks a monotonic high-watermark timestamp for each stock.
- The `/watchlists/:id/since-last-checked` endpoint runs a temporal join between `ChangeEvent.detectedAt` and `WatchlistItem.lastViewedAt`.
- **Confirmed Silence**: If you return after 48 hours and nothing abnormal happened, Dhyan explicitly tells you *"All stocks held steady with zero abnormal spikes"* — eliminating FOMO anxiety.

### 2. Deterministic Confidence Tiers (Zero Hallucination Architecture)
An LLM **never** decides whether a stock move is verified. The tiering engine follows strict deterministic rules:
- 🟢 **CONFIRMED**: Official exchange corporate announcement (NSE/BSE Regulation 30) matches within the event detection window.
- 🟡 **UNEXPLAINED**: Abnormal price/volume anomaly without any corresponding regulatory disclosure.
- 🔴 **UNCERTAIN**: Data feed heartbeat is stale or data feeds conflict.

### 3. "Verify a Tip" (WhatsApp & Telegram Claim Verification)
- 80%+ of Indian retail investors receive unverified stock tips via social media.
- Users can paste any raw message into Dhyan.
- Dhyan uses regex word-boundary symbol detection across its universe, queries the 30-day regulatory filing repository, checks directional price movement, and returns an evidence verdict with a client-side generated branded 1080x1080 PNG share card.

### 4. 60-Second Executive Audio Briefing
- Integrated Web Speech API synthesizes an executive conversational summary (in English or Hindi).
- Automatically dedupes symbols, names the top 3 absolute movers, highlights verified corporate catalysts, and flags uncorroborated volume moves.

### 5. Sector Risk Radar & Watermark Delta Sparklines
- **Sector Risk Radar**: Computes real-time sector weightings and warns when a portfolio has >50% concentration risk in a single sector.
- **Delta Sparklines**: Dual-zone intraday SVG sparklines where the period before your visit is muted slate, and the period since your visit glows in Emerald or Redwood with a pulsing live coordinate dot.

### 6. Grounded "Ask Dhyan" Chat with Non-Predictive Refusal
- Grounded strictly in verified watchlist state and filing disclosures.
- If asked speculative questions (*"Will Reliance go up tomorrow?"* or *"Should I buy IRCTC?"*), it gracefully refuses with an amber **NON-PREDICTIVE REFUSAL** banner.

---

## 🛠️ Step-by-Step Setup Instructions

### Prerequisites
- **Node.js**: v18.0+ or v20.0+
- **Python**: v3.10+ (for FastAPI verification service)
- **Git**: installed on PATH

---

### Method 1: Local Setup (Quickest)

#### Step 1: Clone Repository
```bash
git clone https://github.com/maanvi14/Dhyan-Smart-WatchList.git
cd Dhyan-Smart-WatchList
```

#### Step 2: Backend Setup
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```
*Backend runs on `http://localhost:5000` with live mock feed polling.*

#### Step 3: AI Verification Service (Optional for Groq LLM, runs with heuristic fallback)
```bash
cd ../ai-service
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```
*Verification service runs on `http://localhost:8000`.*

#### Step 4: Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`.*

---

### Method 2: Docker Compose (One-Click)
```bash
docker-compose up --build
```


