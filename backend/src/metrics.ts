import client from "prom-client";

// Create Prometheus registry
export const register = new client.Registry();

// Enable standard default OS & process metrics
client.collectDefaultMetrics({ register });

// ─────────────────────────────────────────────────────────────────────────────
// Custom Dhyan SLO & Performance Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const tickIngestDuration = new client.Histogram({
  name: "dhyan_tick_ingest_duration_seconds",
  help: "Duration of market tick ingest and Redis stream dispatch in seconds",
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25], // 1ms up to 250ms
  registers: [register]
});

export const aiVerificationDuration = new client.Histogram({
  name: "dhyan_ai_verification_duration_seconds",
  help: "Duration of AI verification microservice calls in seconds",
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
  registers: [register]
});

export const dlqMessagesTotal = new client.Counter({
  name: "dhyan_dlq_messages_total",
  help: "Total count of poison-pill messages routed to market.ticks.dlq",
  labelNames: ["symbol", "reason"],
  registers: [register]
});

export const circuitBreakerStateGauge = new client.Gauge({
  name: "dhyan_circuit_breaker_state",
  help: "Circuit breaker status: 0 = CLOSED (healthy), 1 = HALF-OPEN, 2 = OPEN (tripped/degraded)",
  registers: [register]
});

export const activeSocketConnections = new client.Gauge({
  name: "dhyan_active_socket_connections",
  help: "Number of active real-time WebSocket clients connected",
  registers: [register]
});
