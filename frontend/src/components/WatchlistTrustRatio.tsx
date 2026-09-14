"use client";

import { ShieldCheck, Activity, AlertCircle, Info } from "lucide-react";
import { TrustRatioData } from "@/lib/api";
import { TIER_LABELS } from "@/lib/tiers";

interface WatchlistTrustRatioProps {
  data?: TrustRatioData | null;
}

export function WatchlistTrustRatio({ data }: WatchlistTrustRatioProps) {
  if (!data || data.total === 0) {
    return null;
  }

  const confirmedPct = data.confirmedPct;
  const uninformedPct = data.uninformedPct;
  const stalePct = data.stalePct;

  return (
    <div className="bg-surfaceElevated border border-surfaceBorder rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-brand-500" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
            Signal Quality · 7 Day
          </span>
        </div>
        <span className="text-[11px] font-mono text-muted">
          {data.total} {data.total === 1 ? "event" : "events"} classified
        </span>
      </div>

      {/* 3-Color Segmented Progress Bar */}
      <div className="w-full h-3 bg-surface rounded-full overflow-hidden flex border border-surfaceBorder/80 mb-3">
        {confirmedPct > 0 && (
          <div
            style={{ width: `${confirmedPct}%` }}
            className="h-full bg-emerald-500 transition-all duration-500"
            title={`${TIER_LABELS.CONFIRMED}: ${confirmedPct}%`}
          />
        )}
        {uninformedPct > 0 && (
          <div
            style={{ width: `${uninformedPct}%` }}
            className="h-full bg-amber-400 transition-all duration-500"
            title={`${TIER_LABELS.UNEXPLAINED}: ${uninformedPct}%`}
          />
        )}
        {stalePct > 0 && (
          <div
            style={{ width: `${stalePct}%` }}
            className="h-full bg-rose-500 transition-all duration-500"
            title={`${TIER_LABELS.UNCERTAIN}: ${stalePct}%`}
          />
        )}
      </div>

      {/* Legend & Percentages */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px] font-mono">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-foreground font-semibold truncate">{TIER_LABELS.CONFIRMED}:</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-bold shrink-0">{confirmedPct}%</span>
        </div>

        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="text-foreground font-semibold truncate">{TIER_LABELS.UNEXPLAINED}:</span>
          <span className="text-amber-700 dark:text-amber-400 font-bold shrink-0">{uninformedPct}%</span>
        </div>

        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
          <span className="text-foreground font-semibold truncate">{TIER_LABELS.UNCERTAIN}:</span>
          <span className="text-rose-700 dark:text-rose-400 font-bold shrink-0">{stalePct}%</span>
        </div>
      </div>
    </div>
  );
}
