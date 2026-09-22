"use client";

import { useState } from "react";
import { debugApi } from "@/lib/api";
import { AlertTriangle, Play, ZapOff, CheckCircle2, Activity, Brain, Radio, RefreshCw, FileText } from "lucide-react";

interface DebugPanelProps {
  onStatusChange?: () => void;
}

export function DebugPanel({ onStatusChange }: DebugPanelProps) {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleKill = async () => {
    setLoading(true);
    try {
      const res = await debugApi.killFeed();
      setStatusMsg("Market data feed halted. Quotes marked stale.");
      if (onStatusChange) onStatusChange();
    } catch (e) {
      setStatusMsg("Error halting market feed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevive = async () => {
    setLoading(true);
    try {
      const res = await debugApi.reviveFeed();
      setStatusMsg("Market data feed restored. Live tick processing active.");
      if (onStatusChange) onStatusChange();
    } catch (e) {
      setStatusMsg("Error restoring market feed.");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerCatalyst = async () => {
    setLoading(true);
    try {
      await debugApi.triggerCatalyst();
      setStatusMsg("Injected Regulation 30 filing disclosure & volume surge for NSE:TCS. Catalyst Confirmed tier active.");
      if (onStatusChange) onStatusChange();
    } catch (e) {
      setStatusMsg("Error triggering catalyst event.");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerUninformed = async () => {
    setLoading(true);
    try {
      await debugApi.triggerUninformed();
      setStatusMsg("Injected price dislocation (-2.45%, 2.8x volume) on NSE:HDFCBANK with zero filings. Uninformed Flow tier active.");
      if (onStatusChange) onStatusChange();
    } catch (e) {
      setStatusMsg("Error triggering uninformed event.");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSelfLearn = async () => {
    setLoading(true);
    try {
      const res = await debugApi.triggerSelfLearn();
      setStatusMsg(res.message?.replace(/^[^\w]+/, '') || "Online ML: River streaming SGD updated model weights sample-by-sample in sub-millisecond latency.");
      if (onStatusChange) onStatusChange();
    } catch (e: any) {
      setStatusMsg("Error triggering self-learning feedback: " + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerChaos = async () => {
    setLoading(true);
    try {
      const res = await debugApi.triggerChaosMonkey();
      setStatusMsg(res.message?.replace(/^[^\w]+/, '') || "Chaos Simulation Active: Simulated multicast packet drop and network jitter injected.");
      if (onStatusChange) onStatusChange();
    } catch (e: any) {
      setStatusMsg("Error injecting Chaos Monkey: " + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = async () => {
    setLoading(true);
    try {
      const res = await debugApi.resetDemo();
      setStatusMsg(`${res.message?.replace(/^[^\w]+/, '') || "State reset complete."} Watermarks, caches, and contagion buffers initialized.`);
      if (onStatusChange) onStatusChange();
    } catch (e) {
      setStatusMsg("Error resetting demo state.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surfaceElevated border border-surfaceBorder rounded-2xl p-4 my-4 shadow-sm transition-all">
      <div className="flex items-center space-x-2 text-muted font-bold text-xs tracking-wider uppercase mb-3">
        <Activity className="w-4 h-4 text-brand-500" />
        <span>System Demonstration &amp; Resilience Controls</span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={handleTriggerCatalyst}
          disabled={loading}
          className="min-h-[40px] px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 dark:text-emerald-300 border border-emerald-500/40 font-semibold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Trigger Catalyst Disclosure (TCS)</span>
        </button>

        <button
          onClick={handleTriggerUninformed}
          disabled={loading}
          className="min-h-[40px] px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white dark:bg-amber-950/60 dark:hover:bg-amber-900/80 dark:text-amber-300 border border-amber-500/40 font-semibold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Trigger Uninformed Dislocation (HDFC)</span>
        </button>

        <button
          onClick={handleTriggerSelfLearn}
          disabled={loading}
          className="min-h-[40px] px-3.5 py-2 bg-fuchsia-700 hover:bg-fuchsia-800 text-white dark:bg-fuchsia-950/60 dark:hover:bg-fuchsia-900/80 dark:text-fuchsia-300 border border-fuchsia-500/40 font-semibold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Trigger Online ML Self-Learning (River SGD)</span>
        </button>

        <button
          onClick={handleTriggerChaos}
          disabled={loading}
          className="min-h-[40px] px-3.5 py-2 bg-orange-700 hover:bg-orange-800 text-white dark:bg-orange-950/60 dark:hover:bg-orange-900/80 dark:text-orange-300 border border-orange-500/40 font-semibold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Chaos Monkey (Packet Drop / Jitter)</span>
        </button>

        <button
          onClick={handleKill}
          disabled={loading}
          className="min-h-[40px] px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white dark:bg-rose-950/60 dark:hover:bg-rose-900/80 dark:text-rose-300 border border-rose-500/40 font-semibold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <ZapOff className="w-3.5 h-3.5" />
          <span>Kill Feed (Stale Quote)</span>
        </button>

        <button
          onClick={handleRevive}
          disabled={loading}
          className="min-h-[40px] px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white dark:bg-sky-950/60 dark:hover:bg-sky-900/80 dark:text-sky-300 border border-sky-500/40 font-semibold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Revive Feed</span>
        </button>

        <button
          onClick={handleResetDemo}
          disabled={loading}
          className="min-h-[40px] px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-600/40 font-semibold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Demo Environment</span>
        </button>
      </div>

      {statusMsg && (
        <div className="mt-3 text-xs font-mono text-foreground flex items-center space-x-1.5 bg-surface p-2.5 rounded-xl border border-surfaceBorder shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-brand-500" />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
