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
    IT: "#38BDF8",       // sky
    Banking: "#818CF8",  // indigo
    FMCG: "#34D399",     // emerald
    Auto: "#FBBF24",     // amber
    Pharma: "#F472B6",   // pink
    Energy: "#FB923C",   // orange
    Railways: "#A78BFA", // violet
    General: "#94A3B8"
  };

  const title = language === "hi"
    ? `सेक्टर जोखिम रडार (${totalCount} स्टॉक)`
    : `Sector Risk Radar (${totalCount} Stocks)`;

  const warnLabel = language === "hi" ? "उच्च संकेंद्रण" : "High Concentration";

  return (
    <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 mb-4 shadow-md transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <PieChart className="w-4 h-4 text-brand-500" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
            {title}
          </span>
        </div>
        {concentrationWarning && (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            <span>{warnLabel}</span>
          </span>
        )}
      </div>

      {/* Multi-segment distribution progress bar */}
      <div className="w-full h-2.5 bg-surfaceElevated rounded-full overflow-hidden flex mb-3 border border-surfaceBorder/60">
        {breakdown.map((item, idx) => (
          <div
            key={idx}
            style={{
              width: `${item.pct}%`,
              backgroundColor: sectorColors[item.sector] || "#94A3B8"
            }}
            className="h-full transition-all duration-500 hover:opacity-80"
            title={`${item.sector}: ${item.pct}% (${item.count})`}
          />
        ))}
      </div>

      {/* Sector Pills Grid */}
      <div className="flex flex-wrap gap-2 text-xs">
        {breakdown.map((item, idx) => {
          const color = sectorColors[item.sector] || "#94A3B8";
          const isHigh = item.pct >= 50;

          return (
            <div
              key={idx}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono border transition-all ${
                isHigh
                  ? "bg-amber-100 dark:bg-amber-500/10 border-amber-400 dark:border-amber-500/40 text-amber-800 dark:text-amber-400 font-bold"
                  : "bg-surfaceElevated border-surfaceBorder text-muted"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-foreground font-semibold">{t(`sector_${item.sector.toLowerCase()}`) || item.sector}</span>
              <span className="opacity-80 font-bold">{item.pct}%</span>
            </div>
          );
        })}
      </div>

      {concentrationWarning && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400/90 leading-relaxed mt-2.5 pt-2 border-t border-surfaceBorder/80 font-sans">
          ⚠️ {concentrationWarning}
        </p>
      )}
    </div>
  );
}
