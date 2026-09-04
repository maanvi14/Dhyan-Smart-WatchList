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

  return (
    <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 my-4 backdrop-blur">
      <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs tracking-wider uppercase mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span>Demo & Resilience Debug Panel</span>
      </div>
      <p className="text-xs text-slate-300 mb-3 leading-relaxed">
        Use these controls to test resilience end-to-end live. Killing the feed halts price updates, causing snapshots older than 30s to trigger 🔴 <span className="font-bold text-rose-400">Uncertain</span> stale data alerts across the application.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleKill}
          disabled={loading}
          className="min-h-[44px] px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 font-bold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <ZapOff className="w-4 h-4 text-rose-400" />
          <span>KILL FEED (Demo Stale Data)</span>
        </button>

        <button
          onClick={handleRevive}
          disabled={loading}
          className="min-h-[44px] px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-bold rounded-xl text-xs flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <Play className="w-4 h-4 text-emerald-400" />
          <span>REVIVE FEED (Auto Recover)</span>
        </button>
      </div>

      {statusMsg && (
        <div className="mt-3 text-xs font-mono text-amber-300 flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
