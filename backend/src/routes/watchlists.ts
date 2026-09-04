import { Router, Response } from "express";
import { prisma } from "../db";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { priceFeed } from "../feed/priceFeed";
import { getSymbolInfo, SYMBOL_UNIVERSE } from "../feed/symbols";
import { getFilingsForSymbol } from "../feed/filingsStore";
import { checkWatchlistConcentration, generateConfirmedSilenceEvent } from "../engine/changeDetector";

const router = Router();
router.use(authenticateToken);

// GET all watchlists for authenticated user
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const watchlists = await prisma.watchlist.findMany({
      where: { userId: req.userId },
      include: {
        items: true
      }
    });
    res.json(watchlists);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST create watchlist
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Watchlist name required" });

    const watchlist = await prisma.watchlist.create({
      data: {
        userId: req.userId!,
        name
      }
    });
    res.json(watchlist);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST add item to watchlist
router.post("/:id/items", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { symbol, notes } = req.body;

    if (!symbol) return res.status(400).json({ error: "Symbol required" });

    // Validate symbol exists in universe
    const info = getSymbolInfo(symbol);
    if (!info) return res.status(400).json({ error: `Symbol ${symbol} not found in NSE universe` });

    const watchlist = await prisma.watchlist.findFirst({
      where: { id, userId: req.userId }
    });
    if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

    const existingItem = await prisma.watchlistItem.findFirst({
      where: { watchlistId: id, symbol: info.symbol }
    });
    if (existingItem) {
      return res.status(400).json({ error: "Symbol already in watchlist" });
    }

    const item = await prisma.watchlistItem.create({
      data: {
        watchlistId: id,
        symbol: info.symbol,
        sector: info.sector,
        notes: notes || null
      }
    });

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE remove item from watchlist
router.delete("/:id/items/:itemId", async (req: AuthRequest, res: Response) => {
  try {
    const { id, itemId } = req.params;
    await prisma.watchlistItem.deleteMany({
      where: { id: itemId, watchlistId: id }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET live prices for watchlist items
router.get("/:id/live", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const watchlist = await prisma.watchlist.findFirst({
      where: { id, userId: req.userId },
      include: { items: true }
    });

    if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

    const itemsWithPrices = await Promise.all(
      watchlist.items.map(async item => {
        const snap = priceFeed.getLatestSnapshot(item.symbol);
        const info = getSymbolInfo(item.symbol);

        // Fetch latest change event for this item if any
        const latestEvent = await prisma.changeEvent.findFirst({
          where: { watchlistItemId: item.id },
          orderBy: { detectedAt: "desc" }
        });

        // Generate a 12-point synthetic intraday price path anchored around ltp and changePct
        const ltp = snap?.ltp || info?.basePrice || 100;
        const changePct = snap?.changePct || 0;
        const basePrice = ltp / (1 + changePct / 100);
        
        // 12 points spanning from morning open to current ltp
        const sparklinePoints: number[] = [];
        for (let i = 0; i < 12; i++) {
          const progress = i / 11;
          const noise = (Math.sin(i * 1.5 + (item.symbol.length)) * 0.4) * (ltp * 0.005);
          const interpolated = basePrice + (ltp - basePrice) * progress + noise;
          sparklinePoints.push(Number(interpolated.toFixed(2)));
        }

        return {
          id: item.id,
          symbol: item.symbol,
          name: info?.name || item.symbol,
          sector: item.sector || info?.sector || "Other",
          notes: item.notes,
          addedAt: item.addedAt,
          lastViewedAt: item.lastViewedAt,
          ltp,
          changePct,
          volume: snap?.volume || 0,
          avgVolume20d: snap?.avgVolume20d || info?.avgVolume20d || 1000000,
          sourceTrust: snap?.sourceTrust || 1,
          sourceType: snap?.sourceType || "simulated",
          isStale: snap?.isStale ?? true,
          sparkline: sparklinePoints,
          latestEvent: latestEvent ? {
            id: latestEvent.id,
            confidenceTier: latestEvent.confidenceTier,
            magnitude: latestEvent.magnitude,
            detectedAt: latestEvent.detectedAt,
            sectorDivergence: latestEvent.sectorDivergence
          } : null
        };
      })
    );

    res.json({
      id: watchlist.id,
      name: watchlist.name,
      items: itemsWithPrices,
      feedStatus: priceFeed.getFeedStatus()
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST mark a single item as seen
router.post("/:id/items/:itemId/mark-seen", async (req: AuthRequest, res: Response) => {
  try {
    const { id, itemId } = req.params;
    const now = new Date();

    await prisma.watchlistItem.update({
      where: { id: itemId, watchlistId: id },
      data: { lastViewedAt: now }
    });

    res.json({ success: true, itemId, watermark: now });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET since-last-checked watermark comparison diff feed
router.get("/:id/since-last-checked", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const watchlist = await prisma.watchlist.findFirst({
      where: { id, userId: req.userId },
      include: { items: true }
    });

    if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

    // Raw query for items detected after watermark (COALESCE(lastViewedAt, addedAt))
    const rawEvents: any[] = await prisma.$queryRaw`
      SELECT 
        ce.id, 
        ce."watchlistItemId", 
        ce.symbol, 
        ce."confidenceTier", 
        ce.magnitude, 
        ce.narrative, 
        ce."evidenceTrace", 
        ce."sectorDivergence", 
        ce."volumeDivergence", 
        ce."detectedAt",
        wi.notes,
        wi."lastViewedAt"
      FROM "ChangeEvent" ce
      JOIN "WatchlistItem" wi ON ce."watchlistItemId" = wi.id
      WHERE wi."watchlistId" = ${id}
      AND ce."detectedAt" > COALESCE(wi."lastViewedAt", wi."addedAt")
      ORDER BY ce.magnitude DESC, ce."detectedAt" DESC
    `;

    // If zero events found, check if any item hasn't been checked in >48h for "Confirmed Silence" path
    if (rawEvents.length === 0 && watchlist.items.length > 0) {
      const now = Date.now();
      const longUnchecked = watchlist.items.find(item => {
        const watermark = item.lastViewedAt ? new Date(item.lastViewedAt).getTime() : new Date(item.addedAt).getTime();
        return now - watermark > 48 * 60 * 60 * 1000;
      });

      if (longUnchecked) {
        const silenceEvent = generateConfirmedSilenceEvent(longUnchecked.symbol);
        return res.json({
          watchlistId: id,
          hasSilenceEvent: true,
          events: [
            {
              id: `silence-${Date.now()}`,
              watchlistItemId: longUnchecked.id,
              symbol: silenceEvent.symbol,
              confidenceTier: silenceEvent.confidenceTier,
              magnitude: silenceEvent.magnitude,
              narrative: silenceEvent.narrative,
              evidenceTrace: silenceEvent.evidenceTrace,
              sectorDivergence: silenceEvent.sectorDivergence,
              volumeDivergence: silenceEvent.volumeDivergence,
              detectedAt: silenceEvent.detectedAt,
              notes: longUnchecked.notes
            }
          ]
        });
      }
    }

    // Enhance events with Filing details, Sector spread, and Pattern Memory
    const enrichedEvents = await Promise.all(
      rawEvents.map(async e => {
        const info = getSymbolInfo(e.symbol);
        const sector = info?.sector || "General";
        const sectorChangePct = priceFeed.getSectorChangePct(sector);
        const snap = priceFeed.getLatestSnapshot(e.symbol);
        const stockChangePct = snap?.changePct || 0;
        const spread = Number((stockChangePct - sectorChangePct).toFixed(2));

        // Pattern memory: check count of past events for this symbol in DB
        const pastEvents = await prisma.changeEvent.findMany({
          where: { symbol: e.symbol },
          orderBy: { detectedAt: "desc" },
          take: 4
        });
        const historicalCount = pastEvents.length;

        // Filing source check (look up to 48 hours for associated filing)
        const filings = getFilingsForSymbol(e.symbol, 48);
        const filingData = filings.length > 0 ? {
          title: filings[0].title,
          category: filings[0].category,
          timestamp: filings[0].timestamp,
          summary: filings[0].summary
        } : null;

        return {
          ...e,
          name: info?.name || e.symbol,
          sector,
          stockChangePct,
          sectorChangePct,
          sectorSpread: spread,
          historicalCount,
          patternNote: historicalCount > 1 
            ? `Historical Pattern: ${historicalCount} significant moves logged for ${e.symbol} across past sessions.`
            : null,
          filingData,
          evidenceTrace: typeof e.evidenceTrace === "string" ? JSON.parse(e.evidenceTrace) : e.evidenceTrace
        };
      })
    );

    // Compute Watchlist Executive Briefing (conversational, audio-ready)
    const confirmedEvents = enrichedEvents.filter(e => e.confidenceTier === "CONFIRMED");
    const unexplainedEvents = enrichedEvents.filter(e => e.confidenceTier === "UNEXPLAINED");
    const uncertainEvents = enrichedEvents.filter(e => e.confidenceTier === "UNCERTAIN");
    const confirmedCount = confirmedEvents.length;
    const unexplainedCount = unexplainedEvents.length;
    const uncertainCount = uncertainEvents.length;
    const totalEvents = enrichedEvents.length;

    // Helper: get clean display name (e.g. "Tata Motors" instead of "NSE:TATAMOTORS")
    const displayName = (e: any) => e.name || e.symbol.replace(/^NSE:/, "");

    // Build English briefing (deduplicated — each stock mentioned once)
    let storyEn = "";
    if (totalEvents === 0) {
      storyEn = "Good news — your watchlist has been quiet since you last checked. No unusual movements or new filings detected. All stocks are holding steady.";
    } else {
      storyEn = `Welcome back. ${totalEvents} event${totalEvents === 1 ? ' was' : 's were'} detected across your watchlist. Here is what matters. `;

      // Deduplicate: pick unique symbols sorted by abs change, max 4
      const seen = new Set<string>();
      const uniqueMovers = enrichedEvents
        .sort((a, b) => Math.abs(b.stockChangePct || 0) - Math.abs(a.stockChangePct || 0))
        .filter(e => { if (seen.has(e.symbol)) return false; seen.add(e.symbol); return true; })
        .slice(0, 4);

      uniqueMovers.forEach(e => {
        const name = displayName(e);
        const dir = (e.stockChangePct || 0) >= 0 ? "up" : "down";
        const pct = Math.abs(e.stockChangePct || 0).toFixed(1);
        storyEn += `${name} moved ${dir} ${pct} percent`;
        if (e.confidenceTier === "CONFIRMED") {
          storyEn += `, backed by a verified filing`;
        } else if (e.confidenceTier === "UNEXPLAINED") {
          storyEn += `, with no confirmed catalyst`;
        }
        storyEn += ". ";
      });

      // Summary line
      if (confirmedCount > 0 && unexplainedCount === 0) {
        storyEn += `Overall, a clean session — all ${confirmedCount} detected move${confirmedCount === 1 ? ' is' : 's are'} backed by verified exchange filings.`;
      } else if (unexplainedCount > 0 && confirmedCount > 0) {
        storyEn += `${confirmedCount} move${confirmedCount === 1 ? ' is' : 's are'} verified, but ${unexplainedCount} remain unexplained. Those deserve a closer look.`;
      } else if (unexplainedCount > 0) {
        storyEn += `Caution: ${unexplainedCount} move${unexplainedCount === 1 ? '' : 's'} occurred with no verified catalyst. Proceed carefully.`;
      } else {
        storyEn += "That is your quick catch-up. Tap any stock for the full evidence trail.";
      }
    }

    // Build Hindi briefing (same dedup logic)
    let storyHi = "";
    if (totalEvents === 0) {
      storyHi = "अच्छी खबर — आपकी वॉचलिस्ट शांत रही है। कोई असामान्य हलचल या नई फाइलिंग नहीं मिली।";
    } else {
      storyHi = `वापस स्वागत है। आपकी वॉचलिस्ट में ${totalEvents} घटना${totalEvents === 1 ? '' : 'एँ'} दर्ज हुई${totalEvents === 1 ? '' : 'ं'}। `;

      const seenHi = new Set<string>();
      const uniqueMoversHi = enrichedEvents
        .sort((a, b) => Math.abs(b.stockChangePct || 0) - Math.abs(a.stockChangePct || 0))
        .filter(e => { if (seenHi.has(e.symbol)) return false; seenHi.add(e.symbol); return true; })
        .slice(0, 4);

      uniqueMoversHi.forEach(e => {
        const name = displayName(e);
        const dir = (e.stockChangePct || 0) >= 0 ? "ऊपर" : "नीचे";
        const pct = Math.abs(e.stockChangePct || 0).toFixed(1);
        storyHi += `${name} ${dir} ${pct} प्रतिशत गया`;
        if (e.confidenceTier === "CONFIRMED") {
          storyHi += `, सत्यापित फाइलिंग द्वारा प्रमाणित`;
        } else if (e.confidenceTier === "UNEXPLAINED") {
          storyHi += `, कोई पुष्ट कारण नहीं`;
        }
        storyHi += "। ";
      });

      if (confirmedCount > 0 && unexplainedCount === 0) {
        storyHi += `पारदर्शी सत्र — सभी ${confirmedCount} बदलाव सत्यापित फाइलिंग द्वारा प्रमाणित हैं।`;
      } else if (unexplainedCount > 0 && confirmedCount > 0) {
        storyHi += `${confirmedCount} बदलाव सत्यापित, लेकिन ${unexplainedCount} अकारण हैं। इन पर ध्यान दें।`;
      } else if (unexplainedCount > 0) {
        storyHi += `सावधान: ${unexplainedCount} बदलाव बिना पुष्ट कारण के हुए। सतर्कता बरतें।`;
      } else {
        storyHi += "यह था आपका त्वरित अपडेट। पूरी जानकारी के लिए किसी भी स्टॉक पर टैप करें।";
      }
    }

    res.json({
      watchlistId: id,
      hasSilenceEvent: false,
      story: { en: storyEn, hi: storyHi },
      events: enrichedEvents
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET unread count badge
router.get("/:id/unread-count", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const countResult: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM "ChangeEvent" ce
      JOIN "WatchlistItem" wi ON ce."watchlistItemId" = wi.id
      WHERE wi."watchlistId" = ${id}
      AND ce."detectedAt" > COALESCE(wi."lastViewedAt", wi."addedAt")
    `;

    const count = countResult[0]?.count ? Number(countResult[0].count) : 0;
    res.json({ watchlistId: id, unreadCount: count });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST mark all as seen (Watermark update)
router.post("/:id/mark-seen", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const now = new Date();

    await prisma.watchlistItem.updateMany({
      where: { watchlistId: id },
      data: { lastViewedAt: now }
    });

    res.json({ success: true, watermark: now });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET watchlist sector concentration warning
router.get("/:id/concentration", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const watchlist = await prisma.watchlist.findFirst({
      where: { id, userId: req.userId },
      include: { items: true }
    });

    if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

    const warning = checkWatchlistConcentration(watchlist.items);

    // Compute sector breakdown distribution for Risk Radar
    const sectorCounts: Record<string, number> = {};
    const totalItems = watchlist.items.length;
    for (const item of watchlist.items) {
      const sec = item.sector || "General";
      sectorCounts[sec] = (sectorCounts[sec] || 0) + 1;
    }
    const breakdown = Object.entries(sectorCounts).map(([sector, count]) => ({
      sector,
      count,
      pct: totalItems > 0 ? Math.round((count / totalItems) * 100) : 0
    })).sort((a, b) => b.pct - a.pct);

    res.json({ 
      watchlistId: id, 
      concentrationWarning: warning,
      breakdown,
      totalCount: totalItems
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET available symbol universe search
router.get("/universe/symbols", (req, res) => {
  res.json(SYMBOL_UNIVERSE);
});

export default router;
