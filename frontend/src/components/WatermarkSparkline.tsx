"use client";

interface SparklineProps {
  points?: number[];
  changePct: number;
  width?: number;
  height?: number;
  hasWatermarkDelta?: boolean;
}

export function WatermarkSparkline({
  points,
  changePct,
  width = 90,
  height = 32,
  hasWatermarkDelta = true
}: SparklineProps) {
  const defaultPoints = [100, 100.4, 99.8, 100.2, 101, 100.8, 101.4, 101.1, 101.9, 102.3, 102.1, 100 + changePct];
  const pts = (points && points.length >= 4) ? points : defaultPoints;

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min === 0 ? 1 : max - min;

  // Transform points into SVG coordinates
  const svgCoords = pts.map((val, idx) => {
    const x = (idx / (pts.length - 1)) * (width - 4) + 2;
    const y = height - 4 - ((val - min) / range) * (height - 8);
    return [Number(x.toFixed(1)), Number(y.toFixed(1))];
  });

  // Split path into Before Watermark (first 60%) and After Watermark (last 40%)
  const splitIdx = Math.floor(pts.length * 0.6);
  const beforePts = svgCoords.slice(0, splitIdx + 1);
  const afterPts = svgCoords.slice(splitIdx);

  const toPath = (coords: number[][]) => {
    if (coords.length === 0) return "";
    return coords.reduce((acc, [x, y], i) => i === 0 ? `M ${x},${y}` : `${acc} L ${x},${y}`, "");
  };

  const isPositive = changePct >= 0;
  const activeColor = isPositive ? "#10B981" : "#EF4444"; // emerald or rose/redwood

  return (
    <div className="flex flex-col items-end shrink-0" title="Left: Pre-visit | Right: Since last checked">
      <svg width={width} height={height} className="overflow-visible">
        {/* Pre-watermark line (Muted grey) */}
        {hasWatermarkDelta && (
          <path
            d={toPath(beforePts)}
            fill="none"
            stroke="#64748B"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            opacity="0.5"
          />
        )}

        {/* Post-watermark line (Vivid Emerald / Redwood with glow) */}
        <path
          d={toPath(hasWatermarkDelta ? afterPts : svgCoords)}
          fill="none"
          stroke={activeColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current price pulse dot at end */}
        {svgCoords.length > 0 && (
          <circle
            cx={svgCoords[svgCoords.length - 1][0]}
            cy={svgCoords[svgCoords.length - 1][1]}
            r="3"
            fill={activeColor}
            className="animate-pulse"
          />
        )}
      </svg>
      <span className="text-[9px] font-mono text-muted opacity-70 tracking-tighter mt-0.5">
        delta zone ⇥
      </span>
    </div>
  );
}
