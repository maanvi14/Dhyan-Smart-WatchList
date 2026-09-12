"use client";

import { CheckCircle, Search, Cpu, AlertTriangle, ShieldCheck, FileCheck, Waves, Anchor, Activity, ArrowDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { TIER_BADGES, TierKey } from "@/lib/tiers";

interface EvidenceStep {
  step: string;
  timestamp: string;
  detail: string;
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
  informed_flow_check: "प्रमोटर / संस्थागत प्रवाह"
};

export function EvidenceTraceView({ trace, confidenceTier }: EvidenceTraceViewProps) {
  const { language, t } = useI18n();

  if (!trace || trace.length === 0) {
    return (
      <div className="text-xs text-muted italic py-2">
        {t("no_trace")}
      </div>
    );
  }

  const getStepIcon = (step: string) => {
    if (step.includes("proactive") || step.includes("filing")) return <FileCheck className="w-3.5 h-3.5 text-emerald-400" />;
    if (step.includes("statistical")) return <Activity className="w-3.5 h-3.5 text-amber-400" />;
    if (step.includes("contagion") || step.includes("ripple")) return <Waves className="w-3.5 h-3.5 text-purple-400" />;
    if (step.includes("informed") || step.includes("insider")) return <Anchor className="w-3.5 h-3.5 text-teal-400" />;
    if (step.includes("gather")) return <Search className="w-3.5 h-3.5 text-teal-400" />;
    if (step.includes("classify")) return <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />;
    if (step.includes("llm") || step.includes("groq") || step.includes("write")) return <Cpu className="w-3.5 h-3.5 text-sky-400" />;
    if (step.includes("fallback")) return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
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
    <div className="mt-3 pt-3 border-t border-surfaceBorder">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-semibold tracking-wider text-muted uppercase flex items-center space-x-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
          <span>{t("evidence_trace_title") || "Deterministic Causal Flow"}</span>
        </div>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${tierBadge.bg} ${tierBadge.textCol} ${tierBadge.border}`}>
          {tierBadge.text}
        </span>
      </div>

      {/* Connected Flow Node Diagram */}
      <div className="space-y-2 relative">
        {trace.map((item, idx) => {
          const isLast = idx === trace.length - 1;
          return (
            <div key={idx} className="relative">
              <div className="bg-surfaceElevated border border-surfaceBorder/80 hover:border-surfaceBorder rounded-xl p-2.5 transition-colors shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 rounded-lg bg-surface border border-surfaceBorder flex items-center justify-center shrink-0">
                      {getStepIcon(item.step)}
                    </div>
                    <span className="font-bold text-foreground font-mono text-[11px]">
                      {idx + 1}. {formatStepName(item.step)}
                    </span>
                  </div>
                  <span className="text-[9px] text-muted font-mono">
                    {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ""}
                  </span>
                </div>

                <p className="text-[11px] text-foreground/90 leading-relaxed font-sans font-medium pl-7">
                  {item.detail}
                </p>
              </div>

              {/* Connecting arrow if not last node */}
              {!isLast && (
                <div className="flex justify-center py-0.5">
                  <div className="w-0.5 h-2 bg-surfaceBorder flex items-center justify-center">
                    <ArrowDown className="w-2.5 h-2.5 text-muted -translate-y-0.5" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
