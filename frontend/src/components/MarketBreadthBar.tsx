"use client";

import React from "react";
import { MarketBreadthData } from "@/lib/api";
import { Activity, TrendingUp, TrendingDown, Gauge } from "lucide-react";

interface MarketBreadthBarProps {
  data: MarketBreadthData | null;
  loading?: boolean;
}

const DEFAULT_BREADTH_DATA: MarketBreadthData = {
  timestamp: new Date().toISOString(),
  totalSectors: 7,
  advancingSectors: 5,
  decliningSectors: 2,
  neutralSectors: 0,
  averageSectorChangePct: 0.84,
  breadthState: "ADVANCING",
  sectors: [
    { sector: "IT", changePct: 1.42, total: 5, advances: 4, declines: 1, unchanged: 0 },
    { sector: "Banking", changePct: 0.95, total: 6, advances: 5, declines: 1, unchanged: 0 },
    { sector: "Auto", changePct: 0.72, total: 4, advances: 3, declines: 1, unchanged: 0 },
    { sector: "Energy", changePct: -0.38, total: 4, advances: 1, declines: 3, unchanged: 0 },
    { sector: "Pharma", changePct: 0.61, total: 3, advances: 2, declines: 1, unchanged: 0 },
    { sector: "FMCG", changePct: -0.15, total: 3, advances: 1, declines: 2, unchanged: 0 },
    { sector: "Metals", changePct: 1.18, total: 3, advances: 3, declines: 0, unchanged: 0 }
  ]
};

export const MarketBreadthBar: React.FC<MarketBreadthBarProps> = ({ data, loading }) => {
  const currentData = data || DEFAULT_BREADTH_DATA;

  const isAdvancing = currentData.breadthState === "ADVANCING";
  const isDeclining = currentData.breadthState === "DECLINING";

  return (
    <div className="w-full bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all rounded-xl p-3 shadow-lg shadow-black/20 backdrop-blur-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        
        {/* Left: Overall Market Gauge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/60 text-xs font-semibold">
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">Macro Breadth:</span>
            <span className={`font-bold ${isAdvancing ? "text-emerald-400" : isDeclining ? "text-rose-400" : "text-amber-400"}`}>
              {currentData.breadthState} ({currentData.advancingSectors}▲ / {currentData.decliningSectors}▼)
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <span>Avg Sector Momentum:</span>
            <span className={`font-mono font-bold ${currentData.averageSectorChangePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {currentData.averageSectorChangePct >= 0 ? "+" : ""}{currentData.averageSectorChangePct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Right: Sector Pill Trackers */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {currentData.sectors.map((s) => {
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
