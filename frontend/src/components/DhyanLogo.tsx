"use client";

interface DhyanLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function DhyanLogo({ size = "md", className = "" }: DhyanLogoProps) {
  const dimensions = {
    sm: "w-8 h-8 rounded-xl",
    md: "w-10 h-10 rounded-2xl",
    lg: "w-14 h-14 rounded-2xl",
  };

  const svgSize = {
    sm: 20,
    md: 24,
    lg: 32,
  };

  return (
    <div
      className={`relative flex items-center justify-center bg-gradient-to-br from-teal-400 via-brand-500 to-emerald-600 shadow-md shadow-brand-500/25 border border-white/20 transition-all duration-300 group-hover:shadow-brand-500/40 group-hover:scale-105 overflow-hidden ${dimensions[size]} ${className}`}
    >
      {/* Subtle geometric backlight glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4),transparent_60%)] pointer-events-none" />

      {/* Dhyan Iconic Third Eye / Focus Radar SVG */}
      <svg
        width={svgSize[size]}
        height={svgSize[size]}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 text-slate-950"
      >
        {/* Outer concentric lens / radar arc */}
        <path
          d="M4 16C7.5 9 12 5.5 16 5.5C20 5.5 24.5 9 28 16C24.5 23 20 26.5 16 26.5C12 26.5 7.5 23 4 16Z"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Central Iris ring */}
        <circle
          cx="16"
          cy="16"
          r="5.5"
          stroke="currentColor"
          strokeWidth="2.2"
        />

        {/* Focused inner nucleus spark */}
        <circle
          cx="16"
          cy="16"
          r="2.5"
          fill="currentColor"
        />

        {/* Precision radar tick marks */}
        <line x1="16" y1="2" x2="16" y2="4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="27.5" x2="16" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
