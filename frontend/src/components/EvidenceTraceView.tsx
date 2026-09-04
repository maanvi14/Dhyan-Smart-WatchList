"use client";

import { CheckCircle, Search, Cpu, AlertTriangle, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

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
  confirmed_silence_check: "पुष्ट शांति विश्लेषण"
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

  return (
    <div className="mt-3 pt-3 border-t border-surfaceBorder">
      <div className="text-[11px] font-semibold tracking-wider text-muted uppercase mb-3 flex items-center space-x-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
        <span>{t("evidence_trace_title")}</span>
      </div>

      <div className="relative pl-4 space-y-3 border-l-2 border-surfaceBorder">
        {trace.map((item, idx) => (
          <div key={idx} className="relative group">
            {/* Timeline Dot */}
            <div className="absolute -left-[23px] top-0.5 w-4 h-4 rounded-full bg-surface border border-surfaceBorder flex items-center justify-center">
              {getStepIcon(item.step)}
            </div>

            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="font-semibold text-foreground font-mono">
                {formatStepName(item.step)}
              </span>
              <span className="text-[10px] text-muted font-mono">
                {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ""}
              </span>
            </div>

            <p className="text-xs text-muted leading-relaxed font-sans">
              {item.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
