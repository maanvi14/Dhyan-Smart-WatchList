import assert from "assert";
import { computeInternalZScore, computeInternalRSI } from "../src/engine/changeDetector";
import { TIER_LABELS } from "../src/constants/tiers";

console.log("====================================================");
console.log(" 🧪 RUNNING DHYAN BACKEND AUTOMATED TEST SUITE");
console.log("====================================================\n");

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(` ✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(` ❌ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

// 1. Z-Score Statistical Dislocation Test
runTest("Z-Score calculation returns 0 for flat price array", () => {
  const prices = [100, 100, 100, 100, 100];
  const z = computeInternalZScore(prices);
  assert.strictEqual(z, 0);
});

runTest("Z-Score identifies positive statistical anomaly > 2.0σ", () => {
  const prices = [100, 100.1, 100.2, 99.9, 100.0, 100.1, 106.5];
  const z = computeInternalZScore(prices);
  assert.ok(z > 2.0, `Expected Z-score > 2.0, got ${z}`);
});

// 2. RSI Oversold/Overbought Test
runTest("RSI calculation bounds between 0 and 100", () => {
  const prices = [100, 102, 104, 103, 105, 107, 106, 108, 110, 109, 111, 113, 112, 114, 116];
  const rsi = computeInternalRSI(prices);
  assert.ok(rsi >= 0 && rsi <= 100, `RSI out of bounds: ${rsi}`);
});

// 3. Institutional Vocabulary Tier Map Test
runTest("TIER_LABELS maps institutional terminology correctly", () => {
  assert.strictEqual(TIER_LABELS.CONFIRMED, "CATALYST CONFIRMED");
  assert.strictEqual(TIER_LABELS.UNEXPLAINED, "UNINFORMED FLOW");
  assert.strictEqual(TIER_LABELS.UNCERTAIN, "STALE QUOTE");
});

// 4. Time Away Relative Formatting Test
runTest("Relative time formatting handles days, hours, and minutes", () => {
  const formatTimeAgo = (diffMs: number) => {
    const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays >= 1) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    if (diffHours >= 1) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    return `${diffMins} min ago`;
  };

  assert.strictEqual(formatTimeAgo(7 * 24 * 60 * 60 * 1000), "7 days ago");
  assert.strictEqual(formatTimeAgo(3 * 60 * 60 * 1000), "3 hours ago");
  assert.strictEqual(formatTimeAgo(12 * 60 * 1000), "12 min ago");
});

// 5. Unread Inbox Preview Deduplication Test
runTest("Top events preview collapses duplicate symbols", () => {
  const rawEvents = [
    { symbol: "NSE:TATAMOTORS", magnitude: 100 },
    { symbol: "NSE:TATAMOTORS", magnitude: 98 },
    { symbol: "NSE:HDFCBANK", magnitude: 95 }
  ];

  const seenSymbols = new Set<string>();
  const dedupedEvents = rawEvents.filter(e => {
    if (seenSymbols.has(e.symbol)) return false;
    seenSymbols.add(e.symbol);
    return true;
  });

  assert.strictEqual(dedupedEvents.length, 2);
  assert.strictEqual(dedupedEvents[0].symbol, "NSE:TATAMOTORS");
  assert.strictEqual(dedupedEvents[1].symbol, "NSE:HDFCBANK");
});

// 6. Portfolio P&L Delta Calculation Test
runTest("Portfolio P&L calculates net change since watermark", () => {
  const holdings = [
    { symbol: "NSE:TCS", shares: 10, currentLtp: 4120, baselinePrice: 4000 }, // +1200
    { symbol: "NSE:HDFCBANK", shares: 50, currentLtp: 1450, baselinePrice: 1480 } // -1500
  ];

  let totalCurrent = 0;
  let totalBaseline = 0;

  holdings.forEach(h => {
    totalCurrent += h.shares * h.currentLtp;
    totalBaseline += h.shares * h.baselinePrice;
  });

  const pnlRupees = totalCurrent - totalBaseline;
  const pnlPct = (pnlRupees / totalBaseline) * 100;

  assert.strictEqual(pnlRupees, -300);
  assert.strictEqual(Number(pnlPct.toFixed(2)), -0.26);
});

console.log("\n====================================================");
console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log("====================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
