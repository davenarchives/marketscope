export type MarketCategory = "Tailwinds" | "Headwinds" | "Divergence" | "Catalysts";
export type RiskLevel = "moderate" | "elevated" | "critical";

export interface SparkPoint {
  time: number;
  value: number;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  logoUrl?: string;
  price: number;
  change: number;
  percentChange: number;
  sparkline: SparkPoint[];
  source: "finnhub" | "yahoo" | "simulated";
  updatedAt: string;
}

export interface MarketCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MarketSignal {
  id: string;
  category: MarketCategory;
  title: string;
  detail: string;
  impact: "positive" | "negative" | "mixed" | "event";
  strength: number;
  updatedAt: string;
}

export interface BubbleSector {
  sectorName: string;
  bubbleScore: number;
  riskLevel: RiskLevel;
  ytdChange: number;
}

export interface Snapshot {
  indices: MarketQuote[];
  watchlist: MarketQuote[];
  candles: Record<string, MarketCandle[]>;
  signals: MarketSignal[];
  bubbles: BubbleSector[];
  updatedAt: string;
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
}
