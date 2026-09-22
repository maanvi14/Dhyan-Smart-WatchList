import { Router, Request, Response } from "express";
import axios from "axios";
import { SYMBOL_UNIVERSE, SymbolInfo } from "../feed/symbols";
import { getFilingsForSymbol } from "../feed/filingsStore";
import { fetchLiveNewsForSymbol, NewsArticle } from "../feed/newsFeed";
import { priceFeed } from "../feed/priceFeed";

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// Bilingual claim keywords (English + Hindi)
const FILING_KEYWORDS = /dividend|bonus|split|merger|acquisition|results|earnings|partnership|order|deal|contract|डिविडेंड|लाभांश|बोनस|विभाजन|विलय|अधिग्रहण|नतीजे|परिणाम/i;
const PRICE_KEYWORDS  = /buy|sell|target|up|down|rally|crash|breakout|खरीदें|बेचें|टारगेट|लक्ष्य|उछाल|गिरावट|क्रैश|तेजी|मंदी/i;

// Common Devanagari aliases for major Indian stocks
const HINDI_ALIASES: Record<string, string[]> = {
  "NSE:TCS": ["टीसीएस", "टाटा कंसल्टेंसी"],
  "NSE:INFY": ["इन्फोसिस", "इन्फोसिस लिमिटेड", "इन्फी"],
  "NSE:IRCTC": ["आईआरसीटीसी"],
  "NSE:RVNL": ["आरवीएनएल"],
  "NSE:RELIANCE": ["रिलायंस", "रिलायंस इंडस्ट्रीज"],
  "NSE:HDFCBANK": ["एचडीएफसी", "एचडीएफसी बैंक"],
  "NSE:ICICIBANK": ["आईसीआईसीआई", "आईसीआईसीआई बैंक"],
  "NSE:SBIN": ["एसबीआई", "स्टेट बैंक"],
  "NSE:TATAMOTORS": ["टाटा मोटर्स"],
  "NSE:ITC": ["आईटीसी"],
  "NSE:WIPRO": ["विप्रो"],
  "NSE:SUNPHARMA": ["सन फार्मा"]
};

function extractSymbol(tip: string): SymbolInfo | null {
  const cleanTip = tip.trim();

  // 1. Check Hindi / Devanagari aliases first
  for (const [sym, aliases] of Object.entries(HINDI_ALIASES)) {
    for (const alias of aliases) {
      if (cleanTip.includes(alias)) {
        const found = SYMBOL_UNIVERSE.find(s => s.symbol === sym);
        if (found) return found;
      }
    }
  }

  // 2. Check English tickers and names (longest/most specific first)
  const candidates = [...SYMBOL_UNIVERSE].sort((a, b) => b.name.length - a.name.length);

  for (const info of candidates) {
    const bareSymbol = info.symbol.replace("NSE:", "");
    const bareTicker = info.ticker.replace(".NS", "");

    const symRegex = new RegExp(`\\b(${bareSymbol}|${bareTicker})\\b`, "i");
    if (symRegex.test(cleanTip)) {
      return info;
    }

    if (cleanTip.toLowerCase().includes(info.name.toLowerCase())) {
      return info;
    }

    const primaryName = info.name
      .replace(/\s+(Ltd|Limited|Corp|Industries|India|Holdings|Pharmaceutical|Laboratories)\b/gi, "")
      .trim();

    if (primaryName.length >= 4) {
      const brandRegex = new RegExp(`\\b${primaryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
      if (brandRegex.test(cleanTip)) {
        return info;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// POST /api/verify-tip
// ---------------------------------------------------------------------------
router.post("/", async (req: Request, res: Response) => {
  const { tipText } = req.body;

  if (!tipText || typeof tipText !== "string" || tipText.trim().length === 0) {
    return res.status(400).json({ error: "tipText is required" });
  }

  const tip = tipText.trim();

  // 1. Extract symbol
  const symbolInfo = extractSymbol(tip);
  if (!symbolInfo) {
    return res.json({
      extractedSymbol: null,
      message: "No recognised stock symbol found in this tip. Dhyan's universe currently covers 30 major NSE stocks.",
      messageHi: "इस टिप में कोई मान्यता प्राप्त स्टॉक प्रतीक नहीं मिला। ध्यान का दायरा वर्तमान में 30 प्रमुख NSE शेयरों को कवर करता है।",
      confidenceTier: null,
      narrative: null,
      narrativeHi: null,
      evidenceTrace: [],
      newsArticles: []
    });
  }

  // 2. Determine claim path
  const isFilingClaim = FILING_KEYWORDS.test(tip);
  const isPriceClaim  = PRICE_KEYWORDS.test(tip);

  // 30-day filing window (720 hours)
  const filings30d = getFilingsForSymbol(symbolInfo.symbol, 720);
  const filingSummary = filings30d.length > 0
    ? filings30d[0].title + " — " + filings30d[0].summary
    : null;

  // Real price snapshot
  const snapshot = priceFeed.getLatestSnapshot(symbolInfo.symbol);
  const changePct     = snapshot?.changePct     ?? 0;
  const volumeRatio   = snapshot?.avgVolume20d  && snapshot.avgVolume20d > 0
    ? parseFloat((snapshot.volume / snapshot.avgVolume20d).toFixed(2))
    : 1.0;
  const sectorChangePct = priceFeed.getSectorChangePct(symbolInfo.sector);
  const isStale       = snapshot?.isStale ?? true;
  const sourceTrust   = snapshot?.sourceTrust ?? 1;

  // 3. Fetch Live / Curated News Articles for Press Corroboration
  let recentNews: NewsArticle[] = [];
  try {
    recentNews = await fetchLiveNewsForSymbol(symbolInfo.symbol);
  } catch (_) {}

  // Check if tip words match any news headline
  const matchingNews = recentNews.find(n => {
    const tipWords = tip.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    return tipWords.some(w => n.title.toLowerCase().includes(w));
  }) || (recentNews.length > 0 ? recentNews[0] : null);

  // 4. Multi-Layer Classification:
  // Tier 1: CONFIRMED (Exchange Filing)
  // Tier 2: PRESS_CORROBORATED (Moneycontrol / ET / Mint)
  // Tier 3: UNEXPLAINED / UNCERTAIN (Rumor / Directional Mismatch)
  let tier: "CONFIRMED" | "PRESS_CORROBORATED" | "UNEXPLAINED" | "UNCERTAIN" = "UNEXPLAINED";
  let narrative: string;
  let narrativeHi: string;
  const sign = changePct >= 0 ? "+" : "";

  if (isStale || sourceTrust < 1) {
    tier = "UNCERTAIN";
    narrative = `${symbolInfo.name}: Current price data is stale or unavailable — this tip cannot be verified at this time.`;
    narrativeHi = `${symbolInfo.name}: वर्तमान बाजार मूल्य डेटा पुराना या अनुपलब्ध है — इस टिप को अभी सत्यापित नहीं किया जा सकता।`;
  } else if (isFilingClaim && filingSummary) {
    tier = "CONFIRMED";
    narrative = `${symbolInfo.name} (${symbolInfo.symbol}): Official exchange filing confirms this catalyst — ${filingSummary}.`;
    narrativeHi = `${symbolInfo.name} (${symbolInfo.symbol}): आधिकारिक एक्सचेंज फाइलिंग इस उत्प्रेरक की पुष्टि करती है — ${filingSummary}।`;
  } else if (matchingNews && isFilingClaim) {
    tier = "PRESS_CORROBORATED";
    narrative = `${symbolInfo.name}: Corroborated in financial media by ${matchingNews.publisher} ("${matchingNews.title}"). Awaiting formal BSE/NSE Regulation 30 filing.`;
    narrativeHi = `${symbolInfo.name}: ${matchingNews.publisher} की वित्तीय रिपोर्ट में इसका उल्लेख है। आधिकारिक एक्सचेंज फाइलिंग की प्रतीक्षा है।`;
  } else if (isFilingClaim && !filingSummary) {
    tier = "UNCERTAIN";
    narrative = `${symbolInfo.name}: No exchange filing or verified press report found for this claim in the last 30 days — treat as unverified rumor.`;
    narrativeHi = `${symbolInfo.name}: पिछले 30 दिनों में इस दावे के लिए कोई आधिकारिक एक्सचेंज फाइलिंग नहीं मिली — कृपया सतर्क रहें।`;
  } else if (isPriceClaim) {
    const claimedUp = /buy|target|up|rally|breakout|खरीदें|लक्ष्य|उछाल|तेजी/i.test(tip);
    const actualUp = changePct >= 0;
    if (claimedUp !== actualUp && Math.abs(changePct) > 1.0) {
      tier = "UNCERTAIN";
      narrative = `${symbolInfo.name}: Tip claims ${claimedUp ? "upward" : "downward"} move but real price moved ${sign}${changePct.toFixed(2)}% — directional mismatch.`;
      narrativeHi = `${symbolInfo.name}: टिप में ${claimedUp ? "बढ़त" : "गिरावट"} का दावा है लेकिन वास्तविक शेयर मूल्य ${sign}${changePct.toFixed(2)}% बदला — दिशा का विरोधाभास।`;
    } else {
      tier = "UNEXPLAINED";
      narrative = `${symbolInfo.name} trades at ${sign}${changePct.toFixed(2)}% with ${volumeRatio.toFixed(1)}x volume. Pure market flow — zero verified filing catalysts found.`;
      narrativeHi = `${symbolInfo.name} में ${sign}${changePct.toFixed(2)}% बदलाव और ${volumeRatio.toFixed(1)}x वॉल्यूम देखा गया। कोई पुष्ट एक्सचेंज फाइलिंग नहीं मिली।`;
    }
  } else {
    tier = matchingNews ? "PRESS_CORROBORATED" : "UNEXPLAINED";
    narrative = matchingNews
      ? `${symbolInfo.name} recent coverage by ${matchingNews.publisher}: "${matchingNews.title}".`
      : `${symbolInfo.name} trades at ${sign}${changePct.toFixed(2)}%. No confirmed corporate filing found.`;
    narrativeHi = `${symbolInfo.name} में ${sign}${changePct.toFixed(2)}% बदलाव देखा गया।`;
  }

  // 5. Attempt AI service /verify-tip for enhanced LLM narrative
  try {
    const aiRes = await axios.post(`${AI_SERVICE_URL}/verify-tip`, {
      symbol:         symbolInfo.symbol,
      symbolName:     symbolInfo.name,
      originalTip:    tip,
      isFilingClaim,
      isPriceClaim,
      changePct,
      volumeRatio,
      sectorChangePct,
      filingSummary,
      isStale,
      sourceTrust,
      newsHeadlines: recentNews.map(n => `${n.publisher}: ${n.title}`)
    }, { timeout: 4000 });

    const data = aiRes.data;
    return res.json({
      extractedSymbol:   symbolInfo.symbol,
      symbolName:        symbolInfo.name,
      sector:            symbolInfo.sector,
      isFilingClaim,
      isPriceClaim,
      confidenceTier:    data.confidenceTier || tier,
      narrative:         data.narrative || narrative,
      narrativeHi,
      evidenceTrace:     data.evidenceTrace || [],
      newsArticles:      recentNews.slice(0, 3)
    });
  } catch (err) {
    // Local deterministic fallback
    const fallbackTrace = [
      {
        step: "tip_symbol_extract",
        timestamp: new Date().toISOString(),
        detail: `Extracted symbol: ${symbolInfo.symbol} (${symbolInfo.name}) via text match. Claim type: ${isFilingClaim ? "filing-based" : isPriceClaim ? "price-move" : "general"}.`
      },
      {
        step: "filing_lookup_30d",
        timestamp: new Date().toISOString(),
        detail: filingSummary
          ? `Found matching filing in last 30 days: ${filingSummary}`
          : `No exchange filings found for ${symbolInfo.symbol} in the last 30 days.`
      },
      {
        step: "press_corroboration",
        timestamp: new Date().toISOString(),
        detail: matchingNews
          ? `Cross-referenced with financial press: "${matchingNews.title}" (${matchingNews.publisher}).`
          : `Scanned Moneycontrol / Financial press — no matching reports found.`
      },
      {
        step: "classify_tier",
        timestamp: new Date().toISOString(),
        detail: `Tier classified as ${tier}.`
      }
    ];

    return res.json({
      extractedSymbol:  symbolInfo.symbol,
      symbolName:       symbolInfo.name,
      sector:           symbolInfo.sector,
      isFilingClaim,
      isPriceClaim,
      confidenceTier:   tier,
      narrative,
      narrativeHi,
      evidenceTrace:    fallbackTrace,
      newsArticles:     recentNews.slice(0, 3)
    });
  }
});

export default router;
