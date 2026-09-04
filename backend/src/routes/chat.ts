import { Router, Response } from "express";
import axios from "axios";
import { prisma } from "../db";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { priceFeed } from "../feed/priceFeed";
import { checkWatchlistConcentration } from "../engine/changeDetector";

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

router.use(authenticateToken);

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { message, watchlistId } = req.body;
    if (!message || !watchlistId) {
      return res.status(400).json({ error: "Message and watchlistId required" });
    }

    const watchlist = await prisma.watchlist.findFirst({
      where: { id: watchlistId, userId: req.userId },
      include: { items: true }
    });

    if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

    // Retrieve recent ChangeEvents
    const events: any[] = await prisma.$queryRaw`
      SELECT ce.id, ce.symbol, ce."confidenceTier", ce.magnitude, ce.narrative, ce."detectedAt"
      FROM "ChangeEvent" ce
      JOIN "WatchlistItem" wi ON ce."watchlistItemId" = wi.id
      WHERE wi."watchlistId" = ${watchlistId}
      ORDER BY ce."detectedAt" DESC
      LIMIT 10
    `;

    // Retrieve current PriceSnapshots
    const itemsWithSnapshots = watchlist.items.map(item => {
      const snap = priceFeed.getLatestSnapshot(item.symbol);
      return {
        symbol: item.symbol,
        sector: item.sector,
        ltp: snap?.ltp || 0,
        changePct: snap?.changePct || 0,
        isStale: snap?.isStale || false
      };
    });

    const concentration = checkWatchlistConcentration(watchlist.items);

    const payload = {
      watchlistName: watchlist.name,
      itemsCount: watchlist.items.length,
      items: itemsWithSnapshots,
      events: events,
      concentrationWarning: concentration
    };

    // Forward to AI service /chat endpoint
    try {
      const aiResp = await axios.post(`${AI_SERVICE_URL}/chat`, {
        message,
        watchlistPayload: payload
      }, { timeout: 6000 });

      res.json(aiResp.data);
    } catch (aiErr) {
      // Deterministic fallback if AI service fails
      const isPredictive = /predict|target|should i buy|will it go up|future/i.test(message);
      if (isPredictive) {
        return res.json({
          answer: "Dhyan doesn't predict or advise — here's what's actually been confirmed: All current watchlist prices are grounded in verifiable exchange snapshots.",
          isRefusal: true,
          citedEvents: []
        });
      }
      res.json({
        answer: `Ask Dhyan grounded response: Your watchlist has ${watchlist.items.length} stocks. Recent detected events logged: ${events.length > 0 ? events[0].symbol + ' (' + events[0].confidenceTier + ')' : 'No recent events'}.`,
        isRefusal: false,
        citedEvents: []
      });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
