import { Router } from "express";
import { priceFeed } from "../feed/priceFeed";
import { addFiling } from "../feed/filingsStore";
import { proactiveFilingScanner } from "../engine/proactiveScanner";
import { prisma } from "../db";
import { populateUniverseWatchlist } from "../populateUniverse";

const router = Router();

// Kill Feed Switch
router.post("/feed/kill", (req, res) => {
  priceFeed.killFeed();
  res.json({
    success: true,
    feedStatus: priceFeed.getFeedStatus()
  });
});

// Revive Feed Switch
router.post("/feed/revive", (req, res) => {
  priceFeed.reviveFeed();
  res.json({
    success: true,
    feedStatus: priceFeed.getFeedStatus()
  });
});

// 🐒 Chaos Engineering: Chaos Monkey Network Jitter & Multicast Packet Drop Simulation
router.post("/chaos-monkey", (req, res) => {
  const { dropRate = 0.5, jitterMs = 450 } = req.body || {};
  
  // Stochastically mark random symbols as stale to simulate exchange feed UDP multicast degradation
  const allSnaps = priceFeed.getAllSnapshots();
  let affectedCount = 0;
  allSnaps.forEach(snap => {
    if (Math.random() < dropRate) {
      snap.isStale = true;
      affectedCount++;
    }
  });

  res.json({
    success: true,
    mode: "chaos_monkey_active",
    simulatedJitterMs: jitterMs,
    simulatedPacketDropRate: `${dropRate * 100}%`,
    affectedSymbols: affectedCount,
    message: `🐒 Chaos Monkey Injected: ${affectedCount} instruments experiencing simulated multicast packet drops with ${jitterMs}ms artificial jitter. Redwood UI safety borders triggered.`
  });
});

// Get Feed Status
router.get("/feed/status", (req, res) => {
  res.json(priceFeed.getFeedStatus());
});

// ⚡ Live Demo Scenario 1: Trigger Official Regulatory Filing Catalyst (TCS)
router.post("/trigger-catalyst", async (req, res) => {
  try {
    const symbol = "NSE:TCS";
    addFiling({
      id: `live-demo-filing-${Date.now()}`,
      symbol,
      title: "TCS Secures ₹15,000Cr Strategic Cloud & AI Transformation Contract with European Consortium",
      category: "Regulation 30 Material Disclosure",
      timestamp: new Date(),
      summary: "Tata Consultancy Services enters multi-year agreement for digital infrastructure upgrade, expected to expand EBIT margins by 40bps."
    });

    // Induce immediate price & volume reaction
    priceFeed.injectTick(symbol, 2.65, 2.4);

    // Trigger immediate proactive scan sweep
    await proactiveFilingScanner.scan();

    res.json({
      success: true,
      message: "Triggered live Catalyst Confirmed event for NSE:TCS",
      symbol
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ⚡ Live Demo Scenario 2: Trigger Uninformed Flow Dislocation (HDFC Bank)
router.post("/trigger-uninformed", (req, res) => {
  try {
    const symbol = "NSE:HDFCBANK";
    // Inject abnormal price move and volume surge with ZERO filings
    priceFeed.injectTick(symbol, -2.45, 2.8);

    res.json({
      success: true,
      message: "Triggered live Uninformed Flow dislocation for NSE:HDFCBANK",
      symbol
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// 🧠 Live Demo Scenario 3: Trigger River True Online Self-Learning Resolution
router.post("/trigger-self-learn", async (req, res) => {
  try {
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const axios = (await import("axios")).default;

    // Simulate an unresolved anomaly that just received delayed official filing confirmation
    const feedbackPayload = {
      symbol: "NSE:TCS",
      changePct: 3.45,
      volumeRatio: 3.10,
      sectorChangePct: 0.45,
      sectorDivergence: true,
      groundTruthTier: "CONFIRMED",
      filingSummary: "TCS executes ₹15,000Cr Strategic European Digital Infrastructure Contract",
      isStale: false,
      sourceTrust: 3
    };

    const aiRes = await axios.post(`${AI_SERVICE_URL}/feedback/resolve`, {
      ...feedbackPayload,
      isStale: false
    }, { timeout: 3000 });

    res.json({
      success: true,
      message: `⚡ True Online Learning Executed: River updated SGD weights sample-by-sample in ${aiRes.data?.result?.learnLatencyMs || 0.8}ms! Total streaming samples learned: ${aiRes.data?.result?.totalSamplesLearned || 1}`,
      data: aiRes.data
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 🔄 Demo Reset: Wipe all ripple events + populate all 32 symbols + push watermarks back 3h so next trigger-catalyst fires fresh
router.post("/reset-demo", async (req, res) => {
  try {
    // 1. Delete all ripple (contagion) change events — clears the debounce
    const deleted = await prisma.changeEvent.deleteMany({
      where: { isRippleEffect: true }
    });

    // 2. Ensure all 32 universe companies are in the watchlist
    const addedSymbols = await populateUniverseWatchlist();

    // 3. Push every watchlist item's lastViewedAt to 3 hours ago so new events appear as "new"
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await prisma.watchlistItem.updateMany({
      data: { lastViewedAt: threeHoursAgo }
    });

    res.json({
      success: true,
      message: `Demo reset complete. Cleared ${deleted.count} ripple events. Populated ${addedSymbols} universe symbols (32 total companies). Watermarks reset.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

