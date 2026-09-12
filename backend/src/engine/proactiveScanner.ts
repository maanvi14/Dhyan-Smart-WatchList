import { prisma } from "../db";
import { getFilingsForSymbol } from "../feed/filingsStore";
import { Server as SocketIOServer } from "socket.io";

export class ProactiveFilingScanner {
  private intervalTimer: NodeJS.Timeout | null = null;
  private io: SocketIOServer | null = null;

  constructor() {}

  public init(io: SocketIOServer) {
    this.io = io;
  }

  public start(intervalMs = 60000) {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    console.log(`[ProactiveScanner] Started proactive regulatory filing sweep every ${intervalMs / 1000}s`);

    this.intervalTimer = setInterval(() => {
      this.scan().catch(err => {
        console.error("[ProactiveScanner Error]", err.message);
      });
    }, intervalMs);

    // Run initial scan after 5s
    setTimeout(() => {
      this.scan().catch(err => console.error("[ProactiveScanner Initial Error]", err.message));
    }, 5000);
  }

  public stop() {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
  }

  public async scan() {
    try {
      const items = await prisma.watchlistItem.findMany({
        select: {
          id: true,
          watchlistId: true,
          symbol: true
        }
      });

      if (items.length === 0) return;

      const symbolMap = new Map<string, typeof items>();
      for (const item of items) {
        const list = symbolMap.get(item.symbol) || [];
        list.push(item);
        symbolMap.set(item.symbol, list);
      }

      for (const [symbol, watchItems] of symbolMap.entries()) {
        const filings = getFilingsForSymbol(symbol, 2); // last 2 hours
        if (filings.length === 0) continue;

        const latestFiling = filings[0];

        for (const item of watchItems) {
          // Check if a confirmed event was already recorded for this item in the last 2 hours
          const existing = await prisma.changeEvent.findFirst({
            where: {
              watchlistItemId: item.id,
              confidenceTier: "CONFIRMED",
              detectedAt: {
                gte: new Date(Date.now() - 2 * 60 * 60 * 1000)
              }
            }
          });

          if (!existing) {
            const cleanTitle = latestFiling.title.replace(/^(NSE\s+Filing|BSE\s+Filing|Filing)\s*:\s*/i, "").trim();
            const narrative = `CATALYST CONFIRMED — ${symbol} published official exchange disclosure: ${cleanTitle}. Market has not yet reacted — flagged proactively.`;

            const trace = [
              {
                step: "proactive_regulatory_sweep",
                timestamp: new Date().toISOString(),
                detail: `Proactive sweep detected official disclosure (${latestFiling.category}): "${cleanTitle}". Pre-market / pre-reaction detection.`
              },
              {
                step: "classify_tier",
                timestamp: new Date().toISOString(),
                detail: "Status classified as CATALYST CONFIRMED based on verified exchange announcement."
              }
            ];

            const created = await prisma.changeEvent.create({
              data: {
                watchlistItemId: item.id,
                symbol: item.symbol,
                confidenceTier: "CONFIRMED",
                magnitude: 65,
                narrative,
                evidenceTrace: JSON.stringify(trace),
                sectorDivergence: false,
                volumeDivergence: false,
                detectedAt: new Date()
              }
            });

            console.log(`[ProactiveScanner] 🟢 Captured proactive catalyst for ${item.symbol}: ${cleanTitle}`);

            if (this.io) {
              this.io.emit("new_change_event", {
                watchlistId: item.watchlistId,
                event: created
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.error("[ProactiveScanner Sweep Error]", err.message);
    }
  }
}

export const proactiveFilingScanner = new ProactiveFilingScanner();
