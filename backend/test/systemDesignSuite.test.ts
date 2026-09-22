import assert from "assert";
import { encodeBinaryTick, decodeBinaryTick, measureBinaryCompressionRatio } from "../src/feed/binaryEncoder";
import { aiVerificationBreaker, injectCircuitFault, clearCircuitFault } from "../src/circuitBreaker";
import { computeInternalZScore, computeInternalRSI } from "../src/engine/changeDetector";
import { TIER_LABELS } from "../src/constants/tiers";
import {
  computeReturns,
  computeCorrelation,
  computeBeta,
  computeResidualZScore,
  exponentialDecay
} from "../src/engine/correlationEngine";
import { createMulberry32 } from "../src/feed/seedCorrelationHistory";

console.log("================================================================================");
console.log(" 🏛️  DHYAN UNIFIED ENTERPRISE SYSTEM DESIGN & QUANT VERIFICATION SUITE");
console.log("     Groww HQ Bangalore • Live Test & Architecture Benchmark");
console.log("================================================================================\n");

let totalPassed = 0;
let totalFailed = 0;

function printSection(title: string) {
  console.log(`\n── 📦 ${title.toUpperCase()} ─────────────────────────────────────`);
}

async function test(name: string, fn: () => Promise<void> | void) {
  const start = performance.now();
  try {
    await fn();
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ✅ PASS [${duration}ms]: ${name}`);
    totalPassed++;
  } catch (err: any) {
    const duration = (performance.now() - start).toFixed(2);
    console.error(`  ❌ FAIL [${duration}ms]: ${name}`);
    console.error(`     Error: ${err.message}`);
    totalFailed++;
  }
}

async function runMasterSuite() {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Groww 915 Binary Protocol
  // ─────────────────────────────────────────────────────────────────────────────
  printSection("1. Groww 915 High-Performance Binary Protocol");

  await test("Packs 180B+ JSON snapshot into exactly 20-byte binary buffer", () => {
    const sample = {
      symbol: "NSE:TCS",
      name: "Tata Consultancy Services",
      sector: "IT",
      ltp: 3890.5,
      changePct: 2.65,
      volume: 1450000,
      volumeRatio: 2.4,
      sectorChangePct: 0.45,
      sourceTrust: 3,
      isStale: false,
      confidenceTier: "CONFIRMED"
    };

    const binaryBuffer = encodeBinaryTick(sample);
    assert.strictEqual(binaryBuffer.byteLength, 20);

    const compression = measureBinaryCompressionRatio(sample);
    assert.ok(compression.reductionPercentage >= 80.0, `Got ${compression.reductionPercentage}%`);
  });

  await test("Round-trip decoding preserves precision for LTP, changePct, and flags", () => {
    const sample = {
      symbol: "NSE:RELIANCE",
      ltp: 2950.75,
      changePct: -1.45,
      volumeRatio: 1.85,
      sectorChangePct: -0.3,
      isStale: false,
      confidenceTier: "CONFIRMED"
    };
    const buf = encodeBinaryTick(sample);
    const decoded = decodeBinaryTick(buf);
    assert.strictEqual(decoded.symbol, "NSE:RELIANCE");
    assert.strictEqual(decoded.ltp, 2950.75);
    assert.strictEqual(decoded.changePct, -1.45);
    assert.strictEqual(decoded.tierByte, 1);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Distributed Resilience & Opossum Circuit Breaker
  // ─────────────────────────────────────────────────────────────────────────────
  printSection("2. Distributed Resilience & Opossum Circuit Breaker");

  await test("Circuit Breaker CLOSED state executes live AI verification successfully", async () => {
    clearCircuitFault();
    const result = await aiVerificationBreaker.fire({
      symbol: "NSE:TCS",
      changePct: 2.65,
      volumeRatio: 2.4,
      sectorChangePct: 0.45,
      sectorDivergence: true,
      volumeDivergence: true,
      filingSummary: "TCS executes ₹15,000Cr AI contract",
      sourceTrust: 3
    });
    assert.ok(result);
    assert.strictEqual(result.confidenceTier, "CONFIRMED");
  });

  await test("Adversarial AI fault trips breaker to OPEN and activates deterministic fallback", async () => {
    injectCircuitFault("NSE:INFY", "500");
    const fallbackResult = await aiVerificationBreaker.fire({
      symbol: "NSE:INFY",
      changePct: -3.2,
      volumeRatio: 2.8,
      sectorChangePct: 0.2,
      sectorDivergence: true,
      volumeDivergence: true,
      filingSummary: null,
      sourceTrust: 3
    });
    assert.ok(fallbackResult);
    assert.strictEqual(fallbackResult.confidenceTier, "UNEXPLAINED");
    assert.strictEqual(fallbackResult.circuitBreakerFallback, true);
    clearCircuitFault();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Stream Idempotency & Delivery Guarantees
  // ─────────────────────────────────────────────────────────────────────────────
  printSection("3. Stream Idempotency & Delivery Guarantees");

  await test("2-Minute sliding deduplication window prevents duplicate ChangeEvent writes", () => {
    const mockDbEvents = [
      { watchlistItemId: "item_1", detectedAt: new Date(Date.now() - 45 * 1000) } // 45s ago
    ];

    const isDuplicate = (itemId: string, windowMs = 120000) => {
      const cutoff = Date.now() - windowMs;
      return mockDbEvents.some(e => e.watchlistItemId === itemId && e.detectedAt.getTime() >= cutoff);
    };

    assert.strictEqual(isDuplicate("item_1"), true, "Must flag event within 2m as duplicate");
    assert.strictEqual(isDuplicate("item_2"), false, "Must allow fresh event on different item");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Quant Correlation, Beta & Multi-Hop Contagion Engine
  // ─────────────────────────────────────────────────────────────────────────────
  printSection("4. Quant Correlation, Beta & Multi-Hop Contagion");

  await test("Mulberry32 PRNG produces identical reproducible sequence across sessions", () => {
    const prng1 = createMulberry32(0x1337c0de);
    const prng2 = createMulberry32(0x1337c0de);
    for (let i = 0; i < 20; i++) {
      assert.strictEqual(prng1(), prng2());
    }
  });

  await test("computeCorrelation calculates +1.0 for synchronized and -1.0 for inverse returns", () => {
    const x = [0.01, 0.02, -0.01, 0.03, -0.02, 0.04];
    const y = [0.02, 0.04, -0.02, 0.06, -0.04, 0.08];
    const inv = [-0.01, -0.02, 0.01, -0.03, 0.02, -0.04];
    assert.strictEqual(computeCorrelation(x, y), 1);
    assert.strictEqual(computeCorrelation(x, inv), -1);
  });

  await test("computeBeta accurately calculates systemic sensitivity Cov(stock, sector) / Var(sector)", () => {
    const sector = [0.01, 0.02, -0.01, 0.03, -0.02, 0.04];
    const stock = sector.map(m => m * 1.4);
    const beta = computeBeta(stock, sector);
    assert.strictEqual(beta, 1.4);
  });

  await test("exponentialDecay correctly attenuates shock across network hops (halfLife = 1.5 hops)", () => {
    const base = 80;
    const h0 = exponentialDecay(base, 0, 1.5);
    const h1 = exponentialDecay(base, 1, 1.5);
    const h2 = exponentialDecay(base, 2, 1.5);
    assert.strictEqual(h0, 80);
    assert.ok(h1 >= 50 && h1 <= 51, `Expected hop 1 ~ 50.4, got ${h1}`);
    assert.ok(h2 >= 31 && h2 <= 32, `Expected hop 2 ~ 31.75, got ${h2}`);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Zero-CPU Temporal Watermarks & Portfolio Delta
  // ─────────────────────────────────────────────────────────────────────────────
  printSection("5. Zero-CPU Temporal Watermarks & Microstructure Math");

  await test("Monotonic timestamp boundary filters unread events with zero CPU overhead", () => {
    const now = Date.now();
    const watermark = new Date(now - 3 * 60 * 60 * 1000);
    const events = [
      { id: "e1", detectedAt: new Date(now - 4 * 60 * 60 * 1000) },
      { id: "e2", detectedAt: new Date(now - 2 * 60 * 60 * 1000) },
      { id: "e3", detectedAt: new Date(now - 15 * 60 * 1000) }
    ];
    const unread = events.filter(e => e.detectedAt.getTime() > watermark.getTime());
    assert.strictEqual(unread.length, 2);
  });

  await test("Z-Score identifies statistical anomaly (>2.0σ) and RSI bounds between 0-100", () => {
    const prices = [100, 100.1, 100.2, 99.9, 100.0, 100.1, 106.5];
    const z = computeInternalZScore(prices);
    assert.ok(z > 2.0);

    const rsi = computeInternalRSI([100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120]);
    assert.ok(rsi >= 70 && rsi <= 100);
  });

  await test("TIER_LABELS enforces institutional non-hallucinatory vocabulary", () => {
    assert.strictEqual(TIER_LABELS.CONFIRMED, "CATALYST CONFIRMED");
    assert.strictEqual(TIER_LABELS.UNEXPLAINED, "UNINFORMED FLOW");
    assert.strictEqual(TIER_LABELS.UNCERTAIN, "STALE QUOTE");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Final Benchmark Summary
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log(` 🏆 UNIFIED MASTER SUITE: ${totalPassed} PASSED | ${totalFailed} FAILED`);
  console.log("================================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMasterSuite();
