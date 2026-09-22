// @ts-ignore
import CircuitBreaker from "opossum";
import axios from "axios";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export interface VerificationPayload {
  symbol: string;
  changePct: number;
  volumeRatio: number;
  sectorChangePct: number;
  sectorDivergence: boolean;
  volumeDivergence: boolean;
  filingSummary?: string | null;
  isStale?: boolean;
  sourceTrust?: number;
  lowDataMode?: boolean;
}

export interface VerificationResult {
  confidenceTier: string;
  narrative: string;
  evidenceTrace: any[];
  circuitBreakerFallback?: boolean;
}

// Fault injection state for live testing
let simulatedFaultSymbol: string | null = null;
let simulatedFaultMode: "timeout" | "500" | null = null;

export function injectCircuitFault(symbol: string, mode: "timeout" | "500") {
  simulatedFaultSymbol = symbol;
  simulatedFaultMode = mode;
  console.log(`[Circuit Breaker Fault Injection Active] Symbol: ${symbol}, Mode: ${mode}`);
}

export function clearCircuitFault() {
  simulatedFaultSymbol = null;
  simulatedFaultMode = null;
  console.log("[Circuit Breaker Fault Injection Cleared]");
}

// ─────────────────────────────────────────────────────────────────────────────
// Primary Action: Call Python FastAPI Service
// ─────────────────────────────────────────────────────────────────────────────
async function rawCallAiService(payload: VerificationPayload): Promise<VerificationResult> {
  // Check if adversarial fault injection is active for this symbol
  if (simulatedFaultSymbol && payload.symbol === simulatedFaultSymbol) {
    if (simulatedFaultMode === "timeout") {
      // Hang longer than the 2500ms circuit timeout
      await new Promise(r => setTimeout(r, 4000));
    } else {
      throw new Error(`Simulated HTTP 500 Internal Error for ${payload.symbol}`);
    }
  }

  const response = await axios.post(`${AI_SERVICE_URL}/verify`, payload, {
    timeout: 2500 // 2.5s budget
  });

  return response.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback Action: Deterministic Safe Narrative (Zero Financial Hallucination)
// ─────────────────────────────────────────────────────────────────────────────
function deterministicFallback(payload: VerificationPayload): VerificationResult {
  const isUp = payload.changePct >= 0;
  const sign = isUp ? "+" : "";
  let tier = "UNEXPLAINED";
  let narrative = "";

  if (payload.isStale || (payload.sourceTrust !== undefined && payload.sourceTrust < 1)) {
    tier = "UNCERTAIN";
    narrative = `STALE QUOTE — ${payload.symbol} price snapshot marked stale or conflicting; market data feed cannot be verified.`;
  } else if (payload.filingSummary && payload.filingSummary.trim().length > 0) {
    tier = "CONFIRMED";
    narrative = `CATALYST CONFIRMED — ${payload.symbol} moved ${sign}${payload.changePct.toFixed(2)}% following official exchange disclosure: ${payload.filingSummary}.`;
  } else {
    tier = "UNEXPLAINED";
    narrative = `UNINFORMED FLOW — ${payload.symbol} moved ${sign}${payload.changePct.toFixed(2)}% with ${payload.volumeRatio.toFixed(1)}x volume vs sector ${payload.sectorChangePct >= 0 ? "+" : ""}${payload.sectorChangePct.toFixed(2)}%; no official exchange filing corroborates this yet.`;
  }

  return {
    confidenceTier: tier,
    narrative,
    evidenceTrace: [
      {
        step: "circuit_breaker_degradation",
        timestamp: new Date().toISOString(),
        detail: `AI Microservice unavailable or circuit OPEN. Executed deterministic compliance fallback rule engine.`
      }
    ],
    circuitBreakerFallback: true
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Opossum Circuit Breaker Instance
// ─────────────────────────────────────────────────────────────────────────────
const options: CircuitBreaker.Options = {
  timeout: 3000,                // If action takes longer than 3s, trigger failure
  errorThresholdPercentage: 50, // When 50% of requests fail, open breaker
  resetTimeout: 10000,          // After 10s, enter HALF-OPEN to probe service
  volumeThreshold: 3            // Minimum 3 requests before tripping
};

export const aiVerificationBreaker = new CircuitBreaker(rawCallAiService, options);

aiVerificationBreaker.fallback(deterministicFallback);

aiVerificationBreaker.on("open", () => {
  console.warn("⚠️ [Circuit Breaker: OPEN] AI Microservice failing. Fast-failing directly to deterministic fallback.");
});

aiVerificationBreaker.on("halfOpen", () => {
  console.log("🔄 [Circuit Breaker: HALF-OPEN] Probing AI Microservice recovery with trial traffic...");
});

aiVerificationBreaker.on("close", () => {
  console.log("✅ [Circuit Breaker: CLOSED] AI Microservice healthy and serving live requests.");
});

export function getCircuitBreakerStatus() {
  const stats = aiVerificationBreaker.stats;
  return {
    state: aiVerificationBreaker.opened ? "OPEN" : aiVerificationBreaker.halfOpen ? "HALF-OPEN" : "CLOSED",
    enabled: aiVerificationBreaker.enabled,
    failures: stats.failures,
    fallbacks: stats.fallbacks,
    successes: stats.successes,
    rejects: stats.rejects,
    timeouts: stats.timeouts,
    latencyMean: Math.round(stats.latencyMean || 0),
    faultInjection: {
      activeSymbol: simulatedFaultSymbol,
      mode: simulatedFaultMode
    }
  };
}
