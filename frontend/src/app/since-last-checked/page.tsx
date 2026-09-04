"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { EvidenceTraceView } from "@/components/EvidenceTraceView";
import { VisualEvidenceCard } from "@/components/VisualEvidenceCard";
import { VoiceBriefingButton } from "@/components/VoiceBriefingButton";
import { watchlistApi, ChangeEventData, User } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, ShieldCheck, FileText, Sparkles } from "lucide-react";

export default function SinceLastCheckedPage() {
  const router = useRouter();
  const { language, t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<ChangeEventData[]>([]);
  const [hasSilenceEvent, setHasSilenceEvent] = useState(false);
  const [story, setStory] = useState<{ en: string; hi: string } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [markingSeen, setMarkingSeen] = useState(false);

  const loadEvents = async () => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("dhyan_user") : null;
    if (!storedUser) {
      setLoading(false);
      router.push("/login");
      return;
    }
    const u: User = JSON.parse(storedUser);
    setUser(u);

    try {
      const res = await watchlistApi.getSinceLastChecked(u.watchlistId);
      setEvents(res.events || []);
      setHasSilenceEvent(Boolean(res.hasSilenceEvent));
      if (res.story) setStory(res.story);
    } catch (e) {
      console.error("Failed to load events", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const handleMarkSeen = async () => {
    if (!user) return;
    setMarkingSeen(true);
    try {
      await watchlistApi.markSeen(user.watchlistId);
      router.push("/");
    } catch (e) {
      console.error("Failed to mark as seen", e);
    } finally {
      setMarkingSeen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted text-xs font-mono">
        Loading verified change diffs...
      </div>
    );
  }

  const getTierBadge = (tier: "CONFIRMED" | "UNEXPLAINED" | "UNCERTAIN") => {
    if (tier === "CONFIRMED") {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30">
          <span>{t("tier_confirmed_short") || "🟢 CONFIRMED"}</span>
        </span>
      );
    } else if (tier === "UNEXPLAINED") {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30">
          <span>{t("tier_unexplained_short") || "🟡 UNEXPLAINED"}</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-redwood-50 text-redwood-text border border-redwood-border dark:bg-redwood-bg dark:text-redwood-text dark:border-redwood-border">
          <span>{t("tier_uncertain_short") || "🔴 UNCERTAIN"}</span>
        </span>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <Header watchlistId={user?.watchlistId} />

      <main className="max-w-4xl mx-auto px-4 pt-4">

        {/* Back Link */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-muted hover:text-foreground transition-colors min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t("back_to_watchlist")}</span>
          </Link>
        </div>

        {/* Header Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-surfaceBorder">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center space-x-2">
              <ShieldCheck className="w-6 h-6 text-brand-500" />
              <span>{t("since_last_checked")}</span>
            </h1>
            <p className="text-xs text-muted mt-1 font-sans">
              {events.length === 0
                ? (language === "hi" ? "आपकी पिछली विजिट के बाद से कोई नया बदलाव नहीं मिला।" : "No unread changes detected since your last visit.")
                : (language === "hi"
                  ? `आपके वॉटरमार्क के बाद से ${events.length} मार्केट ${events.length === 1 ? "इवेंट" : "इवेंट्स"} लॉग हुए।`
                  : `${events.length} market ${events.length === 1 ? "event" : "events"} logged since your watermark timestamp.`)}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* 60s Voice Briefing Button */}
            <VoiceBriefingButton story={story} />

            {events.length > 0 && (
              <button
                onClick={handleMarkSeen}
                disabled={markingSeen}
                className="min-h-[44px] px-4 py-2 bg-brand-500 hover:bg-brand-600 font-bold text-slate-950 rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 shadow-md shadow-brand-500/20 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>{markingSeen ? (language === "hi" ? "अपडेट हो रहा..." : "Updating...") : t("mark_all_seen")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Watchlist Executive Story Card (Data Storytelling) */}
        {story && (
          <div className="bg-gradient-to-r from-brand-500/10 via-surface to-surface border border-brand-500/30 rounded-2xl p-4 mb-4 shadow-md">
            <div className="flex items-center space-x-2 mb-1 text-xs font-bold text-brand-500 font-mono uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-brand-500" />
              <span>{language === "hi" ? "मार्केट सारांश" : "Executive Market Story"}</span>
            </div>
            <p className="text-xs text-foreground font-medium leading-relaxed font-sans">
              {language === "hi" ? story.hi : story.en}
            </p>
          </div>
        )}

        {/* Confidence Tier Legend */}
        <div className="bg-surface border border-surfaceBorder rounded-2xl p-3 mb-6 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted font-semibold text-[11px] uppercase tracking-wider">
            {t("confidence_tiers")}
          </span>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="text-emerald-500 font-medium">{t("tier_confirmed")}</span>
            <span className="text-amber-500 font-medium">{t("tier_unexplained")}</span>
            <span className="text-redwood-text font-medium">{t("tier_uncertain")}</span>
          </div>
        </div>

        {/* Events Feed or Empty / Confirmed Silence State */}
        {events.length === 0 ? (
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-foreground text-base mb-1">
              {t("confirmed_silence_title")}
            </h3>
            <p className="text-xs text-muted max-w-md mx-auto leading-relaxed mb-4">
              {t("confirmed_silence_desc")}
            </p>
            <Link
              href="/"
              className="inline-block min-h-[44px] px-5 py-2.5 bg-surfaceElevated hover:bg-surface font-semibold text-foreground text-xs rounded-xl transition-colors border border-surfaceBorder"
            >
              {t("return_to_watchlist")}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map(event => {
              const isExpanded = expandedIds.has(event.id);
              const tierBorderColor = event.confidenceTier === "CONFIRMED"
                ? "border-l-4 border-l-emerald-500"
                : event.confidenceTier === "UNEXPLAINED"
                ? "border-l-4 border-l-amber-500"
                : "border-l-4 border-l-redwood-500";

              return (
                <div
                  key={event.id}
                  className={`bg-surface border border-surfaceBorder hover:border-surfaceBorder/80 rounded-2xl p-4 transition-all shadow-md ${tierBorderColor}`}
                >
                  {/* Card Main Row */}
                  <div
                    onClick={() => toggleExpand(event.id)}
                    className="cursor-pointer min-h-[44px] flex items-start justify-between gap-3"
                  >
                    <div className="space-y-2 flex-1">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center space-x-2">
                        {getTierBadge(event.confidenceTier)}

                        <span className="font-bold text-foreground font-mono text-sm">
                          {event.symbol}
                        </span>

                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-badgeBg text-badgeText border border-surfaceBorder">
                          Mag {event.magnitude}/100
                        </span>

                        <span className="text-[11px] text-muted font-mono ml-auto">
                          {event.detectedAt ? new Date(event.detectedAt).toLocaleTimeString() : ""}
                        </span>
                      </div>

                      {/* AI Narrative */}
                      <p className="text-xs text-foreground font-medium leading-relaxed font-sans">
                        {event.narrative}
                      </p>

                      {/* Optional User Note attached to watchlist item */}
                      {event.notes && (
                        <div className="text-[11px] text-muted italic bg-badgeBg inline-flex items-center space-x-1 px-2.5 py-1 rounded-md border border-surfaceBorder">
                          <FileText className="w-3 h-3 text-muted" />
                          <span>Note: "{event.notes}"</span>
                        </div>
                      )}
                    </div>

                    {/* Expand Chevron Toggle */}
                    <button className="min-h-[44px] min-w-[44px] text-muted hover:text-foreground flex items-center justify-center shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-brand-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Evidence & Visual Cards */}
                  {isExpanded && (
                    <>
                      {/* Visual Evidence Suite: Sector Divergence Bar, Causal Timeline, Pattern Memory & Filing Viewer */}
                      <VisualEvidenceCard event={event} />

                      {/* Step-by-step audit trace */}
                      <EvidenceTraceView
                        trace={typeof event.evidenceTrace === "string" ? JSON.parse(event.evidenceTrace) : event.evidenceTrace}
                        confidenceTier={event.confidenceTier}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
