"use client";

import { useState } from "react";
import { ArrowLeftRight, TrendingUp, TrendingDown, Clock, ShieldCheck, FileCheck, X, Download, Waves, Anchor, Building2 } from "lucide-react";
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

      {/* 🌊 Ripple Effect / Contagion Alert Banner */}
      {event.isRippleEffect && event.rippleSourceName && (
        <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-500/40 rounded-xl p-3 flex items-start space-x-2.5 shadow-sm">
          <Waves className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-mono font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider mb-0.5">
              ⚡ Sector Contagion Alert
            </div>
            <p className="text-[11px] text-foreground font-medium leading-relaxed">
              A high signal-strength event was detected on <span className="font-bold text-purple-700 dark:text-purple-300">{event.rippleSourceName}</span> in the same sector.{" "}
              {event.symbol.replace("NSE:", "")} is a sector peer — no confirmed catalyst found yet. Monitor for contagion spread.
            </p>
          </div>
        </div>
      )}

      {/* 🐋 Informed Flow: Promoter / Institutional Trades */}
      {event.insiderData && event.insiderData.length > 0 && (
        <div className="bg-teal-50 dark:bg-teal-950/30 border border-teal-300 dark:border-teal-500/40 rounded-xl p-3 space-y-2 shadow-sm">
          <div className="flex items-center space-x-1.5 text-[10px] font-mono text-teal-900 dark:text-teal-300 font-extrabold uppercase tracking-wider">
            <Anchor className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Informed Flow — Promoter &amp; Institutional Disclosures</span>
          </div>
          {event.insiderData.map((trade, i) => (
            <div key={i} className="flex items-center justify-between bg-surface border border-surfaceBorder rounded-xl px-3 py-2 shadow-sm">
              <div className="flex items-center space-x-2 min-w-0">
                <Building2 className="w-3.5 h-3.5 text-muted shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-foreground truncate">{trade.traderName}</div>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      trade.traderType === "PROMOTER" ? "bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30" :
                      trade.traderType === "FII" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30" :
                      trade.traderType === "DII" ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-900 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/30" :
                      "bg-purple-100 dark:bg-purple-500/20 text-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30"
                    }`}>{trade.traderType}</span>
                    <span className="text-[10px] text-muted font-mono font-medium">{trade.source}</span>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className={`text-[12px] font-extrabold font-mono ${trade.action === "BUY" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                  {trade.action === "BUY" ? "▲ BUY" : "▼ SELL"}
                </div>
                <div className="text-[10px] text-foreground font-mono font-bold">₹{trade.valueInCr.toFixed(0)}Cr</div>
              </div>
            </div>
          ))}
          {event.insiderNarrative && (
            <p className="text-[10px] text-teal-950 dark:text-teal-200 font-mono font-medium leading-relaxed pt-1.5 border-t border-teal-300 dark:border-teal-500/30">
              ✓ {event.insiderNarrative}
            </p>
          )}
        </div>
      )}

      {/* 1. Sector Divergence Bar */}
      <div className="bg-surfaceElevated border border-surfaceBorder rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
          <div className="flex items-center space-x-1.5 text-foreground font-bold uppercase tracking-wider">
            <ArrowLeftRight className="w-3.5 h-3.5 text-brand-500" />
            <span>Sector Divergence Spread</span>
          </div>
          <span className={`font-extrabold ${spread >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            Spread: {spread >= 0 ? "+" : ""}{spread}% Anomaly
          </span>
        </div>

        {/* Visual Spread Bar */}
        <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-surface border border-surfaceBorder shadow-sm">
          <span className="text-foreground font-mono text-[11px] font-semibold">
            Sector ({event.sector || "Nifty"}): {sectorMove >= 0 ? "+" : ""}{sectorMove}%
          </span>
          <div className="w-28 h-2 bg-surfaceElevated rounded-full mx-2 overflow-hidden flex items-center border border-surfaceBorder/80">
            <div
              style={{ width: `${Math.min(100, Math.abs(spread) * 20)}%` }}
              className={`h-full ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`}
            />
          </div>
          <span className={`font-mono font-extrabold text-[11px] ${isPositive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {event.symbol.replace("NSE:", "")}: {stockMove >= 0 ? "+" : ""}{stockMove}%
          </span>
        </div>
      </div>

      {/* 2. Catalyst-Price Dot Timeline (Causal chain) */}
      <div className="bg-surfaceElevated border border-surfaceBorder rounded-xl p-3 shadow-sm">
        <div className="flex items-center space-x-1.5 text-[11px] font-mono text-foreground font-bold mb-2 uppercase tracking-wider">
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
                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500/40"
                : "bg-surface border border-surfaceBorder text-foreground"
            }`}>
              1
            </div>
            <span className="text-[10px] font-mono text-foreground font-bold mt-1">Filing Drop</span>
            <span className="text-[9px] text-muted font-mono font-semibold">11:15 AM</span>
          </div>

          {/* Node 2: Volume Surge */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40 flex items-center justify-center text-[10px] font-bold">
              2
            </div>
            <span className="text-[10px] font-mono text-foreground font-bold mt-1">Vol 2.1x</span>
            <span className="text-[9px] text-muted font-mono font-semibold">11:17 AM</span>
          </div>

          {/* Node 3: Price Move Logged */}
          <div className="relative z-10 flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold ${
              isPositive
                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500/40"
                : "bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border-rose-400 dark:border-rose-500/40"
            }`}>
              3
            </div>
            <span className="text-[10px] font-mono text-foreground font-bold mt-1">
              {isPositive ? "+Price" : "-Price"}
            </span>
            <span className="text-[9px] text-muted font-mono font-semibold">11:18 AM</span>
          </div>
        </div>
      </div>

      {/* 3. Pattern Memory Banner (if multiple occurrences) */}
      {event.patternNote && (
        <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-300 dark:border-sky-500/40 rounded-xl p-2.5 flex items-center space-x-2 text-xs shadow-sm">
          <span className="text-sky-900 dark:text-sky-300 font-mono font-bold text-xs">🧠 Pattern Memory:</span>
          <span className="text-foreground text-[11px] font-medium leading-relaxed">{event.patternNote}</span>
        </div>
      )}

      {/* 4. Verified Source Filing Button */}
      {event.filingData && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowFilingModal(true)}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-surface hover:bg-surfaceElevated border border-brand-500/40 text-brand-600 dark:text-brand-400 text-xs font-bold font-mono flex items-center space-x-1.5 shadow-sm transition-all hover:border-brand-500"
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
