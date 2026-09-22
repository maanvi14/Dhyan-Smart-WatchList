import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const SHOULD_TRY_REDIS = Boolean(process.env.REDIS_URL);

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
  retryStrategy(times) {
    if (times > 2) return null;
    return 500;
  },
  lazyConnect: true
});

export const redisSub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
  retryStrategy(times) {
    if (times > 2) return null;
    return 500;
  },
  lazyConnect: true
});

// Suppress unhandled error events from crashing Node.js
redis.on("error", (err) => {
  if (isRedisConnected) {
    console.warn("[Redis Client Error]:", err.message);
  }
});

redisSub.on("error", (err) => {
  if (isRedisConnected) {
    console.warn("[Redis Sub Error]:", err.message);
  }
});

export let isRedisConnected = false;

// Attempt connection gracefully without crashing on Render / cloud environments
(async () => {
  if (!SHOULD_TRY_REDIS) {
    console.log("[Redis] No REDIS_URL provided — running in high-performance in-memory fallback mode.");
    return;
  }

  try {
    await Promise.race([
      Promise.all([redis.connect(), redisSub.connect()]),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timeout")), 2500))
    ]);
    isRedisConnected = true;
    console.log(`[Redis] Connected successfully to ${REDIS_URL}`);
    
    // Initialize Redis Stream Consumer Group for market ticks
    try {
      await redis.xgroup("CREATE", "market.ticks", "change_detectors", "$", "MKSTREAM");
      console.log("[Redis Streams] Consumer group 'change_detectors' initialized on 'market.ticks'");
    } catch (grpErr: any) {
      if (!grpErr.message?.includes("BUSYGROUP")) {
        console.warn("[Redis Streams] Consumer group init:", grpErr.message);
      }
    }
  } catch (err: any) {
    isRedisConnected = false;
    console.warn(`[Redis] Running in local memory fallback mode (Redis unavailable):`, err.message);
  }
})();

// ─────────────────────────────────────────────────────────────────────────────
// 1. Shared State: Snapshots & Price History in Redis Hashes & Lists
// ─────────────────────────────────────────────────────────────────────────────

const localSnapshotFallback = new Map<string, any>();
const localPriceHistoryFallback = new Map<string, number[]>();

export async function saveSnapshotToRedis(symbol: string, snap: any): Promise<void> {
  localSnapshotFallback.set(symbol, snap);
  if (!isRedisConnected) return;

  try {
    await redis.hset(`snapshot:${symbol}`, {
      symbol: snap.symbol,
      name: snap.name || "",
      sector: snap.sector || "",
      ltp: String(snap.ltp),
      changePct: String(snap.changePct),
      volume: String(snap.volume),
      volumeRatio: String(snap.volumeRatio),
      sectorChangePct: String(snap.sectorChangePct),
      sourceTrust: String(snap.sourceTrust || 3),
      isStale: snap.isStale ? "1" : "0",
      updatedAt: String(snap.updatedAt || Date.now())
    });
  } catch (e: any) {
    console.warn(`[Redis hset error ${symbol}]:`, e.message);
  }
}

export async function getSnapshotFromRedis(symbol: string): Promise<any | null> {
  if (!isRedisConnected) {
    return localSnapshotFallback.get(symbol) || null;
  }

  try {
    const raw = await redis.hgetall(`snapshot:${symbol}`);
    if (!raw || !raw.symbol) {
      return localSnapshotFallback.get(symbol) || null;
    }
    return {
      symbol: raw.symbol,
      name: raw.name,
      sector: raw.sector,
      ltp: parseFloat(raw.ltp || "0"),
      changePct: parseFloat(raw.changePct || "0"),
      volume: parseInt(raw.volume || "0", 10),
      volumeRatio: parseFloat(raw.volumeRatio || "1"),
      sectorChangePct: parseFloat(raw.sectorChangePct || "0"),
      sourceTrust: parseInt(raw.sourceTrust || "3", 10),
      isStale: raw.isStale === "1",
      updatedAt: parseInt(raw.updatedAt || "0", 10)
    };
  } catch (e) {
    return localSnapshotFallback.get(symbol) || null;
  }
}

export async function appendPriceHistoryToRedis(symbol: string, ltp: number): Promise<void> {
  const localHist = localPriceHistoryFallback.get(symbol) || [];
  localHist.push(ltp);
  if (localHist.length > 50) localHist.shift();
  localPriceHistoryFallback.set(symbol, localHist);

  if (!isRedisConnected) return;

  try {
    const key = `history:${symbol}`;
    await redis.rpush(key, String(ltp));
    await redis.ltrim(key, -50, -1); // Keep latest 50 ticks
  } catch (e: any) {
    console.warn(`[Redis rpush error ${symbol}]:`, e.message);
  }
}

export async function getPriceHistoryFromRedis(symbol: string): Promise<number[]> {
  if (!isRedisConnected) {
    return localPriceHistoryFallback.get(symbol) || [];
  }

  try {
    const raw = await redis.lrange(`history:${symbol}`, 0, -1);
    if (!raw || raw.length === 0) {
      return localPriceHistoryFallback.get(symbol) || [];
    }
    return raw.map(v => parseFloat(v));
  } catch (e) {
    return localPriceHistoryFallback.get(symbol) || [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Real Redis Sorted Set (ZSET) Adaptive Triage Queue
// ─────────────────────────────────────────────────────────────────────────────

export async function updateTriageZSet(watchlistId: string, symbol: string, score: number): Promise<void> {
  if (!isRedisConnected) return;
  try {
    await redis.zadd(`triage:${watchlistId}`, score, symbol);
  } catch (e: any) {
    console.warn("[Redis ZADD error]:", e.message);
  }
}

export async function getTopTriageZSet(watchlistId: string, limit: number = 10): Promise<{ symbol: string; score: number }[]> {
  if (!isRedisConnected) return [];
  try {
    const raw = await redis.zrevrange(`triage:${watchlistId}`, 0, limit - 1, "WITHSCORES");
    const results: { symbol: string; score: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      results.push({ symbol: raw[i], score: parseFloat(raw[i + 1]) });
    }
    return results;
  } catch (e: any) {
    console.warn("[Redis ZREVRANGE error]:", e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Real Async Event Backbone: Redis Streams (market.ticks + market.ticks.dlq)
// ─────────────────────────────────────────────────────────────────────────────

export async function publishTickToStream(symbol: string, tickPayload: Record<string, any>): Promise<string | null> {
  if (!isRedisConnected) return null;
  try {
    const streamKey = "market.ticks";
    const entries: string[] = ["symbol", symbol, "timestamp", String(Date.now())];
    for (const [k, v] of Object.entries(tickPayload)) {
      if (k !== "symbol" && k !== "timestamp") {
        entries.push(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
    }
    const messageId = await redis.xadd(streamKey, "*", ...entries);
    return messageId;
  } catch (e: any) {
    console.warn("[Redis XADD error]:", e.message);
    return null;
  }
}

export async function readTicksFromStreamGroup(
  consumerName: string,
  count: number = 5,
  blockMs: number = 1000
): Promise<Array<{ id: string; fields: Record<string, string> }>> {
  if (!isRedisConnected) return [];
  try {
    // Read new pending messages for this consumer group
    const res: any = await redis.xreadgroup(
      "GROUP", "change_detectors", consumerName,
      "COUNT", count,
      "BLOCK", blockMs,
      "STREAMS", "market.ticks", ">"
    );

    if (!res || res.length === 0) return [];
    const streamEntries = res[0][1];
    return streamEntries.map(([id, rawFields]: [string, string[]]) => {
      const fields: Record<string, string> = {};
      for (let i = 0; i < rawFields.length; i += 2) {
        fields[rawFields[i]] = rawFields[i + 1];
      }
      return { id, fields };
    });
  } catch (e: any) {
    return [];
  }
}

export async function ackTickInStream(id: string): Promise<void> {
  if (!isRedisConnected) return;
  try {
    await redis.xack("market.ticks", "change_detectors", id);
  } catch (e: any) {
    console.warn("[Redis XACK error]:", e.message);
  }
}

export async function pushToDLQ(
  originalId: string,
  symbol: string,
  errorReason: string,
  payload: Record<string, any>,
  retryCount: number
): Promise<string | null> {
  console.error(`[DLQ Routing] Message ${originalId} for ${symbol} failed ${retryCount} retries. Routing to 'market.ticks.dlq' — Error: ${errorReason}`);
  if (!isRedisConnected) return null;
  try {
    const dlqId = await redis.xadd(
      "market.ticks.dlq", "*",
      "originalId", originalId,
      "symbol", symbol,
      "errorReason", errorReason,
      "retryCount", String(retryCount),
      "failedAt", new Date().toISOString(),
      "payload", JSON.stringify(payload)
    );
    return dlqId;
  } catch (e: any) {
    console.warn("[Redis DLQ XADD error]:", e.message);
    return null;
  }
}

export async function getDLQEntries(count: number = 10): Promise<Array<{ id: string; fields: Record<string, string> }>> {
  if (!isRedisConnected) return [];
  try {
    const raw = await redis.xrevrange("market.ticks.dlq", "+", "-", "COUNT", count);
    return raw.map(([id, rawFields]: [string, string[]]) => {
      const fields: Record<string, string> = {};
      for (let i = 0; i < rawFields.length; i += 2) {
        fields[rawFields[i]] = rawFields[i + 1];
      }
      return { id, fields };
    });
  } catch (e) {
    return [];
  }
}
