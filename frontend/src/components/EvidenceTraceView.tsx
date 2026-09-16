"use client";

import { useState } from "react";
import { CheckCircle, Search, Cpu, AlertTriangle, ShieldCheck, FileCheck, Waves, Building2, Activity, Code2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { TIER_BADGES, TierKey } from "@/lib/tiers";

interface EvidenceStep {
  step: string;
  timestamp: string;
  detail: string;
  correlationCoefficient?: number | null;
  betaCoefficient?: number | null;
  residualZScore?: number | null;
  hopCount?: number | null;
  [key: string]: any;
}

interface EvidenceTraceViewProps {
  trace: EvidenceStep[];
  confidenceTier: "CONFIRMED" | "UNEXPLAINED" | "UNCERTAIN";
}

const STEP_TRANSLATIONS_HI: Record<string, string> = {
  tip_symbol_extract: "टिप प्रतीक पहचान",
  filing_lookup_30d: "30-दिन एक्सचेंज फाइलिंग खोज",
  classify_tier: "विश्वास स्तर वर्गीकरण",
  write_narrative_groq_llm: "एआई विवरण निर्माण",
  fallback_node: "सत्यापन नियम निष्पादन",
  gather_evidence: "डेटा साक्ष्य संग्रह",
  confirmed_silence_check: "पुष्ट शांति विश्लेषण",
  statistical_dislocation_check: "सांख्यिकीय विचलन सत्यापन",
  proactive_regulatory_sweep: "सक्रिय फाइलिंग स्कैन",
  sector_contagion_detection: "सेक्टर संक्रामक विश्लेषण",
  sector_correlation_check: "सेक्टर सहसंबंध विश्लेषण",
  informed_flow_check: "प्रमोटर / संस्थागत प्रवाह"
};

export function EvidenceTraceView({ trace, confidenceTier }: EvidenceTraceViewProps) {
  const { language, t } = useI18n();
  const [openWorkbenches, setOpenWorkbenches] = useState<Record<number, boolean>>({});
  const [showFullJson, setShowFullJson] = useState(false);

  if (!trace || trace.length === 0) {
    return (
      <div className="text-xs text-muted italic py-3 text-center bg-surfaceElevated/40 rounded-2xl border border-surfaceBorder">
        {t("no_trace")}
      </div>
    );
  }

  const toggleWorkbench = (idx: number) => {
    setOpenWorkbenches(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const getStepIcon = (step: string) => {
    if (step.includes("proactive") || step.includes("filing")) return <FileCheck className="w-3.5 h-3.5 text-emerald-500" />;
    if (step.includes("statistical") || step.includes("correlation")) return <Activity className="w-3.5 h-3.5 text-amber-500" />;
    if (step.includes("contagion") || step.includes("ripple")) return <Waves className="w-3.5 h-3.5 text-purple-500" />;
    if (step.includes("informed") || step.includes("insider")) return <Building2 className="w-3.5 h-3.5 text-teal-500" />;
    if (step.includes("gather")) return <Search className="w-3.5 h-3.5 text-teal-500" />;
    if (step.includes("classify")) return <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />;
    if (step.includes("llm") || step.includes("groq") || step.includes("write")) return <Cpu className="w-3.5 h-3.5 text-sky-500" />;
    if (step.includes("fallback")) return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
  };

  const formatStepName = (stepName: string) => {
    if (language === "hi" && STEP_TRANSLATIONS_HI[stepName]) {
      return STEP_TRANSLATIONS_HI[stepName];
    }
    return stepName
      .replace(/_/g, " ")
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const tierBadge = TIER_BADGES[confidenceTier as TierKey] || TIER_BADGES.CONFIRMED;

  return (
    <div className="mt-3 pt-3 border-t border-surfaceBorder/80 font-sans">
      <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
        <div className="text-xs font-extrabold text-foreground flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-brand-500" />
          <span>Verification Graph Evidence Trace (Audit Trail)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFullJson(!showFullJson)}
            className="inline-flex items-center space-x-1.5 text-[10px] font-mono font-bold px-2 py-1 rounded-md bg-surfaceElevated hover:bg-surface border border-surfaceBorder text-brand-600 dark:text-brand-400 transition-colors"
          >
            <Code2 className="w-3 h-3" />
            <span>{showFullJson ? "Hide Trace JSON" : "View Full JSON"}</span>
          </button>
          <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.textCol} ${tierBadge.border}`}>
            {tierBadge.text}
          </span>
        </div>
      </div>

      {/* Global Full JSON Viewer */}
      {showFullJson && (
        <div className="mb-3 p-3 rounded-xl bg-slate-950/95 dark:bg-slate-900 border border-brand-500/40 font-mono text-[11px] shadow-inner animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-300">
            <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Raw Complete Evidence Trace (JSON)</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(trace, null, 2));
                alert("Copied full evidence trace JSON to clipboard!");
              }}
              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded"
            >
              Copy JSON
            </button>
          </div>
          <pre className="text-slate-300 overflow-x-auto max-h-60 text-[10px] leading-relaxed">
            {JSON.stringify(trace, null, 2)}
          </pre>
        </div>
      )}

      {/* Modern Connected Vertical Pipeline */}
      <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-brand-500 before:via-brand-500/50 before:to-surfaceBorder">
        {trace.map((item, idx) => {
          const hasQuantData =
            item.correlationCoefficient !== undefined ||
            item.step === "sector_correlation_check";
          const isExpanded = Boolean(openWorkbenches[idx]);

          return (
            <div key={idx} className="relative group">
              {/* Stepper Dot */}
              <div className="absolute -left-6 top-3 w-5 h-5 rounded-full bg-surface border-2 border-brand-500 flex items-center justify-center shadow-sm shadow-brand-500/30 group-hover:scale-110 transition-transform">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              </div>

              {/* Node Card */}
              <div className="bg-surfaceElevated/60 hover:bg-surface border border-surfaceBorder/80 hover:border-surfaceBorder rounded-2xl p-3.5 transition-all shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-lg bg-surface border border-surfaceBorder flex items-center justify-center shrink-0">
                      {getStepIcon(item.step)}
                    </div>
                    <span className="font-bold text-foreground text-xs">
                      {idx + 1}. {formatStepName(item.step)}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted font-mono font-semibold">
                    {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ""}
                  </span>
                </div>

                <p className="text-xs text-foreground/85 leading-relaxed font-medium pl-8">
                  {item.detail}
                </p>

                {/* Opt-in Raw JSON Workbench for Quantitative Verification */}
                {hasQuantData && (
                  <div className="mt-2.5 pt-2 pl-8 border-t border-surfaceBorder/60">
                    <button
                      type="button"
                      onClick={() => toggleWorkbench(idx)}
                      className="inline-flex items-center space-x-1.5 text-[11px] font-mono text-muted hover:text-foreground font-semibold px-2 py-1 rounded-lg bg-surface hover:bg-surfaceElevated border border-surfaceBorder transition-all"
                    >
                      <Code2 className="w-3.5 h-3.5 text-brand-500" />
                      <span>
                        {isExpanded
                          ? "Hide Raw JSON Workbench"
                          : "Raw JSON Workbench (for users who want to verify the math)"}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-950/90 dark:bg-slate-900 border border-purple-500/30 font-mono text-xs space-y-1.5 shadow-inner animate-in fade-in duration-150">
                        <div className="text-[10px] text-purple-300 uppercase font-sans font-bold tracking-wider mb-2">
                          Raw Quantitative Audit Trail — For users who want to verify the math:
                        </div>
                        <div className="grid grid-cols-1 gap-1 text-slate-200">
                          <div>
                            <span className="text-purple-400">correlationCoefficient:</span>{" "}
                            <span className="font-bold">
                              {item.correlationCoefficient !== undefined && item.correlationCoefficient !== null
                                ? Number(item.correlationCoefficient).toFixed(2)
                                : "0.00"}
                            </span>
                          </div>
                          <div>
                            <span className="text-blue-400">betaCoefficient:</span>{" "}
                            <span className="font-bold">
                              {item.betaCoefficient !== undefined && item.betaCoefficient !== null
                                ? Number(item.betaCoefficient).toFixed(2)
                                : "0.00"}
                            </span>
                          </div>
                          <div>
                            <span className="text-amber-400">residualZScore:</span>{" "}
                            <span className="font-bold">
                              {item.residualZScore !== undefined && item.residualZScore !== null
                                ? Number(item.residualZScore).toFixed(2)
                                : "0.00"}
                            </span>
                          </div>
                          <div>
                            <span className="text-emerald-400">hopCount:</span>{" "}
                            <span className="font-bold">
                              {item.hopCount !== undefined && item.hopCount !== null ? item.hopCount : 0}
                            </span>
                          </div>
                        </div>
                        <pre className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 overflow-x-auto">
                          {JSON.stringify(
                            {
                              step: item.step,
                              correlationCoefficient: item.correlationCoefficient,
                              betaCoefficient: item.betaCoefficient,
                              residualZScore: item.residualZScore,
                              hopCount: item.hopCount,
                              timestamp: item.timestamp
                            },
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
