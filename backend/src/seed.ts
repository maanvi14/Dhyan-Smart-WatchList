import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Starting Dhyan Database Seed...");

  // Clean existing demo data
  const demoEmail = "demo@dhyan.in";
  await prisma.user.deleteMany({ where: { email: demoEmail } });

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

  // 1. Create Demo User
  const user = await prisma.user.create({
    data: {
      email: demoEmail,
      passwordHash,
      name: "Demo Investor",
      investmentStyle: "MEDIUM_TERM",
      language: "en",
      lowDataMode: false
    }
  });

  // 2. Create Flagship Watchlist
  const watchlist = await prisma.watchlist.create({
    data: {
      userId: user.id,
      name: "Core Holdings & Watchlist"
    }
  });

  // 3. Add 9 Symbols Across Sectors
  const symbols = [
    { symbol: "NSE:TCS", sector: "IT", notes: "Core tech allocation - check Q3 dividend" },
    { symbol: "NSE:INFY", sector: "IT", notes: "US retail spending derivative play" },
    { symbol: "NSE:HDFCBANK", sector: "Banking", notes: "RBI merger approval watch" },
    { symbol: "NSE:ICICIBANK", sector: "Banking", notes: "Credit growth momentum" },
    { symbol: "NSE:HINDUNILVR", sector: "FMCG", notes: "Rural demand recovery candidate" },
    { symbol: "NSE:ITC", sector: "FMCG", notes: "Hotel demerger timeline" },
    { symbol: "NSE:TATAMOTORS", sector: "Auto", notes: "EV sales volume numbers" },
    { symbol: "NSE:SUNPHARMA", sector: "Pharma", notes: "FDA Halol inspection EIR update" },
    { symbol: "NSE:RELIANCE", sector: "Energy", notes: "Clean energy green hydrogen announcement" }
  ];

  const items = [];
  for (const s of symbols) {
    const item = await prisma.watchlistItem.create({
      data: {
        watchlistId: watchlist.id,
        symbol: s.symbol,
        sector: s.sector,
        notes: s.notes,
        addedAt: fiveHoursAgo,
        lastViewedAt: threeHoursAgo // Watermark set to 3 hours ago so events after 3h appear!
      }
    });
    items.push(item);
  }

  // 4. Pre-generate Change Events across 🟢 CONFIRMED, 🟡 UNEXPLAINED, 🔴 UNCERTAIN
  const tcsItem = items.find(i => i.symbol === "NSE:TCS")!;
  const hdfcItem = items.find(i => i.symbol === "NSE:HDFCBANK")!;
  const infyItem = items.find(i => i.symbol === "NSE:INFY")!;
  const tataItem = items.find(i => i.symbol === "NSE:TATAMOTORS")!;

  // Event 1: 🟢 CONFIRMED (TCS)
  await prisma.changeEvent.create({
    data: {
      watchlistItemId: tcsItem.id,
      symbol: "NSE:TCS",
      confidenceTier: "CONFIRMED",
      magnitude: 85,
      narrative: "NSE:TCS surged +3.42% following official exchange disclosure: Board approves interim dividend of Rs 18 per share.",
      sectorDivergence: true,
      volumeDivergence: true,
      detectedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago (after watermark)
      evidenceTrace: JSON.stringify([
        {
          step: "gather_evidence",
          timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
          detail: "Collected price move (+3.42%), volume ratio (2.35x avg), sector move (+0.45%), filing status (Found)."
        },
        {
          step: "classify_tier",
          timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
          detail: "Tier classified as CONFIRMED based on verified board meeting dividend filing on NSE."
        },
        {
          step: "write_narrative_groq_llm",
          timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
          detail: "Generated factual sentence via Groq Llama 3.3 model citing board meeting dividend outcome."
        }
      ])
    }
  });

  // Event 2: 🟡 UNEXPLAINED (INFY)
  await prisma.changeEvent.create({
    data: {
      watchlistItemId: infyItem.id,
      symbol: "NSE:INFY",
      confidenceTier: "UNEXPLAINED",
      magnitude: 68,
      narrative: "NSE:INFY dropped -2.85% with 2.1x volume vs sector +0.45%; no confirmed exchange catalyst found.",
      sectorDivergence: true,
      volumeDivergence: true,
      detectedAt: new Date(now.getTime() - 90 * 60 * 1000), // 1.5 hours ago
      evidenceTrace: JSON.stringify([
        {
          step: "gather_evidence",
          timestamp: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
          detail: "Collected price move (-2.85%), volume ratio (2.10x avg), sector move (+0.45%), filing status (None)."
        },
        {
          step: "classify_tier",
          timestamp: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
          detail: "Tier classified as UNEXPLAINED: significant price/volume anomaly detected, but no matching NSE filing exists in recent window."
        },
        {
          step: "write_narrative_groq_llm",
          timestamp: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
          detail: "Generated factual sentence explicitly highlighting absence of verified catalyst."
        }
      ])
    }
  });

  // Event 3: 🔴 UNCERTAIN (HDFCBANK)
  await prisma.changeEvent.create({
    data: {
      watchlistItemId: hdfcItem.id,
      symbol: "NSE:HDFCBANK",
      confidenceTier: "UNCERTAIN",
      magnitude: 50,
      narrative: "NSE:HDFCBANK price snapshot marked stale (>45s delayed); current market data should not be trusted yet.",
      sectorDivergence: false,
      volumeDivergence: false,
      detectedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      evidenceTrace: JSON.stringify([
        {
          step: "gather_evidence",
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
          detail: "Collected price tick from secondary fallback feed. Primary feed timeout encountered."
        },
        {
          step: "classify_tier",
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
          detail: "Tier classified as UNCERTAIN due to feed staleness threshold exceedance."
        },
        {
          step: "fallback_node",
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
          detail: "Data integrity fallback executed. Bypassed narrative creation to warn of unverified data state."
        }
      ])
    }
  });

  // Event 4: 🟢 CONFIRMED (TATAMOTORS)
  await prisma.changeEvent.create({
    data: {
      watchlistItemId: tataItem.id,
      symbol: "NSE:TATAMOTORS",
      confidenceTier: "CONFIRMED",
      magnitude: 78,
      narrative: "NSE:TATAMOTORS gained +2.90% after filing monthly wholesale EV sales volume surge of 42% YoY.",
      sectorDivergence: true,
      volumeDivergence: true,
      detectedAt: new Date(now.getTime() - 40 * 60 * 1000), // 40 mins ago
      evidenceTrace: JSON.stringify([
        {
          step: "gather_evidence",
          timestamp: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
          detail: "Collected price move (+2.90%), volume ratio (1.85x), sector move (+0.80%), filing status (Found)."
        },
        {
          step: "classify_tier",
          timestamp: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
          detail: "Tier classified as CONFIRMED based on monthly wholesale EV volume publication."
        },
        {
          step: "write_narrative_groq_llm",
          timestamp: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
          detail: "Generated concise factual summary citing EV wholesale data."
        }
      ])
    }
  });

  console.log("✅ Dhyan Database Seed Completed successfully!");
}

seed()
  .catch(e => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
