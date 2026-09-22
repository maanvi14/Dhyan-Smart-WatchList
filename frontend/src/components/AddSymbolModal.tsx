"use client";

import { useEffect, useState } from "react";
import { X, Search, Plus, FileText, Check, Sparkles } from "lucide-react";
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

const CATEGORIES = ["All", "Banking", "IT", "Auto", "Pharma", "Energy", "Metals"];

export function AddSymbolModal({ watchlistId, isOpen, onClose, onAdded }: AddSymbolModalProps) {
  const [universe, setUniverse] = useState<SymbolOption[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = universe.filter(s => {
    const matchesSearch =
      s.symbol.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.sector.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory =
      activeCategory === "All" ||
      s.sector.toLowerCase().includes(activeCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-surface border border-surfaceBorder rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg p-5 sm:p-6 shadow-2xl relative animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surfaceBorder mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 border border-brand-500/20">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-foreground text-base">
                Add Stocks to Watchlist
              </h3>
              <p className="text-[11px] text-muted">
                Zero-noise watchlist with verified SEBI & exchange catalysts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 text-muted hover:text-foreground flex items-center justify-center rounded-full hover:bg-surfaceElevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-2xl mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Search Field */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-4 top-3.5" />
            <input
              type="text"
              autoFocus
              placeholder="Search TCS, Reliance, Banking, Autos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surfaceElevated border border-surfaceBorder rounded-2xl pl-11 pr-4 py-3 text-xs text-foreground placeholder-muted focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all min-h-[44px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-3 text-xs text-muted hover:text-foreground p-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills (Groww-Style) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map(cat => (
              <button
                type="button"
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? "bg-brand-500 text-white font-bold shadow-sm"
                    : "bg-surfaceElevated hover:bg-surface text-muted hover:text-foreground border border-surfaceBorder"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Autocomplete / Stock List */}
          <div className="max-h-56 overflow-y-auto border border-surfaceBorder rounded-2xl bg-surfaceElevated/50 divide-y divide-surfaceBorder">
            {filtered.length === 0 ? (
              <div className="p-6 text-xs text-muted text-center">
                No matching stocks found in verified universe
              </div>
            ) : (
              filtered.map(item => {
                const isSelected = selectedSymbol === item.symbol;
                return (
                  <button
                    type="button"
                    key={item.symbol}
                    onClick={() => setSelectedSymbol(item.symbol)}
                    className={`w-full text-left p-3.5 min-h-[48px] flex items-center justify-between text-xs transition-all ${
                      isSelected
                        ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold"
                        : "hover:bg-surface text-foreground"
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-[10px] ${
                        isSelected
                          ? "bg-brand-500 text-white"
                          : "bg-surface border border-surfaceBorder text-muted"
                      }`}>
                        {item.symbol.replace("NSE:", "").slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold font-mono text-foreground block truncate">
                          {item.symbol.replace("NSE:", "")}
                        </span>
                        <span className="text-[11px] text-muted truncate block">
                          {item.name}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3 flex items-center space-x-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-surfaceBorder text-muted">
                        {item.sector}
                      </span>
                      <span className="font-bold font-mono text-foreground text-xs">
                        ₹{item.basePrice.toLocaleString("en-IN")}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-brand-500 shrink-0 ml-1" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Optional User Note */}
          <div>
            <label className="block text-xs text-muted font-semibold mb-1.5 flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-muted" />
              <span>Investment Thesis / Context Note (Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Long-term compounder, Q2 earnings catalyst"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-surfaceElevated border border-surfaceBorder rounded-2xl px-4 py-2.5 text-xs text-foreground placeholder-muted focus:outline-none focus:border-brand-500 transition-all min-h-[44px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedSymbol || loading}
              className="min-h-[40px] px-6 py-2 bg-brand-500 hover:bg-brand-600 font-bold text-white rounded-full text-xs transition-all shadow-md shadow-brand-500/20 active:scale-95 disabled:opacity-40 flex items-center space-x-1.5"
            >
              {loading ? (
                <span>Adding...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add to Watchlist</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
