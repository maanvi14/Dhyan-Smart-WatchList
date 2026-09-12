import { Router } from "express";
import { priceFeed } from "../feed/priceFeed";
import { addFiling } from "../feed/filingsStore";
import { proactiveFilingScanner } from "../engine/proactiveScanner";

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

export default router;
