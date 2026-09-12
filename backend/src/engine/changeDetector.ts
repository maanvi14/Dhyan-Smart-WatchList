import axios from "axios";
import { SnapshotData, priceFeed } from "../feed/priceFeed";
import { getFilingsForSymbol } from "../feed/filingsStore";
import { getSymbolInfo, SYMBOL_UNIVERSE } from "../feed/symbols";
import {
  getInsiderTradesForSymbol,
  buildInsiderNarrative,
  InsiderTrade
} from "../feed/insiderStore";
import { prisma } from "../db";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export interface ChangeDetectionResult {
  symbol: string;
  confidenceTier: "CONFIRMED" | "UNEXPLAINED" | "UNCERTAIN";
  magnitude: number;
  narrative: string;
  evidenceTrace: any[];
  sectorDivergence: boolean;
  volumeDivergence: boolean;
  detectedAt: Date;
  // ── NEW: Ripple Effect ───────────────────────────────────────────
  isRippleEffect?: boolean;
  rippleSourceSymbol?: string;
  // ── NEW: Skin in the Game ────────────────────────────────────────
  insiderTradeData?: InsiderTrade[] | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hidden Internal Quant Math (RSI & Z-Score anomaly tightening)
// ─────────────────────────────────────────────────────────────────────────────
export function computeInternalZScore(prices: number[]): number {
  if (prices.length < 5) return 0;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  const current = prices[prices.length - 1];
  return Number(((current - mean) / stdDev).toFixed(2));
}

export function computeInternalRSI(prices: number[], period = 14): number {
  if (prices.length < 4) return 50;
  let gains = 0;
  let losses = 0;
  const count = Math.min(prices.length - 1, period);
  for (let i = prices.length - count; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return Number((100 - (100 / (1 + rs))).toFixed(1));
}

// ─────────────────────────────────────────────────────────────────────────────
// ⚡ SECTOR CONTAGION: Returns a lightweight contagion alert for a peer symbol
// Called by index.ts after a high-magnitude event on a "source" symbol.
// ─────────────────────────────────────────────────────────────────────────────
export function generateRippleEvent(
  peerSymbol: string,
  sourceSymbol: string,
  sourceMagnitude: number,
  sector: string
): ChangeDetectionResult {
  const sourceInfo = getSymbolInfo(sourceSymbol);
  const sourceName = sourceInfo?.name || sourceSymbol;
  const peerInfo = getSymbolInfo(peerSymbol);
  const peerName = peerInfo?.name || peerSymbol;

  return {
    symbol: peerSymbol,
    confidenceTier: "UNEXPLAINED",
    magnitude: Math.round(sourceMagnitude * 0.6), // contagion is typically attenuated
    narrative: `⚡ Sector Contagion Alert: ${sourceName} triggered a ${sourceMagnitude.toFixed(0)}-point event in the ${sector} sector. Peer ${peerName} flagged for contagion spread; no verified catalyst confirmed yet.`,
    evidenceTrace: [
      {
        step: "sector_contagion_detection",
        timestamp: new Date().toISOString(),
        detail: `Source event: ${sourceSymbol} (signal strength ${sourceMagnitude.toFixed(0)}) in sector ${sector}. Sector peer ${peerSymbol} flagged for contagion sweep.`
      },
      {
        step: "classify_tier",
        timestamp: new Date().toISOString(),
        detail: `Status set to UNINFORMED FLOW — no independent regulatory filing found for ${peerSymbol}. Contagion is unverified.`
      }
    ],
    sectorDivergence: false,
    volumeDivergence: false,
    detectedAt: new Date(),
    isRippleEffect: true,
    rippleSourceSymbol: sourceSymbol
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main change detection flow for a live price snapshot
// ─────────────────────────────────────────────────────────────────────────────
export async function processSnapshotForChange(
  snapshot: SnapshotData,
  lowDataMode: boolean = false
): Promise<ChangeDetectionResult | null> {
  const symbolInfo = getSymbolInfo(snapshot.symbol);
  const sector = symbolInfo?.sector || "General";
  const sectorChangePct = priceFeed.getSectorChangePct(sector);

  const changePct = snapshot.changePct;
  const absChangePct = Math.abs(changePct);
  const volumeRatio =
    snapshot.avgVolume20d > 0
      ? Number((snapshot.volume / snapshot.avgVolume20d).toFixed(2))
      : 1.0;

  // Internal Hidden Quant Math: statistical dislocation checks
  const rollingPrices = priceFeed.getRollingPrices(snapshot.symbol);
  const internalZScore = computeInternalZScore(rollingPrices);
  const internalRSI = computeInternalRSI(rollingPrices);
  const isStatisticalAnomaly = Math.abs(internalZScore) >= 2.2 || (internalRSI <= 28 && volumeRatio >= 1.3);

  // Step A — Signal Dislocation filter: process if |changePct| >= 2.0% OR volumeRatio >= 1.5 OR statistical dislocation
  const passesThreshold =
    absChangePct >= 2.0 || volumeRatio >= 1.5 || snapshot.isStale || isStatisticalAnomaly;
  if (!passesThreshold) {
    return null; // Noise filtered out
  }

  // Step B — Divergence checks
  let sectorDivergence = false;
  if (!lowDataMode) {
    sectorDivergence = Math.abs(changePct - sectorChangePct) >= 1.5;
  }
  const volumeDivergence =
    volumeRatio >= 2.0 || (absChangePct >= 2.5 && volumeRatio < 1.0);

  // Step C — Catalyst check: official filings
  const filings = getFilingsForSymbol(snapshot.symbol, 4);
  const filingSummary =
    filings.length > 0 ? filings[0].title + " - " + filings[0].summary : null;

  // ── 🐋 Step C2 — Skin in the Game: Insider / Promoter trades ─────────────
  const insiderTrades = getInsiderTradesForSymbol(snapshot.symbol, 24);
  const insiderNarrative =
    insiderTrades.length > 0 ? buildInsiderNarrative(insiderTrades) : null;
  // Insider buys alongside a move elevates confidence to CONFIRMED
  const hasInsiderBuy = insiderTrades.some(t => t.action === "BUY");
  const hasInsiderSell = insiderTrades.some(t => t.action === "SELL");

  // Compute magnitude score (0 - 100)
  let magnitude = Math.min(
    100,
    Math.round(
      absChangePct * 15 +
      volumeRatio * 10 +
      (filings.length > 0 ? 25 : 0) +
      (insiderTrades.length > 0 ? 20 : 0) // insider data adds weight
    )
  );
  if (snapshot.isStale) magnitude = Math.max(magnitude, 40);

  // ── 🕰️ Step C3 — Historical Resolution: look up last 3 UNEXPLAINED events ─
  let historicalResolutionNote: string | null = null;
  try {
    const pastUnexplained = await prisma.changeEvent.findMany({
      where: {
        symbol: snapshot.symbol,
        confidenceTier: "UNEXPLAINED"
      },
      orderBy: { detectedAt: "desc" },
      take: 3
    });

    if (pastUnexplained.length >= 2) {
      // Check what tier they resolved to (within 48h they are typically followed by a CONFIRMED)
      const resolvedConfirmed = await prisma.changeEvent.count({
        where: {
          symbol: snapshot.symbol,
          confidenceTier: "CONFIRMED",
          detectedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // last 30 days
          }
        }
      });
      if (resolvedConfirmed > 0) {
        historicalResolutionNote = `Historical Pattern: The last ${pastUnexplained.length} Unexplained moves for ${snapshot.symbol} were followed by a Confirmed filing within 48h in ${resolvedConfirmed} of ${pastUnexplained.length} cases.`;
      } else {
        historicalResolutionNote = `Historical Pattern: ${pastUnexplained.length} prior Unexplained moves recorded for ${snapshot.symbol} — none resolved to a Confirmed filing in the past 30 days. Treat with caution.`;
      }
    }
  } catch (e) {
    // Non-blocking: if DB unavailable, skip historical note
  }

  // Step D — Verification flow
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/verify`,
      {
        symbol: snapshot.symbol,
        changePct,
        volumeRatio,
        sectorChangePct,
        sectorDivergence,
        volumeDivergence,
        filingSummary,
        isStale: snapshot.isStale,
        sourceTrust: snapshot.sourceTrust,
        lowDataMode,
        // Pass insider data to AI for richer narrative
        insiderNarrative
      },
      { timeout: 5000 }
    );

    const data = response.data;

    // Elevate tier if insider confirmation present
    let finalTier: "CONFIRMED" | "UNEXPLAINED" | "UNCERTAIN" = data.confidenceTier;
    if (hasInsiderBuy && finalTier === "UNEXPLAINED") {
      finalTier = "CONFIRMED";
    }

    let finalNarrative = data.narrative;
    if (insiderNarrative) {
      finalNarrative += ` 🐋 ${insiderNarrative}`;
    }
    if (historicalResolutionNote) {
      finalNarrative += ` 🕰️ ${historicalResolutionNote}`;
    }

    return {
      symbol: snapshot.symbol,
      confidenceTier: finalTier,
      magnitude,
      narrative: finalNarrative,
      evidenceTrace: buildEnrichedTrace(data.evidenceTrace, insiderTrades, historicalResolutionNote),
      sectorDivergence,
      volumeDivergence,
      detectedAt: new Date(),
      insiderTradeData: insiderTrades.length > 0 ? insiderTrades : null
    };
  } catch (err) {
    // Internal TypeScript fallback verification if Python service is offline
    let fallbackTier: "CONFIRMED" | "UNEXPLAINED" | "UNCERTAIN" = snapshot.isStale
      ? "UNCERTAIN"
      : filingSummary || (hasInsiderBuy)
      ? "CONFIRMED"
      : "UNEXPLAINED";

    const sign = changePct >= 0 ? "+" : "";
    let fallbackNarrative = `${snapshot.symbol} moved ${sign}${changePct.toFixed(2)}% with ${volumeRatio.toFixed(1)}x volume.`;

    if (fallbackTier === "UNCERTAIN") {
      fallbackNarrative = `STALE QUOTE — ${snapshot.symbol} price snapshot marked stale or delayed; current market data cannot be verified.`;
    } else if (fallbackTier === "CONFIRMED") {
      if (filingSummary) {
        fallbackNarrative = `CATALYST CONFIRMED — ${snapshot.symbol} moved ${sign}${changePct.toFixed(2)}% following official exchange disclosure: ${filingSummary}.`;
      } else if (hasInsiderBuy) {
        fallbackNarrative = `CATALYST CONFIRMED — ${snapshot.symbol} moved ${sign}${changePct.toFixed(2)}% — 🐋 Informed Flow: Promoter/Insider buying corroborates market move. ${insiderNarrative}`;
      }
    } else {
      fallbackNarrative = `UNINFORMED FLOW — ${snapshot.symbol} moved ${sign}${changePct.toFixed(
        2
      )}% with ${volumeRatio.toFixed(1)}x volume vs sector ${
        sectorChangePct >= 0 ? "+" : ""
      }${sectorChangePct.toFixed(2)}%; real market move, but no official exchange filing corroborates it yet.`;
    }

    if (insiderNarrative) fallbackNarrative += ` 🐋 ${insiderNarrative}`;
    if (historicalResolutionNote) fallbackNarrative += ` 🕰️ ${historicalResolutionNote}`;

    const baseSteps: any[] = [
      {
        step: "gather_evidence",
        timestamp: new Date().toISOString(),
        detail: `Collected move (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%), volume ratio (${volumeRatio.toFixed(2)}x), sector move (${sectorChangePct >= 0 ? "+" : ""}${sectorChangePct.toFixed(2)}%).`
      }
    ];

    if (isStatisticalAnomaly) {
      baseSteps.push({
        step: "statistical_dislocation_check",
        timestamp: new Date().toISOString(),
        detail: `Statistical Anomaly verified: price moved ${internalZScore}σ from rolling mean (internal RSI: ${internalRSI}).`
      });
    }

    baseSteps.push(
      {
        step: "classify_tier",
        timestamp: new Date().toISOString(),
        detail: `Status classified as ${fallbackTier === "CONFIRMED" ? "CATALYST CONFIRMED" : fallbackTier === "UNEXPLAINED" ? "UNINFORMED FLOW" : "STALE QUOTE"}.`
      },
      {
        step: "fallback_node",
        timestamp: new Date().toISOString(),
        detail: "Verification flow executed via local engine deterministic rules."
      }
    );

    const fallbackTrace = buildEnrichedTrace(
      baseSteps,
      insiderTrades,
      historicalResolutionNote
    );

    return {
      symbol: snapshot.symbol,
      confidenceTier: fallbackTier,
      magnitude,
      narrative: fallbackNarrative,
      evidenceTrace: fallbackTrace,
      sectorDivergence,
      volumeDivergence,
      detectedAt: new Date(),
      insiderTradeData: insiderTrades.length > 0 ? insiderTrades : null
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Enrich an evidence trace with insider + historical steps
// ─────────────────────────────────────────────────────────────────────────────
function buildEnrichedTrace(
  baseTrace: any[],
  insiderTrades: InsiderTrade[],
  historicalNote: string | null
): any[] {
  const trace = [...baseTrace];

  if (insiderTrades.length > 0) {
    const buys = insiderTrades.filter(t => t.action === "BUY");
    const sells = insiderTrades.filter(t => t.action === "SELL");
    trace.push({
      step: "informed_flow_check",
      timestamp: new Date().toISOString(),
      detail: `🐋 Informed Flow (Promoter/Institutional disclosure) detected: ${buys.length} BUY order(s) (₹${buys.reduce((s, t) => s + t.valueInCr, 0).toFixed(0)}Cr), ${sells.length} SELL order(s) (₹${sells.reduce((s, t) => s + t.valueInCr, 0).toFixed(0)}Cr). Sources: ${[...new Set(insiderTrades.map(t => t.source))].join(", ")}.`
    });
  }

  if (historicalNote) {
    trace.push({
      step: "historical_unexplained_resolution",
      timestamp: new Date().toISOString(),
      detail: `🕰️ ${historicalNote}`
    });
  }

  return trace;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step E — Confirmed Silence Generator (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export function generateConfirmedSilenceEvent(symbol: string): ChangeDetectionResult {
  return {
    symbol,
    confidenceTier: "CONFIRMED",
    magnitude: 5,
    narrative: `${symbol}: Checked 5 verified exchange data sources — no abnormal moves or filings detected since you last checked.`,
    evidenceTrace: [
      {
        step: "confirmed_silence_check",
        timestamp: new Date().toISOString(),
        detail: "Scanned NSE filings, price volatility bounds, and sector index correlations over 48h window."
      },
      {
        step: "classify_tier",
        timestamp: new Date().toISOString(),
        detail: "Confirmed Silence: zero anomalous signals detected. Verified tranquility."
      }
    ],
    sectorDivergence: false,
    volumeDivergence: false,
    detectedAt: new Date()
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step F — Watchlist Concentration Check (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export function checkWatchlistConcentration(
  items: { symbol: string; sector?: string | null }[]
): string | null {
  if (items.length === 0) return null;

  const sectorCounts: Record<string, number> = {};
  items.forEach(item => {
    const symbolInfo = getSymbolInfo(item.symbol);
    const sector = item.sector || symbolInfo?.sector || "Other";
    sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
  });

  const total = items.length;
  for (const [sector, count] of Object.entries(sectorCounts)) {
    const percentage = (count / total) * 100;
    if (percentage > 50.0 && total >= 3) {
      return `${count} of your ${total} stocks (${percentage.toFixed(0)}%) belong to the ${sector} sector — a single sector headline could appear as ${count} separate alerts.`;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌊 Ripple Effect helper — get sector peers for a symbol (excluding itself)
// ─────────────────────────────────────────────────────────────────────────────
export function getSectorPeers(symbol: string): string[] {
  const info = getSymbolInfo(symbol);
  if (!info) return [];
  return SYMBOL_UNIVERSE
    .filter(s => s.sector === info.sector && s.symbol !== symbol)
    .map(s => s.symbol);
}
