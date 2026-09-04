export interface SymbolInfo {
  symbol: string;       // e.g. "NSE:TCS"
  ticker: string;       // e.g. "TCS.NS"
  name: string;
  sector: string;       // e.g. "IT", "Banking", "FMCG", "Auto", "Pharma"
  basePrice: number;    // e.g. 4150.0
  avgVolume20d: number; // e.g. 2500000
}

export const SYMBOL_UNIVERSE: SymbolInfo[] = [
  // IT Sector
  { symbol: "NSE:TCS", ticker: "TCS.NS", name: "Tata Consultancy Services", sector: "IT", basePrice: 4250.0, avgVolume20d: 2200000 },
  { symbol: "NSE:INFY", ticker: "INFY.NS", name: "Infosys Ltd", sector: "IT", basePrice: 1850.0, avgVolume20d: 5400000 },
  { symbol: "NSE:WIPRO", ticker: "WIPRO.NS", name: "Wipro Ltd", sector: "IT", basePrice: 530.0, avgVolume20d: 6100000 },
  { symbol: "NSE:TECHM", ticker: "TECHM.NS", name: "Tech Mahindra", sector: "IT", basePrice: 1620.0, avgVolume20d: 1800000 },
  { symbol: "NSE:HCLTECH", ticker: "HCLTECH.NS", name: "HCL Technologies", sector: "IT", basePrice: 1780.0, avgVolume20d: 2900000 },

  // Banking Sector
  { symbol: "NSE:HDFCBANK", ticker: "HDFCBANK.NS", name: "HDFC Bank Ltd", sector: "Banking", basePrice: 1650.0, avgVolume20d: 14500000 },
  { symbol: "NSE:ICICIBANK", ticker: "ICICIBANK.NS", name: "ICICI Bank Ltd", sector: "Banking", basePrice: 1220.0, avgVolume20d: 11200000 },
  { symbol: "NSE:SBIN", ticker: "SBIN.NS", name: "State Bank of India", sector: "Banking", basePrice: 830.0, avgVolume20d: 16800000 },
  { symbol: "NSE:KOTAKBANK", ticker: "KOTAKBANK.NS", name: "Kotak Mahindra Bank", sector: "Banking", basePrice: 1790.0, avgVolume20d: 3800000 },
  { symbol: "NSE:AXISBANK", ticker: "AXISBANK.NS", name: "Axis Bank Ltd", sector: "Banking", basePrice: 1170.0, avgVolume20d: 7400000 },

  // FMCG Sector
  { symbol: "NSE:HINDUNILVR", ticker: "HINDUNILVR.NS", name: "Hindustan Unilever", sector: "FMCG", basePrice: 2780.0, avgVolume20d: 1900000 },
  { symbol: "NSE:ITC", ticker: "ITC.NS", name: "ITC Ltd", sector: "FMCG", basePrice: 505.0, avgVolume20d: 12400000 },
  { symbol: "NSE:NESTLEIND", ticker: "NESTLEIND.NS", name: "Nestle India Ltd", sector: "FMCG", basePrice: 2520.0, avgVolume20d: 850000 },
  { symbol: "NSE:BRITANNIA", ticker: "BRITANNIA.NS", name: "Britannia Industries", sector: "FMCG", basePrice: 5760.0, avgVolume20d: 420000 },
  { symbol: "NSE:TATACONSUM", ticker: "TATACONSUM.NS", name: "Tata Consumer Products", sector: "FMCG", basePrice: 1190.0, avgVolume20d: 1600000 },

  // Auto Sector
  { symbol: "NSE:TATAMOTORS", ticker: "TATAMOTORS.NS", name: "Tata Motors Ltd", sector: "Auto", basePrice: 1080.0, avgVolume20d: 9800000 },
  { symbol: "NSE:MARUTI", ticker: "MARUTI.NS", name: "Maruti Suzuki India", sector: "Auto", basePrice: 12400.0, avgVolume20d: 560000 },
  { symbol: "NSE:M&M", ticker: "M&M.NS", name: "Mahindra & Mahindra", sector: "Auto", basePrice: 2850.0, avgVolume20d: 2800000 },
  { symbol: "NSE:HEROMOTOCO", ticker: "HEROMOTOCO.NS", name: "Hero MotoCorp", sector: "Auto", basePrice: 5420.0, avgVolume20d: 790000 },
  { symbol: "NSE:BAJAJ-AUTO", ticker: "BAJAJ-AUTO.NS", name: "Bajaj Auto Ltd", sector: "Auto", basePrice: 9950.0, avgVolume20d: 430000 },

  // Pharma Sector
  { symbol: "NSE:SUNPHARMA", ticker: "SUNPHARMA.NS", name: "Sun Pharmaceutical", sector: "Pharma", basePrice: 1720.0, avgVolume20d: 2600000 },
  { symbol: "NSE:CIPLA", ticker: "CIPLA.NS", name: "Cipla Ltd", sector: "Pharma", basePrice: 1580.0, avgVolume20d: 2100000 },
  { symbol: "NSE:DRREDDY", ticker: "DRREDDY.NS", name: "Dr Reddy's Labs", sector: "Pharma", basePrice: 6900.0, avgVolume20d: 670000 },
  { symbol: "NSE:DIVISLAB", ticker: "DIVISLAB.NS", name: "Divi's Laboratories", sector: "Pharma", basePrice: 4890.0, avgVolume20d: 590000 },
  { symbol: "NSE:APOLLOHOSP", ticker: "APOLLOHOSP.NS", name: "Apollo Hospitals", sector: "Pharma", basePrice: 6750.0, avgVolume20d: 490000 },

  // Energy & Infrastructure
  { symbol: "NSE:RELIANCE", ticker: "RELIANCE.NS", name: "Reliance Industries", sector: "Energy", basePrice: 3020.0, avgVolume20d: 6800000 },
  { symbol: "NSE:ONGC", ticker: "ONGC.NS", name: "Oil & Natural Gas Corp", sector: "Energy", basePrice: 320.0, avgVolume20d: 18500000 },
  { symbol: "NSE:NTPC", ticker: "NTPC.NS", name: "NTPC Ltd", sector: "Energy", basePrice: 410.0, avgVolume20d: 14200000 },
  { symbol: "NSE:POWERGRID", ticker: "POWERGRID.NS", name: "Power Grid Corp", sector: "Energy", basePrice: 340.0, avgVolume20d: 11900000 },
  { symbol: "NSE:BPCL", ticker: "BPCL.NS", name: "Bharat Petroleum", sector: "Energy", basePrice: 360.0, avgVolume20d: 8700000 },

  // Railways & Public Sector
  { symbol: "NSE:IRCTC", ticker: "IRCTC.NS", name: "Indian Railway Catering & Tourism Corp", sector: "Railways", basePrice: 940.0, avgVolume20d: 3200000 },
  { symbol: "NSE:RVNL", ticker: "RVNL.NS", name: "Rail Vikas Nigam Ltd", sector: "Railways", basePrice: 580.0, avgVolume20d: 8900000 }
];

export function getSymbolInfo(symbol: string): SymbolInfo | undefined {
  return SYMBOL_UNIVERSE.find(s => s.symbol === symbol || s.ticker === symbol);
}
