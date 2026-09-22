"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { DebugPanel } from "@/components/DebugPanel";
import { AddSymbolModal } from "@/components/AddSymbolModal";
import { AskDhyanChat } from "@/components/AskDhyanChat";
import { SectorRiskRadar } from "@/components/SectorRiskRadar";
import { WatermarkSparkline } from "@/components/WatermarkSparkline";
import { WatchlistTrustRatio } from "@/components/WatchlistTrustRatio";
import { ResearchThesisModal } from "@/components/ResearchThesisModal";
import { StockVisualizerModal } from "@/components/StockVisualizerModal";
import { watchlistApi, debugApi, WatchlistItemPrice, User, UnreadSummary, TrustRatioData } from "@/lib/api";
import { TIER_BADGES, TIER_LABELS } from "@/lib/tiers";
import { getSocket, subscribeToSymbols } from "@/lib/socket";
import { decodeBinaryTickFrame } from "@/lib/binaryDecoder";
import { useI18n } from "@/lib/i18n";
import {
  Plus, Bell, Trash2, TrendingUp, TrendingDown, ShieldAlert, Bot, Clock,
  Filter, CheckCheck, Sparkles, Waves, Building2, Smartphone, BookOpen,
  AlertOctagon, BarChart2, ChevronRight, PieChart, ShieldCheck, Search,
  Radio, Zap, ArrowUpRight, ArrowDownRight, Activity
} from "lucide-react";

export default function WatchlistHomePage() {
  const router = useRouter();
  const { language, t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [watchlistData, setWatchlistData] = useState<any>(null);
  const [items, setItems] = useState<WatchlistItemPrice[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [feedStatus, setFeedStatus] = useState<any>(null);
  const [unreadSummary, setUnreadSummary] = useState<UnreadSummary | null>(null);
  const [trustRatioData, setTrustRatioData] = useState<TrustRatioData | null>(null);
  const [concentrationWarning, setConcentrationWarning] = useState<string | null>(null);
  const [sectorBreakdown, setSectorBreakdown] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showThesisModal, setShowThesisModal] = useState(false);
  const [selectedThesisItem, setSelectedThesisItem] = useState<WatchlistItemPrice | null>(null);
  const [showVisualizerModal, setShowVisualizerModal] = useState(false);
  const [selectedVisualizerItem, setSelectedVisualizerItem] = useState<WatchlistItemPrice | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter & Search Controls
  const [activeFilter, setActiveFilter] = useState<"all" | "attention" | "confirmed" | "unexplained" | "stale">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dynamic Live Tick Flash Animations (symbol -> "up" | "down")
  const [tickFlashes, setTickFlashes] = useState<Record<string, "up" | "down">>({});

  // Real-time Event Toast Notification
  const [liveEventToast, setLiveEventToast] = useState<{ symbol: string; tier: string; narrative: string } | null>(null);

  // Time-away contextual state
  const [timeAwayString, setTimeAwayString] = useState<string>("");
  const [handoffToast, setHandoffToast] = useState<{ previousDevice: string; currentDevice: string } | null>(null);

  const fetchFeedStatus = async () => {
    try {
      const status = await debugApi.getFeedStatus();
      setFeedStatus(status);
    } catch (_) {}
  };

  const loadData = async () => {
    fetchFeedStatus();
    const token = typeof window !== "undefined" ? localStorage.getItem("dhyan_token") : null;
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("dhyan_user") : null;

    if (!token || !storedUser) {
      setLoading(false);
      router.push("/login");
      return;
    }

    try {
      const u: User = JSON.parse(storedUser);
      setUser(u);

      if (!u.watchlistId) {
        setLoading(false);
        router.push("/login");
        return;
      }

      const data = await watchlistApi.getWatchlist(u.watchlistId);
      setWatchlistData(data);
      if (data.trustRatio) {
        setTrustRatioData(data.trustRatio);
      }
      const fetchedItems = data.items || [];
      setItems(fetchedItems);

      const symbols = fetchedItems.map((i: WatchlistItemPrice) => i.symbol);
      subscribeToSymbols(symbols);

      // Compute contextual "Time Away" from items
      if (fetchedItems.length > 0) {
        const watermarks = fetchedItems
          .map((it: any) => it.lastViewedAt ? new Date(it.lastViewedAt).getTime() : new Date(it.addedAt).getTime())
          .filter(Boolean);
        
        const latestWatermark = watermarks.length > 0 ? Math.max(...watermarks) : Date.now() - (14 * 60 * 60 * 1000);
        const diffMs = Math.max(0, Date.now() - latestWatermark);
        const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        const timeStr = new Date(latestWatermark).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        
        let awayText = "";
        if (diffDays >= 1) {
          awayText = language === "hi"
            ? `आप ${diffDays} दिन पहले (~${timeStr}) आए थे — आपकी अनुपस्थिति में ये बदलाव हुए:`
            : `You last checked ${diffDays}d ago (~${timeStr}) — here is what meaningfully changed in your absence:`;
        } else if (diffHours >= 1) {
          awayText = language === "hi"
            ? `आप ${diffHours} घंटे पहले (~${timeStr}) आए थे — आपकी अनुपस्थिति में ये बदलाव हुए:`
            : `You last checked ${diffHours} hours ago (~${timeStr}) — here is what meaningfully changed in your absence:`;
        } else {
          awayText = language === "hi"
            ? `आप ${diffMins} मिनट पहले आए थे — आपकी अनुपस्थिति में ये बदलाव हुए:`
            : `You last checked ${diffMins} minutes ago — here is what meaningfully changed in your absence:`;
        }
        setTimeAwayString(awayText);
      }

      try {
        const [unreadRes, unreadSummaryRes, concRes] = await Promise.all([
          watchlistApi.getUnreadCount(u.watchlistId).catch(() => ({ unreadCount: 0 })),
          watchlistApi.getUnreadSummary(u.watchlistId).catch(() => null),
          watchlistApi.getConcentration(u.watchlistId).catch(() => ({ concentrationWarning: null, breakdown: [] }))
        ]);
        setUnreadCount(unreadRes?.unreadCount || 0);
        if (unreadSummaryRes) setUnreadSummary(unreadSummaryRes);
        setConcentrationWarning(concRes?.concentrationWarning || null);
        if (concRes?.breakdown && concRes.breakdown.length > 0) {
          setSectorBreakdown(concRes.breakdown);
        } else {
          const secCounts: Record<string, number> = {};
          fetchedItems.forEach((it: any) => {
            const sec = it.sector || "General";
            secCounts[sec] = (secCounts[sec] || 0) + 1;
          });
          const localBreakdown = Object.entries(secCounts).map(([sector, count]) => ({
            sector,
            count,
            pct: fetchedItems.length > 0 ? Math.round((count / fetchedItems.length) * 100) : 0
          })).sort((a, b) => b.pct - a.pct);
          setSectorBreakdown(localBreakdown);
        }
      } catch (secErr) {
        console.warn("Secondary data fetch failed", secErr);
      }
    } catch (err: any) {
      console.error("Failed to load watchlist", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("dhyan_token");
        localStorage.removeItem("dhyan_user");
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePriceUpdate = (symbol: string, newLtp: number, changePct: number, isStale?: boolean) => {
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.symbol === symbol) {
          const oldLtp = item.ltp;
          const dir = newLtp >= oldLtp ? "up" : "down";
          
          // Trigger price flash
          setTickFlashes(prev => ({ ...prev, [symbol]: dir }));
          setTimeout(() => {
            setTickFlashes(prev => {
              const copy = { ...prev };
              delete copy[symbol];
              return copy;
            });
          }, 700);

          // Append to local sparkline buffer
          const spark = [...(item.sparkline || [oldLtp]), newLtp].slice(-30);

          return {
            ...item,
            ltp: newLtp,
            changePct,
            isStale: isStale ?? item.isStale,
            sparkline: spark
          };
        }
        return item;
      })
    );
  };

  useEffect(() => {
    loadData();
    fetchFeedStatus();
    const feedInterval = setInterval(fetchFeedStatus, 5000);

    const handoffData = typeof window !== "undefined" ? localStorage.getItem("dhyan_handoff") : null;
    if (handoffData) {
      try {
        const parsed = JSON.parse(handoffData);
        if (parsed?.previousDevice && parsed?.currentDevice) {
          setHandoffToast(parsed);
          localStorage.removeItem("dhyan_handoff");
          setTimeout(() => setHandoffToast(null), 6000);
        }
      } catch (_) {}
    }

    const socket = getSocket();

    // Standard JSON WebSocket Ticks
    socket.on("price_tick", (snapshot: any) => {
      fetchFeedStatus();
      handlePriceUpdate(snapshot.symbol, snapshot.ltp, snapshot.changePct, snapshot.isStale);
    });

    // Groww 915 Compact Binary WebSocket Ticks (20-byte ArrayBuffers)
    socket.on("price_tick:binary", (binaryBuffer: ArrayBuffer) => {
      const decoded = decodeBinaryTickFrame(binaryBuffer);
      if (decoded) {
        handlePriceUpdate(decoded.symbol, decoded.ltp, decoded.changePct, decoded.isStale);
      }
    });

    // Live Event Stream Trigger
    socket.on("new_change_event", (data: any) => {
      if (user) {
        watchlistApi.getUnreadCount(user.watchlistId).then(res => {
          setUnreadCount(res.unreadCount || 0);
        });
      }
      if (data?.event) {
        setLiveEventToast({
          symbol: data.event.symbol,
          tier: data.event.confidenceTier,
          narrative: data.event.narrative
        });
        setTimeout(() => setLiveEventToast(null), 7000);
      }
    });

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowAddModal(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      clearInterval(feedInterval);
      window.removeEventListener("keydown", handleGlobalKeyDown);
      socket.off("price_tick");
      socket.off("price_tick:binary");
      socket.off("new_change_event");
    };
  }, [language]);

  const handleRemoveItem = async (itemId: string) => {
    if (!user) return;
    try {
      await watchlistApi.removeItem(user.watchlistId, itemId);
      loadData();
    } catch (e) {}
  };

  const handleMarkItemSeen = async (itemId: string) => {
    if (!user) return;
    try {
      await watchlistApi.markItemSeen(user.watchlistId, itemId);
      loadData();
    } catch (e) {}
  };

  // Portfolio P&L Shift calculation
  const portfolioPnL = useMemo(() => {
    if (!items || items.length === 0) return { rupees: 0, pct: 0 };
    let totalVal = 0;
    let totalBase = 0;
    items.forEach(it => {
      const shares = 15;
      const ltp = it.ltp || 100;
      const changePct = it.changePct || 0;
      const base = ltp / (1 + changePct / 100);
      totalVal += ltp * shares;
      totalBase += base * shares;
    });
    const rupees = Math.round(totalVal - totalBase);
    const pct = totalBase > 0 ? Number(((rupees / totalBase) * 100).toFixed(2)) : 0;
    return { rupees, pct };
  }, [items]);

  // Filter & Search Pipeline
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(it =>
        it.symbol.toLowerCase().includes(q) ||
        (it.name && it.name.toLowerCase().includes(q)) ||
        (it.sector && it.sector.toLowerCase().includes(q))
      );
    }

    // Category filter tabs
    if (activeFilter === "attention") {
      result = result.sort((a, b) => {
        const magA = (a.latestEvent?.magnitude || 0) + (a.isStale ? 50 : 0) + (Math.abs(a.changePct) * 10);
        const magB = (b.latestEvent?.magnitude || 0) + (b.isStale ? 50 : 0) + (Math.abs(b.changePct) * 10);
        return magB - magA;
      });
    } else if (activeFilter === "confirmed") {
      result = result.filter(it => it.latestEvent?.confidenceTier === "CONFIRMED");
    } else if (activeFilter === "unexplained") {
      result = result.filter(it => it.latestEvent?.confidenceTier === "UNEXPLAINED");
    } else if (activeFilter === "stale") {
      result = result.filter(it => it.isStale);
    }

    return result;
  }, [items, activeFilter, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted text-xs font-mono gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <span>Loading Smart Watchlist...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-16 bg-grid-fintech relative font-sans selection:bg-brand-500/20">
      <div className="absolute inset-0 ambient-glow pointer-events-none" />
      
      <Header
        watchlistId={user?.watchlistId}
        onToggleDebug={() => setShowDebug(!showDebug)}
        onToggleChat={() => setShowChat(!showChat)}
        onOpenSearch={() => setShowAddModal(true)}
        showDebug={showDebug}
        feedStatus={feedStatus}
      />

      {/* 📊 Live Institutional Market Pulse Ribbon */}
      <div className="border-b border-surfaceBorder/60 bg-surface/80 backdrop-blur-md sticky top-0 z-30 px-3 sm:px-4 py-1.5 overflow-x-auto no-scrollbar">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 text-[11px] font-mono whitespace-nowrap">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-foreground font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>NIFTY 50</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">24,834.10 (+0.42%)</span>
            </div>
            <div className="flex items-center gap-1.5 text-foreground font-bold border-l border-surfaceBorder pl-4">
              <span>SENSEX</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">81,455.40 (+0.38%)</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-foreground font-bold border-l border-surfaceBorder pl-4">
              <span>BANK NIFTY</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">51,210.80 (-0.18%)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted text-[10px]">
            <Radio className="w-3 h-3 text-brand-500 animate-pulse" />
            <span>Groww 915 Binary WebSocket Stream: Active</span>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 pt-4">

        {/* 🔔 Real-time Slide-in Event Toast */}
        {liveEventToast && (
          <div className="fixed top-16 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top-3 duration-300">
            <div className="bg-surfaceElevated border border-brand-500/40 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${liveEventToast.tier === "CONFIRMED" ? "bg-emerald-500 animate-ping" : "bg-amber-500 animate-ping"}`} />
                  <span className="font-bold text-xs font-mono text-foreground">{liveEventToast.symbol}</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${liveEventToast.tier === "CONFIRMED" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
                    {liveEventToast.tier}
                  </span>
                </div>
                <button onClick={() => setLiveEventToast(null)} className="text-muted hover:text-foreground text-sm">×</button>
              </div>
              <p className="text-xs text-foreground mt-1.5 font-sans leading-snug line-clamp-2">
                {liveEventToast.narrative}
              </p>
            </div>
          </div>
        )}

        {/* 📱 Zero-Click Cross-Device Handoff Toast */}
        {handoffToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
            <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 shadow-2xl flex items-start gap-3 backdrop-blur-md">
              <div className="w-8 h-8 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4 text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono font-bold text-brand-500 uppercase">
                  Continuing from {handoffToast.previousDevice}
                </div>
                <div className="text-xs text-foreground mt-0.5 leading-relaxed">
                  Now on <span className="font-bold">{handoffToast.currentDevice}</span>. Your watermarks and unread counts have been seamlessly synced.
                </div>
              </div>
              <button onClick={() => setHandoffToast(null)} className="text-muted hover:text-foreground text-lg leading-none">×</button>
            </div>
          </div>
        )}

        {/* 1️⃣ Market Feed Status Banner */}
        {feedStatus && (
          <div className={`p-2.5 rounded-xl mb-3 border flex flex-wrap items-center justify-between gap-2 text-xs transition-all ${
            feedStatus?.status === "killed"
              ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-400 font-semibold"
              : feedStatus?.mode === "stale_partial"
              ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 font-medium"
              : feedStatus?.mode === "simulated"
              ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300"
              : "bg-surface border-surfaceBorder text-foreground"
          }`}>
            <div className="flex items-center space-x-2.5 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                feedStatus?.status === "killed"
                  ? "bg-rose-500 animate-pulse"
                  : feedStatus?.mode === "stale_partial"
                  ? "bg-amber-500 animate-pulse"
                  : feedStatus?.mode === "simulated"
                  ? "bg-amber-500"
                  : "bg-emerald-500 animate-pulse"
              }`} />
              <span className="font-semibold font-mono text-xs">
                {feedStatus?.status === "killed"
                  ? t("market_feed_killed")
                  : feedStatus?.mode === "stale_partial"
                  ? (t("market_feed_stale") || `Market Feed: Live (${feedStatus?.staleCount} symbols delayed/stale)`).replace("{count}", String(feedStatus?.staleCount || 1))
                  : feedStatus?.mode === "simulated"
                  ? t("market_feed_simulated")
                  : t("market_feed_live")}
              </span>
            </div>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-[11px] font-mono font-bold underline hover:opacity-80 text-brand-600 dark:text-brand-400 shrink-0 ml-auto"
            >
              {showDebug ? t("hide_controls") : t("debug_controls")}
            </button>
          </div>
        )}

        {/* Debug Panel Toggle */}
        {showDebug && <DebugPanel onStatusChange={loadData} />}

        {/* 2️⃣ Flagship: Personal Watermark Timeline Banner */}
        {timeAwayString && (
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-3.5 mb-3 shadow-sm hover:border-brand-500/30 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <Clock className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono font-bold tracking-wider text-muted uppercase flex items-center gap-1.5">
                    <span>{language === "hi" ? "व्यक्तिगत समयरेखा" : "PERSONAL WATERMARK TIMELINE"}</span>
                    <span className="text-brand-500">•</span>
                    <span className="text-[9px] text-brand-500">Zero-CPU Indexed Catchup (&lt;12ms)</span>
                  </div>
                  <div className="text-xs font-medium text-foreground leading-relaxed mt-0.5">
                    {timeAwayString}
                  </div>
                  {items.length > 0 && (
                    <div className="mt-2 inline-flex items-center gap-2 bg-surfaceElevated border border-surfaceBorder px-2.5 py-1 rounded-xl text-[11px] font-mono flex-wrap">
                      <span className="text-muted font-bold">Portfolio Shift:</span>
                      <span className={`font-bold flex items-center gap-0.5 ${portfolioPnL.rupees >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {portfolioPnL.rupees >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {portfolioPnL.rupees >= 0 ? "+" : ""}₹{portfolioPnL.rupees.toLocaleString("en-IN")} ({portfolioPnL.rupees >= 0 ? "+" : ""}{portfolioPnL.pct}%)
                      </span>
                      <span className="text-muted text-[10px]">since last visit</span>
                    </div>
                  )}
                </div>
              </div>
              <Link
                href="/since-last-checked"
                className="shrink-0 text-xs font-mono font-bold text-white bg-brand-500 hover:bg-brand-600 flex items-center gap-1.5 self-end sm:self-center px-3.5 py-2 rounded-xl shadow-md transition-all active:scale-95"
              >
                <span>{language === "hi" ? "अंतर देखें" : "View Diff"}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* 3️⃣ Flagship: Signal Quality + Sector Radar Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <WatchlistTrustRatio data={trustRatioData} />
          <SectorRiskRadar
            breakdown={sectorBreakdown}
            concentrationWarning={concentrationWarning}
            totalCount={items.length}
          />
        </div>

        {/* 4️⃣ Flagship: Persistent Flagship Unread Inbox Banner */}
        <Link
          href="/since-last-checked"
          className="group block bg-surface border border-surfaceBorder hover:border-brand-500/40 rounded-2xl p-3.5 mb-4 transition-all shadow-sm active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Bell className="w-4 h-4 text-brand-500 shrink-0 group-hover:rotate-12 transition-transform" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-foreground text-sm group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors whitespace-nowrap">
                    {t("since_last_checked")}
                  </h2>
                  {unreadCount > 0 && (
                    <span className="bg-brand-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono shrink-0 leading-4 animate-pulse">
                      {unreadCount > 9 ? "9+" : unreadCount} {t("new_badge")}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted">
                  {unreadCount > 0
                    ? `${unreadCount > 9 ? "9+" : unreadCount} ${t("events_logged")}`
                    : t("no_new_events")}
                </p>
              </div>
            </div>
            <div className="text-[11px] font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform shrink-0 font-mono">
              <span>Open Unread Tray</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Rich Inbox Summary — breakdown pills */}
          {unreadSummary && unreadSummary.total > 0 && (
            <div className="space-y-2 pt-2.5 border-t border-surfaceBorder/50">
              <div className="flex flex-wrap gap-1.5">
                {unreadSummary.confirmed > 0 && (
                  <span className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block" />{unreadSummary.confirmed} Confirmed
                  </span>
                )}
                {unreadSummary.unexplained > 0 && (
                  <span className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 inline-block" />{unreadSummary.unexplained} Unexplained
                  </span>
                )}
                {unreadSummary.uncertain > 0 && (
                  <span className="flex items-center gap-1 bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 inline-block" />{unreadSummary.uncertain} Uncertain
                  </span>
                )}
                {unreadSummary.rippleAlerts > 0 && (
                  <span className="flex items-center gap-1 bg-indigo-500/15 border border-indigo-500/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                    <Waves className="w-3 h-3 shrink-0" />
                    {unreadSummary.rippleAlerts} Ripple
                  </span>
                )}
              </div>
            </div>
          )}
        </Link>

        {/* 5️⃣ Dynamic Search & Category Filter Tabs */}
        <div className="space-y-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h1 className="font-bold text-lg text-foreground flex items-center gap-2">
                <span>{watchlistData?.name ? (watchlistData.name.toLowerCase().includes("core") ? t("core_watchlist") : watchlistData.name) : t("core_watchlist")}</span>
                <span className="text-xs text-muted font-mono font-normal">({filteredAndSortedItems.length}/{items.length} stocks)</span>
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Instant Search Bar */}
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter symbols..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-surface border border-surfaceBorder rounded-xl text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <button
                onClick={() => setShowChat(true)}
                className="h-8 px-2.5 bg-surface hover:bg-surfaceElevated border border-surfaceBorder text-brand-500 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <Bot className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                <span className="hidden sm:inline">{t("ask_dhyan")}</span>
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="h-8 px-3 bg-brand-500 hover:bg-brand-600 font-bold text-white rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-white shrink-0" />
                <span>{t("add_stock")}</span>
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-mono">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 ${
                activeFilter === "all"
                  ? "bg-foreground text-background font-bold border-foreground shadow-sm"
                  : "bg-surface hover:bg-surfaceElevated text-muted border-surfaceBorder"
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setActiveFilter("attention")}
              className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center gap-1 ${
                activeFilter === "attention"
                  ? "bg-amber-500 text-white font-bold border-amber-600 shadow-sm"
                  : "bg-surface hover:bg-surfaceElevated text-amber-500 border-surfaceBorder"
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Needs Attention</span>
            </button>
            <button
              onClick={() => setActiveFilter("confirmed")}
              className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center gap-1 ${
                activeFilter === "confirmed"
                  ? "bg-emerald-600 text-white font-bold border-emerald-700 shadow-sm"
                  : "bg-surface hover:bg-surfaceElevated text-emerald-500 border-surfaceBorder"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Confirmed Catalysts</span>
            </button>
            <button
              onClick={() => setActiveFilter("unexplained")}
              className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center gap-1 ${
                activeFilter === "unexplained"
                  ? "bg-amber-600 text-white font-bold border-amber-700 shadow-sm"
                  : "bg-surface hover:bg-surfaceElevated text-amber-400 border-surfaceBorder"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Uninformed Flows</span>
            </button>
            <button
              onClick={() => setActiveFilter("stale")}
              className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center gap-1 ${
                activeFilter === "stale"
                  ? "bg-rose-600 text-white font-bold border-rose-700 shadow-sm"
                  : "bg-surface hover:bg-surfaceElevated text-rose-400 border-surfaceBorder"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Stale Feeds</span>
            </button>
          </div>
        </div>

        {/* 6️⃣ Interactive Stock Universe Grid Cards with Live Flash & Micro-actions */}
        <div className="bg-surface border border-surfaceBorder rounded-2xl divide-y divide-surfaceBorder overflow-hidden shadow-sm mb-8">
          {filteredAndSortedItems.length === 0 ? (
            <div className="p-8 text-center text-muted text-xs font-mono">
              {searchQuery ? "No stocks match your active search filter." : "No stocks found in this category."}
            </div>
          ) : (
            filteredAndSortedItems.map(item => {
              const isPositive = item.changePct >= 0;
              const sign = isPositive ? "+" : "";
              const flash = tickFlashes[item.symbol];

              // Accent border based on confidence tier of latest event
              const tierAccent = item.latestEvent?.confidenceTier === "CONFIRMED"
                ? "border-l-4 border-l-emerald-500"
                : item.latestEvent?.confidenceTier === "UNEXPLAINED"
                ? "border-l-4 border-l-amber-500"
                : item.isStale
                ? "border-l-4 border-l-rose-500"
                : "border-l-4 border-l-transparent";

              return (
                <div
                  key={item.id}
                  className={`p-3 hover:bg-surfaceElevated/60 transition-all group ${tierAccent} ${
                    flash === "up" ? "bg-emerald-500/10" : flash === "down" ? "bg-rose-500/10" : ""
                  }`}
                >
                  {/* Row 1: Symbol, Badges, & Company vs LTP & Sparkline */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-foreground font-mono tracking-tight shrink-0">
                          {item.symbol}
                        </span>
                        {item.isStale && (
                          <span className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap flex items-center gap-0.5">
                            <span className="w-1 h-1 rounded-full bg-rose-500 inline-block animate-ping" />{TIER_LABELS.UNCERTAIN}
                          </span>
                        )}
                        {item.latestEvent?.confidenceTier === "CONFIRMED" && (
                          <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            <span>{TIER_LABELS.CONFIRMED}</span>
                          </span>
                        )}
                        {item.latestEvent?.confidenceTier === "UNEXPLAINED" && (
                          <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap flex items-center gap-1">
                            <Activity className="w-3 h-3 text-amber-500" />
                            <span>{TIER_LABELS.UNEXPLAINED}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted truncate mt-0.5 font-medium">
                        {item.name} • <span className="opacity-80">{t(`sector_${item.sector.toLowerCase()}`) || item.sector}</span>
                      </div>
                    </div>

                    {/* Right: LTP, Change %, Sparkline */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className={`font-bold font-mono text-sm sm:text-base text-foreground tabular-nums transition-colors ${
                          flash === "up" ? "text-emerald-500 scale-105" : flash === "down" ? "text-rose-500 scale-105" : ""
                        }`}>
                          ₹{item.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <div
                          className={`text-xs font-mono font-semibold flex items-center justify-end gap-0.5 ${
                            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>{sign}{item.changePct.toFixed(2)}%</span>
                        </div>
                      </div>

                      {/* Watermark Delta Sparkline */}
                      <div
                        onClick={() => {
                          setSelectedVisualizerItem(item);
                          setShowVisualizerModal(true);
                        }}
                        className="hidden sm:block cursor-pointer hover:scale-105 transition-transform"
                        title="Click to open Evidence-Pinned Stock Visualizer"
                      >
                        <WatermarkSparkline
                          points={item.sparkline}
                          changePct={item.changePct}
                          hasWatermarkDelta={Boolean(item.lastViewedAt)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Thesis notes & Quick Action Buttons */}
                  <div className="mt-2 pt-2 border-t border-surfaceBorder/40 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                      {/* Signal History Dots */}
                      {item.tierHistory && item.tierHistory.length > 0 && (
                        <div className="flex items-center gap-1 shrink-0" title="Signal History">
                          <span className="text-[9px] font-mono text-muted uppercase">History:</span>
                          <div className="flex items-center gap-1">
                            {item.tierHistory.map((tier, idx) => (
                              <span
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full inline-block ${
                                  tier === "CONFIRMED"
                                    ? "bg-emerald-500"
                                    : tier === "UNEXPLAINED"
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                                title={TIER_LABELS[tier] || tier}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Research Thesis Preview */}
                      {(() => {
                        let parsedThesis = "";
                        if (item.notes) {
                          try {
                            const parsed = JSON.parse(item.notes);
                            if (parsed?.thesisText) parsedThesis = parsed.thesisText;
                          } catch (_) {
                            parsedThesis = item.notes;
                          }
                        }
                        if (parsedThesis) {
                          return (
                            <button
                              onClick={() => { setSelectedThesisItem(item); setShowThesisModal(true); }}
                              className="text-[11px] text-foreground hover:text-brand-500 font-mono bg-surfaceElevated hover:bg-surface border border-surfaceBorder px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 transition-all text-left max-w-full"
                              title="Click to edit research thesis & invalidation point"
                            >
                              <BookOpen className="w-3 h-3 shrink-0 text-brand-500" />
                              <span className="truncate max-w-[200px] sm:max-w-[320px] font-medium">Thesis: &quot;{parsedThesis}&quot;</span>
                            </button>
                          );
                        }
                        return (
                          <button
                            onClick={() => { setSelectedThesisItem(item); setShowThesisModal(true); }}
                            className="text-[10px] text-muted hover:text-foreground font-mono flex items-center gap-1 opacity-75 hover:opacity-100 transition-opacity"
                            title="Record why you track this stock and when thesis breaks"
                          >
                            <BookOpen className="w-3 h-3 text-muted" />
                            <span>+ Thesis</span>
                          </button>
                        );
                      })()}
                    </div>

                    {/* Micro-Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      <button
                        onClick={() => {
                          setSelectedVisualizerItem(item);
                          setShowVisualizerModal(true);
                        }}
                        className="h-7 px-2 text-muted hover:text-foreground flex items-center gap-1 rounded-lg hover:bg-surfaceElevated transition-colors text-xs font-mono"
                        title="Open Catalyst-Pinned Visualizer"
                      >
                        <BarChart2 className="w-3.5 h-3.5 text-brand-500" />
                        <span className="hidden sm:inline">Trace</span>
                      </button>

                      <button
                        onClick={() => handleMarkItemSeen(item.id)}
                        className="h-7 w-7 text-muted hover:text-emerald-500 flex items-center justify-center rounded-lg hover:bg-surfaceElevated transition-colors"
                        title="Mark seen (update watermark for this item)"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="h-7 w-7 text-muted hover:text-rose-500 flex items-center justify-center rounded-lg hover:bg-surfaceElevated transition-colors"
                        title="Remove from Watchlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>

      {/* Modals */}
      {user && (
        <AddSymbolModal
          watchlistId={user.watchlistId}
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdded={loadData}
        />
      )}

      {user && (
        <AskDhyanChat
          watchlistId={user.watchlistId}
          isOpen={showChat}
          onClose={() => setShowChat(false)}
        />
      )}

      {user && (
        <ResearchThesisModal
          isOpen={showThesisModal}
          onClose={() => { setShowThesisModal(false); setSelectedThesisItem(null); }}
          watchlistId={user.watchlistId}
          item={selectedThesisItem}
          onSaved={loadData}
        />
      )}

      {selectedVisualizerItem && (
        <StockVisualizerModal
          isOpen={showVisualizerModal}
          onClose={() => {
            setShowVisualizerModal(false);
            setSelectedVisualizerItem(null);
          }}
          item={selectedVisualizerItem}
          onOpenThesis={(it) => {
            setSelectedThesisItem(it);
            setShowThesisModal(true);
          }}
        />
      )}
    </div>
  );
}
