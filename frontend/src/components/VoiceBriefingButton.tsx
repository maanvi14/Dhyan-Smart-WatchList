"use client";

import { useState, useRef } from "react";
import { Volume2, VolumeX, Sparkles, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { watchlistApi } from "@/lib/api";

interface VoiceBriefingButtonProps {
  story?: { en: string; hi: string } | null;
}

export function VoiceBriefingButton({ story }: VoiceBriefingButtonProps) {
  const { language } = useI18n();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayBriefing = async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }

    const speechText = language === "hi"
      ? (story?.hi || "नमस्ते! अभी कोई नई जानकारी नहीं है।")
      : (story?.en || "Hello! No new updates right now.");

    // Try Sarvam AI neural voice synthesis first
    setIsLoading(true);
    try {
      const res = await watchlistApi.synthesizeVoice(speechText, language);
      if (res?.audioBase64) {
        const audioSrc = `data:audio/wav;base64,${res.audioBase64}`;
        if (!audioRef.current) {
          audioRef.current = new Audio(audioSrc);
        } else {
          audioRef.current.src = audioSrc;
        }
        audioRef.current.onended = () => setIsPlaying(false);
        audioRef.current.onerror = () => fallbackToSpeechSynthesis(speechText);
        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.warn("Sarvam AI voice stream fallback:", err);
    } finally {
      setIsLoading(false);
    }

    // High-cadence fallback to local SpeechSynthesis
    fallbackToSpeechSynthesis(speechText);
  };

  const fallbackToSpeechSynthesis = (speechText: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Speech synthesis is not supported on this browser.");
      return;
    }
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
      disabled={isLoading}
      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold font-mono flex items-center space-x-2 transition-all shadow-md active:scale-95 border ${
        isPlaying
          ? "bg-rose-500 text-white border-rose-600 animate-pulse"
          : "bg-surface hover:bg-surfaceElevated text-brand-500 border-surfaceBorder hover:border-brand-500/40"
      } ${isLoading ? "opacity-75 cursor-wait" : ""}`}
      title={language === "hi" ? "60 सेकंड का ऑडियो सारांश सुनें" : "Listen to 60-second audio summary"}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
          <span>{language === "hi" ? "ऑडियो तैयार हो रहा है..." : "Synthesizing audio..."}</span>
        </>
      ) : isPlaying ? (
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
