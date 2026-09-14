"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Bot, Wrench, LogOut, Sun, Moon } from "lucide-react";
import { watchlistApi, debugApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "next-themes";
import { DhyanLogo } from "@/components/DhyanLogo";

interface HeaderProps {
  watchlistId?: string;
  onToggleDebug?: () => void;
  onToggleChat?: () => void;
  onOpenSearch?: () => void;
  showDebug?: boolean;
  feedStatus?: any;
}

export function Header({
  watchlistId,
  onToggleDebug,
  onToggleChat,
  onOpenSearch,
  showDebug,
  feedStatus: feedStatusProp,
}: HeaderProps) {
  const router = useRouter();
  const { language, setLanguage, t } = useI18n();
  const { theme, setTheme } = useTheme();

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [internalFeedStatus, setInternalFeedStatus] = useState<any>({
    status: "active",
    mode: "live",
    message: "Feed operating normally",
  });

  const feedStatus = feedStatusProp || internalFeedStatus;

  const indices = [
    { name: "NIFTY 50", value: "24,852.15", change: "+0.42%", isPos: true },
    { name: "SENSEX", value: "81,332.72", change: "+0.38%", isPos: true },
    { name: "BANK NIFTY", value: "51,215.40", change: "-0.15%", isPos: false },
    { name: "INDIA VIX", value: "12.29", change: "+4.15%", isPos: true },
  ];

  const fetchUnread = async () => {
    if (!watchlistId) return;
    try {
      const res = await watchlistApi.getUnreadCount(watchlistId);
      setUnreadCount(res.unreadCount || 0);
    } catch (e) {}
  };

  const fetchStatus = async () => {
    try {
      const res = await debugApi.getFeedStatus();
      setInternalFeedStatus(res);
    } catch (e) {}
  };

  useEffect(() => {
    fetchUnread();
    fetchStatus();
    const interval = setInterval(() => { fetchUnread(); fetchStatus(); }, 5000);
    return () => clearInterval(interval);
  }, [watchlistId]);

  const handleLogout = () => {
    localStorage.removeItem("dhyan_token");
    localStorage.removeItem("dhyan_user");
    router.push("/login");
  };

  const feedDot =
    feedStatus.status === "killed" ? "bg-redwood-500 animate-pulse"
    : feedStatus.mode === "stale_partial" ? "bg-amber-500 animate-pulse"
    : feedStatus.mode === "simulated" ? "bg-amber-500"
    : "bg-emerald-500 animate-pulse";

  const feedLabel =
    feedStatus.status === "killed" ? t("feed_killed")
    : feedStatus.mode === "stale_partial"
    ? (t("feed_stale_partial") || `FEED: LIVE (${feedStatus.staleCount} STALE)`).replace("{count}", String(feedStatus.staleCount || 1))
    : feedStatus.mode === "simulated" ? t("feed_simulated")
    : t("feed_live");

  const feedBg =
    feedStatus.status === "killed" ? "bg-redwood-bg border-redwood-border text-redwood-text"
    : feedStatus.mode === "stale_partial" ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/50 text-amber-800 dark:text-amber-300"
    : feedStatus.mode === "simulated" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
    : "bg-surfaceElevated border-surfaceBorder text-foreground";

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-surfaceBorder">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <DhyanLogo size="sm" />
          <div>
            <span className="font-extrabold tracking-tight text-foreground text-base sm:text-lg group-hover:text-brand-500 transition-colors flex items-center gap-1">
              {t("app_title")}
              <span className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 font-mono font-bold border border-brand-500/20">
                PRO
              </span>
            </span>
            <span className="text-[9px] sm:text-[10px] text-muted uppercase tracking-wider block font-semibold">
              {t("app_subtitle")}
            </span>
          </div>
        </Link>

        {/* Search omnibar -- desktop only */}
        <div className="hidden sm:flex flex-1 max-w-sm mx-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-full bg-surfaceElevated hover:bg-surface border border-surfaceBorder text-muted hover:text-foreground text-xs font-medium transition-all shadow-inner hover:shadow-sm group"
          >
            <div className="flex items-center space-x-2">
              <svg className="w-3.5 h-3.5 text-muted group-hover:text-brand-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Search stocks, filings, catalysts...</span>
            </div>
            <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-surface border border-surfaceBorder rounded text-muted">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Feed status badge -- large desktop only */}
          <div className={`hidden xl:flex items-center space-x-1.5 border rounded-full px-3 py-1 text-xs font-mono ${feedBg}`}>
            <span className={`w-2 h-2 rounded-full ${feedDot}`} />
            <span>{feedLabel}</span>
          </div>

          {/* Ask Dhyan -- icon only on mobile */}
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              className="min-h-[40px] min-w-[40px] px-2 sm:px-3 rounded-full bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 text-brand-600 dark:text-brand-400 flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95"
            >
              <Bot className="w-4 h-4 text-brand-500 shrink-0" />
              <span className="hidden sm:inline">{t("ask_dhyan")}</span>
            </button>
          )}

          {/* Bell with unread badge */}
          {watchlistId && (
            <Link
              href="/since-last-checked"
              className="relative min-h-[40px] min-w-[40px] px-2 rounded-full bg-surface hover:bg-surfaceElevated border border-surfaceBorder text-foreground flex items-center justify-center gap-1 text-xs font-semibold transition-all active:scale-95"
            >
              <Bell className="w-4 h-4 shrink-0" />
              {unreadCount > 0 && (
                <span className="bg-brand-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Language toggle */}
          <button
            onClick={() => setLanguage(language === "en" ? "hi" : "en")}
            className="min-h-[40px] min-w-[40px] rounded-full bg-surface border border-surfaceBorder text-foreground flex items-center justify-center text-[11px] font-bold font-mono transition-all hover:bg-surfaceElevated"
            title="Toggle Language"
          >
            {language === "en" ? "EN" : "HI"}
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="min-h-[40px] min-w-[40px] rounded-full bg-surface border border-surfaceBorder text-foreground flex items-center justify-center transition-all hover:bg-surfaceElevated"
            title="Toggle Theme"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Debug -- hidden on mobile */}
          {onToggleDebug && (
            <button
              onClick={onToggleDebug}
              className={`hidden sm:flex min-h-[40px] min-w-[40px] rounded-full border items-center justify-center text-xs transition-all ${
                showDebug ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-surface border-surfaceBorder text-muted hover:text-foreground"
              }`}
              title="Debug Panel"
            >
              <Wrench className="w-4 h-4" />
            </button>
          )}

          {/* Logout -- hidden on mobile */}
          <button
            onClick={handleLogout}
            className="hidden sm:flex min-h-[40px] min-w-[40px] rounded-full bg-surface hover:bg-surfaceElevated border border-surfaceBorder text-muted hover:text-rose-500 items-center justify-center transition-all"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Market Ticker Strip */}
      <div className="border-t border-surfaceBorder/60 bg-surfaceElevated/40 px-3 sm:px-4 py-1.5 overflow-x-auto scrollbar-none">
        <div className="max-w-5xl mx-auto flex items-center gap-3 sm:gap-4 text-[11px] font-mono whitespace-nowrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted shrink-0 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Markets
          </span>
          <div className="h-3 w-px bg-surfaceBorder shrink-0" />
          {indices.map((idx) => (
            <div key={idx.name} className="flex items-center gap-1 shrink-0">
              <span className="text-muted font-medium">{idx.name}</span>
              <span className="font-bold text-foreground">{idx.value}</span>
              <span className={`font-semibold px-1 rounded text-[10px] ${idx.isPos ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                {idx.isPos ? "\u25b2" : "\u25bc"} {idx.change}
              </span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
