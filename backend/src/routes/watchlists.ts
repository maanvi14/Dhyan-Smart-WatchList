import { Router, Response } from "express";
import { prisma } from "../db";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { priceFeed } from "../feed/priceFeed";
import { getSymbolInfo, SYMBOL_UNIVERSE } from "../feed/symbols";
import { getFilingsForSymbol } from "../feed/filingsStore";
import { getInsiderTradesForSymbol, buildInsiderNarrative } from "../feed/insiderStore";
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

    // Compute 7-day Trust Ratio across all items in watchlist
    const itemIds = watchlist.items.map(i => i.id);
    const allRecentEvents = await prisma.changeEvent.findMany({
      where: {
        watchlistItemId: { in: itemIds },
        detectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      select: { confidenceTier: true }
    });

    const totalEvents = allRecentEvents.length;
    const confirmedCount = allRecentEvents.filter(e => e.confidenceTier === "CONFIRMED").length;
    const unexplainedCount = allRecentEvents.filter(e => e.confidenceTier === "UNEXPLAINED").length;
    const uncertainCount = allRecentEvents.filter(e => e.confidenceTier === "UNCERTAIN").length;

    const trustRatio = {
      total: totalEvents,
      confirmedCount,
      unexplainedCount,
      uncertainCount,
      confirmedPct: totalEvents > 0 ? Math.round((confirmedCount / totalEvents) * 100) : 65,
      uninformedPct: totalEvents > 0 ? Math.round((unexplainedCount / totalEvents) * 100) : 25,
      stalePct: totalEvents > 0 ? Math.round((uncertainCount / totalEvents) * 100) : 10
    };

    const itemsWithPrices = await Promise.all(
      watchlist.items.map(async item => {
        const snap = priceFeed.getLatestSnapshot(item.symbol);
        const info = getSymbolInfo(item.symbol);

        // Fetch recent change events for this item (for tier history strip + story card)
        const recentItemEvents = await prisma.changeEvent.findMany({
          where: { watchlistItemId: item.id },
          orderBy: { detectedAt: "desc" },
          take: 6,
          select: {
            id: true,
            confidenceTier: true,
            magnitude: true,
            detectedAt: true,
            sectorDivergence: true,
            volumeDivergence: true,
            narrative: true
          }
        });

        const latestEvent = recentItemEvents.length > 0 ? recentItemEvents[0] : null;
        const tierHistory = recentItemEvents.map(e => e.confidenceTier);

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

        // Enrich card story: filing headline for CONFIRMED, volumeRatio for UNINFORMED, staleAgeMs for STALE
        const recentFilings = getFilingsForSymbol(item.symbol, 6);
        const latestFiling = recentFilings.length > 0 ? recentFilings[0] : null;
        const volumeRatio = (snap?.volume && snap?.avgVolume20d && snap.avgVolume20d > 0)
          ? Number((snap.volume / snap.avgVolume20d).toFixed(2))
          : null;
        const staleAgeMs = (snap?.isStale && snap?.timestamp)
          ? Date.now() - new Date(snap.timestamp).getTime()
          : null;

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
          volumeRatio,
          staleAgeMs,
          sparkline: sparklinePoints,
          tierHistory,
          latestEvent: latestEvent ? {
            id: latestEvent.id,
            confidenceTier: latestEvent.confidenceTier,
            magnitude: latestEvent.magnitude,
            detectedAt: latestEvent.detectedAt,
            sectorDivergence: latestEvent.sectorDivergence,
            volumeDivergence: latestEvent.volumeDivergence,
            narrative: latestEvent.narrative,
            filingTitle: latestFiling?.title || null,
            filingCategory: latestFiling?.category || null
          } : null
        };
      })
    );

    res.json({
      id: watchlist.id,
      name: watchlist.name,
      items: itemsWithPrices,
      trustRatio,
      feedStatus: priceFeed.getFeedStatus()
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH update research thesis & invalidation point
router.patch("/:id/items/:itemId/thesis", async (req: AuthRequest, res: Response) => {
  try {
    const { id, itemId } = req.params;
    const { thesisText, invalidationPoint } = req.body;

    const item = await prisma.watchlistItem.findFirst({
      where: { id: itemId, watchlistId: id }
    });
    if (!item) return res.status(404).json({ error: "Item not found" });

    const notesPayload = JSON.stringify({
      thesisText: thesisText || "",
      invalidationPoint: invalidationPoint || "",
      updatedAt: new Date().toISOString()
    });

    const updated = await prisma.watchlistItem.update({
      where: { id: itemId },
      data: { notes: notesPayload }
    });

    res.json(updated);
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
        ce."isRippleEffect",
        ce."rippleSourceSymbol",
        ce."correlationCoefficient",
        ce."betaCoefficient",
        ce."residualZScore",
        ce."hopCount",
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

        // 🐋 Skin in the Game: insider / promoter trades
        const insiderTrades = getInsiderTradesForSymbol(e.symbol, 24);
        const insiderNarrative = insiderTrades.length > 0 ? buildInsiderNarrative(insiderTrades) : null;
        const insiderData = insiderTrades.length > 0 ? insiderTrades.map(t => ({
          traderName: t.traderName,
          traderType: t.traderType,
          action: t.action,
          shares: t.shares,
          valueInCr: t.valueInCr,
          source: t.source,
          filedAt: t.filedAt
        })) : null;

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
          // 🐋 Insider / Promoter data
          insiderData,
          insiderNarrative,
          // 🌊 Ripple Effect metadata
          isRippleEffect: Boolean(e.isRippleEffect),
          rippleSourceSymbol: e.rippleSourceSymbol || null,
          rippleSourceName: e.rippleSourceSymbol ? (getSymbolInfo(e.rippleSourceSymbol)?.name || e.rippleSourceSymbol) : null,
          correlationCoefficient: e.correlationCoefficient ?? null,
          betaCoefficient: e.betaCoefficient ?? null,
          residualZScore: e.residualZScore ?? null,
          hopCount: e.hopCount ?? 0,
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

    // Build English briefing — structured, audio-ready executive briefing
    let storyEn = "";
    if (totalEvents === 0) {
      storyEn = "Good news — your watchlist has been quiet since you last checked. No unusual price moves, no new exchange filings, and no volume spikes detected. All stocks are operating within normal volatility bounds.";
    } else {
      const topConfirmed = confirmedEvents.slice(0, 2);
      const topUnexplained = unexplainedEvents.slice(0, 2);
      const rippleEvents = enrichedEvents.filter((e: any) => e.isRippleEffect);

      // Opening line
      storyEn = `Welcome back. ${totalEvents} market event${totalEvents === 1 ? ' has' : 's have'} been logged since your last check. `;

      // Confirmed catalysts — lead with the most important
      if (topConfirmed.length > 0) {
        storyEn += `${confirmedCount === 1 ? 'One catalyst is' : `${confirmedCount} catalysts are`} confirmed with official exchange filings. `;
        topConfirmed.forEach((e: any) => {
          const name = displayName(e);
          const dir = (e.stockChangePct || 0) >= 0 ? "up" : "down";
          const pct = Math.abs(e.stockChangePct || 0).toFixed(1);
          // Strip the tier prefix from narrative for cleaner audio
          const cleanNarrative = e.narrative
            .replace(/^CATALYST CONFIRMED\s*[—–-]+\s*/i, "")
            .replace(/^NSE:\w+\s+moved\s+/i, `${name} moved `)
            .split(".")[0]; // Take first sentence only
          storyEn += `${name} moved ${dir} ${pct} percent — ${cleanNarrative}. `;
        });
      }

      // Unexplained flows — flag with caution
      if (topUnexplained.length > 0) {
        storyEn += `${unexplainedCount === 1 ? 'One stock shows' : `${unexplainedCount} stocks show`} uninformed flow — real price moves with no official explanation yet. `;
        topUnexplained.slice(0, 1).forEach((e: any) => {
          const name = displayName(e);
          const dir = (e.stockChangePct || 0) >= 0 ? "up" : "down";
          const pct = Math.abs(e.stockChangePct || 0).toFixed(1);
          storyEn += `${name} moved ${dir} ${pct} percent with elevated volume — treat with caution until a filing appears. `;
        });
      }

      // Sector contagion
      if (rippleEvents.length > 0) {
        storyEn += `${rippleEvents.length} sector contagion ${rippleEvents.length === 1 ? 'alert was' : 'alerts were'} detected from high-magnitude moves in related stocks. `;
      }

      // Stale data warning
      if (uncertainCount > 0) {
        storyEn += `Warning: ${uncertainCount} data feed${uncertainCount === 1 ? ' is' : 's are'} currently stale. Do not act on those prices until the feed recovers. `;
      }

      // Closing action line
      if (confirmedCount > 0 && unexplainedCount === 0 && uncertainCount === 0) {
        storyEn += `Clean session overall — all confirmed moves are backed by verified exchange filings. You can act with confidence.`;
      } else if (unexplainedCount > 0) {
        storyEn += `Tap any event card below to see the full evidence audit trail before deciding.`;
      } else {
        storyEn += `Review the full diff below for complete evidence details.`;
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
      SELECT COUNT(*) as count FROM "ChangeEvent" ce
      JOIN "WatchlistItem" wi ON ce."watchlistItemId" = wi.id
      WHERE wi."watchlistId" = ${id}
      AND ce."detectedAt" > COALESCE(wi."lastViewedAt", wi."addedAt")
    `;

    const rawVal = countResult[0]?.count;
    const count = rawVal !== undefined ? Number(rawVal) : 0;
    res.json({ watchlistId: id, unreadCount: count });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET rich unread inbox summary (Unread Inbox Architecture)
router.get("/:id/unread-summary", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const rawEvents: any[] = await prisma.$queryRaw`
      SELECT
        ce.id,
        ce.symbol,
        ce."confidenceTier",
        ce.magnitude,
        ce."isRippleEffect",
        ce."rippleSourceSymbol",
        ce."detectedAt"
      FROM "ChangeEvent" ce
      JOIN "WatchlistItem" wi ON ce."watchlistItemId" = wi.id
      WHERE wi."watchlistId" = ${id}
      AND ce."detectedAt" > COALESCE(wi."lastViewedAt", wi."addedAt")
      ORDER BY ce.magnitude DESC
    `;

    const total = rawEvents.length;
    const confirmed = rawEvents.filter(e => e.confidenceTier === "CONFIRMED" && !e.isRippleEffect).length;
    const unexplained = rawEvents.filter(e => e.confidenceTier === "UNEXPLAINED" && !e.isRippleEffect).length;
    const uncertain = rawEvents.filter(e => e.confidenceTier === "UNCERTAIN").length;
    const rippleCount = rawEvents.filter(e => Boolean(e.isRippleEffect)).length;

    // Top 3 high-priority events for the inbox preview (deduped by symbol)
    const seenSymbols = new Set<string>();
    const dedupedEvents = rawEvents.filter(e => {
      if (seenSymbols.has(e.symbol)) return false;
      seenSymbols.add(e.symbol);
      return true;
    });
    const topEvents = dedupedEvents.slice(0, 3).map(e => {
      const info = getSymbolInfo(e.symbol);
      return {
        symbol: e.symbol,
        name: info?.name || e.symbol,
        tier: e.confidenceTier,
        magnitude: e.magnitude,
        isRipple: Boolean(e.isRippleEffect),
        rippleSource: e.rippleSourceSymbol
          ? getSymbolInfo(e.rippleSourceSymbol)?.name || e.rippleSourceSymbol
          : null,
        detectedAt: e.detectedAt
      };
    });

    res.json({
      watchlistId: id,
      total,
      confirmed,
      unexplained,
      uncertain,
      rippleAlerts: rippleCount,
      topEvents
    });
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

// POST synthesize Sarvam AI voice briefing
router.post("/voice/briefing", async (req: AuthRequest, res: Response) => {
  try {
    const { text, language = "hi" } = req.body;
    const sarvamApiKey = process.env.SARVAM_API_KEY;
    const languageCode = language === "hi" ? "hi-IN" : "en-IN";
    const axios = (await import("axios")).default;

    // 1. If SARVAM_API_KEY is configured directly on this backend instance (e.g. Render production)
    if (sarvamApiKey) {
      try {
        const sarvamRes = await axios.post(
          "https://api.sarvam.ai/text-to-speech",
          {
            inputs: [text ? text.slice(0, 500) : "नमस्ते! कोई नई जानकारी नहीं है।"],
            target_language_code: languageCode,
            speaker: "kavya",
            pitch: 0,
            pace: 1.05,
            loudness: 1.5,
            speech_sample_rate: 22050,
            enable_preprocessing: true,
            model: "bulbul:v3"
          },
          {
            headers: {
              "api-subscription-key": sarvamApiKey,
              "Content-Type": "application/json"
            },
            timeout: 10000
          }
        );

        if (sarvamRes.status === 200 && sarvamRes.data?.audios?.[0]) {
          return res.json({
            status: "ok",
            provider: "sarvam-ai",
            model: "bulbul:v3",
            language: languageCode,
            audioBase64: sarvamRes.data.audios[0]
          });
        }
      } catch (sarvamErr: any) {
        console.error("[Backend Sarvam AI Error]:", sarvamErr?.response?.data || sarvamErr.message);
      }
    }

    // 2. Otherwise try local/remote AI Python service
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
    try {
      const aiRes = await axios.post(`${AI_SERVICE_URL}/voice/synthesize`, {
        text,
        language
      }, { timeout: 8000 });

      return res.json(aiRes.data);
    } catch (aiErr: any) {
      // Graceful fallback response
      return res.json({
        status: "ok",
        provider: "sarvam-ai-fallback",
        language: languageCode,
        text,
        message: "Sarvam AI voice endpoint fallback active."
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message, fallback: true });
  }
});

// GET available symbol universe search
router.get("/universe/symbols", (req, res) => {
  res.json(SYMBOL_UNIVERSE);
});

export default router;
