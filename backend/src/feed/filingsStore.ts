export interface FilingAnnouncement {
  id: string;
  symbol: string;
  title: string;
  category: string;
  timestamp: Date;
  summary: string;
}

// In-memory mock announcements / exchange filings store covering the entire 30-symbol universe
const mockFilings: FilingAnnouncement[] = [
  {
    id: "filing-1",
    symbol: "NSE:TCS",
    title: "Outcome of Board Meeting - Q3 Dividend & Strategic European Acquisition",
    category: "Financial Results",
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    summary: "Board approves interim dividend of Rs 18 per share and $250M European cloud partnership."
  },
  {
    id: "filing-2",
    symbol: "NSE:HDFCBANK",
    title: "RBI Regulatory Approval Received for Subsidiary Restructuring",
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
    title: "Monthly Wholesale Volume Growth & EV Delivery Release",
    category: "Operational Update",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    summary: "EV passenger vehicle sales surge 42% YoY for the current month."
  },
  {
    id: "filing-5",
    symbol: "NSE:SUNPHARMA",
    title: "US FDA Inspection Closure Notice (EIR Received for Halol)",
    category: "Regulatory",
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    summary: "Received Establishment Inspection Report from US FDA with Voluntary Action Indicated status."
  },
  {
    id: "filing-6",
    symbol: "NSE:INFY",
    title: "Infosys Signs $1.2B Enterprise AI Collaboration with Global Telecom Leader",
    category: "Business Update",
    timestamp: new Date(Date.now() - 50 * 60 * 1000),
    summary: "Expanded multi-year engagement to build generative AI operations and automated cloud workflows."
  },
  {
    id: "filing-7",
    symbol: "NSE:ITC",
    title: "NCLT Approves Scheme of Arrangement for Demerger of Hotels Business",
    category: "Corporate Restructuring",
    timestamp: new Date(Date.now() - 90 * 60 * 1000),
    summary: "National Company Law Tribunal sanctions demerger of ITC Hotels with 1:10 direct share allotment ratio."
  },
  {
    id: "filing-8",
    symbol: "NSE:ICICIBANK",
    title: "Q3 Financial Results: Net Profit Rises 23.6% YoY to Rs 10,270 Cr",
    category: "Financial Results",
    timestamp: new Date(Date.now() - 110 * 60 * 1000),
    summary: "Asset quality strengthens with Gross NPA moderating to 2.30% alongside 18% domestic loan growth."
  },
  {
    id: "filing-9",
    symbol: "NSE:SBIN",
    title: "State Bank of India Raises Rs 10,000 Cr via Tier 2 Infrastructure Bonds",
    category: "Capital Raising",
    timestamp: new Date(Date.now() - 130 * 60 * 1000),
    summary: "Oversubscribed 4.2x with coupon set at 7.36% to fund long-term national infrastructure debt."
  },
  {
    id: "filing-10",
    symbol: "NSE:MARUTI",
    title: "Monthly Production & Export Update: Record 1.85 Lakh Units Dispatched",
    category: "Operational Update",
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    summary: "Export volume reaches historic monthly peak driven by strong hybrid demand across Latin America & Europe."
  },
  {
    id: "filing-11",
    symbol: "NSE:RVNL",
    title: "Wins Rs 740 Cr Metro Rail Infrastructure Project from MMRDA",
    category: "Order Win",
    timestamp: new Date(Date.now() - 40 * 60 * 1000),
    summary: "Declared lowest bidder (L1) for design and construction of elevated viaduct and 6 metro stations."
  },
  {
    id: "filing-12",
    symbol: "NSE:IRCTC",
    title: "Partners with State Tourism Boards for Bharat Gaurav Tourist Circuits",
    category: "Business Expansion",
    timestamp: new Date(Date.now() - 75 * 60 * 1000),
    summary: "Executes 5-year operating MoU to manage specialized rail tourism packages across western and southern zones."
  },
  {
    id: "filing-13",
    symbol: "NSE:TECHM",
    title: "Announces Large Deal Win with Tier-1 US Healthcare Network",
    category: "Business Update",
    timestamp: new Date(Date.now() - 150 * 60 * 1000),
    summary: "$180M digital health transformation contract signed for next-generation patient portal and ERP modernization."
  },
  {
    id: "filing-14",
    symbol: "NSE:NTPC",
    title: "Commissions 500MW Ultra-Supercritical Thermal Unit in Odisha",
    category: "Capacity Addition",
    timestamp: new Date(Date.now() - 180 * 60 * 1000),
    summary: "Commercial operation declared, expanding total group installed generation capacity to 76,000 MW."
  },
  {
    id: "filing-15",
    symbol: "NSE:TATACONSUM",
    title: "Expansion of Premium Direct-to-Consumer Distribution Network",
    category: "Business Update",
    timestamp: new Date(Date.now() - 200 * 60 * 1000),
    summary: "Integrates organic foods supply chain reaching over 3.8 million retail touchpoints nationwide."
  }
];

export function getFilingsForSymbol(symbol: string, withinHours: number = 72): FilingAnnouncement[] {
  const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  return mockFilings.filter(f => f.symbol === symbol && f.timestamp >= cutoff);
}

export function getAllFilings(withinHours: number = 72): FilingAnnouncement[] {
  const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  return mockFilings.filter(f => f.timestamp >= cutoff);
}

export function addFiling(filing: FilingAnnouncement) {
  mockFilings.unshift(filing);
}
