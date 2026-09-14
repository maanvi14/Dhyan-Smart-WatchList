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
  AlertOctagon, BarChart2, Search, SlidersHorizontal, ShieldCheck, ChevronRight,
  PieChart, LayoutGrid, ListFilter
} from "lucide-react";

type ActiveTab = "watchlist" | "attention" | "intel" | "radar";

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

  // Modern Trading App Tabs: 'watchlist' | 'attention' | 'intel' | 'radar'
  const [activeTab, setActiveTab] = useState<ActiveTab>("watchlist");
  const [searchQuery, setSearchQuery] = useState("");

  // Contextual time-away string
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
        
        const timeAgoStr = diffDays >= 1 ? `${diffDays}d ago` : diffHours >= 1 ? `${diffHours}h ago` : `${diffMins}m ago`;
        setTimeAwayString(`Last checked ${timeAgoStr} (~${timeStr})`);
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

  const handleRemoveItem = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await watchlistApi.removeItem(user.watchlistId, itemId);
      loadData();
    } catch (e) {}
  };

  const handleMarkItemSeen = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await watchlistApi.markItemSeen(user.watchlistId, itemId);
      loadData();
    } catch (e) {}
  };

  // Portfolio P&L Shift calculation
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

  // Filter and sort items based on tab and search
  const displayedItems = useMemo(() => {
    let list = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || i.sector.toLowerCase().includes(q));
    }
    if (activeTab === "attention") {
      list.sort((a, b) => {
        const magA = (a.latestEvent?.magnitude || 0) + (a.isStale ? 50 : 0) + (Math.abs(a.changePct) * 10);
        const magB = (b.latestEvent?.magnitude || 0) + (b.isStale ? 50 : 0) + (Math.abs(b.changePct) * 10);
        return magB - magA;
      });
    }
    return list;
  }, [items, activeTab, searchQuery]);

  // Count items needing attention
  const attentionCount = useMemo(() => {
    return items.filter(i => i.latestEvent || i.isStale).length;
  }, [items]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted text-xs font-mono gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <span>Loading Institutional Watchlist...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 sm:pb-12 bg-grid-fintech relative font-sans">
      <div className="absolute inset-0 ambient-glow pointer-events-none" />
      
      <Header
        watchlistId={user?.watchlistId}
        onToggleDebug={() => setShowDebug(!showDebug)}
        onToggleChat={() => setShowChat(!showChat)}
        onOpenSearch={() => setShowAddModal(true)}
        showDebug={showDebug}
        feedStatus={feedStatus}
      />

      <main className="max-w-4xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4">

        {/* 📱 Zero-Click Cross-Device Handoff Toast */}
        {handoffToast && (
          <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-surface border border-brand-500/40 rounded-2xl p-3.5 shadow-2xl flex items-start gap-3 backdrop-blur-md">
              <div className="w-7 h-7 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4 text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono font-bold text-brand-500 uppercase">
                  Synced from {handoffToast.previousDevice}
                </div>
                <div className="text-xs text-foreground mt-0.5">
                  Watermarks and read receipts synced to <span className="font-bold">{handoffToast.currentDevice}</span>.
                </div>
              </div>
              <button onClick={() => setHandoffToast(null)} className="text-muted hover:text-foreground text-sm">×</button>
            </div>
          </div>
        )}

        {/* Debug Panel Toggle */}
        {showDebug && <DebugPanel onStatusChange={loadData} />}

        {/* 🏛️ Modern Trading App Portfolio & Intel Summary Bar */}
        <div className="bg-surface border border-surfaceBorder rounded-2xl p-3.5 sm:p-4 mb-3 sm:mb-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Portfolio / Watchlist Stat */}
            <div className="flex items-center gap-4 sm:gap-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block">
                  Watchlist Value
                </span>
                <div className="text-lg sm:text-xl font-mono font-extrabold text-foreground tabular-nums">
                  ₹{portfolioPnL.totalValue.toLocaleString("en-IN")}
                </div>
              </div>

              <div className="h-8 w-px bg-surfaceBorder hidden xs:block" />

              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block">
                  Watermark Delta
                </span>
                <div className={`text-xs sm:text-sm font-mono font-bold flex items-center gap-1 tabular-nums ${
                  portfolioPnL.rupees >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}>
                  {portfolioPnL.rupees >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{portfolioPnL.rupees >= 0 ? "+" : ""}₹{portfolioPnL.rupees.toLocaleString("en-IN")} ({portfolioPnL.rupees >= 0 ? "+" : ""}{portfolioPnL.pct}%)</span>
                </div>
              </div>
            </div>

            {/* Quick Unread Intel Capsule & Add Stock Button */}
            <div className="flex items-center gap-2 ml-auto">
              <Link
                href="/since-last-checked"
                className="h-9 px-3 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/25 rounded-xl flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400 transition-all active:scale-95"
                title="View Since Last Checked change diff"
              >
                <Bell className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                <span className="hidden xs:inline">Intel:</span>
                <span className="font-bold font-mono">
                  {unreadCount > 0 ? `${unreadCount} New` : "Synced"}
                </span>
                <ChevronRight className="w-3 h-3 opacity-60" />
              </Link>

              <button
                onClick={() => setShowAddModal(true)}
                className="h-9 px-3 sm:px-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-brand-500/20"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="hidden xs:inline">Add Stock</span>
                <span className="xs:hidden">Add</span>
              </button>
            </div>
          </div>

          {timeAwayString && (
            <div className="text-[11px] font-mono text-muted mt-2 pt-2 border-t border-surfaceBorder/50 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-brand-500 shrink-0" />
              <span>{timeAwayString}</span>
            </div>
          )}
        </div>

        {/* 🧭 Professional Trading App Segmented Control Tabs */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-surfaceElevated p-1 rounded-xl border border-surfaceBorder overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab("watchlist")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "watchlist"
                  ? "bg-surface text-foreground font-bold shadow-sm border border-surfaceBorder/80"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Watchlist ({items.length})
            </button>

            <button
              onClick={() => setActiveTab("attention")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "attention"
                  ? "bg-amber-500 text-white font-bold shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span>🔥 Attention</span>
              {attentionCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "attention" ? "bg-white/20 text-white" : "bg-amber-500/20 text-amber-500"}`}>
                  {attentionCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("intel")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "intel"
                  ? "bg-brand-500 text-white font-bold shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span>⚡ Intel Feed</span>
              {unreadCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "intel" ? "bg-white/20 text-white" : "bg-brand-500/20 text-brand-500"}`}>
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("radar")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "radar"
                  ? "bg-surface text-foreground font-bold shadow-sm border border-surfaceBorder/80"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Health &amp; Risk</span>
              <span className="sm:hidden">Radar</span>
            </button>
          </div>

          {/* Inline Filter Search Input */}
          {(activeTab === "watchlist" || activeTab === "attention") && (
            <div className="relative max-w-[160px] sm:max-w-[200px] hidden xs:block">
              <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 text-xs bg-surface border border-surfaceBorder rounded-lg placeholder-muted focus:outline-none focus:border-brand-500 transition-colors font-mono"
              />
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 1 & 2: Institutional Watchlist Table */}
        {/* ═══════════════════════════════════════════════════════ */}
        {(activeTab === "watchlist" || activeTab === "attention") && (
          <div className="bg-surface border border-surfaceBorder rounded-2xl divide-y divide-surfaceBorder overflow-hidden shadow-sm">
            {displayedItems.length === 0 ? (
              <div className="p-8 text-center text-muted text-xs font-mono space-y-2">
                <p>No symbols found matching filter.</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-brand-500 font-bold hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add a new stock
                </button>
              </div>
            ) : (
              displayedItems.map(item => {
                const isPositive = item.changePct >= 0;
                const sign = isPositive ? "+" : "";

                const tierAccent = item.latestEvent?.confidenceTier === "CONFIRMED"
                  ? "border-l-[3px] border-l-emerald-500"
                  : item.latestEvent?.confidenceTier === "UNEXPLAINED"
                  ? "border-l-[3px] border-l-amber-500"
                  : item.isStale
                  ? "border-l-[3px] border-l-redwood-500"
                  : "border-l-[3px] border-l-transparent";

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedVisualizerItem(item);
                      setShowVisualizerModal(true);
                    }}
                    className={`p-3 sm:p-3.5 hover:bg-surfaceElevated cursor-pointer transition-all group ${tierAccent}`}
                  >
                    {/* Main Row: Symbol & Name on left | Sparkline | Price & Change on right */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Symbol, Exchange & Sector */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm sm:text-base text-foreground font-mono tracking-tight">
                            {item.symbol.replace("NSE:", "")}
                          </span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-surfaceElevated border border-surfaceBorder text-muted">
                            NSE
                          </span>

                          {/* Catalyst Status Pill */}
                          {item.isStale && (
                            <span className="bg-redwood-bg text-redwood-text border border-redwood-border text-[9px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0">
                              🔴 STALE
                            </span>
                          )}
                          {item.latestEvent?.confidenceTier === "CONFIRMED" && (
                            <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0">
                              🟢 FILING
                            </span>
                          )}
                          {item.latestEvent?.confidenceTier === "UNEXPLAINED" && (
                            <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0">
                              🟡 FLOW
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-muted truncate mt-0.5 font-medium">
                          {item.name} • <span className="opacity-80">{item.sector}</span>
                        </div>
                      </div>

                      {/* Center: Sparkline (desktop & tablet) */}
                      <div className="hidden sm:block px-2">
                        <WatermarkSparkline
                          points={item.sparkline}
                          changePct={item.changePct}
                          hasWatermarkDelta={Boolean(item.lastViewedAt)}
                        />
                      </div>

                      {/* Right: LTP Price & % Change Badge */}
                      <div className="text-right shrink-0 flex items-center gap-3">
                        <div>
                          <div className="font-bold font-mono text-sm sm:text-base text-foreground tabular-nums">
                            ₹{item.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </div>
                          <div
                            className={`text-[11px] font-mono font-bold inline-flex items-center justify-end gap-0.5 tabular-nums px-1.5 py-0.2 rounded ${
                              isPositive
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isPositive ? "▲" : "▼"}{sign}{item.changePct.toFixed(2)}%
                          </div>
                        </div>

                        {/* Quick Action Icons */}
                        <div className="flex items-center gap-1 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedThesisItem(item);
                              setShowThesisModal(true);
                            }}
                            className="h-7 w-7 text-muted hover:text-brand-500 flex items-center justify-center rounded-lg hover:bg-surface border border-transparent hover:border-surfaceBorder transition-colors"
                            title="Edit Research Thesis"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleMarkItemSeen(item.id, e)}
                            className="h-7 w-7 text-muted hover:text-emerald-500 flex items-center justify-center rounded-lg hover:bg-surface border border-transparent hover:border-surfaceBorder transition-colors"
                            title="Mark seen"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleRemoveItem(item.id, e)}
                            className="h-7 w-7 text-muted hover:text-rose-500 flex items-center justify-center rounded-lg hover:bg-surface border border-transparent hover:border-surfaceBorder transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Optional Compact Thesis Tag if exists */}
                    {(() => {
                      let parsedThesis = "";
                      if (item.notes) {
                        try {
                          const p = JSON.parse(item.notes);
                          if (p?.thesisText) parsedThesis = p.thesisText;
                        } catch (_) {
                          parsedThesis = item.notes;
                        }
                      }
                      if (parsedThesis) {
                        return (
                          <div className="mt-1.5 text-[10px] font-mono text-brand-600 dark:text-brand-400 flex items-center gap-1 truncate max-w-lg">
                            <BookOpen className="w-3 h-3 shrink-0 opacity-70" />
                            <span className="truncate">Thesis: "{parsedThesis}"</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 3: Intel Feed / Since Last Checked View */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeTab === "intel" && (
          <div className="space-y-4">
            <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-surfaceBorder">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-brand-500" />
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Verified Event Audit Trace</h3>
                    <p className="text-[11px] text-muted">{unreadCount} change events logged since your watermark timestamp</p>
                  </div>
                </div>
                <Link
                  href="/since-last-checked"
                  className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm transition-all active:scale-95"
                >
                  <span>Full Diff View</span>
                  <span>→</span>
                </Link>
              </div>

              {unreadSummary && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {unreadSummary.confirmed > 0 && (
                      <span className="flex items-center space-x-1 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                        <span>🟢</span><span>{unreadSummary.confirmed} Confirmed Filings</span>
                      </span>
                    )}
                    {unreadSummary.unexplained > 0 && (
                      <span className="flex items-center space-x-1 bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                        <span>🟡</span><span>{unreadSummary.unexplained} Uninformed Flow</span>
                      </span>
                    )}
                    {unreadSummary.uncertain > 0 && (
                      <span className="flex items-center space-x-1 bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                        <span>🔴</span><span>{unreadSummary.uncertain} Stale Quotes</span>
                      </span>
                    )}
                    {unreadSummary.rippleAlerts > 0 && (
                      <span className="flex items-center space-x-1 bg-purple-50 dark:bg-purple-500/15 border border-purple-300 dark:border-purple-500/30 text-purple-800 dark:text-purple-300 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                        <Waves className="w-3 h-3" />
                        <span>{unreadSummary.rippleAlerts} Sector Ripples</span>
                      </span>
                    )}
                  </div>

                  {unreadSummary.topEvents.length > 0 && (
                    <div className="divide-y divide-surfaceBorder border border-surfaceBorder rounded-xl bg-surfaceElevated/40 overflow-hidden">
                      {unreadSummary.topEvents.map((ev, i) => (
                        <div key={i} className="p-2.5 flex items-center justify-between text-xs font-mono">
                          <div className="flex items-center gap-2 min-w-0">
                            <span>{ev.tier === "CONFIRMED" ? "🟢" : ev.tier === "UNEXPLAINED" ? "🟡" : "🔴"}</span>
                            <span className="font-bold text-foreground">{ev.name}</span>
                            {ev.isRipple && <span className="text-purple-500 text-[10px]">⚡ Ripple</span>}
                          </div>
                          <span className="text-muted text-[10px] shrink-0">Signal {ev.magnitude.toFixed(0)}/100</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 4: Health & Sector Risk Radar */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeTab === "radar" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <WatchlistTrustRatio data={trustRatioData} />
            <SectorRiskRadar
              breakdown={sectorBreakdown}
              concentrationWarning={concentrationWarning}
              totalCount={items.length}
            />
          </div>
        )}

      </main>

      {/* 📱 Mobile Fixed Bottom Navigation Bar (like Zerodha Kite / Groww) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-surfaceBorder sm:hidden flex items-center justify-around h-14 px-2">
        <button
          onClick={() => setActiveTab("watchlist")}
          className={`flex flex-col items-center justify-center flex-1 py-1 ${
            activeTab === "watchlist" ? "text-brand-500 font-bold" : "text-muted"
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Watchlist</span>
        </button>

        <button
          onClick={() => setActiveTab("attention")}
          className={`flex flex-col items-center justify-center flex-1 py-1 relative ${
            activeTab === "attention" ? "text-amber-500 font-bold" : "text-muted"
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Attention</span>
          {attentionCount > 0 && (
            <span className="absolute top-0.5 right-6 w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("intel")}
          className={`flex flex-col items-center justify-center flex-1 py-1 relative ${
            activeTab === "intel" ? "text-brand-500 font-bold" : "text-muted"
          }`}
        >
          <Bell className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Intel</span>
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-6 w-2 h-2 rounded-full bg-brand-500" />
          )}
        </button>

        <button
          onClick={() => setShowChat(true)}
          className="flex flex-col items-center justify-center flex-1 py-1 text-muted hover:text-brand-500"
        >
          <Bot className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Ask AI</span>
        </button>

        <button
          onClick={() => setActiveTab("radar")}
          className={`flex flex-col items-center justify-center flex-1 py-1 ${
            activeTab === "radar" ? "text-brand-500 font-bold" : "text-muted"
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Radar</span>
        </button>
      </nav>

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
