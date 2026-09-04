import { Router, Request, Response } from "express";
import axios from "axios";
import { SYMBOL_UNIVERSE, SymbolInfo } from "../feed/symbols";
import { getFilingsForSymbol } from "../feed/filingsStore";
import { priceFeed } from "../feed/priceFeed";

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// Bilingual claim keywords (English + Hindi)
const FILING_KEYWORDS = /dividend|bonus|split|merger|acquisition|results|earnings|डिविडेंड|लाभांश|बोनस|विभाजन|विलय|अधिग्रहण|नतीजे|परिणाम/i;
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

// ---------------------------------------------------------------------------
// Symbol extractor — returns the first SymbolInfo whose symbol/ticker/name
// appears in the tip text (case-insensitive, supporting Latin and Devanagari).
// ---------------------------------------------------------------------------
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

    // Exact symbol or ticker as a distinct word: \bTCS\b, \bINFY\b, \bITC\b
    const symRegex = new RegExp(`\\b(${bareSymbol}|${bareTicker})\\b`, "i");
    if (symRegex.test(cleanTip)) {
      return info;
    }

    // Full company name check
    if (cleanTip.toLowerCase().includes(info.name.toLowerCase())) {
      return info;
    }

    // Significant first word / brand keyword
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
      evidenceTrace: []
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

  // Real price snapshot (best-effort)
  const snapshot = priceFeed.getLatestSnapshot(symbolInfo.symbol);
  const changePct     = snapshot?.changePct     ?? 0;
  const volumeRatio   = snapshot?.avgVolume20d  && snapshot.avgVolume20d > 0
    ? parseFloat((snapshot.volume / snapshot.avgVolume20d).toFixed(2))
    : 1.0;
  const sectorChangePct = priceFeed.getSectorChangePct(symbolInfo.sector);
  const isStale       = snapshot?.isStale ?? true;
  const sourceTrust   = snapshot?.sourceTrust ?? 1;

  // Generate deterministic English & Hindi narratives
  let tier: "CONFIRMED" | "UNEXPLAINED" | "UNCERTAIN" = "UNEXPLAINED";
  let narrative: string;
  let narrativeHi: string;
  const sign = changePct >= 0 ? "+" : "";

  if (isStale || sourceTrust < 1) {
    tier = "UNCERTAIN";
    narrative = `${symbolInfo.name}: Current price data is stale or unavailable — this tip cannot be verified at this time.`;
    narrativeHi = `${symbolInfo.name}: वर्तमान बाजार मूल्य डेटा पुराना या अनुपलब्ध है — इस टिप को अभी सत्यापित नहीं किया जा सकता।`;
  } else if (isFilingClaim && filingSummary) {
    tier = "CONFIRMED";
    narrative = `${symbolInfo.name} (${symbolInfo.symbol}): A matching exchange filing corroborates this tip — ${filingSummary}.`;
    narrativeHi = `${symbolInfo.name} (${symbolInfo.symbol}): एक आधिकारिक एक्सचेंज फाइलिंग इस टिप की पुष्टि करती है — ${filingSummary}।`;
  } else if (isFilingClaim && !filingSummary) {
    tier = "UNCERTAIN";
    narrative = `${symbolInfo.name}: No exchange filing found for this claimed event in the last 30 days — treat this tip with caution.`;
    narrativeHi = `${symbolInfo.name}: पिछले 30 दिनों में इस कॉर्पोरेट कार्रवाई के लिए कोई आधिकारिक एक्सचेंज फाइलिंग नहीं मिली — कृपया इस टिप से सतर्क रहें।`;
  } else if (isPriceClaim) {
    const claimedUp = /buy|target|up|rally|breakout|खरीदें|लक्ष्य|उछाल|तेजी/i.test(tip);
    const actualUp = changePct >= 0;
    if (claimedUp !== actualUp && Math.abs(changePct) > 1.0) {
      tier = "UNCERTAIN";
      narrative = `${symbolInfo.name}: Tip claims ${claimedUp ? "upward" : "downward"} move but real price moved ${sign}${changePct.toFixed(2)}% — directional mismatch.`;
      narrativeHi = `${symbolInfo.name}: टिप में ${claimedUp ? "बढ़त" : "गिरावट"} का दावा है लेकिन वास्तविक शेयर मूल्य ${sign}${changePct.toFixed(2)}% बदला — दिशा का विरोधाभास।`;
    } else {
      tier = "UNEXPLAINED";
      narrative = `${symbolInfo.name} shows ${sign}${changePct.toFixed(2)}% change with ${volumeRatio.toFixed(1)}x volume. No confirmed catalyst found for this tip.`;
      narrativeHi = `${symbolInfo.name} में ${sign}${changePct.toFixed(2)}% बदलाव और ${volumeRatio.toFixed(1)}x वॉल्यूम देखा गया। इस टिप के लिए कोई पुष्ट उत्प्रेरक नहीं मिला।`;
    }
  } else {
    tier = "UNEXPLAINED";
    narrative = `${symbolInfo.name} shows ${sign}${changePct.toFixed(2)}% change with ${volumeRatio.toFixed(1)}x volume. No confirmed catalyst found for this tip.`;
    narrativeHi = `${symbolInfo.name} में ${sign}${changePct.toFixed(2)}% बदलाव देखा गया। इस टिप के लिए कोई पुष्ट उत्प्रेरक नहीं मिला।`;
  }

  // 3. Attempt AI service /verify-tip for enhanced LLM narrative
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
      sourceTrust
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
      evidenceTrace:     data.evidenceTrace || []
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
      evidenceTrace:    fallbackTrace
    });
  }
});

export default router;
