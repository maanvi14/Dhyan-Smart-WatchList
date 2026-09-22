"use client";

import React from "react";
import { WatchlistItemPrice } from "@/lib/api";
import { ShieldCheck, Zap, AlertTriangle, Activity, TrendingUp, TrendingDown, Clock, ChevronRight } from "lucide-react";

interface CausalTreemapProps {
  items: WatchlistItemPrice[];
  onSelectItem?: (item: WatchlistItemPrice) => void;
}

export const CausalTreemap: React.FC<CausalTreemapProps> = ({ items, onSelectItem }) => {
  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
        No stocks in watchlist to render Causal Treemap.
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Legend & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
          <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Causal Evidence Treemap</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
          <div className="flex items-center gap-1.5 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
            <span className="text-emerald-300 font-medium">Reg 30 Confirmed</span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-800/40">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"></span>
            <span className="text-amber-300 font-medium">Unexplained Flow</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-800/40 px-2 py-0.5 rounded-md border border-slate-700/40">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span className="text-slate-300 font-medium">Sector Beta</span>
          </div>
          <div className="flex items-center gap-1.5 bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-800/40">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span className="text-rose-300 font-medium">Stale Quote</span>
          </div>
        </div>
      </div>

      {/* Responsive Treemap Grid (Mobile 1 col, Tablet 2 col, Laptop 3 col, Desktop 4 col) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {items.map((item) => {
          const tier = item.latestEvent?.confidenceTier || (item.isStale ? "UNCERTAIN" : "BETA");
          const isConfirmed = tier === "CONFIRMED";
          const isUnexplained = tier === "UNEXPLAINED";
          const isUncertain = tier === "UNCERTAIN" || item.isStale;
          const isUp = item.changePct >= 0;
          const ghost = item.ghostPosition;

          // Color & border styles mapped to Dhyan evidence tiers
          let cardStyle = "bg-slate-900/90 border-slate-800 hover:border-slate-600";
          let badgeColor = "bg-slate-800/80 text-slate-300 border-slate-700/80";
          let badgeText = "Beta Move";
          let IconComponent = Activity;

          if (isConfirmed) {
            cardStyle = "bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border-emerald-500/60 shadow-lg shadow-emerald-950/30 hover:border-emerald-400";
            badgeColor = "bg-emerald-950 border-emerald-600/80 text-emerald-300";
            badgeText = "Reg 30";
            IconComponent = ShieldCheck;
          } else if (isUnexplained) {
            cardStyle = "bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-900 border-amber-500/60 shadow-lg shadow-amber-950/30 hover:border-amber-400";
            badgeColor = "bg-amber-950 border-amber-600/80 text-amber-300";
            badgeText = "Flow Divergence";
            IconComponent = Zap;
          } else if (isUncertain) {
            cardStyle = "bg-gradient-to-br from-rose-950/60 via-slate-900 to-slate-900 border-rose-600/60 shadow-lg shadow-rose-950/30 hover:border-rose-400";
            badgeColor = "bg-rose-950 border-rose-600/80 text-rose-300";
            badgeText = "Stale Quote";
            IconComponent = AlertTriangle;
          }

          return (
            <div
              key={item.id}
              onClick={() => onSelectItem && onSelectItem(item)}
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[145px] group relative overflow-hidden ${cardStyle}`}
            >
              {/* Top Row: Symbol, Sector, Evidence Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-base text-white tracking-tight group-hover:text-emerald-400 transition-colors">
                      {item.symbol.replace("NSE:", "")}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 font-medium">
                      {item.sector}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5 font-medium" title={item.name}>
                    {item.name}
                  </div>
                </div>

                {/* Evidence Tier Badge */}
                <div className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${badgeColor} whitespace-nowrap`}>
                  <IconComponent className="w-3 h-3 shrink-0" />
                  <span>{badgeText}</span>
                </div>
              </div>

              {/* Middle Row: LTP & Change % */}
              <div className="my-2.5 flex items-baseline justify-between">
                <div>
                  <div className="text-lg sm:text-xl font-mono font-extrabold text-white">
                    ₹{item.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Vol: {item.volumeRatio ? `${item.volumeRatio}x avg` : `${(item.volume / 100000).toFixed(1)}L`}
                  </div>
                </div>

                <div className={`shrink-0 flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-1 rounded-xl ${
                  isUp ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60" : "bg-rose-950/80 text-rose-400 border border-rose-800/60"
                }`}>
                  {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{isUp ? "+" : ""}{item.changePct.toFixed(2)}%</span>
                </div>
              </div>

              {/* Bottom: Ghost Portfolio / Catalyst Snippet */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] gap-2">
                {ghost && ghost.hypotheticalAmount ? (
                  <div className="flex items-center gap-1 text-slate-300 min-w-0 truncate">
                    <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="text-slate-400 shrink-0">Ghost:</span>
                    <span className={`font-mono font-bold truncate ${ghost.hesitationReturnPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {ghost.hesitationReturnPct >= 0 ? "+" : ""}₹{Math.abs(ghost.opportunityCost || 0).toLocaleString("en-IN")} ({ghost.hesitationReturnPct >= 0 ? "+" : ""}{ghost.hesitationReturnPct}%)
                    </span>
                  </div>
                ) : item.latestEvent?.filingTitle ? (
                  <div className="text-emerald-400/90 truncate text-[10px] italic flex-1" title={item.latestEvent.filingTitle}>
                    📄 {item.latestEvent.filingTitle}
                  </div>
                ) : (
                  <div className="text-slate-400 text-[10px]">
                    Tracked since {new Date(item.addedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                  </div>
                )}

                <div className="text-[10px] font-semibold text-slate-400 group-hover:text-emerald-300 transition-colors flex items-center gap-0.5 shrink-0">
                  <span>Trace</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
