import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import authRoutes from "./routes/auth";
import watchlistRoutes from "./routes/watchlists";
import debugRoutes from "./routes/debug";
import chatRoutes from "./routes/chat";
import verifyTipRoutes from "./routes/verifyTip";
import marketWireRoutes from "./routes/marketWire";
import { priceFeed, SnapshotData } from "./feed/priceFeed";
import { processSnapshotForChange, generateRippleEvent, getSectorPeers } from "./engine/changeDetector";
import { proactiveFilingScanner } from "./engine/proactiveScanner";
import { seedCorrelationHistory } from "./feed/seedCorrelationHistory";
import { prisma } from "./db";
import {
  redis,
  redisSub,
  isRedisConnected,
  saveSnapshotToRedis,
  appendPriceHistoryToRedis,
  publishTickToStream,
  readTicksFromStreamGroup,
  ackTickInStream,
  pushToDLQ,
  updateTriageZSet
} from "./redis";
import { encodeBinaryTick } from "./feed/binaryEncoder";
import { register, tickIngestDuration, activeSocketConnections, dlqMessagesTotal } from "./metrics";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Attach Redis Adapter for Multi-Replica Horizontal Scaling if Redis is ready
try {
  if (isRedisConnected) {
    io.adapter(createAdapter(redis, redisSub));
    console.log("[Socket.io] Redis Adapter attached for multi-replica scaling.");
  } else {
    console.log("[Socket.io] Running with local memory adapter.");
  }
} catch (e: any) {
  console.log("[Socket.io] Running with local adapter:", e.message);
}

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/watchlists", watchlistRoutes);
app.use("/api/debug", debugRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/verify-tip", verifyTipRoutes);
app.use("/api/market-wire", marketWireRoutes);

// Prometheus /metrics Endpoint
app.get("/metrics", async (req, res) => {
  res.setHeader("Content-Type", register.contentType);
  res.send(await register.metrics());
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "dhyan-backend-monolith",
    redisConnected: isRedisConnected
  });
});

// Socket.io Room-based Subscriptions (O(1) room lookup, zero O(N*M) socket iteration)
io.on("connection", (socket) => {
  activeSocketConnections.inc();
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Client subscribes to visible symbols on their current screen
  socket.on("subscribe_symbols", (symbols: string[]) => {
    // Leave previous symbol rooms if needed or join new ones
    if (Array.isArray(symbols)) {
      symbols.forEach(sym => {
        socket.join(`symbol:${sym}`);
      });
      console.log(`[Socket.io] Client ${socket.id} joined rooms for symbols:`, symbols);
    }
  });

  socket.on("disconnect", () => {
    activeSocketConnections.dec();
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Listen for price ticks & broadcast to room + save shared state in Redis + publish to Redis Stream
priceFeed.onTick(async (snapshot: SnapshotData) => {
  const timer = tickIngestDuration.startTimer();

  // 1. Groww 915 Pattern: Native Room Broadcast (JSON + Binary Float32Array Frame)
  const roomName = `symbol:${snapshot.symbol}`;
  io.to(roomName).emit("price_tick", snapshot);

  const binaryFrame = encodeBinaryTick(snapshot);
  io.to(roomName).emit("price_tick:binary", binaryFrame);

  // 2. Shared State in Redis (survives backend restart & shared across replicas)
  await saveSnapshotToRedis(snapshot.symbol, snapshot);
  await appendPriceHistoryToRedis(snapshot.symbol, snapshot.ltp);

  // 3. Publish to Redis Stream for Decoupled Asynchronous Processing
  await publishTickToStream(snapshot.symbol, snapshot);

  timer();
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Decoupled Redis Streams Consumer Worker with Idempotent DB Writes & DLQ
// ─────────────────────────────────────────────────────────────────────────────
const retryCounter = new Map<string, number>();

async function startStreamConsumerWorker() {
  console.log("[Stream Worker] Started background Redis Streams change-detection consumer group...");
  while (true) {
    try {
      const entries = await readTicksFromStreamGroup("worker_1", 5, 2000);
      if (!entries || entries.length === 0) {
        // Fallback sleep if no stream messages
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      for (const entry of entries) {
        const { id, fields } = entry;
        const symbol = fields.symbol;
        if (!symbol) {
          await ackTickInStream(id);
          continue;
        }

        try {
          // Reconstruct snapshot
          const snapshot: SnapshotData = {
            symbol,
            timestamp: new Date(parseInt(fields.timestamp || String(Date.now()), 10)),
            ltp: parseFloat(fields.ltp || "0"),
            changePct: parseFloat(fields.changePct || "0"),
            volume: parseInt(fields.volume || "0", 10),
            avgVolume20d: parseInt(fields.avgVolume20d || "1000000", 10),
            sourceTrust: parseInt(fields.sourceTrust || "3", 10),
            sourceType: (fields.sourceType as any) || "live",
            isStale: fields.isStale === "1" || fields.isStale === "true"
          };

          // Find affected watchlists
          const watchItems = await prisma.watchlistItem.findMany({
            where: { symbol: snapshot.symbol },
            include: { watchlist: { include: { user: true } } }
          });

          if (watchItems.length > 0) {
            for (const item of watchItems) {
              const lowDataMode = item.watchlist.user.lowDataMode;
              const changeResult = await processSnapshotForChange(snapshot, lowDataMode);

              if (changeResult) {
                // IDEMPOTENCY CHECK: 2-minute deduplication window per symbol
                const recentEvent = await prisma.changeEvent.findFirst({
                  where: {
                    watchlistItemId: item.id,
                    detectedAt: {
                      gte: new Date(Date.now() - 2 * 60 * 1000)
                    }
                  }
                });

                if (!recentEvent) {
                  const created = await prisma.changeEvent.create({
                    data: {
                      watchlistItemId: item.id,
                      symbol: snapshot.symbol,
                      confidenceTier: changeResult.confidenceTier,
                      magnitude: changeResult.magnitude,
                      narrative: changeResult.narrative,
                      evidenceTrace: JSON.stringify(changeResult.evidenceTrace),
                      sectorDivergence: changeResult.sectorDivergence,
                      volumeDivergence: changeResult.volumeDivergence,
                      detectedAt: changeResult.detectedAt
                    }
                  });

                  // Update Redis ZSET Priority Triage Score in O(log N)
                  const relevanceScore = changeResult.magnitude * (changeResult.confidenceTier === "CONFIRMED" ? 1.5 : 1.0);
                  await updateTriageZSet(item.watchlistId, snapshot.symbol, relevanceScore);

                  console.log(`[Stream Worker] Created ChangeEvent (${created.confidenceTier}) for ${snapshot.symbol} on WatchlistItem ${item.id}`);

                  // Notify connected client of new ChangeEvent
                  io.emit("new_change_event", {
                    watchlistId: item.watchlistId,
                    event: created
                  });

                  // 🌊 RIPPLE EFFECT: If this is a high-magnitude event, sweep sector peers with quant-backed contagion
                  if (changeResult.magnitude >= 50) {
                    const visitedSymbols = new Set<string>([snapshot.symbol]);
                    const symbolInfo = (await import("./feed/symbols")).getSymbolInfo(snapshot.symbol);
                    const sector = symbolInfo?.sector || "General";

                    const hop1Peers = getSectorPeers(snapshot.symbol);
                    for (const peerSymbol of hop1Peers) {
                      if (visitedSymbols.has(peerSymbol)) continue;
                      visitedSymbols.add(peerSymbol);

                      const peerItems = await prisma.watchlistItem.findMany({
                        where: { symbol: peerSymbol },
                        include: { watchlist: true }
                      });
                      if (peerItems.length === 0) continue;

                      const rippleResult = generateRippleEvent(
                        peerSymbol,
                        snapshot.symbol,
                        changeResult.magnitude,
                        sector,
                        1
                      );

                      if (!rippleResult) continue;

                      for (const peerItem of peerItems) {
                        const recentRipple = await prisma.changeEvent.findFirst({
                          where: {
                            watchlistItemId: peerItem.id,
                            isRippleEffect: true,
                            rippleSourceSymbol: snapshot.symbol,
                            detectedAt: { gte: new Date(Date.now() - 30 * 1000) }
                          }
                        });

                        if (!recentRipple) {
                          const rippleEvent = await prisma.changeEvent.create({
                            data: {
                              watchlistItemId: peerItem.id,
                              symbol: peerItem.symbol,
                              confidenceTier: rippleResult.confidenceTier,
                              magnitude: rippleResult.magnitude,
                              narrative: rippleResult.narrative,
                              evidenceTrace: JSON.stringify(rippleResult.evidenceTrace),
                              sectorDivergence: false,
                              volumeDivergence: false,
                              detectedAt: rippleResult.detectedAt,
                              isRippleEffect: true,
                              rippleSourceSymbol: snapshot.symbol,
                              correlationCoefficient: rippleResult.correlationCoefficient,
                              betaCoefficient: rippleResult.betaCoefficient,
                              residualZScore: rippleResult.residualZScore,
                              hopCount: rippleResult.hopCount
                            }
                          });

                          io.emit("new_change_event", {
                            watchlistId: peerItem.watchlistId,
                            event: rippleEvent,
                            isRipple: true
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          // Acknowledge message in Redis Stream
          await ackTickInStream(id);
          retryCounter.delete(id);

        } catch (procErr: any) {
          console.error(`[Stream Worker Error on message ${id}]:`, procErr.message);
          const currentRetries = (retryCounter.get(id) || 0) + 1;
          retryCounter.set(id, currentRetries);

          if (currentRetries >= 3) {
            // Poison-pill threshold reached: route to Dead-Letter Queue
            await pushToDLQ(id, symbol, procErr.message, fields, currentRetries);
            dlqMessagesTotal.inc({ symbol, reason: procErr.message?.slice(0, 30) || "worker_failure" });
            await ackTickInStream(id); // Ack to unblock stream
            retryCounter.delete(id);
          }
        }
      }
    } catch (loopErr: any) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// Start Stream Worker in background
startStreamConsumerWorker().catch(e => console.error("[Stream Worker Fatal]:", e));

// Seed synthetic correlation and beta history before starting polling
seedCorrelationHistory();

// Start price polling
priceFeed.startPolling(15000);

// Start proactive regulatory filing scanner
proactiveFilingScanner.init(io);
proactiveFilingScanner.start(30000);

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Dhyan Backend Monolith running on port ${PORT}`);
  console.log(`=================================================`);
});
