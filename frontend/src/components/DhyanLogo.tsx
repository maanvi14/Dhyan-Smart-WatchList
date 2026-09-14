"use client";

interface DhyanLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function DhyanLogo({ size = "md", className = "" }: DhyanLogoProps) {
  const dimensions = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
    xl: "h-20 w-20",
  };

  return (
    <div
      className={`relative flex items-center justify-center rounded-xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm shadow-emerald-500/10 p-1 transition-all duration-300 group-hover:shadow-brand-500/30 group-hover:scale-105 overflow-hidden ${dimensions[size]} ${className}`}
    >
      <img
        src="/dhyan-logo.png"
        alt="Dhyan Logo"
        className="w-full h-full object-contain"
      />
    </div>
  );
}
