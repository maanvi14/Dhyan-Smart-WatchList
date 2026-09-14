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
    { name: "SENSEX",   value: "81,332.72", change: "+0.38%", isPos: true },
    { name: "BANK NIFTY", value: "51,215.40", change: "-0.15%", isPos: false },
    { name: "INDIA VIX", value: "12.29",     change: "+4.15%", isPos: true },
  ];

  const fetchUnread = async () => {
    if (!watchlistId) return;
    try { const res = await watchlistApi.getUnreadCount(watchlistId); setUnreadCount(res.unreadCount || 0); } catch {}
  };
  const fetchStatus = async () => {
    try { const res = await debugApi.getFeedStatus(); setInternalFeedStatus(res); } catch {}
  };

  useEffect(() => {
    fetchUnread(); fetchStatus();
    const interval = setInterval(() => { fetchUnread(); fetchStatus(); }, 5000);
    return () => clearInterval(interval);
  }, [watchlistId]);

  const handleLogout = () => {
    localStorage.removeItem("dhyan_token");
    localStorage.removeItem("dhyan_user");
    router.push("/login");
  };

  const isAlerted = feedStatus.status === "killed" || feedStatus.mode === "stale_partial" || feedStatus.mode === "simulated";

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-surfaceBorder">
      {/* Main nav row */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <DhyanLogo size="sm" />
          <div className="leading-tight">
            <div className="font-extrabold tracking-tight text-foreground text-[15px] sm:text-base group-hover:text-brand-500 transition-colors flex items-center gap-1">
              {t("app_title")}
              <span className="text-[7px] sm:text-[8px] px-1 rounded bg-brand-500/15 text-brand-600 dark:text-brand-400 font-mono font-bold border border-brand-500/20 leading-4">
                PRO
              </span>
            </div>
            <div className="text-[9px] text-muted uppercase tracking-widest font-semibold">
              {t("app_subtitle")}
            </div>
          </div>
        </Link>

        {/* Desktop search */}
        <div className="hidden md:flex flex-1 max-w-xs mx-3">
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-full bg-surfaceElevated hover:bg-surface border border-surfaceBorder text-muted hover:text-foreground text-xs font-medium transition-all"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Search stocks...</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Feed alert dot on mobile */}
          {isAlerted && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse xl:hidden" title="Feed Alert" />
          )}

          {/* Feed status — desktop only */}
          <div className={`hidden xl:flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs font-mono ${
            feedStatus.status === "killed" ? "bg-redwood-bg border-redwood-border text-redwood-text"
            : isAlerted ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/50 text-amber-800 dark:text-amber-300"
            : "bg-surfaceElevated border-surfaceBorder text-foreground"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              feedStatus.status === "killed" ? "bg-redwood-500 animate-pulse"
              : feedStatus.mode === "stale_partial" ? "bg-amber-500 animate-pulse"
              : feedStatus.mode === "simulated" ? "bg-amber-400"
              : "bg-emerald-500 animate-pulse"
            }`} />
            <span>
              {feedStatus.status === "killed"
                ? t("feed_killed")
                : feedStatus.mode === "stale_partial"
                ? (t("feed_stale_partial") || `FEED: LIVE (${feedStatus.staleCount} STALE)`).replace("{count}", String(feedStatus.staleCount || 1))
                : feedStatus.mode === "simulated"
                ? t("feed_simulated")
                : t("feed_live")}
            </span>
          </div>

          {/* Ask Dhyan */}
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              className="h-9 min-w-[36px] px-2 sm:px-3 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/25 text-brand-600 dark:text-brand-400 flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95"
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline text-[11px]">{t("ask_dhyan")}</span>
            </button>
          )}

          {/* Bell */}
          {watchlistId && (
            <Link
              href="/since-last-checked"
              className="relative h-9 min-w-[36px] px-2 rounded-lg bg-surface hover:bg-surfaceElevated border border-surfaceBorder flex items-center justify-center gap-1 text-xs font-semibold transition-all active:scale-95"
            >
              <Bell className="w-4 h-4 shrink-0" />
              {unreadCount > 0 && (
                <span className="bg-brand-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Language */}
          <button
            onClick={() => setLanguage(language === "en" ? "hi" : "en")}
            className="h-9 min-w-[36px] rounded-lg bg-surface border border-surfaceBorder text-foreground flex items-center justify-center text-[11px] font-bold font-mono transition-all hover:bg-surfaceElevated"
          >
            {language === "en" ? "EN" : "HI"}
          </button>

          {/* Theme */}
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="h-9 w-9 rounded-lg bg-surface border border-surfaceBorder text-foreground flex items-center justify-center transition-all hover:bg-surfaceElevated"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Debug — desktop only */}
          {onToggleDebug && (
            <button
              onClick={onToggleDebug}
              className={`hidden sm:flex h-9 w-9 rounded-lg border items-center justify-center transition-all ${
                showDebug ? "bg-amber-500/20 border-amber-500/40 text-amber-500" : "bg-surface border-surfaceBorder text-muted hover:text-foreground"
              }`}
            >
              <Wrench className="w-4 h-4" />
            </button>
          )}

          {/* Logout — desktop only */}
          <button
            onClick={handleLogout}
            className="hidden sm:flex h-9 w-9 rounded-lg bg-surface hover:bg-surfaceElevated border border-surfaceBorder text-muted hover:text-rose-500 items-center justify-center transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ticker strip */}
      <div className="border-t border-surfaceBorder/50 bg-surfaceElevated/50 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-4 px-3 sm:px-4 py-1 text-[10px] sm:text-[11px] font-mono whitespace-nowrap min-w-0">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted shrink-0 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            MKTS
          </span>
          {indices.map((idx) => (
            <div key={idx.name} className="flex items-center gap-1 shrink-0">
              <span className="text-muted">{idx.name}</span>
              <span className="font-bold text-foreground">{idx.value}</span>
              <span className={`font-semibold ${ idx.isPos ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400" }`}>
                {idx.isPos ? "▲" : "▼"}{idx.change}
              </span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
