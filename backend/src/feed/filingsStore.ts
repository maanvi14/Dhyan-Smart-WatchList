export interface FilingAnnouncement {
  id: string;
  symbol: string;
  title: string;
  category: string;
  timestamp: Date;
  summary: string;
}

// In-memory mock announcements / exchange filings store
const mockFilings: FilingAnnouncement[] = [
  {
    id: "filing-1",
    symbol: "NSE:TCS",
    title: "Outcome of Board Meeting - Q3 Dividend & Strategic Acquisition",
    category: "Financial Results",
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    summary: "Board approves interim dividend of Rs 18 per share and $250M European cloud partnership."
  },
  {
    id: "filing-2",
    symbol: "NSE:HDFCBANK",
    title: "RBI Regulatory Approval Received for Subsidiary Merger",
    category: "Regulatory",
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    summary: "Reserve Bank of India conveys no-objection for merger of financial services arms."
  },
  {
    id: "filing-3",
    symbol: "NSE:RELIANCE",
    title: "Press Release - Major New Clean Energy Offtake Agreement",
    category: "Business Update",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    summary: "Reliance New Energy executes binding 20-year green hydrogen supply agreement with global consortium."
  },
  {
    id: "filing-4",
    symbol: "NSE:TATAMOTORS",
    title: "Monthly Wholesale Volume Growth Data Release",
    category: "Operational Update",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    summary: "EV passenger vehicle sales surge 42% YoY for the current month."
  },
  {
    id: "filing-5",
    symbol: "NSE:SUNPHARMA",
    title: "US FDA Inspection Closure Notice (EIR Received)",
    category: "Regulatory",
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    summary: "Received Establishment Inspection Report from US FDA for Halol facility with Voluntary Action Indicated status."
  }
];

export function getFilingsForSymbol(symbol: string, withinHours: number = 4): FilingAnnouncement[] {
  const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  return mockFilings.filter(f => f.symbol === symbol && f.timestamp >= cutoff);
}

export function addFiling(filing: FilingAnnouncement) {
  mockFilings.unshift(filing);
}
