"use client";

import { useState } from "react";
import { Volume2, VolumeX, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface VoiceBriefingButtonProps {
  story?: { en: string; hi: string } | null;
}

export function VoiceBriefingButton({ story }: VoiceBriefingButtonProps) {
  const { language } = useI18n();
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayBriefing = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Speech synthesis is not supported on this browser.");
      return;
    }

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    // Use the backend-generated conversational briefing summary
    const speechText = language === "hi"
      ? (story?.hi || "नमस्ते! अभी कोई नई जानकारी नहीं है।")
      : (story?.en || "Hello! No new updates right now.");

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.lang = language === "hi" ? "hi-IN" : "en-IN";

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const btnLabel = language === "hi" ? "60s ऑडियो ब्रीफिंग" : "60s Audio Briefing";
  const stopLabel = language === "hi" ? "रुकें" : "Stop Briefing";

  return (
    <button
      onClick={handlePlayBriefing}
      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold font-mono flex items-center space-x-2 transition-all shadow-md active:scale-95 border ${
        isPlaying
          ? "bg-rose-500 text-white border-rose-600 animate-pulse"
          : "bg-surface hover:bg-surfaceElevated text-brand-500 border-surfaceBorder hover:border-brand-500/40"
      }`}
      title={language === "hi" ? "60 सेकंड का ऑडियो सारांश सुनें" : "Listen to 60-second audio summary"}
    >
      {isPlaying ? (
        <>
          <VolumeX className="w-4 h-4" />
          <span>{stopLabel}</span>
        </>
      ) : (
        <>
          <Volume2 className="w-4 h-4 text-brand-500" />
          <span>{btnLabel}</span>
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
        </>
      )}
    </button>
  );
}
