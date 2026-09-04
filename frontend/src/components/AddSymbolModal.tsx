"use client";

import { useEffect, useState } from "react";
import { X, Search, Plus, FileText } from "lucide-react";
import { watchlistApi } from "@/lib/api";

interface AddSymbolModalProps {
  watchlistId: string;
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

interface SymbolOption {
  symbol: string;
  name: string;
  sector: string;
  basePrice: number;
}

export function AddSymbolModal({ watchlistId, isOpen, onClose, onAdded }: AddSymbolModalProps) {
  const [universe, setUniverse] = useState<SymbolOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      watchlistApi.getSymbolsUniverse()
        .then(res => setUniverse(res))
        .catch(() => setError("Failed to load symbols universe"));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = universe.filter(s =>
    s.symbol.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.sector.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSymbol) return;

    setLoading(true);
    setError(null);
    try {
      await watchlistApi.addItem(watchlistId, selectedSymbol, notes);
      onAdded();
      onClose();
      setSelectedSymbol(null);
      setNotes("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add symbol");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-surfaceBorder rounded-2xl w-full max-w-md p-5 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder mb-4">
          <h3 className="font-bold text-foreground text-base flex items-center space-x-2">
            <Plus className="w-5 h-5 text-brand-500" />
            <span>Add Stock to Watchlist</span>
          </h3>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] text-muted hover:text-foreground flex items-center justify-center rounded-xl hover:bg-surfaceElevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Search Field */}
          <div>
            <label className="block text-xs text-muted font-medium mb-1.5">
              Search NSE Stock Universe (~30 Tickers)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="Search TCS, Reliance, Banking..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-inputBg border border-surfaceBorder rounded-xl pl-9 pr-4 py-2.5 text-xs text-foreground placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors min-h-[44px]"
              />
            </div>
          </div>

          {/* Autocomplete List */}
          <div className="max-h-48 overflow-y-auto border border-surfaceBorder rounded-xl bg-surfaceElevated divide-y divide-surfaceBorder">
            {filtered.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 text-center">No matching stocks found</div>
            ) : (
              filtered.map(item => (
                <button
                  type="button"
                  key={item.symbol}
                  onClick={() => setSelectedSymbol(item.symbol)}
                  className={`w-full text-left p-3 min-h-[44px] flex items-center justify-between text-xs transition-colors ${
                    selectedSymbol === item.symbol
                      ? "bg-brand-500/10 text-brand-400 border-l-2 border-brand-500"
                      : "hover:bg-surfaceElevated text-foreground"
                  }`}
                >
                  <div>
                    <span className="font-bold font-mono text-foreground block">{item.symbol}</span>
                    <span className="text-[11px] text-muted">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-badgeBg text-badgeText">
                      {item.sector}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Optional User Note */}
          <div>
            <label className="block text-xs text-muted font-medium mb-1.5 flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-muted" />
              <span>Investment Note (Optional context tag)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. IPO play, exit by December"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-inputBg border border-surfaceBorder rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder-slate-500 focus:outline-none focus:border-brand-500 min-h-[44px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedSymbol || loading}
              className="min-h-[44px] px-5 py-2 bg-brand-500 hover:bg-brand-600 font-bold text-slate-950 rounded-xl text-xs transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add to Watchlist"}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
