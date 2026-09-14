"use client";

import { useEffect, useState, useMemo } from "react";
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
import { useI18n } from "@/lib/i18n";
import {
  Plus, Bell, Trash2, TrendingUp, TrendingDown, ShieldAlert, Bot, Clock,
  Filter, CheckCheck, Sparkles, Waves, Building2, Smartphone, BookOpen,
  AlertOctagon, BarChart2, ChevronRight, PieChart, ShieldCheck
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

  // Attention Priority sorting toggle
  const [sortByAttention, setSortByAttention] = useState(false);

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
    socket.on("price_tick", (snapshot: any) => {
      fetchFeedStatus();
      setItems(prevItems =>
        prevItems.map(item => {
          if (item.symbol === snapshot.symbol) {
            return {
              ...item,
              ltp: snapshot.ltp,
              changePct: snapshot.changePct,
              volume: snapshot.volume,
              isStale: snapshot.isStale
            };
          }
          return item;
        })
      );
    });

    socket.on("new_change_event", () => {
      if (user) {
        watchlistApi.getUnreadCount(user.watchlistId).then(res => {
          setUnreadCount(res.unreadCount || 0);
        });
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

  // Sort by Attention Priority
  const sortedItems = useMemo(() => {
    if (!sortByAttention) return items;
    return [...items].sort((a, b) => {
      const magA = (a.latestEvent?.magnitude || 0) + (a.isStale ? 50 : 0) + (Math.abs(a.changePct) * 10);
      const magB = (b.latestEvent?.magnitude || 0) + (b.isStale ? 50 : 0) + (Math.abs(b.changePct) * 10);
      return magB - magA;
    });
  }, [items, sortByAttention]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted text-xs font-mono gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <span>Loading Smart Watchlist...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-16 bg-grid-fintech relative font-sans">
      <div className="absolute inset-0 ambient-glow pointer-events-none" />
      
      <Header
        watchlistId={user?.watchlistId}
        onToggleDebug={() => setShowDebug(!showDebug)}
        onToggleChat={() => setShowChat(!showChat)}
        onOpenSearch={() => setShowAddModal(true)}
        showDebug={showDebug}
        feedStatus={feedStatus}
      />

      <main className="max-w-4xl mx-auto px-3 sm:px-4 pt-4">

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
          <div className={`p-3 rounded-2xl mb-4 border flex flex-wrap items-center justify-between gap-2 text-xs backdrop-blur shadow-sm transition-all ${
            feedStatus?.status === "killed"
              ? "bg-rose-500/10 border-rose-500/20 text-rose-400 font-semibold"
              : feedStatus?.mode === "stale_partial"
              ? "bg-amber-500/10 border-amber-500/20 text-amber-300 font-medium"
              : feedStatus?.mode === "simulated"
              ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
              : "bg-surface border-surfaceBorder text-slate-200"
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
              className="text-[11px] font-mono font-bold underline hover:opacity-80 text-brand-400 shrink-0 ml-auto"
            >
              {showDebug ? t("hide_controls") : t("debug_controls")}
            </button>
          </div>
        )}

        {/* Debug Panel Toggle */}
        {showDebug && <DebugPanel onStatusChange={loadData} />}

        {/* 2️⃣ Flagship: Personal Watermark Timeline Banner */}
        {timeAwayString && (
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 mb-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-brand-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono font-bold tracking-wider text-muted uppercase">
                    {language === "hi" ? "व्यक्तिगत समयरेखा" : "PERSONAL WATERMARK TIMELINE"}
                  </div>
                  <div className="text-xs font-medium text-foreground leading-relaxed mt-0.5">
                    {timeAwayString}
                  </div>
                  {items.length > 0 && (
                    <div className="mt-2 inline-flex items-center gap-2 bg-surfaceElevated border border-surfaceBorder px-2.5 py-1 rounded-lg text-[11px] font-mono shadow-sm flex-wrap">
                      <span className="text-muted font-bold">💼 Portfolio Shift:</span>
                      <span className={`font-bold ${portfolioPnL.rupees >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {portfolioPnL.rupees >= 0 ? "+" : ""}₹{portfolioPnL.rupees.toLocaleString("en-IN")} ({portfolioPnL.rupees >= 0 ? "+" : ""}{portfolioPnL.pct}%)
                      </span>
                      <span className="text-muted text-[10px]">since last check</span>
                    </div>
                  )}
                </div>
              </div>
              <Link
                href="/since-last-checked"
                className="shrink-0 text-xs font-mono font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1 self-end sm:self-center bg-brand-500/10 px-3 py-1.5 rounded-lg border border-brand-500/20 transition-all active:scale-95"
              >
                <span>{language === "hi" ? "अंतर देखें" : "View Diff"}</span>
                <span>→</span>
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
          className="group block bg-surface border border-surfaceBorder hover:border-brand-500/40 rounded-2xl p-4 mb-6 transition-all shadow-sm active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-foreground text-sm group-hover:text-brand-400 transition-colors whitespace-nowrap">
                    {t("since_last_checked")}
                  </h2>
                  {unreadCount > 0 && (
                    <span className="bg-brand-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono shrink-0 leading-4">
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
            <div className="text-[11px] font-bold text-brand-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform shrink-0">
              <span>View Diff</span>
              <span>→</span>
            </div>
          </div>

          {/* Rich Inbox Summary — breakdown pills */}
          {unreadSummary && unreadSummary.total > 0 && (
            <div className="space-y-2.5 pt-2.5 border-t border-surfaceBorder/50">
              <div className="flex flex-wrap gap-1.5">
                {unreadSummary.confirmed > 0 && (
                  <span className="flex items-center space-x-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                    <span>🟢</span><span>{unreadSummary.confirmed} Confirmed</span>
                  </span>
                )}
                {unreadSummary.unexplained > 0 && (
                  <span className="flex items-center space-x-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                    <span>🟡</span><span>{unreadSummary.unexplained} Unexplained</span>
                  </span>
                )}
                {unreadSummary.uncertain > 0 && (
                  <span className="flex items-center space-x-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                    <span>🔴</span><span>{unreadSummary.uncertain} Uncertain</span>
                  </span>
                )}
                {unreadSummary.rippleAlerts > 0 && (
                  <span className="flex items-center space-x-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                    <Waves className="w-3 h-3" />
                    <span>{unreadSummary.rippleAlerts} Ripple</span>
                  </span>
                )}
              </div>
              {/* Top event preview list */}
              {unreadSummary.topEvents.length > 0 && (
                <div className="space-y-1">
                  {unreadSummary.topEvents.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] font-mono">
                      <div className="flex items-center space-x-1.5">
                        <span className={ev.tier === "CONFIRMED" ? "text-emerald-400" : ev.tier === "UNEXPLAINED" ? "text-amber-400" : "text-rose-400"}>
                          {ev.tier === "CONFIRMED" ? "🟢" : ev.tier === "UNEXPLAINED" ? "🟡" : "🔴"}
                        </span>
                        <span className="font-semibold text-slate-200">{ev.name}</span>
                        {ev.isRipple && (
                          <span className="text-indigo-400 text-[9px]">⚡ via {ev.rippleSource}</span>
                        )}
                      </div>
                      <span className="text-muted text-[10px]">mag {ev.magnitude.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Link>

        {/* 5️⃣ Core Holdings & Watchlist Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h1 className="font-bold text-lg text-foreground">
              {watchlistData?.name ? (watchlistData.name.toLowerCase().includes("core") ? t("core_watchlist") : watchlistData.name) : t("core_watchlist")}
            </h1>
            <span className="text-xs text-muted font-mono">
              {items.length} {t("stocks_tracked")}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Attention Priority Sort Toggle */}
            <button
              onClick={() => setSortByAttention(v => !v)}
              className={`h-10 px-3 border rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                sortByAttention
                  ? "bg-amber-500 text-white border-amber-600 font-bold"
                  : "bg-surface hover:bg-surfaceElevated border-surfaceBorder text-muted hover:text-foreground"
              }`}
              title="Prioritize stocks with critical filings or severe anomalies"
            >
              <Filter className="w-3.5 h-3.5 shrink-0" />
              <span>{sortByAttention
                ? (language === "hi" ? "ध्यान क्रम 🔥" : "Attention Sorted 🔥")
                : (language === "hi" ? "ध्यान पहले" : "Needs Attention First")
              }</span>
            </button>

            <button
              onClick={() => setShowChat(true)}
              className="h-10 px-3.5 bg-surface hover:bg-surfaceElevated border border-surfaceBorder text-brand-500 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Bot className="w-4 h-4 text-brand-500 shrink-0" />
              <span>{t("ask_dhyan")}</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="h-10 px-3.5 sm:px-4 bg-brand-500 hover:bg-brand-600 font-bold text-white rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-brand-500/20"
            >
              <Plus className="w-4 h-4 text-white shrink-0" />
              <span>{t("add_stock")}</span>
            </button>
          </div>
        </div>

        {/* Stock Universe Ticker List with Sparklines & Accent Borders */}
        <div className="bg-surface border border-surfaceBorder rounded-2xl divide-y divide-surfaceBorder overflow-hidden shadow-sm mb-8">
          {sortedItems.length === 0 ? (
            <div className="p-8 text-center text-muted text-xs font-mono">
              {language === "hi"
                ? "आपकी वॉचलिस्ट खाली है। पहला स्टॉक ट्रैक करने के लिए \"स्टॉक जोड़ें\" पर टैप करें!"
                : "Your watchlist is empty. Tap \"Add Stock\" to track your first symbol!"}
            </div>
          ) : (
            sortedItems.map(item => {
              const isPositive = item.changePct >= 0;
              const sign = isPositive ? "+" : "";

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
                  className={`p-3.5 sm:p-4 hover:bg-surfaceElevated transition-all group ${tierAccent}`}
                >
                  {/* Row 1: Symbol, Badges, & Company (Left) vs LTP & Change % (Right) */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-foreground font-mono tracking-tight shrink-0">
                          {item.symbol}
                        </span>
                        {item.isStale && (
                          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm shrink-0 whitespace-nowrap">
                            🔴 {TIER_LABELS.UNCERTAIN}
                          </span>
                        )}
                        {item.latestEvent?.confidenceTier === "CONFIRMED" && (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                            🟢 {TIER_LABELS.CONFIRMED}
                          </span>
                        )}
                        {item.latestEvent?.confidenceTier === "UNEXPLAINED" && (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                            🟡 {TIER_LABELS.UNEXPLAINED}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted truncate mt-0.5 font-medium">
                        {item.name} • <span className="opacity-80">{t(`sector_${item.sector.toLowerCase()}`) || item.sector}</span>
                      </div>
                    </div>

                    {/* Right: LTP & Change % */}
                    <div className="text-right shrink-0">
                      <div className="font-bold font-mono text-sm sm:text-base text-foreground tabular-nums">
                        ₹{item.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                      <div
                        className={`text-xs font-mono font-semibold flex items-center justify-end gap-0.5 ${
                          isPositive ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{sign}{item.changePct.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Recent Signal Dots, Research Thesis & Actions */}
                  <div className="mt-2 pt-2 border-t border-surfaceBorder/40 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                      {/* Tier History Dot Strip */}
                      {item.tierHistory && item.tierHistory.length > 0 && (
                        <div className="flex items-center gap-1 shrink-0" title="Signal History">
                          <span className="text-[9px] font-mono text-muted uppercase">Recent:</span>
                          <div className="flex items-center gap-1">
                            {item.tierHistory.map((tier, idx) => (
                              <span
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full inline-block ${
                                  tier === "CONFIRMED"
                                    ? "bg-emerald-500"
                                    : tier === "UNEXPLAINED"
                                    ? "bg-amber-400"
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
                              className="text-[11px] text-slate-300 hover:text-white font-mono bg-surfaceElevated/70 hover:bg-surfaceElevated border border-surfaceBorder px-2.5 py-0.5 rounded-md flex items-center gap-1.5 transition-colors text-left max-w-full"
                              title="Click to edit research thesis & invalidation point"
                            >
                              <BookOpen className="w-3 h-3 shrink-0 text-brand-400" />
                              <span className="truncate max-w-[180px] sm:max-w-[280px]">Thesis: "{parsedThesis}"</span>
                            </button>
                          );
                        }
                        return (
                          <button
                            onClick={() => { setSelectedThesisItem(item); setShowThesisModal(true); }}
                            className="text-[10px] text-muted hover:text-slate-300 font-mono flex items-center gap-1 opacity-75 hover:opacity-100 transition-opacity"
                            title="Record why you track this stock and when thesis breaks"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>+ Thesis</span>
                          </button>
                        );
                      })()}
                    </div>

                    {/* Sparkline & Micro-Actions */}
                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      {/* Watermark Delta Sparkline on larger screens */}
                      <div
                        onClick={() => {
                          setSelectedVisualizerItem(item);
                          setShowVisualizerModal(true);
                        }}
                        className="hidden md:block pr-2 cursor-pointer hover:scale-105 transition-transform"
                        title="Click to open Evidence-Pinned Stock Visualizer"
                      >
                        <WatermarkSparkline
                          points={item.sparkline}
                          changePct={item.changePct}
                          hasWatermarkDelta={Boolean(item.lastViewedAt)}
                        />
                      </div>

                      <button
                        onClick={() => {
                          setSelectedVisualizerItem(item);
                          setShowVisualizerModal(true);
                        }}
                        className="h-7 w-7 text-muted hover:text-brand-400 flex items-center justify-center rounded-lg hover:bg-surfaceElevated transition-colors"
                        title="Open Catalyst-Pinned Visualizer"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => { setSelectedThesisItem(item); setShowThesisModal(true); }}
                        className="h-7 w-7 text-muted hover:text-brand-400 flex items-center justify-center rounded-lg hover:bg-surfaceElevated transition-colors"
                        title="Edit Research Thesis"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleMarkItemSeen(item.id)}
                        className="h-7 w-7 text-muted hover:text-emerald-400 flex items-center justify-center rounded-lg hover:bg-surfaceElevated transition-colors"
                        title="Mark seen (update watermark for this item)"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="h-7 w-7 text-muted hover:text-rose-400 flex items-center justify-center rounded-lg hover:bg-surfaceElevated transition-colors"
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

      {/* Add Symbol Modal */}
      {user && (
        <AddSymbolModal
          watchlistId={user.watchlistId}
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdded={loadData}
        />
      )}

      {/* Ask Dhyan Grounded Chat Drawer */}
      {user && (
        <AskDhyanChat
          watchlistId={user.watchlistId}
          isOpen={showChat}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Research Thesis & Invalidation Modal */}
      {user && (
        <ResearchThesisModal
          isOpen={showThesisModal}
          onClose={() => { setShowThesisModal(false); setSelectedThesisItem(null); }}
          watchlistId={user.watchlistId}
          item={selectedThesisItem}
          onSaved={loadData}
        />
      )}

      {/* Evidence-Pinned Stock Visualizer Modal */}
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
