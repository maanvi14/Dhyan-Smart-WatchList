export const TIER_KEYS = {
  CONFIRMED: "CONFIRMED",
  PRESS_CORROBORATED: "PRESS_CORROBORATED",
  UNEXPLAINED: "UNEXPLAINED",
  UNCERTAIN: "UNCERTAIN"
} as const;

export type TierKey = typeof TIER_KEYS[keyof typeof TIER_KEYS];

export const TIER_LABELS: Record<TierKey, string> = {
  CONFIRMED: "CATALYST CONFIRMED",
  PRESS_CORROBORATED: "PRESS CORROBORATED",
  UNEXPLAINED: "UNINFORMED FLOW",
  UNCERTAIN: "STALE QUOTE"
};

export const TIER_BADGES: Record<TierKey, { text: string; bg: string; textCol: string; border: string; icon: string }> = {
  CONFIRMED: {
    text: "CATALYST CONFIRMED",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    textCol: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-300 dark:border-emerald-500/40",
    icon: "🟢"
  },
  PRESS_CORROBORATED: {
    text: "PRESS CORROBORATED",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    textCol: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-500/40",
    icon: "📰"
  },
  UNEXPLAINED: {
    text: "UNINFORMED FLOW",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    textCol: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-500/40",
    icon: "🟡"
  },
  UNCERTAIN: {
    text: "STALE QUOTE",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    textCol: "text-rose-700 dark:text-rose-300",
    border: "border-rose-300 dark:border-rose-500/40",
    icon: "🔴"
  }
};

export const SECONDARY_LABELS = {
  RIPPLE: "SECTOR CONTAGION",
  INSIDER: "INFORMED FLOW",
  SIGNAL_STRENGTH: "SIGNAL STRENGTH"
} as const;
