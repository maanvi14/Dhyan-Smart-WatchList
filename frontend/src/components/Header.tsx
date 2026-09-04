"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Bot, Wrench, LogOut, Sun, Moon, Languages } from "lucide-react";
import { watchlistApi, debugApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "next-themes";
import { DhyanLogo } from "@/components/DhyanLogo";

interface HeaderProps {
  watchlistId?: string;
  onToggleDebug?: () => void;
  onToggleChat?: () => void;
  showDebug?: boolean;
}

export function Header({ watchlistId, onToggleDebug, onToggleChat, showDebug }: HeaderProps) {
  const router = useRouter();
  const { language, setLanguage, t } = useI18n();
  const { theme, setTheme } = useTheme();

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [feedStatus, setFeedStatus] = useState<any>({
    status: "active",
    mode: "live",
    message: "Feed operating normally"
  });

  const fetchUnread = async () => {
    if (!watchlistId) return;
    try {
      const res = await watchlistApi.getUnreadCount(watchlistId);
      setUnreadCount(res.unreadCount || 0);
    } catch (e) {
      // ignore
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await debugApi.getFeedStatus();
      setFeedStatus(res);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchUnread();
    fetchStatus();
    const interval = setInterval(() => {
      fetchUnread();
      fetchStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [watchlistId]);

  const handleLogout = () => {
    localStorage.removeItem("dhyan_token");
    localStorage.removeItem("dhyan_user");
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-surfaceBorder px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        
        {/* Brand & Dhyan Logo */}
        <Link href="/" className="flex items-center space-x-2.5 group">
          <DhyanLogo size="sm" />
          <div>
            <span className="font-bold tracking-tight text-foreground text-lg group-hover:text-brand-500 transition-colors">
              {t("app_title")}
            </span>
            <span className="text-[10px] text-muted uppercase tracking-widest block font-medium">
              {t("app_subtitle")}
            </span>
          </div>
        </Link>

        {/* Status & Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          
          {/* Feed Status Indicator */}
          <div className={`hidden md:flex items-center space-x-1.5 border rounded-full px-3 py-1 text-xs font-mono ${
            feedStatus.status === "killed"
              ? "bg-redwood-bg border-redwood-border text-redwood-text"
              : feedStatus.mode === "stale_partial"
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/50 text-amber-800 dark:text-amber-300"
              : feedStatus.mode === "simulated"
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
              : "bg-surfaceElevated border-surfaceBorder text-foreground"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              feedStatus.status === "killed"
                ? "bg-redwood-500 animate-pulse"
                : feedStatus.mode === "stale_partial"
                ? "bg-amber-500 animate-pulse"
                : feedStatus.mode === "simulated"
                ? "bg-amber-500"
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

          {/* Ask Dhyan Chat Button */}
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 text-brand-500 flex items-center space-x-1.5 text-xs font-semibold transition-all active:scale-95"
            >
              <Bot className="w-4 h-4 text-brand-500" />
              <span className="hidden xs:inline">{t("ask_dhyan")}</span>
            </button>
          )}

          {/* Unread Badge Link */}
          {watchlistId && (
            <Link
              href="/since-last-checked"
              className="relative min-h-[44px] px-3 py-2 rounded-xl bg-surface hover:bg-surfaceElevated border border-surfaceBorder text-foreground flex items-center space-x-1.5 text-xs font-semibold transition-all active:scale-95"
            >
              <Bell className="w-4 h-4 text-foreground" />
              <span className="hidden xs:inline">{t("changes_badge")}</span>
              {unreadCount > 0 && (
                <span className="bg-brand-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full text-[11px] font-mono">
                  {unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === "en" ? "hi" : "en")}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-surface border border-surfaceBorder text-foreground flex items-center justify-center text-xs font-bold font-mono transition-all hover:bg-surfaceElevated"
            title="Toggle Language (English / Hindi)"
          >
            {language === "en" ? "EN" : "HI"}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-surface border border-surfaceBorder text-foreground flex items-center justify-center text-xs transition-all hover:bg-surfaceElevated"
            title="Toggle Theme"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Debug Toggle */}
          {onToggleDebug && (
            <button
              onClick={onToggleDebug}
              className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center text-xs transition-all ${
                showDebug
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                  : "bg-surface border-surfaceBorder text-muted hover:text-foreground"
              }`}
              title="Demo Debug Panel"
            >
              <Wrench className="w-4 h-4" />
            </button>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-surface hover:bg-surfaceElevated border border-surfaceBorder text-muted hover:text-foreground flex items-center justify-center text-xs transition-all"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
}
