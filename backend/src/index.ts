import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { Server as SocketIOServer } from "socket.io";
import authRoutes from "./routes/auth";
import watchlistRoutes from "./routes/watchlists";
import debugRoutes from "./routes/debug";
import chatRoutes from "./routes/chat";
import verifyTipRoutes from "./routes/verifyTip";
import { priceFeed, SnapshotData } from "./feed/priceFeed";
import { processSnapshotForChange, generateRippleEvent, getSectorPeers } from "./engine/changeDetector";
import { proactiveFilingScanner } from "./engine/proactiveScanner";
import { seedCorrelationHistory } from "./feed/seedCorrelationHistory";
import { prisma } from "./db";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/watchlists", watchlistRoutes);
app.use("/api/debug", debugRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/verify-tip", verifyTipRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "dhyan-backend-monolith" });
});

// Socket.io Visibility-based Live Ticks
const clientSubscriptions = new Map<string, Set<string>>(); // socketId -> Set of symbols

io.on("connection", (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  clientSubscriptions.set(socket.id, new Set());

  // Client subscribes to visible symbols on their current screen
  socket.on("subscribe_symbols", (symbols: string[]) => {
    const subSet = new Set(symbols);
    clientSubscriptions.set(socket.id, subSet);
    console.log(`[Socket.io] Client ${socket.id} subscribed to symbols:`, symbols);
  });

  socket.on("disconnect", () => {
    clientSubscriptions.delete(socket.id);
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Listen for price ticks & broadcast to interested clients + process change detection
priceFeed.onTick(async (snapshot: SnapshotData) => {
  // Broadcast snapshot to connected clients that are watching this symbol
  io.sockets.sockets.forEach((socket, id) => {
    const subs = clientSubscriptions.get(id);
    if (subs && subs.has(snapshot.symbol)) {
      socket.emit("price_tick", snapshot);
    }
  });

  // Background Change Detection Sweep
  try {
    const watchItems = await prisma.watchlistItem.findMany({
      where: { symbol: snapshot.symbol },
      include: { watchlist: { include: { user: true } } }
    });

    if (watchItems.length > 0) {
      for (const item of watchItems) {
        const lowDataMode = item.watchlist.user.lowDataMode;
        const changeResult = await processSnapshotForChange(snapshot, lowDataMode);

        if (changeResult) {
          // Avoid duplicate change events within 2 minutes for the same item
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

            console.log(`[Engine] Created ChangeEvent (${created.confidenceTier}) for ${snapshot.symbol} on WatchlistItem ${item.id}`);

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

              // Hop 1: Direct sector peers
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
                  1 // Hop 1
                );

                if (!rippleResult) continue; // Dropped if |rho| < 0.2

                for (const peerItem of peerItems) {
                  // Avoid ripple events for the same pair within 1 hour
                  const recentRipple = await prisma.changeEvent.findFirst({
                    where: {
                      watchlistItemId: peerItem.id,
                      isRippleEffect: true,
                      rippleSourceSymbol: snapshot.symbol,
                      detectedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
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

                    console.log(`[Ripple Hop 1] Created contagion alert for ${peerItem.symbol} (source: ${snapshot.symbol}, mag: ${rippleResult.magnitude})`);

                    io.emit("new_change_event", {
                      watchlistId: peerItem.watchlistId,
                      event: rippleEvent,
                      isRipple: true
                    });
                  }
                }

                // Hop 2: If Hop 1 decayed magnitude is still >= 50, propagate to second-order peers
                if (rippleResult.magnitude >= 50) {
                  const hop2Peers = getSectorPeers(peerSymbol);
                  for (const subPeerSymbol of hop2Peers) {
                    if (visitedSymbols.has(subPeerSymbol)) continue;
                    visitedSymbols.add(subPeerSymbol);

                    const subPeerItems = await prisma.watchlistItem.findMany({
                      where: { symbol: subPeerSymbol },
                      include: { watchlist: true }
                    });
                    if (subPeerItems.length === 0) continue;

                    const subRippleResult = generateRippleEvent(
                      subPeerSymbol,
                      peerSymbol,
                      rippleResult.magnitude,
                      sector,
                      2 // Hop 2
                    );

                    if (!subRippleResult) continue;

                    for (const subItem of subPeerItems) {
                      const recentSubRipple = await prisma.changeEvent.findFirst({
                        where: {
                          watchlistItemId: subItem.id,
                          isRippleEffect: true,
                          rippleSourceSymbol: peerSymbol,
                          detectedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
                        }
                      });

                      if (!recentSubRipple) {
                        const subRippleEvent = await prisma.changeEvent.create({
                          data: {
                            watchlistItemId: subItem.id,
                            symbol: subItem.symbol,
                            confidenceTier: subRippleResult.confidenceTier,
                            magnitude: subRippleResult.magnitude,
                            narrative: subRippleResult.narrative,
                            evidenceTrace: JSON.stringify(subRippleResult.evidenceTrace),
                            sectorDivergence: false,
                            volumeDivergence: false,
                            detectedAt: subRippleResult.detectedAt,
                            isRippleEffect: true,
                            rippleSourceSymbol: peerSymbol,
                            correlationCoefficient: subRippleResult.correlationCoefficient,
                            betaCoefficient: subRippleResult.betaCoefficient,
                            residualZScore: subRippleResult.residualZScore,
                            hopCount: subRippleResult.hopCount
                          }
                        });

                        console.log(`[Ripple Hop 2] Created second-order contagion alert for ${subItem.symbol} (source: ${peerSymbol}, mag: ${subRippleResult.magnitude})`);

                        io.emit("new_change_event", {
                          watchlistId: subItem.watchlistId,
                          event: subRippleEvent,
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
      }
    }
  } catch (err) {
    console.error("[Engine Error] Failed to process snapshot for change detection:", (err as Error).message);
  }
});

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
