import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("dhyan_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export interface User {
  id: string;
  email: string;
  name: string;
  investmentStyle: string;
  lowDataMode: boolean;
  watchlistId: string;
}

export interface WatchlistItemPrice {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  notes?: string;
  addedAt: string;
  lastViewedAt?: string;
  ltp: number;
  changePct: number;
  volume: number;
  avgVolume20d: number;
  sourceTrust: number;
  sourceType: "live" | "simulated";
  isStale: boolean;
  sparkline?: number[];
  latestEvent?: {
    id: string;
    confidenceTier: "CONFIRMED" | "UNEXPLAINED" | "UNCERTAIN";
    magnitude: number;
    detectedAt: string;
    sectorDivergence: boolean;
  } | null;
}

export interface ChangeEventData {
  id: string;
  watchlistItemId: string;
  symbol: string;
  name?: string;
  sector?: string;
  confidenceTier: "CONFIRMED" | "UNEXPLAINED" | "UNCERTAIN";
  magnitude: number;
  narrative: string;
  evidenceTrace: { step: string; timestamp: string; detail: string }[];
  sectorDivergence: boolean;
  volumeDivergence: boolean;
  detectedAt: string;
  notes?: string;
  stockChangePct?: number;
  sectorChangePct?: number;
  sectorSpread?: number;
  historicalCount?: number;
  patternNote?: string | null;
  filingData?: {
    title: string;
    category: string;
    timestamp: string;
    summary: string;
  } | null;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    return res.data;
  },
  signup: async (email: string, password: string, name: string) => {
    const res = await api.post("/auth/signup", { email, password, name });
    return res.data;
  },
  demoLogin: async () => {
    const res = await api.post("/auth/demo");
    return res.data;
  },
  getDemoInfo: async () => {
    const res = await api.get("/auth/demo-info");
    return res.data;
  }
};

export const watchlistApi = {
  getWatchlist: async (watchlistId: string) => {
    const res = await api.get(`/watchlists/${watchlistId}/live`);
    return res.data;
  },
  getSinceLastChecked: async (watchlistId: string) => {
    const res = await api.get(`/watchlists/${watchlistId}/since-last-checked`);
    return res.data;
  },
  getUnreadCount: async (watchlistId: string) => {
    const res = await api.get(`/watchlists/${watchlistId}/unread-count`);
    return res.data;
  },
  markSeen: async (watchlistId: string) => {
    const res = await api.post(`/watchlists/${watchlistId}/mark-seen`);
    return res.data;
  },
  markItemSeen: async (watchlistId: string, itemId: string) => {
    const res = await api.post(`/watchlists/${watchlistId}/items/${itemId}/mark-seen`);
    return res.data;
  },
  getConcentration: async (watchlistId: string) => {
    const res = await api.get(`/watchlists/${watchlistId}/concentration`);
    return res.data;
  },
  addItem: async (watchlistId: string, symbol: string, notes?: string) => {
    const res = await api.post(`/watchlists/${watchlistId}/items`, { symbol, notes });
    return res.data;
  },
  removeItem: async (watchlistId: string, itemId: string) => {
    const res = await api.delete(`/watchlists/${watchlistId}/items/${itemId}`);
    return res.data;
  },
  getSymbolsUniverse: async () => {
    const res = await api.get("/watchlists/universe/symbols");
    return res.data;
  }
};

export const chatApi = {
  sendMessage: async (watchlistId: string, message: string) => {
    const res = await api.post("/chat", { watchlistId, message });
    return res.data;
  }
};

export interface VerifyTipResult {
  extractedSymbol: string | null;
  symbolName?: string;
  sector?: string;
  isFilingClaim?: boolean;
  isPriceClaim?: boolean;
  confidenceTier: "CONFIRMED" | "UNEXPLAINED" | "UNCERTAIN" | null;
  narrative: string | null;
  narrativeHi?: string | null;
  evidenceTrace: { step: string; timestamp: string; detail: string }[];
  message?: string;
  messageHi?: string;
}

export const verifyTipApi = {
  verify: async (tipText: string): Promise<VerifyTipResult> => {
    const res = await api.post("/verify-tip", { tipText });
    return res.data;
  }
};

export const debugApi = {
  killFeed: async () => {
    const res = await api.post("/debug/feed/kill");
    return res.data;
  },
  reviveFeed: async () => {
    const res = await api.post("/debug/feed/revive");
    return res.data;
  },
  getFeedStatus: async () => {
    const res = await api.get("/debug/feed/status");
    return res.data;
  }
};
