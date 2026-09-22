import { Router, Request, Response } from "express";
import { SYMBOL_UNIVERSE } from "../feed/symbols";
import { getFilingsForSymbol, FilingAnnouncement } from "../feed/filingsStore";
import { fetchLiveNewsForSymbol, getMarketWideWire, NewsArticle } from "../feed/newsFeed";
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

router.get("/", async (req: Request, res: Response) => {
  try {
    const wireItems: WireItem[] = [];

    // 1. Ingest all recent Regulation 30 filings across the universe
    for (const symInfo of SYMBOL_UNIVERSE) {
      const filings = getFilingsForSymbol(symInfo.symbol, 72); // last 72 hours
      const snapshot = priceFeed.getLatestSnapshot(symInfo.symbol);
      const ltp = snapshot?.ltp ?? symInfo.basePrice;
      const changePct = snapshot?.changePct ?? 0;

      for (const f of filings) {
        wireItems.push({
          id: `wire-filing-${f.id}`,
          type: "FILING",
          symbol: symInfo.symbol,
          symbolName: symInfo.name,
          sector: symInfo.sector,
          title: f.title,
          summary: f.summary,
          source: `BSE/NSE Reg 30 (${f.category})`,
          timestamp: f.timestamp.toISOString(),
          confidenceTier: "CONFIRMED",
          changePct,
          ltp
        });
      }
    }

    // 2. Ingest curated & live market press stories
    const marketNews = await getMarketWideWire(15);
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
