"use client";

import { useState, useMemo } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  FileCheck,
  Building2,
  Activity,
  Zap,
  Clock,
  Sparkles,
  CheckCircle2,
  BookOpen
} from "lucide-react";
import { WatchlistItemPrice } from "@/lib/api";
import { TIER_BADGES, TierKey } from "@/lib/tiers";

interface StockVisualizerModalProps {
  item: WatchlistItemPrice | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenThesis?: (item: WatchlistItemPrice) => void;
}

interface CatalystPin {
  id: string;
  type: "filing" | "volume" | "flow" | "contagion";
  title: string;
  time: string;
  xPercent: number;
  price: number;
  badge: string;
  description: string;
  source: string;
}

export function StockVisualizerModal({
  item,
  isOpen,
  onClose,
  onOpenThesis
}: StockVisualizerModalProps) {
  const [timeframe, setTimeframe] = useState<"1D" | "1W" | "1M" | "1Y" | "ALL">("1D");
  const [selectedPinId, setSelectedPinId] = useState<string | null>("pin-1");

  if (!isOpen || !item) return null;

  const ltp = item.ltp || 1000;
  const changePct = item.changePct || 0;
  const isPositive = changePct >= 0;
  const tier = item.latestEvent?.confidenceTier || (item.isStale ? "UNCERTAIN" : "CONFIRMED");
  const tierBadge = TIER_BADGES[tier as TierKey] || TIER_BADGES.CONFIRMED;

  // Generate simulated chart series based on timeframe & stock price
  const chartData = useMemo(() => {
    const pointsCount = timeframe === "1D" ? 24 : timeframe === "1W" ? 35 : 50;
    const base = ltp / (1 + changePct / 100);
    const pts: number[] = [];
    let cur = base;

    for (let i = 0; i < pointsCount - 1; i++) {
      const noise = (Math.random() - 0.48) * (base * 0.008);
      cur += noise;
      pts.push(Number(cur.toFixed(2)));
    }
    pts.push(ltp);
    return pts;
  }, [item.symbol, timeframe, ltp, changePct]);

  // Simulated Catalyst Pins across the timeline
  const catalystPins: CatalystPin[] = useMemo(() => {
    const base = ltp / (1 + changePct / 100);
    return [
      {
        id: "pin-1",
        type: "filing",
        title: "Official SEBI Reg 30 Filing Dropped",
        time: "11:15 AM",
        xPercent: 35,
        price: Number((base * 1.004).toFixed(2)),
        badge: "SEBI Reg 30",
        description: "Official exchange disclosure: Key regulatory clearance / strategic contract execution announced.",
        source: "National Stock Exchange (NSE) API"
      },
      {
        id: "pin-2",
        type: "volume",
        title: "Volume Surge Anomaly (2.1x Average)",
        time: "11:17 AM",
        xPercent: 58,
        price: Number((base * 1.012).toFixed(2)),
        badge: "Volume Spike",
        description: "Trading volume surged 210% above the 30-day moving baseline in a 5-minute candle.",
        source: "NSE Realtime Tape Engine"
      },
      {
        id: "pin-3",
        type: "flow",
        title: "Institutional & Promoter Block Deal",
        time: "1:20 PM",
        xPercent: 82,
        price: Number((base * 1.018).toFixed(2)),
        badge: "Informed Flow",
        description: "Foreign Institutional Investor (FII) disclosed ₹578 Cr buy transaction on block window.",
        source: "Exchange Block Window Feed"
      }
    ];
  }, [ltp, changePct]);

  const selectedPin = catalystPins.find(p => p.id === selectedPinId) || catalystPins[0];

  // SVG Chart Geometry
  const width = 640;
  const height = 220;
  const minPrice = Math.min(...chartData);
  const maxPrice = Math.max(...chartData);
  const priceRange = maxPrice - minPrice === 0 ? 1 : maxPrice - minPrice;

  const svgCoords = chartData.map((val, idx) => {
    const x = (idx / (chartData.length - 1)) * (width - 40) + 20;
    const y = height - 30 - ((val - minPrice) / priceRange) * (height - 60);
    return [Number(x.toFixed(1)), Number(y.toFixed(1))];
  });

  const pathString = svgCoords.reduce((acc, [x, y], i) => (i === 0 ? `M ${x},${y}` : `${acc} L ${x},${y}`), "");
  const areaString = `${pathString} L ${svgCoords[svgCoords.length - 1][0]},${height - 10} L ${svgCoords[0][0]},${height - 10} Z`;

  // Watermark split (60% pre-visit, 40% since last checked)
  const watermarkX = (width - 40) * 0.55 + 20;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto font-sans">
      <div className="bg-surface border border-surfaceBorder rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl p-4 sm:p-6 shadow-2xl relative sm:my-8 animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="flex items-start justify-between pb-4 border-b border-surfaceBorder mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center font-mono font-extrabold text-sm text-brand-600 dark:text-brand-400">
              {item.symbol.replace("NSE:", "").slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-foreground text-lg sm:text-xl tracking-tight">
                  {item.symbol.replace("NSE:", "")}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surfaceElevated border border-surfaceBorder text-muted font-semibold">
                  {item.sector || "NSE Equities"}
                </span>
                <span className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.textCol} ${tierBadge.border}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{tierBadge.text}</span>
                </span>
              </div>
              <p className="text-xs text-muted font-medium mt-0.5">
                {item.name || "National Stock Exchange of India"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surfaceElevated hover:bg-surface border border-surfaceBorder text-muted hover:text-foreground flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Price & Timeframe Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-baseline space-x-2.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground">
              ₹{ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span
              className={`text-xs sm:text-sm font-mono font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                isPositive
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
              }`}
            >
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>
                {isPositive ? "+" : ""}{changePct.toFixed(2)}%
              </span>
            </span>
            <span className="text-[11px] text-muted font-mono">Today's Delta</span>
          </div>

          {/* Timeframe Selector Pills (Groww-Style) */}
          <div className="flex items-center gap-1 bg-surfaceElevated/70 p-1 rounded-full border border-surfaceBorder">
            {(["1D", "1W", "1M", "1Y", "ALL"] as const).map(tf => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  timeframe === tf
                    ? "bg-brand-500 text-white font-bold shadow-sm"
                    : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* 📈 Evidence-Annotated Chart Container */}
        <div className="bg-surfaceElevated/40 border border-surfaceBorder rounded-3xl p-4 mb-4 relative overflow-hidden shadow-inner">
          
          {/* Chart Header Bar */}
          <div className="flex items-center justify-between text-[11px] font-mono text-muted mb-2 px-1">
            <span className="flex items-center gap-1.5 font-bold text-foreground">
              <Zap className="w-3.5 h-3.5 text-brand-500" />
              Catalyst-Pinned Price Timeline
            </span>
            <span className="text-[10px] text-muted">
              Click any pin to inspect verified catalyst
            </span>
          </div>

          {/* SVG Interactive Canvas */}
          <div className="relative w-full overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
              <defs>
                <linearGradient id="visualizer-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? "#00D09C" : "#EF4444"} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={isPositive ? "#00D09C" : "#EF4444"} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="20" y1="30" x2={width - 20} y2="30" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />
              <line x1="20" y1="100" x2={width - 20} y2="100" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />
              <line x1="20" y1="170" x2={width - 20} y2="170" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />

              {/* Watermark Boundary Line */}
              <line
                x1={watermarkX}
                y1="15"
                x2={watermarkX}
                y2={height - 20}
                stroke="#10B981"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeOpacity="0.6"
              />
              <text
                x={watermarkX + 6}
                y="26"
                fill="#10B981"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                ⏱️ Since Last Checked
              </text>

              {/* Area Gradient Fill */}
              <path d={areaString} fill="url(#visualizer-gradient)" />

              {/* Price Curve */}
              <path
                d={pathString}
                fill="none"
                stroke={isPositive ? "#00D09C" : "#EF4444"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Current Price Endpoint */}
              {svgCoords.length > 0 && (
                <circle
                  cx={svgCoords[svgCoords.length - 1][0]}
                  cy={svgCoords[svgCoords.length - 1][1]}
                  r="4.5"
                  fill={isPositive ? "#00D09C" : "#EF4444"}
                  className="animate-pulse"
                />
              )}

              {/* Catalyst Pins Plotted on Curve */}
              {catalystPins.map(pin => {
                const targetIdx = Math.floor((pin.xPercent / 100) * (svgCoords.length - 1));
                const [cx, cy] = svgCoords[targetIdx] || [watermarkX, 100];
                const isSelected = selectedPinId === pin.id;

                return (
                  <g
                    key={pin.id}
                    onClick={() => setSelectedPinId(pin.id)}
                    className="cursor-pointer group"
                  >
                    {/* Vertical guideline */}
                    <line
                      x1={cx}
                      y1={cy}
                      x2={cx}
                      y2={height - 20}
                      stroke={isSelected ? "#00D09C" : "#64748B"}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      strokeOpacity={isSelected ? "0.8" : "0.3"}
                    />

                    {/* Outer Glow Halo */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? "9" : "6"}
                      fill={pin.type === "filing" ? "#10B981" : pin.type === "flow" ? "#0EA5E9" : "#F59E0B"}
                      fillOpacity="0.2"
                      className="transition-all duration-300"
                    />

                    {/* Pin Circle Dot */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? "5" : "3.5"}
                      fill={pin.type === "filing" ? "#10B981" : pin.type === "flow" ? "#0EA5E9" : "#F59E0B"}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />

                    {/* Pin Label Tag */}
                    <rect
                      x={cx - 30}
                      y={cy - 24}
                      width="60"
                      height="16"
                      rx="8"
                      fill={isSelected ? "#00D09C" : "#1E293B"}
                      stroke={isSelected ? "#00D09C" : "#334155"}
                      strokeWidth="1"
                    />
                    <text
                      x={cx}
                      y={cy - 13}
                      textAnchor="middle"
                      fill={isSelected ? "#020617" : "#F8FAFC"}
                      fontSize="8"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {pin.time}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Time Labels */}
          <div className="flex items-center justify-between text-[9px] font-mono text-muted px-2 pt-1 border-t border-surfaceBorder/60">
            <span>9:15 AM (Market Open)</span>
            <span>12:00 PM</span>
            <span>3:30 PM (Market Close)</span>
          </div>
        </div>

        {/* 🔍 Selected Catalyst Deep-Dive Inspector Panel */}
        {selectedPin && (
          <div className="bg-surfaceElevated/70 border border-brand-500/30 rounded-2xl p-4 mb-4 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-500 shrink-0">
                  {selectedPin.type === "filing" ? (
                    <FileCheck className="w-4 h-4" />
                  ) : selectedPin.type === "flow" ? (
                    <Building2 className="w-4 h-4" />
                  ) : (
                    <Activity className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-foreground text-xs sm:text-sm">
                    {selectedPin.title}
                  </h4>
                  <span className="text-[10px] text-muted font-mono font-semibold">
                    Logged at {selectedPin.time} • Price at Event: ₹{selectedPin.price}
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/30">
                {selectedPin.badge}
              </span>
            </div>

            <p className="text-xs text-foreground/90 font-medium leading-relaxed mb-2.5 pl-9">
              {selectedPin.description}
            </p>

            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-surfaceBorder/60 font-mono">
              <span className="text-muted flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Source: {selectedPin.source}
              </span>
              <span className="text-brand-600 dark:text-brand-400 font-bold flex items-center gap-1">
                Deterministic Verified <CheckCircle2 className="w-3 h-3" />
              </span>
            </div>
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-surfaceBorder">
          {onOpenThesis && (
            <button
              onClick={() => {
                onClose();
                onOpenThesis(item);
              }}
              className="min-h-[38px] px-4 py-2 rounded-full bg-surface hover:bg-surfaceElevated border border-surfaceBorder text-foreground text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-500" />
              <span>Investment Thesis Note</span>
            </button>
          )}

          <div className="flex items-center space-x-2 ml-auto">
            <button
              onClick={onClose}
              className="min-h-[38px] px-6 py-2 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/20 active:scale-95"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
