"use client";

import { useState } from "react";
import { debugApi } from "@/lib/api";
import { AlertTriangle, Play, ZapOff, CheckCircle2 } from "lucide-react";

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
      setStatusMsg("Feed killed! Snapshots are now frozen and marked stale.");
      if (onStatusChange) onStatusChange();
    } catch (e) {
      setStatusMsg("Error killing feed");
    } finally {
      setLoading(false);
    }
  };

  const handleRevive = async () => {
    setLoading(true);
    try {
      const res = await debugApi.reviveFeed();
      setStatusMsg("Feed revived! Resumed normal price tick updates.");
      if (onStatusChange) onStatusChange();
    } catch (e) {
      setStatusMsg("Error reviving feed");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerCatalyst = async () => {
    setLoading(true);
    try {
      await debugApi.triggerCatalyst();
      setStatusMsg("⚡ Injected live Regulation 30 filing & volume surge for NSE:TCS. Watch for CATALYST CONFIRMED alert!");
      if (onStatusChange) onStatusChange();
    } catch (e) {
      setStatusMsg("Error triggering catalyst event");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerUninformed = async () => {
    setLoading(true);
    try {
      await debugApi.triggerUninformed();
      setStatusMsg("⚡ Injected -2.4% price move with 2.8x volume on NSE:HDFCBANK (zero filings). Watch for UNINFORMED FLOW alert!");
      if (onStatusChange) onStatusChange();
    } catch (e) {
      setStatusMsg("Error triggering uninformed event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surfaceElevated border border-amber-500/40 rounded-2xl p-4 my-4 shadow-md transition-all">
      <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 font-bold text-xs tracking-wider uppercase mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span>Live Pitch Demo &amp; Resilience Controls</span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={handleTriggerCatalyst}
          disabled={loading}
          className="min-h-[40px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 dark:text-emerald-300 border border-emerald-500/50 font-bold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <span>⚡ Trigger Catalyst Disclosure (TCS)</span>
        </button>

        <button
          onClick={handleTriggerUninformed}
          disabled={loading}
          className="min-h-[40px] px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-950/60 dark:hover:bg-amber-900/80 dark:text-amber-300 border border-amber-500/50 font-bold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <span>⚡ Trigger Uninformed Dislocation (HDFC)</span>
        </button>

        <button
          onClick={handleKill}
          disabled={loading}
          className="min-h-[40px] px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-950/60 dark:hover:bg-rose-900/80 dark:text-rose-300 border border-rose-500/50 font-bold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <ZapOff className="w-3.5 h-3.5" />
          <span>Kill Feed (Stale Quote)</span>
        </button>

        <button
          onClick={handleRevive}
          disabled={loading}
          className="min-h-[40px] px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-950/60 dark:hover:bg-sky-900/80 dark:text-sky-300 border border-sky-500/50 font-bold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Revive Feed</span>
        </button>
      </div>

      {statusMsg && (
        <div className="mt-3 text-xs font-mono text-amber-900 dark:text-amber-300 flex items-center space-x-1.5 bg-surface p-2.5 rounded-xl border border-amber-500/30 shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
