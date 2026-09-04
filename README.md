# Dhyan (ध्यान) — Evidence-First Smart Market Watchlist

[![Groww Code 2026](https://img.shields.io/badge/Groww_Code-2026-00D09C?style=for-the-badge&logo=appveyor)](https://github.com/maanvi14/Dhyan-Smart-WatchList)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

> **"Don’t build the obvious watchlist. Build the version you believe should exist — and be ready to explain why."**

---

## 🎯 100-Word Product Pitch

I built **Dhyan (ध्यान)**—an end-to-end evidence-first smart watchlist using **Next.js 14, Node/Express, Socket.io, and FastAPI** that turns raw market noise into verified truth.

Dhyan defines *meaningful change* through causal divergence: abnormal volume, sector spreads, and official **NSE/BSE regulatory filings**. A cross-device **temporal watermark engine** (`lastViewedAt`) isolates what happened in your absence via **dual-zone delta sparklines**, **sector-risk radars**, and **60s audio briefings**. Movements are deterministically categorized into **Confirmed**, **Unexplained**, or **Uncertain** tiers with audit traces. Stale data degrades honestly, while **"Verify a Tip"** fact-checks social media rumors into shareable cards. Fully responsive on mobile. Never predicts.

---

## 🏛️ Core Engineering Decisions: Architecture

```
 ┌─────────────────────────────────────────────────────────────┐
 │                Next.js 14 Responsive Frontend               │
 │    (App Router + Tailwind + NextThemes + i18n + WebSpeech)  │
 └──────────────────────────────┬──────────────────────────────┘
                                │ REST / Socket.io
 ┌──────────────────────────────▼──────────────────────────────┐
 │                Node.js + Express Monolith                   │
 │  ┌────────────────────────┐    ┌─────────────────────────┐  │
 │  │ Causal Engine (Triad)  │    │ Resilience Feed Poller  │  │
 │  │ Divergence + Volume    │    │ (yfinance + Fallback)   │  │
 │  └───────────┬────────────┘    └─────────────────────────┘  │
 └──────────────┼──────────────────────────────────────────────┘
                │ Verification Request
 ┌──────────────▼─────────────────────────────┐   ┌────────────┐
 │    FastAPI NLP & Fact Verification         │   │ SQLite /   │
 │   (Groq Llama 3.3 70B / Rule Fallback)     │   │ PostgreSQL │
 └────────────────────────────────────────────┘   └────────────┘
```

### Key Technical Choices & Simplicity Trade-Offs

1. **Monotonic Temporal Watermark Engine (`lastViewedAt`)**
   - *Decision*: Instead of fragile per-event boolean `is_read: true` flags that break across devices or browser cache clears, Dhyan tracks a high-watermark timestamp per item.
   - *Benefit*: Any return visit diff is a simple temporal SQL range query (`detectedAt > lastViewedAt`), enabling deterministic sync across mobile and desktop.

2. **Deterministic Classification + Zero Hallucination AI**
   - *Decision*: An LLM is **never** permitted to decide confidence tiers. Classification follows strict deterministic rules:
     - 🟢 **CONFIRMED**: Official exchange corporate announcement (NSE/BSE Regulation 30) matches within the event window.
     - 🟡 **UNEXPLAINED**: Volume/price anomaly without corresponding regulatory disclosure.
     - 🔴 **UNCERTAIN**: Data feed heartbeat is stale (>30s) or conflicting.
   - *Benefit*: Eliminates financial hallucinations while using AI strictly for natural language synthesis.

3. **Causal Triad Definition of "Meaningful Change"**
   - *Decision*: A stock movement is only flagged if it breaks from systemic market beta:
     $$\text{Divergence Spread} = \Delta \text{Stock \%} - \Delta \text{Sector Benchmark \%}$$
   - *Benefit*: Distinguishes market-wide tides from genuine company-specific news catalysts.

4. **Client-Side Canvas Vector Card Generation**
   - *Decision*: Branded 1080x1080 social share cards are rendered entirely client-side using pure SVG & HTML5 Canvas API with native Web Share API integration.
   - *Benefit*: Zero server-side headless browser (Puppeteer) CPU overhead or cloud costs.

---

## 🌟 Comprehensive Feature Set

- **Personal Watermark Timeline**: Dynamic contextual banner computing time away in hours/minutes.
- **Watermark Delta Sparklines**: Dual-zone mini-charts where pre-visit price action is muted slate and new action glows with a pulsing coordinate dot.
- **Sector Risk Radar**: Real-time distribution progress/donut bar warning against portfolio concentration (>50% single-sector exposure).
- **"Needs Attention First" Priority Sort**: Instant 1-tap reordering bubbling verified filings and critical anomalies to the top.
- **60-Second Executive Audio Morning Brief**: Conversational Web Speech API market synthesis in English and Hindi.
- **Visual Evidence Suite**: Step-by-step causal timelines, sector spread bars, and official Regulation 30 disclosure drawers.
- **"Verify a Tip" (WhatsApp/Telegram Fact-Checker)**: Direct social claim verification against 30-day exchange disclosures with shareable card generator.
- **Ask Dhyan Grounded Chat**: RAG-style query drawer strictly grounded in verified watchlist data with **Non-Predictive Refusal** on speculative questions.
- **Chaos Engineering & Stale Resilience**: Heartbeat monitor that immediately flags broken feeds with Redwood borders.
- **Bilingual & Dual Theme**: Full English & Hindi UI with high-contrast Dark & Light mode accessibility.

---

## 📂 Project Structure

```text
Dhyan-Smart-WatchList/
├── backend/                  # Node.js + Express + Socket.io Monolith
│   ├── prisma/               # Database schema & SQLite/PostgreSQL migrations
│   │   └── schema.prisma
│   ├── src/
│   │   ├── engine/           # Causal change detector & watermark diff logic
│   │   │   └── changeDetector.ts
│   │   ├── feed/             # Market data polling, symbols & Regulation 30 filings
│   │   │   ├── filingsStore.ts
│   │   │   ├── priceFeed.ts
│   │   │   └── symbols.ts
│   │   ├── routes/           # REST endpoints (auth, watchlists, verify-tip, debug)
│   │   │   ├── auth.ts
│   │   │   ├── chat.ts
│   │   │   ├── debug.ts
│   │   │   ├── verifyTip.ts
│   │   │   └── watchlists.ts
│   │   ├── index.ts          # Server initialization & Socket.io handler
│   │   └── seed.ts           # Demo database seeder (7 flagship stocks)
│   └── package.json
│
├── frontend/                 # Next.js 14 App Router Responsive Client
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css   # Theme colors & Redwood palette
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx      # Core Watchlist Dashboard & Time-Away banner
│   │   │   ├── login/        # 1-Tap Demo access & Authentication
│   │   │   └── since-last-checked/ # Verified Diff Feed & Audio Briefing
│   │   ├── components/       # Reusable UI suite (Sparklines, Radar, Cards, Logo)
│   │   │   ├── AskDhyanChat.tsx
│   │   │   ├── DhyanLogo.tsx
│   │   │   ├── EvidenceTraceView.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── SectorRiskRadar.tsx
│   │   │   ├── VisualEvidenceCard.tsx
│   │   │   ├── VoiceBriefingButton.tsx
│   │   │   └── WatermarkSparkline.tsx
│   │   └── lib/              # API clients, Socket.io listener, and i18n
│   └── package.json
│
├── ai-service/               # FastAPI Python Verification Microservice
│   ├── main.py               # Groq Llama 3.3 70B fact-checking & chat router
│   └── requirements.txt
│
├── docker-compose.yml        # 1-Click local full-stack containerization
└── README.md
```

---

## 🛠️ Setup & Running Instructions

### Prerequisites
- **Node.js**: v18.0+ or v20.0+
- **Python**: v3.10+ (for FastAPI verification service)
- **Git**: installed on PATH

---

### Local Setup (Step-by-Step)

#### 1. Clone Repository
```bash
git clone https://github.com/maanvi14/Dhyan-Smart-WatchList.git
cd Dhyan-Smart-WatchList
```

#### 2. Backend Setup
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```
*Backend runs on `http://localhost:5000` with live mock feed polling.*

#### 3. AI Verification Service (Optional for Groq LLM, runs with heuristic fallback)
```bash
cd ../ai-service
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```
*Verification service runs on `http://localhost:8000`.*

#### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`.*

---

### Docker Compose (One-Click)
```bash
docker-compose up --build
```

---

## 🛡️ Defense & FAQ (Groww Engineering Questions)

### Q1: How would this scale to 10 million concurrent users and 5,000 instruments?
**A:** Currently, quotes are maintained in an in-memory $O(1)$ state hash on the server. At 10M users:
1. **Exchange Ingestion Cluster**: Dedicated Go or Rust microservices consume raw multicast exchange feeds (NSE NOW/NEAT) and publish clean ticks into an Apache Kafka topic partitioned by symbol.
2. **Stream Processing (Flink / In-Memory Aggregator)**: Apache Flink evaluates sliding window metrics (20D volume multiples, RoC velocity) and publishes enriched quotes to a Redis Cluster.
3. **WebSocket Fan-Out Layer**: Stateless Node.js / Go WebSocket gateway nodes subscribe to Redis Pub/Sub channels for active symbols. Because users share watchlists of the same ~5,000 liquid stocks, we fan out updates using symbol channel subscriptions rather than calculating deltas per user.
4. **Session Catch-Up on Demand**: When an inactive user opens the app, the catch-up digest is computed on-demand by querying time-series snapshots (TimescaleDB / ClickHouse) for their ~20 watched stocks, requiring zero background CPU when the user is offline.

### Q2: How do you handle network disconnections on mobile devices?
**A:** The frontend includes an automatic exponential backoff reconnection loop. While disconnected, the UI displays a warning banner and freezes stale prices rather than showing outdated quotes as live. Upon reconnection, the client sends a session sync request to receive the catch-up delta for the disconnection window.

### Q3: Why not let the LLM decide if a move is confirmed?
**A:** Financial applications require strict zero-tolerance for hallucinations. LLMs are non-deterministic and susceptible to prompt injection or plausible-sounding fabrications. Dhyan uses deterministic SQL joins and exchange filing category lookups to assign confidence tiers; the LLM is restricted exclusively to natural language narrative rendering.

---

## 👩‍💻 Author & Submission Details

- **Submission**: Groww Code 2026 Hackathon
- **Repository**: [github.com/maanvi14/Dhyan-Smart-WatchList](https://github.com/maanvi14/Dhyan-Smart-WatchList)
- **Developer**: Maanvi Verma (`maanvi.verma14@gmail.com`)
- **License**: MIT
