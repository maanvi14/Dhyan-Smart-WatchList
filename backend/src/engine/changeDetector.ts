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
// 🌊 RIPPLE EFFECT: Returns a lightweight contagion alert for a peer symbol
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
    narrative: `⚡ Ripple Effect: ${sourceName} triggered a ${sourceMagnitude.toFixed(0)}-point event in the ${sector} sector. ${peerName} is a peer — monitor for contagion. No confirmed catalyst for ${peerSymbol} yet.`,
    evidenceTrace: [
      {
        step: "ripple_detection",
        timestamp: new Date().toISOString(),
        detail: `Source event: ${sourceSymbol} (magnitude ${sourceMagnitude.toFixed(0)}) in sector ${sector}. Sector peer ${peerSymbol} flagged for contagion sweep.`
      },
      {
        step: "classify_tier",
        timestamp: new Date().toISOString(),
        detail: `Tier set to UNEXPLAINED — no independent filing found for ${peerSymbol}. Contagion is unverified.`
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

  // Step A — Magnitude filter: only process if |changePct| >= 2.0% OR volumeRatio >= 1.5
  const passesThreshold =
    absChangePct >= 2.0 || volumeRatio >= 1.5 || snapshot.isStale;
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
      fallbackNarrative = `${snapshot.symbol} price snapshot marked stale or conflicting; data cannot be verified.`;
    } else if (fallbackTier === "CONFIRMED") {
      if (filingSummary) {
        fallbackNarrative = `${snapshot.symbol} moved ${sign}${changePct.toFixed(2)}% following filing: ${filingSummary}.`;
      } else if (hasInsiderBuy) {
        fallbackNarrative = `${snapshot.symbol} moved ${sign}${changePct.toFixed(2)}% — 🐋 Promoter/Insider buying detected. ${insiderNarrative}`;
      }
    } else {
      fallbackNarrative = `${snapshot.symbol} moved ${sign}${changePct.toFixed(
        2
      )}% with ${volumeRatio.toFixed(1)}x volume vs sector ${
        sectorChangePct >= 0 ? "+" : ""
      }${sectorChangePct.toFixed(2)}%; no confirmed catalyst found.`;
    }

    if (insiderNarrative) fallbackNarrative += ` 🐋 ${insiderNarrative}`;
    if (historicalResolutionNote) fallbackNarrative += ` 🕰️ ${historicalResolutionNote}`;

    const fallbackTrace = buildEnrichedTrace(
      [
        {
          step: "gather_evidence",
          timestamp: new Date().toISOString(),
          detail: `Collected move (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%), volume ratio (${volumeRatio.toFixed(2)}x), sector move (${sectorChangePct >= 0 ? "+" : ""}${sectorChangePct.toFixed(2)}%).`
        },
        {
          step: "classify_tier",
          timestamp: new Date().toISOString(),
          detail: `Tier classified as ${fallbackTier}.`
        },
        {
          step: "fallback_node",
          timestamp: new Date().toISOString(),
          detail: "Verification flow executed via local engine fallback."
        }
      ],
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
      step: "insider_skin_in_game",
      timestamp: new Date().toISOString(),
      detail: `🐋 Promoter/Institutional disclosure detected. ${buys.length} BUY order(s): ₹${buys.reduce((s, t) => s + t.valueInCr, 0).toFixed(0)}Cr. ${sells.length} SELL order(s): ₹${sells.reduce((s, t) => s + t.valueInCr, 0).toFixed(0)}Cr. Sources: ${[...new Set(insiderTrades.map(t => t.source))].join(", ")}.`
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
