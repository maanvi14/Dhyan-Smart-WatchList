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
import { watchlistApi, WatchlistItemPrice, User } from "@/lib/api";
import { getSocket, subscribeToSymbols } from "@/lib/socket";
import { useI18n } from "@/lib/i18n";
import { Plus, Bell, Trash2, TrendingUp, TrendingDown, ShieldAlert, Bot, Clock, Filter, CheckCheck, Sparkles } from "lucide-react";

export default function WatchlistHomePage() {
  const router = useRouter();
  const { language, t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [watchlistData, setWatchlistData] = useState<any>(null);
  const [items, setItems] = useState<WatchlistItemPrice[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [concentrationWarning, setConcentrationWarning] = useState<string | null>(null);
  const [sectorBreakdown, setSectorBreakdown] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(true);

  // 2026 UX: Attention Priority sorting toggle
  const [sortByAttention, setSortByAttention] = useState(false);

  // Time-away contextual state
  const [timeAwayString, setTimeAwayString] = useState<string>("");

  const loadData = async () => {
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
      setItems(data.items || []);

      const symbols = (data.items || []).map((i: WatchlistItemPrice) => i.symbol);
      subscribeToSymbols(symbols);

      const [unreadRes, concRes] = await Promise.all([
        watchlistApi.getUnreadCount(u.watchlistId),
        watchlistApi.getConcentration(u.watchlistId)
      ]);
      setUnreadCount(unreadRes.unreadCount || 0);
      setConcentrationWarning(concRes.concentrationWarning);
      if (concRes.breakdown) setSectorBreakdown(concRes.breakdown);

      // Compute contextual "Time Away" from earliest/latest watermark
      if (data.items && data.items.length > 0) {
        const watermarks = data.items
          .map((it: any) => it.lastViewedAt ? new Date(it.lastViewedAt).getTime() : new Date(it.addedAt).getTime())
          .filter(Boolean);
        if (watermarks.length > 0) {
          const latestWatermark = Math.max(...watermarks);
          const diffHours = Math.max(1, Math.round((Date.now() - latestWatermark) / (1000 * 60 * 60)));
          const timeStr = new Date(latestWatermark).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          if (language === "hi") {
            setTimeAwayString(`आपने आखिरी बार ${diffHours} घंटे पहले (लगभग ${timeStr}) चेक किया था। आपकी अनुपस्थिति में यह हुआ:`);
          } else {
            setTimeAwayString(`You last checked ${diffHours} hours ago (~${timeStr}). Here is what happened in your absence:`);
          }
        }
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

    const socket = getSocket();
    socket.on("price_tick", (snapshot: any) => {
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

    return () => {
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

  // Sorted items: either default or "Needs Attention First"
  const sortedItems = useMemo(() => {
    if (!sortByAttention) return items;
    return [...items].sort((a, b) => {
      // Prioritize confirmed filings and high magnitude moves
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

  const feedStatus = watchlistData?.feedStatus;

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <Header
        watchlistId={user?.watchlistId}
        onToggleDebug={() => setShowDebug(!showDebug)}
        onToggleChat={() => setShowChat(!showChat)}
        showDebug={showDebug}
      />

      <main className="max-w-4xl mx-auto px-4 pt-4">

        {/* Market Feed Status Banner */}
        <div className={`p-3 rounded-2xl mb-4 border flex items-center justify-between text-xs backdrop-blur shadow-sm ${
          feedStatus?.status === "killed"
            ? "bg-redwood-50 dark:bg-redwood-bg border-redwood-border text-redwood-text"
            : feedStatus?.mode === "stale_partial"
            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/50 text-amber-800 dark:text-amber-300"
            : feedStatus?.mode === "simulated"
            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
            : "bg-surfaceElevated border-surfaceBorder text-foreground"
        }`}>
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              feedStatus?.status === "killed"
                ? "bg-redwood-500 animate-pulse"
                : feedStatus?.mode === "stale_partial"
                ? "bg-amber-400 animate-pulse"
                : feedStatus?.mode === "simulated"
                ? "bg-amber-400"
                : "bg-emerald-500"
            }`} />
            <span className="font-semibold font-mono">
              {feedStatus?.status === "killed"
                ? t("market_feed_killed")
                : feedStatus?.mode === "stale_partial"
                ? (t("market_feed_stale") || `Market Feed: Live (${feedStatus?.staleCount || 1} symbols delayed/stale)`).replace("{count}", String(feedStatus?.staleCount || 1))
                : feedStatus?.mode === "simulated"
                ? t("market_feed_simulated")
                : t("market_feed_live")}
            </span>
          </div>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-[11px] font-mono underline hover:opacity-80"
          >
            {showDebug ? t("hide_controls") : t("debug_controls")}
          </button>
        </div>

        {/* Debug Panel Toggle */}
        {showDebug && <DebugPanel onStatusChange={loadData} />}

        {/* Contextual "Time Away" Personal Timeline Banner */}
        {timeAwayString && (
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-3.5 mb-4 flex items-center space-x-2.5 text-xs text-muted shadow-sm">
            <Clock className="w-4 h-4 text-brand-500 shrink-0" />
            <span className="leading-relaxed font-sans">{timeAwayString}</span>
          </div>
        )}

        {/* Sector Risk Radar Donut/Progress Bar */}
        <SectorRiskRadar
          breakdown={sectorBreakdown}
          concentrationWarning={concentrationWarning}
          totalCount={items.length}
        />

        {/* Persistent Flagship Unread Badge Banner */}
        <Link
          href="/since-last-checked"
          className="group block bg-gradient-to-r from-brand-500/10 via-teal-500/10 to-surfaceElevated border border-brand-500/30 hover:border-brand-500/60 rounded-2xl p-4 mb-6 transition-all shadow-md active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
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
                      {unreadCount} {t("new_badge")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {unreadCount > 0
                    ? `${unreadCount} ${t("events_logged")}`
                    : t("no_new_events")}
                </p>
              </div>
            </div>

            <div className="text-xs font-semibold text-brand-500 flex items-center space-x-1 group-hover:translate-x-1 transition-transform font-mono">
              <span>{t("view_diff")}</span>
              <span>→</span>
            </div>
          </div>
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
                        <span className="bg-redwood-bg text-redwood-text border border-redwood-border text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-sm">
                          🔴 {t("stale_badge")}
                        </span>
                      )}
                      {item.latestEvent?.confidenceTier === "CONFIRMED" && (
                        <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                          FILING
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate mt-0.5 font-medium">
                      {item.name} • <span className="opacity-80">{t(`sector_${item.sector.toLowerCase()}`) || item.sector}</span>
                    </div>
                    {item.notes && (
                      <div className="text-[11px] text-muted italic mt-1 bg-badgeBg inline-block px-2 py-0.5 rounded border border-surfaceBorder">
                        "{item.notes}"
                      </div>
                    )}
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

                    {/* Quick Micro-Actions: Mark item seen or Remove */}
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
    </div>
  );
}
