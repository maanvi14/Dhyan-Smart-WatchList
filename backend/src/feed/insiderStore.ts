/**
 * insiderStore.ts — Promoter & Institutional "Skin in the Game" Mock Store
 *
 * In production this would scrape:
 *  - BSE Bulk Deal / Block Deal data (publicly available daily CSV)
 *  - NSE Insider Trading disclosures (SEBI SAST Regulation 29)
 *  - Promoter shareholding change forms
 *
 * For this hackathon the store is seeded with realistic data for the demo
 * 7 flagship stocks. Pattern: promoter buying alongside an unexplained move
 * is one of the strongest "Skin in the Game" evidence signals in Indian markets.
 */

export interface InsiderTrade {
  id: string;
  symbol: string;
  traderName: string;
  traderType: "PROMOTER" | "FII" | "DII" | "INSIDER";
  action: "BUY" | "SELL";
  shares: number;
  valueInCr: number;   // ₹ crore
  filedAt: Date;
  source: "BSE_BULK_DEAL" | "NSE_BLOCK_DEAL" | "SAST";
}

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60 * 1000);

// Simulated insider / promoter trades for the flagship demo symbols
const mockInsiderTrades: InsiderTrade[] = [
  // TCS — Promoter group buying quietly while stock dips
  {
    id: "it-001",
    symbol: "NSE:TCS",
    traderName: "Tata Sons Pvt Ltd (Promoter)",
    traderType: "PROMOTER",
    action: "BUY",
    shares: 1_200_000,
    valueInCr: 510.0,
    filedAt: hoursAgo(2),
    source: "BSE_BULK_DEAL"
  },
  // HDFC Bank — Large FII accumulation
  {
    id: "it-002",
    symbol: "NSE:HDFCBANK",
    traderName: "Blackrock Inc. (FII)",
    traderType: "FII",
    action: "BUY",
    shares: 3_500_000,
    valueInCr: 577.5,
    filedAt: hoursAgo(1),
    source: "NSE_BLOCK_DEAL"
  },
  // Reliance — Promoter trimming position (bearish signal context)
  {
    id: "it-003",
    symbol: "NSE:RELIANCE",
    traderName: "Reliance Industries Promoter Group",
    traderType: "PROMOTER",
    action: "SELL",
    shares: 500_000,
    valueInCr: 151.0,
    filedAt: hoursAgo(3),
    source: "SAST"
  },
  // Tata Motors — DII buying strongly (LIC, mutual funds)
  {
    id: "it-004",
    symbol: "NSE:TATAMOTORS",
    traderName: "Life Insurance Corp. of India (DII)",
    traderType: "DII",
    action: "BUY",
    shares: 2_000_000,
    valueInCr: 216.0,
    filedAt: hoursAgo(0.5),
    source: "BSE_BULK_DEAL"
  },
  // Sun Pharma — Insider (MD) accumulating ahead of FDA update
  {
    id: "it-005",
    symbol: "NSE:SUNPHARMA",
    traderName: "Dilip Shanghvi (MD & Promoter)",
    traderType: "INSIDER",
    action: "BUY",
    shares: 250_000,
    valueInCr: 43.0,
    filedAt: hoursAgo(4),
    source: "SAST"
  },
  // ICICI Bank — FII selling (risk-off signal)
  {
    id: "it-006",
    symbol: "NSE:ICICIBANK",
    traderName: "Government of Singapore (FII)",
    traderType: "FII",
    action: "SELL",
    shares: 1_800_000,
    valueInCr: 219.6,
    filedAt: hoursAgo(1.5),
    source: "NSE_BLOCK_DEAL"
  },
  // Infosys — Promoter confidence buy
  {
    id: "it-007",
    symbol: "NSE:INFY",
    traderName: "NR Narayana Murthy (Promoter)",
    traderType: "PROMOTER",
    action: "BUY",
    shares: 600_000,
    valueInCr: 111.0,
    filedAt: hoursAgo(5),
    source: "SAST"
  }
];

/**
 * Returns insider/promoter trades for a given symbol filed within the last N hours.
 * In production: query DB or SEBI API endpoint.
 */
export function getInsiderTradesForSymbol(symbol: string, withinHours: number = 24): InsiderTrade[] {
  const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  return mockInsiderTrades.filter(t => t.symbol === symbol && t.filedAt >= cutoff);
}

/**
 * Returns all trades for all symbols in a given sector within the last N hours.
 * Used for sector-level "smart money" overview.
 */
export function getInsiderTradesForSector(
  symbols: string[],
  withinHours: number = 24
): InsiderTrade[] {
  const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  return mockInsiderTrades.filter(t => symbols.includes(t.symbol) && t.filedAt >= cutoff);
}

/**
 * Summarise a list of trades into a human-readable "Skin in the Game" narrative.
 */
export function buildInsiderNarrative(trades: InsiderTrade[]): string {
  if (trades.length === 0) return "";
  const buys = trades.filter(t => t.action === "BUY");
  const sells = trades.filter(t => t.action === "SELL");
  const totalBuyValue = buys.reduce((s, t) => s + t.valueInCr, 0);
  const totalSellValue = sells.reduce((s, t) => s + t.valueInCr, 0);
  const parts: string[] = [];
  if (buys.length > 0) {
    parts.push(`${buys[0].traderName} bought ₹${totalBuyValue.toFixed(0)}Cr worth of shares (${buys[0].source})`);
  }
  if (sells.length > 0) {
    parts.push(`${sells[0].traderName} sold ₹${totalSellValue.toFixed(0)}Cr worth of shares (${sells[0].source})`);
  }
  return parts.join("; ") + " — Verified insider disclosure.";
}
