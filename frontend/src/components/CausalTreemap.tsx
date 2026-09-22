"use client";

import React from "react";
import { WatchlistItemPrice } from "@/lib/api";
import { ShieldCheck, Zap, AlertTriangle, Activity, TrendingUp, TrendingDown, Clock } from "lucide-react";

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
    <div className="space-y-3">
      {/* Legend & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 font-medium">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Causal Evidence Treemap (Tile sizing = Avg Liquidity | Color = Evidence Tier)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
            <span className="text-emerald-300 font-medium">Confirmed Catalyst</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shadow-sm shadow-amber-500/50"></span>
            <span className="text-amber-300 font-medium">Unexplained Flow</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-600"></span>
            <span className="text-slate-300 font-medium">Beta Aligned</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
            <span className="text-rose-300 font-medium">Stale / Uncertain</span>
          </div>
        </div>
      </div>

      {/* Responsive Treemap Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item) => {
          const tier = item.latestEvent?.confidenceTier || (item.isStale ? "UNCERTAIN" : "BETA");
          const isConfirmed = tier === "CONFIRMED";
          const isUnexplained = tier === "UNEXPLAINED";
          const isUncertain = tier === "UNCERTAIN" || item.isStale;
          const isBeta = !isConfirmed && !isUnexplained && !isUncertain;

          const isUp = item.changePct >= 0;
          const ghost = item.ghostPosition;

          // Color & border styles mapped to Dhyan evidence tiers
          let cardStyle = "bg-slate-900/90 border-slate-800 hover:border-slate-600";
          let badgeColor = "bg-slate-800 text-slate-400 border-slate-700";
          let badgeText = "Beta Aligned";
          let IconComponent = Activity;

          if (isConfirmed) {
            cardStyle = "bg-gradient-to-br from-emerald-950/80 to-slate-900 border-emerald-600/80 shadow-lg shadow-emerald-950/40 hover:border-emerald-400";
            badgeColor = "bg-emerald-900/60 text-emerald-300 border-emerald-700";
            badgeText = "Reg 30 Confirmed";
            IconComponent = ShieldCheck;
          } else if (isUnexplained) {
            cardStyle = "bg-gradient-to-br from-amber-950/80 to-slate-900 border-amber-500/80 shadow-lg shadow-amber-950/40 hover:border-amber-400";
            badgeColor = "bg-amber-900/60 text-amber-300 border-amber-600";
            badgeText = "Volume Divergence";
            IconComponent = Zap;
          } else if (isUncertain) {
            cardStyle = "bg-gradient-to-br from-rose-950/80 to-slate-900 border-rose-600/80 shadow-lg shadow-rose-950/40 hover:border-rose-400";
            badgeColor = "bg-rose-900/60 text-rose-300 border-rose-700";
            badgeText = "Stale / Uncertain";
            IconComponent = AlertTriangle;
          }

          return (
            <div
              key={item.id}
              onClick={() => onSelectItem && onSelectItem(item)}
              className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[140px] group relative overflow-hidden ${cardStyle}`}
            >
              {/* Top Row: Symbol, Sector, Evidence Badge */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base text-white tracking-wide group-hover:text-emerald-400 transition-colors">
                      {item.symbol.replace("NSE:", "")}
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                      {item.sector}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                    {item.name}
                  </div>
                </div>

                {/* Evidence Tier Badge */}
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeColor}`}>
                  <IconComponent className="w-3 h-3" />
                  <span>{badgeText}</span>
                </div>
              </div>

              {/* Middle Row: LTP & Change % */}
              <div className="my-2 flex items-baseline justify-between">
                <div>
                  <div className="text-lg font-mono font-bold text-white">
                    ₹{item.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Vol: {item.volumeRatio ? `${item.volumeRatio}x avg` : `${(item.volume / 100000).toFixed(1)}L`}
                  </div>
                </div>

                <div className={`flex items-center gap-1 font-mono font-bold text-sm px-2 py-1 rounded ${
                  isUp ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40" : "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                }`}>
                  {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{isUp ? "+" : ""}{item.changePct.toFixed(2)}%</span>
                </div>
              </div>

              {/* Bottom: Ghost Portfolio / Catalyst Snippet */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                {ghost && ghost.hypotheticalAmount ? (
                  <div className="flex items-center gap-1 text-slate-300">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span className="text-slate-400">Ghost P&L:</span>
                    <span className={`font-mono font-bold ${ghost.hesitationReturnPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {ghost.hesitationReturnPct >= 0 ? "+" : ""}₹{Math.abs(ghost.opportunityCost || 0).toLocaleString("en-IN")} ({ghost.hesitationReturnPct >= 0 ? "+" : ""}{ghost.hesitationReturnPct}%)
                    </span>
                  </div>
                ) : item.latestEvent?.filingTitle ? (
                  <div className="text-emerald-400/90 truncate text-[10px] italic">
                    📄 {item.latestEvent.filingTitle}
                  </div>
                ) : (
                  <div className="text-slate-500 text-[10px]">
                    Added {new Date(item.addedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                  </div>
                )}

                <span className="text-[10px] text-slate-400 group-hover:text-white transition-colors">
                  Details →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
