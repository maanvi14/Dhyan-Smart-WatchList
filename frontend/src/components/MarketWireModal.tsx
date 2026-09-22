"use client";

import React, { useState, useEffect } from "react";
import { WireItem, watchlistApi } from "@/lib/api";
import { X, Radio, FileText, Newspaper, Plus, Check, ExternalLink, ShieldCheck, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

interface MarketWireModalProps {
  isOpen: boolean;
  onClose: () => void;
  watchlistId: string;
  onStockAdded?: () => void;
}

export const MarketWireModal: React.FC<MarketWireModalProps> = ({
  isOpen,
  onClose,
  watchlistId,
  onStockAdded
}) => {
  const [items, setItems] = useState<WireItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "FILING" | "NEWS">("ALL");
  const [addingSymbols, setAddingSymbols] = useState<Record<string, boolean>>({});
  const [addedSymbols, setAddedSymbols] = useState<Record<string, boolean>>({});

  const fetchWire = async () => {
    setLoading(true);
    try {
      const data = await watchlistApi.getMarketWire();
      setItems(data.items || []);
    } catch (e) {
      console.error("Failed to load market wire", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWire();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddStock = async (symbol: string) => {
    if (addedSymbols[symbol] || addingSymbols[symbol]) return;
    setAddingSymbols(prev => ({ ...prev, [symbol]: true }));
    try {
      await watchlistApi.addItem(watchlistId, symbol, "Added via Market Verified Wire", "Catalyst Tracker");
      setAddedSymbols(prev => ({ ...prev, [symbol]: true }));
      if (onStockAdded) onStockAdded();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Symbol already in watchlist");
    } finally {
      setAddingSymbols(prev => ({ ...prev, [symbol]: false }));
    }
  };

  const filteredItems = items.filter(item => {
    if (filter === "ALL") return true;
    return item.type === filter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Market Verified Wire
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800/80 text-emerald-300 font-medium">
                  Live Exchange & Press Radar
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Verified Regulation 30 filings and accredited financial press across 30 NSE stocks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchWire}
              title="Refresh Wire"
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filter === "ALL"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              All Events ({items.length})
            </button>
            <button
              onClick={() => setFilter("FILING")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
                filter === "FILING"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Reg 30 Filings</span>
            </button>
            <button
              onClick={() => setFilter("NEWS")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
                filter === "NEWS"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              <span>Accredited Press</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Zero speculation • Strictly grounded in audited sources
          </span>
        </div>

        {/* Wire List Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 divide-y divide-slate-800/40">
          {loading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Fetching live filings & financial reports across the exchange...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No wire events matching this filter.
            </div>
          ) : (
            filteredItems.map(item => {
              const isFiling = item.type === "FILING";
              const isAdded = addedSymbols[item.symbol];
              const isAdding = addingSymbols[item.symbol];
              const isUp = item.changePct >= 0;

              return (
                <div key={item.id} className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3 group">
                  <div className="space-y-1 flex-1">
                    {/* Symbol & Source Tags */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white tracking-wide">
                        {item.symbol.replace("NSE:", "")}
                      </span>
                      <span className="text-xs text-slate-400">
                        {item.symbolName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                        {item.sector}
                      </span>

                      {/* Type Badge */}
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                        isFiling
                          ? "bg-emerald-950 border border-emerald-700/80 text-emerald-300"
                          : "bg-blue-950 border border-blue-700/80 text-blue-300"
                      }`}>
                        {isFiling ? <ShieldCheck className="w-3 h-3" /> : <Newspaper className="w-3 h-3" />}
                        <span>{item.source}</span>
                      </span>

                      {/* Price snapshot */}
                      <div className={`flex items-center gap-0.5 font-mono text-[11px] font-bold ${
                        isUp ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{isUp ? "+" : ""}{item.changePct.toFixed(2)}%</span>
                      </div>
                    </div>

                    {/* Headline / Summary */}
                    <div className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                      {item.title}
                    </div>

                    {item.summary && (
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {item.summary}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                      <span>{new Date(item.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-emerald-400/80 hover:text-emerald-300 hover:underline"
                        >
                          <span>Read Source Report</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* 1-Click Add Button */}
                  <div className="shrink-0 self-start sm:self-center">
                    <button
                      onClick={() => handleAddStock(item.symbol)}
                      disabled={isAdded || isAdding}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm ${
                        isAdded
                          ? "bg-emerald-950 border border-emerald-700 text-emerald-300 cursor-default"
                          : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold active:scale-95"
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>In Watchlist</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isAdding ? "Adding..." : "+ Watch"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-center text-xs text-slate-400 flex items-center justify-between px-5">
          <span>Dhyan Verified Market Wire</span>
          <span className="text-[11px] text-slate-500">
            Auto-filtered for high-conviction catalysts only
          </span>
        </div>

      </div>
    </div>
  );
};
