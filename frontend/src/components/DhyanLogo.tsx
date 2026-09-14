"use client";

interface DhyanLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  useFullBanner?: boolean;
}

export function DhyanLogo({ size = "md", className = "", useFullBanner = false }: DhyanLogoProps) {
  const dimensions = {
    sm: "h-10 w-10 p-1.5",
    md: "h-12 w-12 p-2",
    lg: "h-16 w-16 p-2.5",
    xl: "h-20 w-20 p-3",
  };

  return (
    <div
      className={`relative flex items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-brand-500/30 dark:border-brand-500/40 shadow-md shadow-brand-500/15 transition-all duration-300 group-hover:scale-105 group-hover:shadow-brand-500/30 group-hover:border-brand-500/60 overflow-hidden shrink-0 ${dimensions[size]} ${className}`}
    >
      <img
        src={useFullBanner ? "/dhyan-logo.png" : "/dhyan-icon.png"}
        alt="Dhyan Logo"
        className="w-full h-full object-contain"
      />
    </div>
  );
}
