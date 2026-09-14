"use client";

import { PieChart, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface SectorItem {
  sector: string;
  count: number;
  pct: number;
}

interface SectorRiskRadarProps {
  breakdown: SectorItem[];
  concentrationWarning: string | null;
  totalCount: number;
}

export function SectorRiskRadar({
  breakdown,
  concentrationWarning,
  totalCount
}: SectorRiskRadarProps) {
  const { language, t } = useI18n();

  if (!breakdown || breakdown.length === 0) return null;

  const sectorColors: Record<string, string> = {
    IT: "#6366F1",       // Indigo
    Banking: "#0EA5E9",  // Sky Slate
    FMCG: "#10B981",     // Muted Emerald
    Auto: "#D97706",     // Warm Amber
    Pharma: "#E11D48",   // Soft Rose
    Energy: "#7C3AED",   // Violet
    Railways: "#64748B", // Cool Slate
    General: "#475569"
  };

  const title = language === "hi"
    ? `सेक्टर जोखिम रडार (${totalCount} स्टॉक)`
    : `Sector Risk Radar (${totalCount} Stocks)`;

  const warnLabel = language === "hi" ? "उच्च संकेंद्रण" : "High Concentration";

  return (
    <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 shadow-sm transition-all">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center space-x-2">
          <PieChart className="w-4 h-4 text-brand-500" />
          <span className="text-xs font-bold text-foreground tracking-wide font-mono">
            {title}
          </span>
        </div>
        {concentrationWarning && (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            <span>{warnLabel}</span>
          </span>
        )}
      </div>

      {/* Multi-segment distribution progress bar */}
      <div className="w-full h-2 bg-slate-100 dark:bg-surfaceElevated rounded-full overflow-hidden flex mb-3 border border-slate-200 dark:border-surfaceBorder/60">
        {breakdown.map((item, idx) => (
          <div
            key={idx}
            style={{
              width: `${item.pct}%`,
              backgroundColor: sectorColors[item.sector] || "#64748B"
            }}
            className="h-full transition-all duration-500 hover:opacity-80"
            title={`${item.sector}: ${item.pct}% (${item.count})`}
          />
        ))}
      </div>

      {/* Sector Pills Grid */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {breakdown.map((item, idx) => {
          const color = sectorColors[item.sector] || "#64748B";
          const isHigh = item.pct >= 50;

          return (
            <div
              key={idx}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all ${
                isHigh
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold"
                  : "bg-surfaceElevated border-surfaceBorder text-foreground"
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-foreground font-semibold">{t(`sector_${item.sector.toLowerCase()}`) || item.sector}</span>
              <span className="text-muted font-bold ml-0.5">{item.pct}%</span>
            </div>
          );
        })}
      </div>

      {concentrationWarning && (
        <p className="text-[11px] text-amber-800 dark:text-amber-400/90 leading-relaxed mt-2.5 pt-2 border-t border-slate-200 dark:border-surfaceBorder/80 font-sans">
          ⚠️ {concentrationWarning}
        </p>
      )}
    </div>
  );
}
