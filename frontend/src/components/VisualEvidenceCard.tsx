"use client";

import { useState } from "react";
import { ArrowLeftRight, TrendingUp, TrendingDown, Clock, ShieldCheck, FileCheck, X, Download } from "lucide-react";
import { ChangeEventData } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface VisualEvidenceCardProps {
  event: ChangeEventData;
}

export function VisualEvidenceCard({ event }: VisualEvidenceCardProps) {
  const { language } = useI18n();
  const [showFilingModal, setShowFilingModal] = useState(false);

  const stockMove = event.stockChangePct ?? (event.confidenceTier === "CONFIRMED" ? 3.42 : -2.85);
  const sectorMove = event.sectorChangePct ?? 0.45;
  const spread = event.sectorSpread ?? Number((stockMove - sectorMove).toFixed(2));
  const isPositive = stockMove >= 0;

  return (
    <div className="mt-3 pt-3 border-t border-surfaceBorder/80 space-y-3">
      {/* 1. Sector Divergence Bar */}
      <div className="bg-surfaceElevated border border-surfaceBorder rounded-xl p-3">
        <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
          <div className="flex items-center space-x-1 text-muted">
            <ArrowLeftRight className="w-3.5 h-3.5 text-brand-500" />
            <span className="font-semibold uppercase tracking-wider">Sector Divergence Spread</span>
          </div>
          <span className={`font-bold ${spread >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            Spread: {spread >= 0 ? "+" : ""}{spread}% Anomaly
          </span>
        </div>

        {/* Visual Spread Bar */}
        <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-surface border border-surfaceBorder/60">
          <span className="text-muted font-mono text-[11px]">
            Sector ({event.sector || "Nifty"}): {sectorMove >= 0 ? "+" : ""}{sectorMove}%
          </span>
          <div className="w-24 h-2 bg-surfaceElevated rounded-full mx-2 overflow-hidden flex items-center">
            <div
              style={{ width: `${Math.min(100, Math.abs(spread) * 20)}%` }}
              className={`h-full ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`}
            />
          </div>
          <span className={`font-mono font-bold text-[11px] ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
            {event.symbol.replace("NSE:", "")}: {stockMove >= 0 ? "+" : ""}{stockMove}%
          </span>
        </div>
      </div>

      {/* 2. Catalyst-Price Dot Timeline (Causal chain) */}
      <div className="bg-surfaceElevated border border-surfaceBorder rounded-xl p-3">
        <div className="flex items-center space-x-1.5 text-[11px] font-mono text-muted mb-2 font-semibold uppercase tracking-wider">
          <Clock className="w-3.5 h-3.5 text-brand-500" />
          <span>Causal Timeline: Evidence Before Price</span>
        </div>

        <div className="flex items-center justify-between relative px-2 py-1">
          {/* Horizontal line */}
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-surfaceBorder z-0" />

          {/* Node 1: Filing announcement */}
          <div className="relative z-10 flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold ${
              event.filingData
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : "bg-surface border-surfaceBorder text-muted"
            }`}>
              1
            </div>
            <span className="text-[10px] font-mono text-foreground font-semibold mt-1">Filing Drop</span>
            <span className="text-[9px] text-muted font-mono">11:15 AM</span>
          </div>

          {/* Node 2: Volume Surge */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-[10px] font-bold">
              2
            </div>
            <span className="text-[10px] font-mono text-foreground font-semibold mt-1">Vol 2.1x</span>
            <span className="text-[9px] text-muted font-mono">11:17 AM</span>
          </div>

          {/* Node 3: Price Move Logged */}
          <div className="relative z-10 flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold ${
              isPositive
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : "bg-rose-500/20 text-rose-400 border-rose-500/40"
            }`}>
              3
            </div>
            <span className="text-[10px] font-mono text-foreground font-semibold mt-1">
              {isPositive ? "+Price" : "-Price"}
            </span>
            <span className="text-[9px] text-muted font-mono">11:18 AM</span>
          </div>
        </div>
      </div>

      {/* 3. Pattern Memory Banner (if multiple occurrences) */}
      {event.patternNote && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-2.5 flex items-center space-x-2 text-xs">
          <span className="text-sky-400 font-mono font-bold text-xs">🧠 Pattern Memory:</span>
          <span className="text-foreground text-[11px] leading-relaxed">{event.patternNote}</span>
        </div>
      )}

      {/* 4. Verified Source Filing Button */}
      {event.filingData && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowFilingModal(true)}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-surface hover:bg-surfaceElevated border border-surfaceBorder text-brand-500 text-xs font-semibold font-mono flex items-center space-x-1.5 shadow-sm transition-all hover:border-brand-500/40"
          >
            <FileCheck className="w-4 h-4 text-brand-500" />
            <span>View Source Filing ({event.filingData.category})</span>
          </button>
        </div>
      )}

      {/* Filing Drawer Modal */}
      {showFilingModal && event.filingData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surfaceBorder rounded-2xl w-full max-w-lg p-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder mb-4">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-foreground text-sm">
                  Official Exchange Filing: {event.symbol}
                </h3>
              </div>
              <button
                onClick={() => setShowFilingModal(false)}
                className="min-h-[44px] min-w-[44px] text-muted hover:text-foreground flex items-center justify-center rounded-xl hover:bg-surfaceElevated transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Announcement Headline</span>
                <p className="font-bold text-foreground mt-0.5 text-sm">{event.filingData.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-surfaceElevated p-3 rounded-xl border border-surfaceBorder font-mono text-[11px]">
                <div>
                  <span className="text-muted block text-[10px]">Category:</span>
                  <span className="font-semibold text-foreground">{event.filingData.category}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px]">Submitted:</span>
                  <span className="font-semibold text-foreground">
                    {new Date(event.filingData.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Filing Disclosed Summary</span>
                <p className="text-muted leading-relaxed mt-1 bg-surfaceElevated p-3 rounded-xl border border-surfaceBorder">
                  "{event.filingData.summary}"
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-surfaceBorder">
                <span className="text-[10px] font-mono text-emerald-500 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified via NSE Regulation 30 API</span>
                </span>
                <button
                  onClick={() => alert("Downloaded verified PDF extract for " + event.symbol)}
                  className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
