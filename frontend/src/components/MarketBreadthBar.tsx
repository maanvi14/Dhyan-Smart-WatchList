"use client";

import React from "react";
import { MarketBreadthData } from "@/lib/api";
import { Activity, TrendingUp, TrendingDown, Gauge } from "lucide-react";

interface MarketBreadthBarProps {
  data: MarketBreadthData | null;
  loading?: boolean;
}

export const MarketBreadthBar: React.FC<MarketBreadthBarProps> = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between animate-pulse text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-spin" />
          <span>Syncing Nifty 50 Sector Breadth & Macro Beta...</span>
        </div>
      </div>
    );
  }

  const isAdvancing = data.breadthState === "ADVANCING";
  const isDeclining = data.breadthState === "DECLINING";

  return (
    <div className="w-full bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all rounded-xl p-3 shadow-lg shadow-black/20 backdrop-blur-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        
        {/* Left: Overall Market Gauge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/60 text-xs font-semibold">
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">Macro Breadth:</span>
            <span className={`font-bold ${isAdvancing ? "text-emerald-400" : isDeclining ? "text-rose-400" : "text-amber-400"}`}>
              {data.breadthState} ({data.advancingSectors}▲ / {data.decliningSectors}▼)
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <span>Avg Sector Momentum:</span>
            <span className={`font-mono font-bold ${data.averageSectorChangePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {data.averageSectorChangePct >= 0 ? "+" : ""}{data.averageSectorChangePct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Right: Sector Pill Trackers */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {data.sectors.map((s) => {
            const isUp = s.changePct > 0;
            const isDown = s.changePct < 0;
            return (
              <div
                key={s.sector}
                title={`${s.sector}: ${s.advances} Advancing, ${s.declines} Declining, ${s.unchanged} Unchanged`}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors shrink-0 ${
                  isUp
                    ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
                    : isDown
                    ? "bg-rose-950/40 border-rose-800/50 text-rose-300"
                    : "bg-slate-800/60 border-slate-700/40 text-slate-400"
                }`}
              >
                <span>{s.sector}</span>
                <span className="font-mono text-[10px] font-bold">
                  {isUp ? "+" : ""}{s.changePct.toFixed(1)}%
                </span>
                {isUp ? (
                  <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                ) : isDown ? (
                  <TrendingDown className="w-2.5 h-2.5 text-rose-400" />
                ) : null}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
