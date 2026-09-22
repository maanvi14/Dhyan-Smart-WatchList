import { Router, Request, Response } from "express";
import { SYMBOL_UNIVERSE } from "../feed/symbols";
import { getAllFilings, getFilingsForSymbol, FilingAnnouncement } from "../feed/filingsStore";
import { getCuratedNewsArchive, getMarketWideWire, NewsArticle } from "../feed/newsFeed";
import { priceFeed } from "../feed/priceFeed";

const router = Router();

export interface WireItem {
  id: string;
  type: "FILING" | "NEWS";
  symbol: string;
  symbolName: string;
  sector: string;
  title: string;
  summary?: string;
  source: string;
  link?: string;
  timestamp: string;
  confidenceTier: "CONFIRMED" | "PRESS_CORROBORATED" | "UNEXPLAINED";
  changePct: number;
  ltp: number;
}

// GET /api/market-wire/breadth (Public Macro Breadth endpoint)
router.get("/breadth", (req: Request, res: Response) => {
  try {
    const sectors = Array.from(new Set(SYMBOL_UNIVERSE.map(s => s.sector)));
    const sectorStats = sectors.map(sector => {
      const symbolsInSector = SYMBOL_UNIVERSE.filter(s => s.sector === sector);
      let advances = 0;
      let declines = 0;
      let unchanged = 0;

      symbolsInSector.forEach(sym => {
        const snap = priceFeed.getLatestSnapshot(sym.symbol);
        const change = snap?.changePct ?? 0;
        if (change > 0.05) advances++;
        else if (change < -0.05) declines++;
        else unchanged++;
      });

      const changePct = priceFeed.getSectorChangePct(sector);
      return {
        sector,
        changePct: Number(changePct.toFixed(2)),
        total: symbolsInSector.length,
        advances,
        declines,
        unchanged
      };
    });

    const advancingSectors = sectorStats.filter(s => s.changePct > 0).length;
    const decliningSectors = sectorStats.filter(s => s.changePct < 0).length;
    const avgChange = sectorStats.reduce((acc, s) => acc + s.changePct, 0) / (sectorStats.length || 1);

    return res.json({
      timestamp: new Date().toISOString(),
      totalSectors: sectors.length,
      advancingSectors,
      decliningSectors,
      neutralSectors: sectors.length - (advancingSectors + decliningSectors),
      averageSectorChangePct: Number(avgChange.toFixed(2)),
      breadthState: advancingSectors > decliningSectors ? "ADVANCING" : decliningSectors > advancingSectors ? "DECLINING" : "BALANCED",
      sectors: sectorStats
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to calculate breadth" });
  }
});

// GET /api/market-wire (All confirmed filings and accredited press)
router.get("/", async (req: Request, res: Response) => {
  try {
    const wireItems: WireItem[] = [];

    // 1. Ingest all recent Regulation 30 filings across the universe
    const allFilings = getAllFilings(72);
    for (const f of allFilings) {
      const symInfo = SYMBOL_UNIVERSE.find(s => s.symbol === f.symbol);
      const snapshot = priceFeed.getLatestSnapshot(f.symbol);
      const ltp = snapshot?.ltp ?? symInfo?.basePrice ?? 1000;
      const changePct = snapshot?.changePct ?? 0;

      wireItems.push({
        id: `wire-filing-${f.id}`,
        type: "FILING",
        symbol: f.symbol,
        symbolName: symInfo?.name || f.symbol,
        sector: symInfo?.sector || "General",
        title: f.title,
        summary: f.summary,
        source: `BSE/NSE Reg 30 (${f.category})`,
        link: (f as any).link || `https://www.bseindia.com/corporates/ann.aspx?scrip=${(f as any).bseScripCode || ""}&dur=A&Start=0&End=10`,
        timestamp: f.timestamp.toISOString(),
        confidenceTier: "CONFIRMED",
        changePct,
        ltp
      });
    }

    // 2. Ingest curated & live market press stories
    const marketNews = await getMarketWideWire(25);
    for (const n of marketNews) {
      const symInfo = SYMBOL_UNIVERSE.find(s => s.symbol === n.symbol);
      if (symInfo) {
        const snapshot = priceFeed.getLatestSnapshot(symInfo.symbol);
        const ltp = snapshot?.ltp ?? symInfo.basePrice;
        const changePct = snapshot?.changePct ?? 0;

        wireItems.push({
          id: `wire-news-${n.id}`,
          type: "NEWS",
          symbol: symInfo.symbol,
          symbolName: symInfo.name,
          sector: symInfo.sector,
          title: n.title,
          summary: n.snippet,
          source: n.publisher,
          link: n.link,
          timestamp: n.publishedAt,
          confidenceTier: "PRESS_CORROBORATED",
          changePct,
          ltp
        });
      }
    }

    // Sort by most recent first
    wireItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({
      total: wireItems.length,
      timestamp: new Date().toISOString(),
      items: wireItems
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch market wire" });
  }
});

export default router;
