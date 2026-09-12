export const TIER_KEYS = {
  CONFIRMED: "CONFIRMED",
  UNEXPLAINED: "UNEXPLAINED",
  UNCERTAIN: "UNCERTAIN"
} as const;

export type TierKey = typeof TIER_KEYS[keyof typeof TIER_KEYS];

export const TIER_LABELS: Record<TierKey, string> = {
  CONFIRMED: "CATALYST CONFIRMED",
  UNEXPLAINED: "UNINFORMED FLOW",
  UNCERTAIN: "STALE QUOTE"
};

export const TIER_GLOSS: Record<TierKey, string> = {
  CONFIRMED: "Official exchange disclosure (Regulation 30) corroborates the market move.",
  UNEXPLAINED: "Price/volume anomaly detected with zero verified regulatory disclosures.",
  UNCERTAIN: "Market data heartbeat is stale or conflicting — quote cannot be verified."
};

export const SECONDARY_LABELS = {
  RIPPLE: "SECTOR CONTAGION",
  INSIDER: "INFORMED FLOW",
  MAGNITUDE: "SIGNAL STRENGTH"
} as const;
