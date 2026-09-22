"use client";

import { useState, useEffect } from "react";
import { X, BookOpen, AlertOctagon, Save, Sparkles } from "lucide-react";
import { watchlistApi, WatchlistItemPrice } from "@/lib/api";

interface ResearchThesisModalProps {
  isOpen: boolean;
  onClose: () => void;
  watchlistId: string;
  item: WatchlistItemPrice | null;
  onSaved: () => void;
}

export function ResearchThesisModal({
  isOpen,
  onClose,
  watchlistId,
  item,
  onSaved
}: ResearchThesisModalProps) {
  const [thesisText, setThesisText] = useState("");
  const [invalidationPoint, setInvalidationPoint] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item && item.notes) {
      try {
        const parsed = JSON.parse(item.notes);
        if (typeof parsed === "object" && parsed !== null) {
          setThesisText(parsed.thesisText || "");
          setInvalidationPoint(parsed.invalidationPoint || "");
          return;
        }
      } catch (_) {
        // legacy plain text notes
        setThesisText(item.notes);
        setInvalidationPoint("");
        return;
      }
    }
    setThesisText("");
    setInvalidationPoint("");
  }, [item]);

  if (!isOpen || !item) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await watchlistApi.updateThesis(watchlistId, item.id, thesisText.trim(), invalidationPoint.trim());
      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save research thesis", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-surface border border-surfaceBorder rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg p-5 shadow-2xl relative animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-500">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">
                Research Thesis &amp; Invalidation Point
              </h3>
              <p className="text-[11px] font-mono text-muted">
                {item.symbol} • {item.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] text-muted hover:text-foreground flex items-center justify-center rounded-xl hover:bg-surfaceElevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 text-xs">
          
          {/* Field 1: Why is this in your watchlist? */}
          <div>
            <label className="block text-foreground font-semibold mb-1 flex items-center space-x-1.5">
              <span>Why is this stock in your watchlist?</span>
            </label>
            <textarea
              value={thesisText}
              onChange={e => setThesisText(e.target.value)}
              placeholder="e.g. Underperformed sector by 8% in August. Watching for mean reversion following upcoming Q3 earnings..."
              rows={3}
              className="w-full bg-surfaceElevated border border-surfaceBorder rounded-xl p-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-brand-500/80 transition-colors resize-none font-sans leading-relaxed"
            />
          </div>

          {/* Field 2: Invalidation Point */}
          <div>
            <label className="block text-rose-600 dark:text-rose-400 font-semibold mb-1 flex items-center space-x-1.5">
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>When does this thesis break? (Invalidation Point)</span>
            </label>
            <textarea
              value={invalidationPoint}
              onChange={e => setInvalidationPoint(e.target.value)}
              placeholder="e.g. If stock drops below 200 SMA at ₹1,580 or promoter sells >₹50Cr, exit the thesis immediately..."
              rows={2}
              className="w-full bg-surfaceElevated border border-surfaceBorder rounded-xl p-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-rose-500/80 transition-colors resize-none font-sans leading-relaxed"
            />
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-surfaceBorder flex items-center justify-between">
            <span className="text-[11px] font-mono text-muted hidden sm:inline">
              Document reason before price reacts.
            </span>
            <div className="flex items-center space-x-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted hover:text-foreground hover:bg-surfaceElevated transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-brand-500/20 transition-all active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? "Saving..." : "Save Thesis"}</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
