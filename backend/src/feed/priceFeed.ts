import axios from "axios";
import { SYMBOL_UNIVERSE, SymbolInfo } from "./symbols";
import { addFiling } from "./filingsStore";

export interface SnapshotData {
  symbol: string;
  timestamp: Date;
  ltp: number;
  changePct: number;
  volume: number;
  avgVolume20d: number;
  sourceTrust: number; // 3 = live, 1 = simulated
  sourceType: "live" | "simulated";
  isStale: boolean;
}

type TickCallback = (snapshot: SnapshotData) => void;

class PriceFeedManager {
  private isKilled: boolean = false;
  private currentSource: "live" | "simulated" = "live";
  private latestSnapshots: Map<string, SnapshotData> = new Map();
  private symbolPrices: Map<string, number> = new Map();
  private tickListeners: TickCallback[] = [];
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor() {
    SYMBOL_UNIVERSE.forEach(s => {
      this.symbolPrices.set(s.symbol, s.basePrice);
      const initialSnap: SnapshotData = {
        symbol: s.symbol,
        timestamp: new Date(),
        ltp: s.basePrice,
        changePct: 0.0,
        volume: Math.floor(s.avgVolume20d * 0.8),
        avgVolume20d: s.avgVolume20d,
        sourceTrust: 3,
        sourceType: "live",
        isStale: false
      };
      this.latestSnapshots.set(s.symbol, initialSnap);
    });
  }

  public onTick(callback: TickCallback) {
    this.tickListeners.push(callback);
  }

  public getFeedStatus() {
    if (this.isKilled) {
      return {
        status: "killed",
        mode: "stale",
        staleCount: SYMBOL_UNIVERSE.length,
        message: "Feed manually killed via debug switch"
      };
    }

    // Check count of stale symbols across universe
    const allSnaps = this.getAllSnapshots();
    const staleCount = allSnaps.filter(s => s.isStale).length;

    if (staleCount > 0) {
      return {
        status: "active",
        mode: "stale_partial",
        staleCount,
        message: `Feed: Live (${staleCount} symbols stale)`
      };
    }

    return {
      status: "active",
      mode: this.currentSource,
      staleCount: 0,
      message: `Feed operating normally (${this.currentSource})`
    };
  }

  public killFeed() {
    this.isKilled = true;
    for (const [sym, snap] of this.latestSnapshots.entries()) {
      this.latestSnapshots.set(sym, {
        ...snap,
        isStale: true
      });
    }
    console.log("[PriceFeed] FEED KILLED manually.");
  }

  public reviveFeed() {
    this.isKilled = false;
    const now = new Date();
    for (const [sym, snap] of this.latestSnapshots.entries()) {
      this.latestSnapshots.set(sym, {
        ...snap,
        timestamp: now,
        isStale: false
      });
    }
    console.log("[PriceFeed] FEED REVIVED.");
  }

  public getLatestSnapshot(symbol: string): SnapshotData | undefined {
    const snap = this.latestSnapshots.get(symbol);
    if (!snap) return undefined;

    // Widened dynamic staleness threshold to 60s (to prevent false staleness during live poll latency)
    const isOld = Date.now() - new Date(snap.timestamp).getTime() > 60000;
    return {
      ...snap,
      isStale: snap.isStale || isOld || this.isKilled
    };
  }

  public getAllSnapshots(): SnapshotData[] {
    return SYMBOL_UNIVERSE.map(s => this.getLatestSnapshot(s.symbol)!).filter(Boolean);
  }

  public getSectorChangePct(sector: string): number {
    const sectorSymbols = SYMBOL_UNIVERSE.filter(s => s.sector === sector);
    if (sectorSymbols.length === 0) return 0;

    let totalChange = 0;
    sectorSymbols.forEach(s => {
      const snap = this.getLatestSnapshot(s.symbol);
      if (snap) totalChange += snap.changePct;
    });

    return Number((totalChange / sectorSymbols.length).toFixed(2));
  }

  public startPolling(intervalMs: number = 15000) {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    console.log(`[PriceFeed] Started feed polling every ${intervalMs}ms`);

    this.pollingInterval = setInterval(() => {
      if (this.isKilled) return;
      this.tick();
    }, intervalMs);

    this.tick();
  }

  private async tick() {
    if (this.isKilled) return;

    if (this.currentSource === "live") {
      try {
        await this.fetchLiveTicks();
      } catch (err) {
        console.warn("[PriceFeed] Live feed fetch failed/rate-limited, falling back to simulated feed.", (err as Error).message);
        this.currentSource = "simulated";
        this.generateSimulatedTicks();
      }
    } else {
      this.generateSimulatedTicks();
    }
  }

  private async fetchLiveTicks() {
    const chunk = [...SYMBOL_UNIVERSE].sort(() => 0.5 - Math.random()).slice(0, 5);
    const now = new Date();

    for (const info of chunk) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${info.ticker}?interval=1m&range=1d`;
        const resp = await axios.get(url, {
          timeout: 4000,
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        const result = resp.data?.chart?.result?.[0];
        if (result && result.meta) {
          const meta = result.meta;
          const ltp = meta.regularMarketPrice || info.basePrice;
          const prevClose = meta.chartPreviousClose || meta.previousClose || info.basePrice;
          const changePct = Number((((ltp - prevClose) / prevClose) * 100).toFixed(2));
          const volume = meta.regularMarketVolume || Math.floor(info.avgVolume20d * 0.9);

          const snap: SnapshotData = {
            symbol: info.symbol,
            timestamp: now,
            ltp: Number(ltp.toFixed(2)),
            changePct,
            volume,
            avgVolume20d: info.avgVolume20d,
            sourceTrust: 3,
            sourceType: "live",
            isStale: false
          };

          this.latestSnapshots.set(info.symbol, snap);
          this.notifyTick(snap);
          continue;
        }
      } catch (e) {
        this.generateSimulatedTickForSymbol(info);
      }
    }
  }

  private generateSimulatedTicks() {
    SYMBOL_UNIVERSE.forEach(info => {
      this.generateSimulatedTickForSymbol(info);
    });
  }

  private generateSimulatedTickForSymbol(info: SymbolInfo) {
    const currentLtp = this.symbolPrices.get(info.symbol) || info.basePrice;
    const now = new Date();

    const isAnomaly = Math.random() < 0.08;
    let changeDelta = (Math.random() - 0.49) * 0.6;
    let volumeMultiplier = 0.8 + Math.random() * 0.4;

    if (isAnomaly) {
      const direction = Math.random() > 0.4 ? 1 : -1;
      changeDelta = direction * (2.2 + Math.random() * 2.3);
      volumeMultiplier = 1.6 + Math.random() * 1.8;

      if (Math.random() < 0.5) {
        const title = direction > 0 
          ? `${info.name} secures major export contract`
          : `${info.name} reports temporary plant shutdown`;
        addFiling({
          id: `sim-filing-${Date.now()}-${info.symbol.replace(":", "")}`,
          symbol: info.symbol,
          title,
          category: "Corporate Announcement",
          timestamp: new Date(now.getTime() - 5 * 60 * 1000),
          summary: `Company filed exchange disclosure regarding operational update.`
        });
      }
    }

    const newLtp = Number(Math.max(10, currentLtp * (1 + changeDelta / 100)).toFixed(2));
    this.symbolPrices.set(info.symbol, newLtp);

    const changePct = Number((((newLtp - info.basePrice) / info.basePrice) * 100).toFixed(2));
    const volume = Math.floor(info.avgVolume20d * volumeMultiplier);

    const snap: SnapshotData = {
      symbol: info.symbol,
      timestamp: now,
      ltp: newLtp,
      changePct,
      volume,
      avgVolume20d: info.avgVolume20d,
      sourceTrust: this.currentSource === "live" ? 2 : 1,
      sourceType: this.currentSource,
      isStale: this.isKilled
    };

    this.latestSnapshots.set(info.symbol, snap);
    this.notifyTick(snap);
  }

  private notifyTick(snap: SnapshotData) {
    this.tickListeners.forEach(cb => cb(snap));
  }
}

export const priceFeed = new PriceFeedManager();
