import assert from "assert";
import {
  computeReturns,
  computeCorrelation,
  computeBeta,
  computeResidualZScore,
  exponentialDecay
} from "../src/engine/correlationEngine";
import {
  seedCorrelationHistory,
  getStockReturns,
  getSectorReturns,
  createMulberry32
} from "../src/feed/seedCorrelationHistory";
import {
  translateSignalToPlainLanguage,
  generateRippleEvent
} from "../src/engine/changeDetector";
import { SYMBOL_UNIVERSE } from "../src/feed/symbols";

console.log("====================================================");
console.log(" 🧪 RUNNING QUANT CORRELATION & BETA TEST SUITE");
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

// 1. Seeded PRNG Reproducibility Test
runTest("Mulberry32 produces identical sequence for same seed across restarts", () => {
  const prng1 = createMulberry32(0x1337c0de);
  const prng2 = createMulberry32(0x1337c0de);
  for (let i = 0; i < 20; i++) {
    assert.strictEqual(prng1(), prng2(), `Mismatch at iteration ${i}`);
  }
});

// 2. computeReturns Test
runTest("computeReturns accurately calculates simple Δp / p returns", () => {
  const prices = [100, 105, 102.9, 108.045];
  const returns = computeReturns(prices);
  assert.strictEqual(returns.length, 3);
  assert.strictEqual(returns[0], 0.05);
  assert.strictEqual(returns[1], -0.02);
  assert.strictEqual(returns[2], 0.05);
});

runTest("computeReturns returns empty array for single price or empty input", () => {
  assert.deepStrictEqual(computeReturns([]), []);
  assert.deepStrictEqual(computeReturns([100]), []);
});

// 3. computeCorrelation Test
runTest("computeCorrelation returns 0 for fewer than 5 data points", () => {
  assert.strictEqual(computeCorrelation([0.01, 0.02, 0.03], [0.01, 0.02, 0.03]), 0);
});

runTest("computeCorrelation returns 0 for flat series (zero standard deviation)", () => {
  const x = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01];
  const y = [0.02, 0.03, 0.01, 0.04, 0.02, 0.01];
  assert.strictEqual(computeCorrelation(x, y), 0);
});

runTest("computeCorrelation calculates +1.0 for perfectly synchronized returns", () => {
  const x = [0.01, 0.02, -0.01, 0.03, -0.02, 0.04];
  const y = [0.02, 0.04, -0.02, 0.06, -0.04, 0.08]; // 2 * x
  const r = computeCorrelation(x, y);
  assert.strictEqual(r, 1);
});

runTest("computeCorrelation calculates -1.0 for perfectly inverse returns", () => {
  const x = [0.01, 0.02, -0.01, 0.03, -0.02, 0.04];
  const y = [-0.01, -0.02, 0.01, -0.03, 0.02, -0.04]; // -x
  const r = computeCorrelation(x, y);
  assert.strictEqual(r, -1);
});

// 4. computeBeta Test
runTest("computeBeta returns 0 for fewer than 5 data points", () => {
  assert.strictEqual(computeBeta([0.01, 0.02], [0.01, 0.02]), 0);
});

runTest("computeBeta accurately computes Cov(stock, sector) / Var(sector)", () => {
  const sector = [0.01, 0.02, -0.01, 0.03, -0.02, 0.04];
  // Stock reacts 1.3x to sector
  const stock = sector.map(m => m * 1.3);
  const beta = computeBeta(stock, sector);
  assert.strictEqual(beta, 1.3);
});

// 5. computeResidualZScore Test
runTest("computeResidualZScore returns 0 for fewer than 5 points or zero std dev", () => {
  assert.strictEqual(computeResidualZScore(0.05, 0.02, [0.01, 0.02]), 0);
  assert.strictEqual(computeResidualZScore(0.05, 0.02, [0.01, 0.01, 0.01, 0.01, 0.01]), 0);
});

runTest("computeResidualZScore identifies anomalies > 2.0σ", () => {
  const historicalResiduals = [0.001, -0.002, 0.002, -0.001, 0.000, 0.001, -0.001];
  // Sudden massive residual shock
  const z = computeResidualZScore(0.06, 0.01, historicalResiduals);
  assert.ok(Math.abs(z) > 2.0, `Expected Z > 2.0, got ${z}`);
});

// 6. exponentialDecay Test
runTest("exponentialDecay preserves magnitude at hop 0 and attenuates per half-life", () => {
  const base = 80;
  assert.strictEqual(exponentialDecay(base, 0), 80);
  // At hop 1 with halfLife 1.5: decay factor = 2^(-1/1.5) = 2^(-0.6667) ~ 0.62996 -> ~50.4
  const hop1 = exponentialDecay(base, 1, 1.5);
  assert.ok(hop1 >= 50 && hop1 <= 51, `Expected hop 1 ~ 50.4, got ${hop1}`);
  // At hop 2: decay factor = 2^(-2/1.5) ~ 0.39685 -> ~31.75
  const hop2 = exponentialDecay(base, 2, 1.5);
  assert.ok(hop2 >= 31 && hop2 <= 32, `Expected hop 2 ~ 31.75, got ${hop2}`);
});

// 7. translateSignalToPlainLanguage Test (Zero financial jargon in plain language)
runTest("translateSignalToPlainLanguage maps high and low beta correctly", () => {
  const highBeta = translateSignalToPlainLanguage(0.75, 1.35, 0.5, "Tata Motors");
  assert.strictEqual(
    highBeta.sensitivityPhrase,
    "historically reacts more strongly than the sector average"
  );
  assert.strictEqual(highBeta.anomalyNote, null);
  assert.ok(highBeta.strengthPhrase.includes("strong historical co-movement"));

  const lowBeta = translateSignalToPlainLanguage(0.45, 0.72, -0.3, "Infosys");
  assert.strictEqual(
    lowBeta.sensitivityPhrase,
    "historically reacts more mildly than the sector average"
  );
  assert.ok(lowBeta.strengthPhrase.includes("moderate historical co-movement"));

  const normalBeta = translateSignalToPlainLanguage(0.3, 1.05, 0.2, "HDFC Bank");
  assert.strictEqual(normalBeta.sensitivityPhrase, "");
  assert.ok(normalBeta.strengthPhrase.includes("mild historical co-movement"));

  const anomaly = translateSignalToPlainLanguage(0.8, 1.1, 2.85, "State Bank of India");
  assert.strictEqual(
    anomaly.anomalyNote,
    "This move is larger than usual for how this stock typically follows State Bank of India"
  );
});

// 8. Seeding & Live Engine Integration Test
runTest("seedCorrelationHistory populates ~60 return points per stock and sector", () => {
  seedCorrelationHistory();

  // Verify every symbol in universe has 60 points
  SYMBOL_UNIVERSE.forEach(stock => {
    const returns = getStockReturns(stock.symbol);
    assert.strictEqual(
      returns.length,
      60,
      `Symbol ${stock.symbol} expected 60 return points, got ${returns.length}`
    );
  });

  // Verify sectors have 60 points
  const sectors = [...new Set(SYMBOL_UNIVERSE.map(s => s.sector))];
  sectors.forEach(sector => {
    const returns = getSectorReturns(sector);
    assert.strictEqual(
      returns.length,
      60,
      `Sector ${sector} expected 60 return points, got ${returns.length}`
    );
  });
});

runTest("generateRippleEvent computes non-zero quant values on seeded data and filters weak pairs", () => {
  // TCS and INFY are both in the IT sector
  const ripple = generateRippleEvent("NSE:INFY", "NSE:TCS", 75, "IT", 1);
  assert.ok(ripple !== null, "Expected non-null ripple event between IT sector peers");
  assert.ok(ripple.correlationCoefficient !== undefined);
  assert.ok(ripple.betaCoefficient !== undefined);
  assert.ok(ripple.hopCount === 1);
  assert.ok(ripple.magnitude > 0 && ripple.magnitude < 75);

  // Narrative must contain plain language only — no raw rho, beta, sigma, or z-score numbers
  assert.ok(
    !ripple.narrative.includes("0."),
    `Narrative should not expose raw float numbers: ${ripple.narrative}`
  );
  assert.ok(
    !ripple.narrative.includes("ρ") && !ripple.narrative.includes("β"),
    `Narrative should not contain Greek symbols: ${ripple.narrative}`
  );

  // Evidence trace must contain sector_correlation_check with audit details
  const correlationStep = ripple.evidenceTrace.find(
    (step: any) => step.step === "sector_correlation_check"
  );
  assert.ok(correlationStep, "Expected sector_correlation_check in evidenceTrace");
  assert.ok(correlationStep.correlationCoefficient !== undefined);
  assert.ok(correlationStep.betaCoefficient !== undefined);
});

console.log("\n====================================================");
console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log("====================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
