import type { BubbleSector, MarketSignal } from "../types";

export const INDEX_SYMBOLS = [
  { symbol: "^GSPC", finnhubSymbol: "SPY", name: "S&P 500", logoUrl: logoForDomain("ssga.com") },
  { symbol: "^NDX", finnhubSymbol: "QQQ", name: "Nasdaq 100", logoUrl: logoForDomain("invesco.com") },
  { symbol: "^DJI", finnhubSymbol: "DIA", name: "Dow Jones", logoUrl: logoForDomain("spglobal.com") },
  { symbol: "PSEI.PS", finnhubSymbol: "PSEI.PS", name: "PSEi" }
];

export const DEFAULT_WATCHLIST = [
  { symbol: "AAPL", name: "Apple", logoUrl: logoForDomain("apple.com") },
  { symbol: "MSFT", name: "Microsoft", logoUrl: logoForDomain("microsoft.com") },
  { symbol: "NVDA", name: "NVIDIA", logoUrl: logoForDomain("nvidia.com") },
  { symbol: "SM.PS", name: "SM Investments", logoUrl: logoForDomain("sminvestments.com") }
];

function logoForDomain(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

export const BASE_SIGNALS: Omit<MarketSignal, "id" | "updatedAt" | "strength">[] = [
  {
    category: "Tailwinds",
    title: "Earnings Revision Breadth Improving",
    detail: "Mega-cap technology and financials show stronger forward estimate momentum.",
    impact: "positive"
  },
  {
    category: "Tailwinds",
    title: "Rate-Cut Expectations Stabilizing",
    detail: "Short-end yield pressure has eased, supporting duration-sensitive growth assets.",
    impact: "positive"
  },
  {
    category: "Headwinds",
    title: "Inflation Risk Still Sticky",
    detail: "Services inflation and wage measures remain the main macro risk for multiples.",
    impact: "negative"
  },
  {
    category: "Headwinds",
    title: "Bond Yield Spikes Pressure Valuations",
    detail: "Equity risk premiums are thin if long-end yields resume climbing.",
    impact: "negative"
  },
  {
    category: "Divergence",
    title: "Large Caps Leading Small Caps",
    detail: "Index strength is concentrated in liquid leadership while breadth is uneven.",
    impact: "mixed"
  },
  {
    category: "Divergence",
    title: "Credit Calm, Equity Volatility Rising",
    detail: "Credit spreads remain contained despite a mild pickup in equity hedging demand.",
    impact: "mixed"
  },
  {
    category: "Catalysts",
    title: "FOMC Decision Window",
    detail: "Policy guidance and dot-plot revisions could reset rate expectations.",
    impact: "event"
  },
  {
    category: "Catalysts",
    title: "Earnings Reports Cluster",
    detail: "Large index constituents report this week, raising single-name gap risk.",
    impact: "event"
  }
];

export const BUBBLE_SECTORS: BubbleSector[] = [
  { sectorName: "AI Infrastructure", bubbleScore: 74, riskLevel: "elevated", ytdChange: 31.4 },
  { sectorName: "Crypto Equities", bubbleScore: 68, riskLevel: "elevated", ytdChange: 24.8 },
  { sectorName: "Defense Autonomy", bubbleScore: 56, riskLevel: "moderate", ytdChange: 15.2 },
  { sectorName: "Unprofitable Growth", bubbleScore: 81, riskLevel: "critical", ytdChange: 42.6 }
];
