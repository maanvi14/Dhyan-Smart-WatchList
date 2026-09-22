"use client";

import { useState, useEffect } from "react";
import { debugApi } from "@/lib/api";
import {
  AlertTriangle, Play, ZapOff, CheckCircle2, Activity, Brain, Radio,
  RefreshCw, FileText, Server, Flame, ShieldAlert, Cpu
} from "lucide-react";

interface DebugPanelProps {
  onStatusChange?: () => void;
}

export function DebugPanel({ onStatusChange }: DebugPanelProps) {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<any | null>(null);

  const fetchTelemetry = async () => {
    try {
      const data = await debugApi.getArchitectureTelemetry();
      setTelemetry(data);
    } catch (_) {}
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleKill = async () => {
    setLoading(true);
    try {
      await debugApi.killFeed();
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
      await debugApi.reviveFeed();
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
      setStatusMsg(res.message?.replace(/^[^\w]+/, '') || "Online ML: River streaming SGD updated model weights sample-by-sample.");
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

  const handleFaultInjection = async () => {
    setLoading(true);
    try {
      const res = await debugApi.triggerFaultInjection("NSE:INFY");
      setStatusMsg(res.message?.replace(/^[^\w]+/, '') || "Fault injected on NSE:INFY: AI verification timeout will trip breaker and route poison message to DLQ.");
      fetchTelemetry();
      if (onStatusChange) onStatusChange();
    } catch (e: any) {
      setStatusMsg("Error injecting fault: " + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleClearFault = async () => {
    setLoading(true);
    try {
      await debugApi.clearFaultInjection();
      setStatusMsg("Adversarial fault injection cleared. Normal verification restored.");
      fetchTelemetry();
      if (onStatusChange) onStatusChange();
    } catch (e) {
      setStatusMsg("Error clearing fault.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = async () => {
    setLoading(true);
    try {
      const res = await debugApi.resetDemo();
      setStatusMsg(`${res.message?.replace(/^[^\w]+/, '') || "State reset complete."} Watermarks, caches, and contagion buffers initialized.`);
      fetchTelemetry();
      if (onStatusChange) onStatusChange();
    } catch (e) {
      setStatusMsg("Error resetting demo state.");
    } finally {
      setLoading(false);
    }
  };

  const breakerState = telemetry?.circuitBreaker?.state || "CLOSED";
  const breakerColor = breakerState === "OPEN" ? "bg-rose-500/20 text-rose-400 border-rose-500/40" : breakerState === "HALF-OPEN" ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";

  return (
    <div className="bg-surfaceElevated border border-surfaceBorder rounded-2xl p-4 my-4 shadow-sm transition-all space-y-4">
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-2.5">
        <div className="flex items-center space-x-2 text-muted font-bold text-xs tracking-wider uppercase">
          <Activity className="w-4 h-4 text-brand-500" />
          <span>Groww Distributed Systems Controls &amp; Resilience</span>
        </div>
        
        {telemetry && (
          <div className="flex items-center space-x-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded-md bg-surface border border-surfaceBorder text-foreground flex items-center space-x-1">
              <Server className="w-3 h-3 text-sky-400" />
              <span>Redis: {telemetry.redisSharedState?.connected ? "Shared State Active" : "Local State"}</span>
            </span>
            <span className={`px-2 py-0.5 rounded-md border font-bold flex items-center space-x-1 ${breakerColor}`}>
              <ShieldAlert className="w-3 h-3" />
              <span>Breaker: {breakerState}</span>
            </span>
          </div>
        )}
      </div>

      {/* Live System Architecture Telemetry Cards */}
      {telemetry && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
          <div className="bg-surface p-2.5 rounded-xl border border-surfaceBorder">
            <div className="text-muted text-[10px] uppercase font-bold mb-1 flex items-center space-x-1">
              <Cpu className="w-3 h-3 text-brand-500" />
              <span>Groww 915 Binary Protocol</span>
            </div>
            <div className="text-foreground font-semibold">
              {telemetry.binaryProtocol?.binaryFrameBytes}B Binary vs {telemetry.binaryProtocol?.jsonPayloadBytes}B JSON
            </div>
            <div className="text-emerald-500 font-bold text-[11px] mt-0.5">
              ⚡ {telemetry.binaryProtocol?.measuredBandwidthReduction} Measured Bandwidth Reduction
            </div>
          </div>

          <div className="bg-surface p-2.5 rounded-xl border border-surfaceBorder">
            <div className="text-muted text-[10px] uppercase font-bold mb-1 flex items-center space-x-1">
              <Server className="w-3 h-3 text-fuchsia-400" />
              <span>Redis Streams &amp; Consumer Group</span>
            </div>
            <div className="text-foreground font-semibold">
              Topic: market.ticks ➔ {telemetry.redisSharedState?.consumerGroup || "change_detectors"}
            </div>
            <div className="text-sky-400 text-[11px] mt-0.5">
              Shared Hash &amp; List state across replicas
            </div>
          </div>

          <div className="bg-surface p-2.5 rounded-xl border border-surfaceBorder">
            <div className="text-muted text-[10px] uppercase font-bold mb-1 flex items-center space-x-1">
              <Flame className="w-3 h-3 text-rose-400" />
              <span>Dead-Letter Queue (DLQ)</span>
            </div>
            <div className="text-foreground font-semibold">
              Stream: {telemetry.deadLetterQueue?.streamKey}
            </div>
            <div className="text-muted text-[11px] mt-0.5">
              Poison-Pills Captured: <span className="font-bold text-foreground">{telemetry.deadLetterQueue?.recentPoisonPillsCount || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleTriggerCatalyst}
          disabled={loading}
          className="min-h-[38px] px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 dark:text-emerald-300 border border-emerald-500/40 font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Trigger Catalyst (TCS)</span>
        </button>

        <button
          onClick={handleTriggerUninformed}
          disabled={loading}
          className="min-h-[38px] px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white dark:bg-amber-950/60 dark:hover:bg-amber-900/80 dark:text-amber-300 border border-amber-500/40 font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Trigger Uninformed (HDFC)</span>
        </button>

        <button
          onClick={handleTriggerSelfLearn}
          disabled={loading}
          className="min-h-[38px] px-3 py-1.5 bg-fuchsia-700 hover:bg-fuchsia-800 text-white dark:bg-fuchsia-950/60 dark:hover:bg-fuchsia-900/80 dark:text-fuchsia-300 border border-fuchsia-500/40 font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Trigger Online ML (River SGD)</span>
        </button>

        <button
          onClick={handleFaultInjection}
          disabled={loading}
          className="min-h-[38px] px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white dark:bg-rose-950/70 dark:hover:bg-rose-900/90 dark:text-rose-300 border border-rose-500/50 font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
          title="Injects AI timeout to prove Opossum circuit breaker trip & genuine DLQ routing"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Inject AI Timeout ➔ Trip Breaker &amp; DLQ</span>
        </button>

        <button
          onClick={handleClearFault}
          disabled={loading}
          className="min-h-[38px] px-3 py-1.5 bg-surface hover:bg-surfaceBorder text-foreground border border-surfaceBorder font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <span>Clear Fault</span>
        </button>

        <button
          onClick={handleTriggerChaos}
          disabled={loading}
          className="min-h-[38px] px-3 py-1.5 bg-orange-700 hover:bg-orange-800 text-white dark:bg-orange-950/60 dark:hover:bg-orange-900/80 dark:text-orange-300 border border-orange-500/40 font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Chaos Monkey</span>
        </button>

        <button
          onClick={handleKill}
          disabled={loading}
          className="min-h-[38px] px-3 py-1.5 bg-rose-900 hover:bg-rose-950 text-white border border-rose-700/50 font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <ZapOff className="w-3.5 h-3.5" />
          <span>Kill Feed</span>
        </button>

        <button
          onClick={handleRevive}
          disabled={loading}
          className="min-h-[38px] px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white dark:bg-sky-950/60 dark:hover:bg-sky-900/80 dark:text-sky-300 border border-sky-500/40 font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Revive Feed</span>
        </button>

        <button
          onClick={handleResetDemo}
          disabled={loading}
          className="min-h-[38px] px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-600/40 font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Demo</span>
        </button>
      </div>

      {statusMsg && (
        <div className="mt-2 text-xs font-mono text-foreground flex items-center space-x-1.5 bg-surface p-2.5 rounded-xl border border-surfaceBorder shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-brand-500" />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
