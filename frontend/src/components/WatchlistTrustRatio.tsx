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
    <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-brand-500" />
          <span className="text-xs font-mono font-bold tracking-wide text-foreground">
            Signal Quality · 7 Day
          </span>
        </div>
        <span className="text-[11px] font-mono text-muted">
          {data.total} {data.total === 1 ? "event" : "events"} classified
        </span>
      </div>

      {/* 3-Color Segmented Progress Bar */}
      <div className="w-full h-2 bg-slate-100 dark:bg-surfaceElevated rounded-full overflow-hidden flex border border-slate-200 dark:border-surfaceBorder/60 mb-3">
        {confirmedPct > 0 && (
          <div
            style={{ width: `${confirmedPct}%` }}
            className="h-full bg-emerald-500 transition-all duration-500"
            title={`Catalyst Confirmed: ${confirmedPct}%`}
          />
        )}
        {uninformedPct > 0 && (
          <div
            style={{ width: `${uninformedPct}%` }}
            className="h-full bg-amber-500 transition-all duration-500"
            title={`Uninformed Flow: ${uninformedPct}%`}
          />
        )}
        {stalePct > 0 && (
          <div
            style={{ width: `${stalePct}%` }}
            className="h-full bg-rose-500 dark:bg-rose-500 transition-all duration-500"
            title={`Stale Quote: ${stalePct}%`}
          />
        )}
      </div>

      {/* Legend & Percentages */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-slate-600 dark:text-slate-300 font-medium">Confirmed:</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-bold font-mono">{confirmedPct}%</span>
        </div>

        <div className="flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span className="text-slate-600 dark:text-slate-300 font-medium">Uninformed:</span>
          <span className="text-amber-700 dark:text-amber-400 font-bold font-mono">{uninformedPct}%</span>
        </div>

        <div className="flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          <span className="text-slate-600 dark:text-slate-300 font-medium">Stale:</span>
          <span className="text-rose-700 dark:text-rose-400 font-bold font-mono">{stalePct}%</span>
        </div>
      </div>
    </div>
  );
}
