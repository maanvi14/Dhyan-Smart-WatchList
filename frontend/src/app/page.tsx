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
import { watchlistApi, debugApi, WatchlistItemPrice, User, UnreadSummary, TrustRatioData } from "@/lib/api";
import { TIER_BADGES, TIER_LABELS } from "@/lib/tiers";
import { getSocket, subscribeToSymbols } from "@/lib/socket";
import { useI18n } from "@/lib/i18n";
import { Plus, Bell, Trash2, TrendingUp, TrendingDown, ShieldAlert, Bot, Clock, Filter, CheckCheck, Sparkles, Waves, Building2, Smartphone, BookOpen, AlertOctagon } from "lucide-react";

export default function WatchlistHomePage() {
  const router = useRouter();
  const { language, t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [watchlistData, setWatchlistData] = useState<any>(null);
  const [items, setItems] = useState<WatchlistItemPrice[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [feedStatus, setFeedStatus] = useState<any>(null);
  // 🆕 Rich Unread Inbox summary
  const [unreadSummary, setUnreadSummary] = useState<UnreadSummary | null>(null);
  const [trustRatioData, setTrustRatioData] = useState<TrustRatioData | null>(null);
  const [concentrationWarning, setConcentrationWarning] = useState<string | null>(null);
  const [sectorBreakdown, setSectorBreakdown] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showThesisModal, setShowThesisModal] = useState(false);
  const [selectedThesisItem, setSelectedThesisItem] = useState<WatchlistItemPrice | null>(null);
  const [loading, setLoading] = useState(true);

  // 2026 UX: Attention Priority sorting toggle
  const [sortByAttention, setSortByAttention] = useState(false);

  // Time-away contextual state
  const [timeAwayString, setTimeAwayString] = useState<string>("");

  // 🆕 Zero-Click Cross-Device Handoff toast state
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

      // Compute contextual "Time Away" IMMEDIATELY from items
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
        
        const timeAgoStr = diffDays >= 1 ? `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago` : diffHours >= 1 ? `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago` : `${diffMins} min ago`;
        const timeAgoStrHi = diffDays >= 1 ? `${diffDays} ${diffDays === 1 ? 'दिन' : 'दिन'} पहले` : diffHours >= 1 ? `${diffHours} घंटे पहले` : `${diffMins} मिनट पहले`;

        if (language === "hi") {
          setTimeAwayString(`आपने आखिरी बार ${timeAgoStrHi} (लगभग ${timeStr}) चेक किया था — आपकी अनुपस्थिति में यह महत्वपूर्ण बदलाव हुए:`);
        } else {
          setTimeAwayString(`You last checked ${timeAgoStr} (~${timeStr}) — here is what meaningfully changed in your absence:`);
        }
      } else {
        if (language === "hi") {
          setTimeAwayString("वॉचलिस्ट में आपका स्वागत है — लाइव मार्केट गतिविधि और पुष्ट फाइलिंग यहाँ दिखेंगी:");
        } else {
          setTimeAwayString("Welcome to Dhyan — verified corporate filings and abnormal divergence updates will appear below:");
        }
      }

      // Safe secondary fetches for badge and radar
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
          // Fallback client-side sector breakdown calculation from fetched items
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
        console.warn("Secondary data fetch failed, using fallbacks", secErr);
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

    // 🆕 Zero-Click Cross-Device Handoff: check if login page stored handoff info
    const handoffData = typeof window !== "undefined" ? localStorage.getItem("dhyan_handoff") : null;
    if (handoffData) {
      try {
        const parsed = JSON.parse(handoffData);
        if (parsed?.previousDevice && parsed?.currentDevice) {
          setHandoffToast(parsed);
          localStorage.removeItem("dhyan_handoff"); // consume once
          // Auto-dismiss after 6 seconds
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
    } catch (e) {
      // ignore
    }
  };

  const handleMarkItemSeen = async (itemId: string) => {
    if (!user) return;
    try {
      await watchlistApi.markItemSeen(user.watchlistId, itemId);
      loadData();
    } catch (e) {
      // ignore
    }
  };

  // Portfolio P&L Impact since away calculation
  const portfolioPnL = useMemo(() => {
    if (!items || items.length === 0) return { rupees: 0, pct: 0, totalValue: 0 };
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
    return { rupees, pct, totalValue: Math.round(totalVal) };
  }, [items]);

  // Sorted items: either default or "Needs Attention First"
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
      <div className="min-h-screen bg-background flex items-center justify-center text-muted text-xs font-mono">
        Loading Dhyan Watchlist...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-16 bg-grid-fintech relative">
      <div className="absolute inset-0 ambient-glow pointer-events-none" />
      <Header
        watchlistId={user?.watchlistId}
        onToggleDebug={() => setShowDebug(!showDebug)}
        onToggleChat={() => setShowChat(!showChat)}
        onOpenSearch={() => setShowAddModal(true)}
        showDebug={showDebug}
        feedStatus={feedStatus}
      />

      <main className="max-w-4xl mx-auto px-4 pt-4">

        {/* 📱 Zero-Click Cross-Device Handoff Toast (fixed bottom, auto-dismiss) */}
        {handoffToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
            <div className="bg-surface border border-brand-500/50 rounded-2xl p-4 shadow-2xl shadow-brand-500/10 flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4 text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono font-bold text-brand-500 uppercase tracking-wider">
                  Continuing from {handoffToast.previousDevice}
                </div>
                <div className="text-xs text-foreground mt-0.5 leading-relaxed">
                  Now on <span className="font-bold">{handoffToast.currentDevice}</span>. Your watermarks and unread counts have been seamlessly synced across devices.
                </div>
              </div>
              <button
                onClick={() => setHandoffToast(null)}
                className="text-muted hover:text-foreground shrink-0 text-lg leading-none"
              >×</button>
            </div>
          </div>
        )}

        {/* Market Feed Status Banner */}
        {feedStatus && (
          <div className={`p-3 rounded-2xl mb-4 border flex items-center justify-between text-xs backdrop-blur shadow-sm transition-all ${
            feedStatus?.status === "killed"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-500/50 text-rose-900 dark:text-rose-300 font-semibold"
              : feedStatus?.mode === "stale_partial"
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/50 text-amber-900 dark:text-amber-300 font-medium"
              : feedStatus?.mode === "simulated"
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-300"
              : "bg-surfaceElevated border-surfaceBorder text-foreground"
          }`}>
            <div className="flex items-center space-x-2.5">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
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
              className="text-[11px] font-mono font-bold underline hover:opacity-80 text-brand-500 dark:text-brand-400 shrink-0"
            >
              {showDebug ? t("hide_controls") : t("debug_controls")}
            </button>
          </div>
        )}

        {/* Debug Panel Toggle */}
        {showDebug && <DebugPanel onStatusChange={loadData} />}

        {/* Contextual "Time Away" Personal Timeline Banner */}
        {timeAwayString && (
          <div className="bg-gradient-to-r from-brand-500/15 via-surface to-surfaceElevated border border-brand-500/40 rounded-2xl p-4 mb-4 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-500 shrink-0">
                <Clock className="w-4 h-4 text-brand-500" />
              </div>
              <div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-500">
                  {language === "hi" ? "व्यक्तिगत समयरेखा" : "Personal Watermark Timeline"}
                </div>
                <div className="text-xs font-medium text-foreground leading-relaxed mt-0.5 font-sans">
                  {timeAwayString}
                </div>
                {items.length > 0 && (
                  <div className="mt-1.5 inline-flex items-center space-x-2 bg-surface border border-surfaceBorder px-2.5 py-1 rounded-lg text-[11px] font-mono shadow-sm">
                    <span className="text-muted font-bold">💼 Portfolio Shift:</span>
                    <span className={`font-bold ${portfolioPnL.rupees >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                      {portfolioPnL.rupees >= 0 ? "+" : ""}₹{portfolioPnL.rupees.toLocaleString("en-IN")} ({portfolioPnL.rupees >= 0 ? "+" : ""}{portfolioPnL.pct}%)
                    </span>
                    <span className="text-muted text-[10px]">since last check</span>
                  </div>
                )}
              </div>
            </div>
            <Link
              href="/since-last-checked"
              className="shrink-0 text-[11px] font-mono font-bold text-brand-500 hover:text-brand-400 underline flex items-center space-x-1"
            >
              <span>{language === "hi" ? "अंतर देखें" : "View Diff"}</span>
              <span>→</span>
            </Link>
          </div>
        )}

        {/* Signal Quality + Sector Radar — collapsed into single row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <WatchlistTrustRatio data={trustRatioData} />
          <SectorRiskRadar
            breakdown={sectorBreakdown}
            concentrationWarning={concentrationWarning}
            totalCount={items.length}
          />
        </div>

        {/* 📬 Persistent Flagship Unread Inbox Banner (Unread Inbox Architecture) */}
        <Link
          href="/since-last-checked"
          className="group block bg-gradient-to-r from-brand-500/10 via-teal-500/10 to-surfaceElevated border border-brand-500/30 hover:border-brand-500/60 rounded-2xl p-4 mb-6 transition-all shadow-md active:scale-[0.99]"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-500">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="font-bold text-foreground text-sm group-hover:text-brand-500 transition-colors">
                    {t("since_last_checked")}
                  </h2>
                  {unreadCount > 0 && (
                    <span className="bg-brand-500 text-slate-950 text-[11px] font-bold px-2 py-0.5 rounded-full font-mono">
                      {unreadCount > 9 ? "9+" : unreadCount} {t("new_badge")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {unreadCount > 0
                    ? `${unreadCount > 9 ? "9+" : unreadCount} ${t("events_logged")}`
                    : t("no_new_events")}
                </p>
              </div>
            </div>
            <div className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center space-x-1 group-hover:translate-x-1 transition-transform font-mono">
              <span>{t("view_diff")}</span>
              <span>→</span>
            </div>
          </div>

          {/* Rich Inbox Summary — breakdown pills */}
          {unreadSummary && unreadSummary.total > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-surfaceBorder/50">
              <div className="flex flex-wrap gap-2">
                {unreadSummary.confirmed > 0 && (
                  <span className="flex items-center space-x-1 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg shadow-sm">
                    <span>🟢</span><span>{unreadSummary.confirmed} Confirmed</span>
                  </span>
                )}
                {unreadSummary.unexplained > 0 && (
                  <span className="flex items-center space-x-1 bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg shadow-sm">
                    <span>🟡</span><span>{unreadSummary.unexplained} Unexplained</span>
                  </span>
                )}
                {unreadSummary.uncertain > 0 && (
                  <span className="flex items-center space-x-1 bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-300 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg shadow-sm">
                    <span>🔴</span><span>{unreadSummary.uncertain} Uncertain</span>
                  </span>
                )}
                {unreadSummary.rippleAlerts > 0 && (
                  <span className="flex items-center space-x-1 bg-purple-100 dark:bg-purple-500/20 border border-purple-300 dark:border-purple-500/40 text-purple-900 dark:text-purple-300 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg shadow-sm">
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
                        <span className={ev.tier === "CONFIRMED" ? "text-emerald-400" : ev.tier === "UNEXPLAINED" ? "text-amber-400" : "text-redwood-text"}>
                          {ev.tier === "CONFIRMED" ? "🟢" : ev.tier === "UNEXPLAINED" ? "🟡" : "🔴"}
                        </span>
                        <span className="font-bold text-foreground">{ev.name}</span>
                        {ev.isRipple && (
                          <span className="text-purple-400 text-[9px]">⚡ via {ev.rippleSource}</span>
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

        {/* Watchlist Header & Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="font-bold text-lg text-foreground">
              {watchlistData?.name ? (watchlistData.name.toLowerCase().includes("core") ? t("core_watchlist") : watchlistData.name) : t("core_watchlist")}
            </h1>
            <span className="text-xs text-muted font-mono">
              {items.length} {t("stocks_tracked")}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Attention Priority Sort Toggle */}
            <button
              onClick={() => setSortByAttention(v => !v)}
              className={`min-h-[44px] px-3 py-2 border rounded-xl text-xs font-mono font-semibold flex items-center space-x-1.5 transition-all shadow-sm ${
                sortByAttention
                  ? "bg-amber-500 text-slate-950 border-amber-600 font-bold"
                  : "bg-surface hover:bg-surfaceElevated border-surfaceBorder text-muted hover:text-foreground"
              }`}
              title="Prioritize stocks with critical filings or severe anomalies"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{sortByAttention
                ? (language === "hi" ? "ध्यान क्रम 🔥" : "Attention Sorted 🔥")
                : (language === "hi" ? "ध्यान पहले" : "Needs Attention First")
              }</span>
            </button>

            <button
              onClick={() => setShowChat(true)}
              className="min-h-[44px] px-3.5 py-2 bg-surface hover:bg-surfaceElevated border border-surfaceBorder text-brand-500 font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <Bot className="w-4 h-4 text-brand-500" />
              <span>{t("ask_dhyan")}</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="min-h-[44px] px-4 py-2 bg-brand-500 hover:bg-brand-600 font-bold text-slate-950 rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 shadow-md shadow-brand-500/20"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>{t("add_stock")}</span>
            </button>
          </div>
        </div>

        {/* Stock Universe Ticker List with Sparklines & Accent Borders */}
        <div className="bg-surface border border-surfaceBorder rounded-2xl divide-y divide-surfaceBorder overflow-hidden shadow-xl">
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
                ? "border-l-4 border-l-redwood-500"
                : "border-l-4 border-l-transparent";

              return (
                <div
                  key={item.id}
                  className={`p-4 flex items-center justify-between hover:bg-surfaceElevated transition-all group ${tierAccent}`}
                >
                  {/* Left: Symbol & Sector */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-foreground font-mono tracking-tight">
                        {item.symbol}
                      </span>
                      {item.isStale && (
                        <span className="bg-redwood-bg text-redwood-text border border-redwood-border text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm">
                          🔴 {TIER_LABELS.UNCERTAIN}
                        </span>
                      )}
                      {item.latestEvent?.confidenceTier === "CONFIRMED" && (
                        <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                          🟢 {TIER_LABELS.CONFIRMED}
                        </span>
                      )}
                      {item.latestEvent?.confidenceTier === "UNEXPLAINED" && (
                        <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                          🟡 {TIER_LABELS.UNEXPLAINED}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted truncate mt-0.5 font-medium">
                      {item.name} • <span className="opacity-80">{t(`sector_${item.sector.toLowerCase()}`) || item.sector}</span>
                    </div>

                    {/* Tier History Dot Strip */}
                    {item.tierHistory && item.tierHistory.length > 0 && (
                      <div className="flex items-center space-x-1.5 mt-1" title="Signal History: Green = Catalyst Confirmed, Yellow = Uninformed Flow, Red = Stale Quote">
                        <span className="text-[9px] font-mono text-muted uppercase tracking-wider">Recent:</span>
                        <div className="flex items-center space-x-1">
                          {item.tierHistory.map((tier, idx) => (
                            <span
                              key={idx}
                              className={`w-2 h-2 rounded-full inline-block ${
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
                            className="text-[11px] text-brand-500 hover:text-brand-400 font-mono mt-1.5 bg-brand-500/10 hover:bg-brand-500/15 border border-brand-500/30 px-2 py-0.5 rounded-lg flex items-center space-x-1.5 transition-colors text-left"
                            title="Click to edit research thesis & invalidation point"
                          >
                            <BookOpen className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[240px]">Thesis: "{parsedThesis}"</span>
                          </button>
                        );
                      }
                      return (
                        <button
                          onClick={() => { setSelectedThesisItem(item); setShowThesisModal(true); }}
                          className="text-[10px] text-muted hover:text-brand-500 font-mono mt-1 flex items-center space-x-1 opacity-70 hover:opacity-100 transition-opacity"
                          title="Record why you track this stock and when thesis breaks"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>+ Add Thesis &amp; Invalidation</span>
                        </button>
                      );
                    })()}
                  </div>

                  {/* Center: Watermark Delta Sparkline */}
                  <div className="hidden sm:block px-3">
                    <WatermarkSparkline
                      points={item.sparkline}
                      changePct={item.changePct}
                      hasWatermarkDelta={Boolean(item.lastViewedAt)}
                    />
                  </div>

                  {/* Right: LTP & Change % */}
                  <div className="text-right flex items-center space-x-3">
                    <div>
                      <div className="font-bold font-mono text-sm text-foreground tabular-nums">
                        ₹{item.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                      <div
                        className={`text-xs font-mono font-semibold flex items-center justify-end space-x-0.5 ${
                          isPositive ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{sign}{item.changePct.toFixed(2)}%</span>
                      </div>
                    </div>

                    {/* Quick Micro-Actions */}
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setSelectedThesisItem(item); setShowThesisModal(true); }}
                        className="min-h-[44px] min-w-[36px] text-muted hover:text-brand-500 flex items-center justify-center"
                        title="Edit Research Thesis"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleMarkItemSeen(item.id)}
                        className="min-h-[44px] min-w-[36px] text-muted hover:text-emerald-500 flex items-center justify-center"
                        title="Mark seen (update watermark for this item)"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="min-h-[44px] min-w-[36px] text-muted hover:text-rose-500 flex items-center justify-center"
                        title="Remove from Watchlist"
                      >
                        <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
