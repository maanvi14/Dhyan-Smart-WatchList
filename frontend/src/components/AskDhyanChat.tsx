"use client";

import { useState, useEffect } from "react";
import {
  X, Send, Sparkles, ShieldAlert, CheckCircle2, Bot,
  MessageSquare, Search, Share2, Download, ChevronDown, ChevronUp
} from "lucide-react";
import { chatApi, verifyTipApi, VerifyTipResult } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { EvidenceTraceView } from "./EvidenceTraceView";

interface AskDhyanChatProps {
  watchlistId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  isRefusal?: boolean;
  timestamp: string;
}

type Tab = "ask" | "verify";

// ---------------------------------------------------------------------------
// Tier config with light mode and dark mode classes + Redwood for UNCERTAIN
// ---------------------------------------------------------------------------
const TIER_CONFIG = {
  CONFIRMED: {
    bg: "bg-emerald-50/80 dark:bg-emerald-950/40",
    border: "border-emerald-300 dark:border-emerald-500/40",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40",
    dot: "bg-emerald-500"
  },
  UNEXPLAINED: {
    bg: "bg-amber-50/80 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-500/40",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-300 dark:border-amber-500/40",
    dot: "bg-amber-500"
  },
  UNCERTAIN: {
    bg: "bg-redwood-50 dark:bg-redwood-bg",
    border: "border-redwood-border dark:border-redwood-border",
    badge: "bg-redwood-100 text-redwood-text dark:bg-redwood-200/20 dark:text-redwood-text border-redwood-border",
    dot: "bg-redwood-500"
  }
} as const;

// ---------------------------------------------------------------------------
// Shareable card SVG → PNG (Bilingual + Redwood Palette)
// ---------------------------------------------------------------------------
function buildCardSvg(result: VerifyTipResult, tipText: string, language: string): string {
  const tier = result.confidenceTier ?? "UNCERTAIN";

  const tierColors: Record<string, { bg: string; accent: string; dot: string }> = {
    CONFIRMED:   { bg: "#064e3b", accent: "#10b981", dot: "#34d399" },
    UNEXPLAINED: { bg: "#451a03", accent: "#f59e0b", dot: "#fcd34d" },
    UNCERTAIN:   { bg: "#5A1414", accent: "#DC2626", dot: "#F87171" } // Redwood / rich crimson tone
  };
  const c = tierColors[tier];

  const safeTip = (tipText.length > 80 ? tipText.slice(0, 77) + "…" : tipText)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  
  const rawNarrative = (language === "hi" && result.narrativeHi)
    ? result.narrativeHi
    : (result.narrative ?? "No narrative generated.");

  const safeNarrative = rawNarrative
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const symbolLabel = result.extractedSymbol?.replace("NSE:", "") ?? "—";
  
  const dateStr = new Date().toLocaleString(language === "hi" ? "hi-IN" : "en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

  const tierLabel = language === "hi"
    ? (tier === "CONFIRMED" ? "पुष्टि की गई" : tier === "UNEXPLAINED" ? "अकारण" : "अनिश्चित")
    : tier;

  const headerSub = language === "hi"
    ? "स्मार्ट वॉचलिस्ट · टिप सत्यापन"
    : "SMART WATCHLIST · TIP VERIFICATION";

  const originalTipHeading = language === "hi" ? "मूल टिप" : "ORIGINAL TIP";
  const verdictHeading = language === "hi" ? "ध्यान का निर्णय" : "DHYAN VERDICT";
  const footerSource = language === "hi"
    ? "NSE एक्सचेंज फाइलिंग और मार्केट डेटा · 30-दिन विंडो"
    : "Verified using NSE exchange filing lookup · 30-day window";
  const footerTagline = language === "hi"
    ? "साक्ष्य-आधारित · कभी कोई भविष्यवाणी नहीं"
    : "Evidence-based · Never predictive";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="${c.bg}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${c.accent}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${c.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <rect x="0" y="0" width="1080" height="6" fill="${c.accent}"/>
  <rect x="0" y="0" width="6" height="1080" fill="url(#accent)"/>

  <!-- Grid pattern -->
  <g opacity="0.04" stroke="${c.accent}" stroke-width="1">
    ${Array.from({length: 20}, (_, i) => `<line x1="${i*60}" y1="0" x2="${i*60}" y2="1080"/>`).join("")}
    ${Array.from({length: 20}, (_, i) => `<line x1="0" y1="${i*60}" x2="1080" y2="${i*60}"/>`).join("")}
  </g>

  <!-- Brand top bar -->
  <text x="80" y="90" font-family="monospace" font-size="24" fill="${c.accent}" letter-spacing="6" font-weight="bold">DHYAN</text>
  <text x="80" y="118" font-family="sans-serif" font-size="14" fill="#94a3b8" letter-spacing="2">${headerSub}</text>

  <!-- Tier badge -->
  <rect x="80" y="154" width="310" height="52" rx="10" fill="${c.accent}" fill-opacity="0.18" stroke="${c.accent}" stroke-width="1.5" stroke-opacity="0.6"/>
  <circle cx="109" cy="180" r="9" fill="${c.dot}"/>
  <text x="130" y="186" font-family="sans-serif" font-size="18" font-weight="bold" fill="${c.accent}" letter-spacing="2">${tierLabel}</text>

  <!-- Symbol badge -->
  <rect x="410" y="154" width="180" height="52" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="500" y="186" font-family="monospace" font-size="20" font-weight="bold" fill="#f1f5f9" text-anchor="middle">${symbolLabel}</text>

  <!-- Tip section -->
  <text x="80" y="270" font-family="sans-serif" font-size="14" fill="#94a3b8" letter-spacing="1" font-weight="bold">${originalTipHeading}</text>
  <rect x="80" y="288" width="920" height="3" rx="1.5" fill="${c.accent}" fill-opacity="0.3"/>
  <text x="80" y="335" font-family="sans-serif" font-size="22" fill="#e2e8f0" font-style="italic">"${safeTip}"</text>

  <!-- Divider -->
  <rect x="80" y="400" width="920" height="1" fill="#1e293b"/>

  <!-- Verdict section -->
  <text x="80" y="448" font-family="sans-serif" font-size="14" fill="#94a3b8" letter-spacing="1" font-weight="bold">${verdictHeading}</text>
  <rect x="80" y="466" width="920" height="3" rx="1.5" fill="${c.accent}" fill-opacity="0.3"/>

  <!-- Narrative text — wrapped manually -->
  ${wrapTextSvg(safeNarrative, 80, 520, 920, 32, "#f8fafc", "sans-serif", "26")}

  <!-- Bottom bar -->
  <rect x="0" y="970" width="1080" height="110" fill="#090d16"/>
  <rect x="0" y="970" width="1080" height="1" fill="#1e293b"/>

  <!-- Footer left: timestamp -->
  <text x="80" y="1018" font-family="monospace" font-size="14" fill="#94a3b8">${dateStr}</text>
  <text x="80" y="1046" font-family="sans-serif" font-size="13" fill="#64748b">${footerSource}</text>

  <!-- Footer right: dhyan.in -->
  <text x="1000" y="1018" font-family="monospace" font-size="22" font-weight="bold" fill="${c.accent}" text-anchor="end">dhyan.in</text>
  <text x="1000" y="1046" font-family="sans-serif" font-size="13" fill="#64748b" text-anchor="end">${footerTagline}</text>
</svg>`;
}

function wrapTextSvg(
  text: string, x: number, y: number, maxWidth: number,
  lineHeight: number, fill: string, family: string, size: string
): string {
  const charsPerLine = Math.floor(maxWidth / (Number(size) * 0.58));
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > charsPerLine && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current.trim());

  return lines.slice(0, 6).map((line, i) =>
    `<text x="${x}" y="${y + i * lineHeight}" font-family="${family}" font-size="${size}" fill="${fill}">${line}</text>`
  ).join("\n");
}

async function downloadCard(svgString: string, filename: string) {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.src = url;
  await new Promise(resolve => { img.onload = resolve; });

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);

  canvas.toBlob(async (pngBlob) => {
    if (!pngBlob) return;
    if (navigator.share && navigator.canShare?.({ files: [new File([pngBlob], filename, { type: "image/png" })] })) {
      try {
        await navigator.share({
          title: "Dhyan Tip Verification",
          files: [new File([pngBlob], filename, { type: "image/png" })]
        });
        return;
      } catch { /* fall through to download */ }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(pngBlob);
    a.download = filename;
    a.click();
  }, "image/png");
}

// ---------------------------------------------------------------------------
// VerifyTip result card component
// ---------------------------------------------------------------------------
function VerifyResultCard({
  result, tipText, onShare
}: {
  result: VerifyTipResult;
  tipText: string;
  onShare: () => void;
}) {
  const { language, t } = useI18n();
  const [traceOpen, setTraceOpen] = useState(false);
  const tier = result.confidenceTier;

  if (!tier) {
    const noSymMsg = (language === "hi" && result.messageHi)
      ? result.messageHi
      : (result.message || t("no_symbol_detected"));

    return (
      <div className="rounded-xl border border-surfaceBorder bg-surfaceElevated p-4 text-xs space-y-2 shadow-sm">
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-muted" />
          <span className="text-foreground font-semibold">{t("no_symbol_detected")}</span>
        </div>
        <p className="text-muted leading-relaxed">{noSymMsg}</p>
      </div>
    );
  }

  const cfg = TIER_CONFIG[tier];
  const localizedTierBadge = t(`tier_${tier.toLowerCase()}_short`) || tier;
  const localizedSector = t(`sector_${(result.sector || "").toLowerCase()}`) || result.sector;
  const displayNarrative = (language === "hi" && result.narrativeHi)
    ? result.narrativeHi
    : result.narrative;

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-4 space-y-3.5 shadow-md transition-all`}>
      {/* Tier badge + symbol */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className={`inline-flex items-center space-x-1.5 text-xs font-bold px-3 py-1 rounded-xl border font-mono shadow-sm ${cfg.badge}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
          <span>{localizedTierBadge}</span>
        </span>
        {result.extractedSymbol && (
          <span className="text-xs font-mono bg-badgeBg text-badgeText px-2.5 py-1 rounded-xl border border-surfaceBorder font-semibold">
            {result.extractedSymbol.replace("NSE:", "")} • {localizedSector}
          </span>
        )}
      </div>

      {/* Narrative */}
      <p className="text-xs text-foreground font-medium leading-relaxed font-sans">
        {displayNarrative}
      </p>

      {/* Actions row */}
      <div className="flex items-center justify-between pt-1 border-t border-surfaceBorder/60">
        <button
          onClick={() => setTraceOpen(v => !v)}
          className="flex items-center space-x-1 text-xs text-muted hover:text-foreground transition-colors font-medium"
        >
          {traceOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{traceOpen ? t("hide_evidence_trace") : t("show_evidence_trace")}</span>
        </button>

        <button
          onClick={onShare}
          className="flex items-center space-x-1.5 text-xs bg-surface hover:bg-surfaceElevated text-foreground font-semibold px-3.5 py-1.5 rounded-xl border border-surfaceBorder shadow-sm transition-all active:scale-95"
        >
          <Share2 className="w-3.5 h-3.5 text-brand-500" />
          <span>{t("share_card")}</span>
        </button>
      </div>

      {/* Evidence trace */}
      {traceOpen && result.evidenceTrace.length > 0 && (
        <EvidenceTraceView trace={result.evidenceTrace} confidenceTier={tier} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Drawer component
// ---------------------------------------------------------------------------
export function AskDhyanChat({ watchlistId, isOpen, onClose }: AskDhyanChatProps) {
  const { language, t } = useI18n();
  const [tab, setTab] = useState<Tab>("ask");

  // --- Ask Dhyan state ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // --- Verify a Tip state ---
  const [tipText, setTipText] = useState("");
  const [tipResult, setTipResult] = useState<VerifyTipResult | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const [tipError, setTipError] = useState<string | null>(null);
  const [lastTipText, setLastTipText] = useState("");

  // Sync initial welcome message whenever language changes
  useEffect(() => {
    setMessages([
      {
        id: "msg-welcome",
        sender: "assistant",
        text: t("chat_welcome"),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  }, [language]);

  // ── Ask Dhyan send ──
  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput.trim();
    setChatInput("");

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await chatApi.sendMessage(watchlistId, userText);
      setMessages(prev => [...prev, {
        id: `bot-${Date.now()}`,
        sender: "assistant",
        text: res.answer,
        isRefusal: res.isRefusal,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: language === "hi"
          ? "डेटा पुनर्प्राप्ति विफल रही। कृपया नेटवर्क कनेक्शन जांचें।"
          : "Dhyan grounded query failed. Please verify network connection.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Verify a Tip submit ──
  const handleTipVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipText.trim() || tipLoading) return;

    setTipLoading(true);
    setTipResult(null);
    setTipError(null);
    setLastTipText(tipText.trim());

    try {
      const result = await verifyTipApi.verify(tipText.trim());
      setTipResult(result);
    } catch {
      setTipError(language === "hi" ? "सत्यापन अनुरोध विफल रहा।" : "Verification request failed. Is the backend running?");
    } finally {
      setTipLoading(false);
    }
  };

  // ── Share card ──
  const handleShare = async () => {
    if (!tipResult) return;
    const svg = buildCardSvg(tipResult, lastTipText, language);
    const tier = tipResult.confidenceTier ?? "UNKNOWN";
    const sym = tipResult.extractedSymbol?.replace("NSE:", "") ?? "dhyan";
    await downloadCard(svg, `dhyan-tip-${sym}-${tier.toLowerCase()}.png`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex justify-end">
      <div className="bg-surface border-l border-surfaceBorder w-full max-w-md h-full flex flex-col shadow-2xl relative">

        {/* ── Header ── */}
        <div className="p-4 border-b border-surfaceBorder flex items-center justify-between bg-surfaceElevated shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-teal-400 flex items-center justify-center shadow-md">
              <Bot className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center space-x-1.5">
                <span>{t("ask_dhyan")}</span>
                <span className="bg-brand-500/15 text-brand-500 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-brand-500/30">
                  {t("grounded_badge")}
                </span>
              </h3>
              <p className="text-[11px] text-muted">{t("ask_dhyan_subtitle")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] text-muted hover:text-foreground flex items-center justify-center rounded-xl hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tab Toggle ── */}
        <div className="flex border-b border-surfaceBorder bg-surface shrink-0">
          <button
            onClick={() => setTab("ask")}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-3 text-xs font-semibold transition-colors ${
              tab === "ask"
                ? "text-brand-500 border-b-2 border-brand-500 bg-surfaceElevated font-bold"
                : "text-muted hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t("tab_ask_dhyan")}</span>
          </button>
          <button
            onClick={() => setTab("verify")}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-3 text-xs font-semibold transition-colors ${
              tab === "verify"
                ? "text-brand-500 border-b-2 border-brand-500 bg-surfaceElevated font-bold"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{t("tab_verify_tip")}</span>
          </button>
        </div>

        {/* ── Non-predictive guardrail ── */}
        <div className="bg-surfaceElevated border-b border-surfaceBorder px-4 py-2 text-[11px] text-muted flex items-center space-x-2 shrink-0">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>{t("non_predictive_note")}</span>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* TAB: Ask Dhyan (chat) */}
        {/* ══════════════════════════════════════════════════ */}
        {tab === "ask" && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                      msg.sender === "user"
                        ? "bg-brand-500 text-slate-950 font-medium rounded-tr-none"
                        : msg.isRefusal
                        ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 rounded-tl-none"
                        : "bg-surfaceElevated border border-surfaceBorder text-foreground rounded-tl-none"
                    }`}
                  >
                    {msg.sender === "assistant" && (
                      <div className="flex items-center space-x-1.5 mb-1.5">
                        {msg.isRefusal ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 font-mono">
                            <ShieldAlert className="w-3 h-3" />
                            <span>{t("refusal_badge")}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 font-mono">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{t("grounded_badge_full")}</span>
                          </span>
                        )}
                      </div>
                    )}
                    <p>{msg.text}</p>
                    <div className="text-[10px] opacity-60 text-right mt-1 font-mono">{msg.timestamp}</div>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center space-x-2 text-xs text-muted font-mono italic p-2">
                  <Sparkles className="w-4 h-4 text-brand-500 animate-spin" />
                  <span>{t("retrieving_facts")}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleChatSend} className="p-3 border-t border-surfaceBorder bg-surfaceElevated shrink-0">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder={t("ask_dhyan_placeholder")}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  className="flex-1 bg-inputBg border border-surfaceBorder rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder-muted focus:outline-none focus:border-brand-500 min-h-[44px] shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  className="min-h-[44px] min-w-[44px] bg-brand-500 hover:bg-brand-600 font-bold text-slate-950 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  <Send className="w-4 h-4 text-slate-950" />
                </button>
              </div>
            </form>
          </>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* TAB: Verify a Tip */}
        {/* ══════════════════════════════════════════════════ */}
        {tab === "verify" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Tip input form */}
              <form onSubmit={handleTipVerify} className="space-y-2.5">
                <label className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                  {t("verify_tip_label")}
                </label>
                <textarea
                  rows={3}
                  placeholder={t("verify_tip_placeholder")}
                  value={tipText}
                  onChange={e => setTipText(e.target.value)}
                  className="w-full bg-inputBg border border-surfaceBorder rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder-muted focus:outline-none focus:border-brand-500 resize-none shadow-sm leading-relaxed"
                />
                <button
                  type="submit"
                  disabled={!tipText.trim() || tipLoading}
                  className="w-full min-h-[46px] bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold rounded-xl flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-50 text-sm shadow-md shadow-brand-500/20"
                >
                  {tipLoading ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>{t("verify_tip_loading")}</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>{t("verify_tip_submit")}</span>
                    </>
                  )}
                </button>
              </form>

              {/* Demo tips */}
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] text-muted font-mono uppercase tracking-wider font-semibold">
                  {t("try_demo_tip")}
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    t("demo_tip_1"),
                    t("demo_tip_2"),
                    t("demo_tip_3")
                  ].map((demo, i) => (
                    <button
                      key={i}
                      onClick={() => setTipText(demo)}
                      className="text-left text-xs text-muted hover:text-foreground bg-surfaceElevated hover:bg-surface border border-surfaceBorder rounded-xl px-3.5 py-2.5 transition-all font-sans leading-relaxed shadow-sm active:scale-[0.99]"
                    >
                      "{demo}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {tipError && (
                <div className="rounded-xl border border-redwood-border bg-redwood-50 dark:bg-redwood-bg p-3 text-xs text-redwood-text shadow-sm">
                  {tipError}
                </div>
              )}

              {/* Result card */}
              {tipResult && (
                <VerifyResultCard
                  result={tipResult}
                  tipText={lastTipText}
                  onShare={handleShare}
                />
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
