import { config } from "../config.js";
import type { MarketCandle, MarketQuote, SparkPoint } from "../types.js";

export interface SymbolMeta {
  symbol: string;
  finnhubSymbol?: string;
  name: string;
  logoUrl?: string;
}

export type CandleRange = "1d" | "1m" | "3m" | "1y" | "5y" | "all";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(operation: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(250 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

async function fetchJson<T>(url: string, timeoutMs = 3500): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "market-scope/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export class MarketDataProvider {
  private readonly simulatedState = new Map<string, MarketQuote>();
  private readonly logoState = new Map<string, string | undefined>();

  async quote(meta: SymbolMeta): Promise<MarketQuote> {
    if (config.FINNHUB_API_KEY) {
      try {
        return await this.finnhubQuote(meta);
      } catch {
        // Yahoo or simulation will fill the gap.
      }
    }

    if (config.YAHOO_FINANCE_ENABLED) {
      try {
        return await this.yahooQuote(meta);
      } catch {
        // Simulation is the final fallback.
      }
    }

    return this.simulatedQuote(meta);
  }

  async candles(meta: SymbolMeta, range: CandleRange = "1d"): Promise<MarketCandle[]> {
    if (config.FINNHUB_API_KEY) {
      try {
        return await this.finnhubCandles(meta, range);
      } catch {
        // Yahoo or simulation will fill the gap.
      }
    }

    if (config.YAHOO_FINANCE_ENABLED) {
      try {
        return await this.yahooCandles(meta, range);
      } catch {
        // Simulation is the final fallback.
      }
    }

    return this.simulatedCandles(meta, range);
  }

  private async finnhubQuote(meta: SymbolMeta): Promise<MarketQuote> {
    type FinnhubQuote = {
      c?: number;
      d?: number;
      dp?: number;
      pc?: number;
      t?: number;
    };

    const symbol = encodeURIComponent(meta.finnhubSymbol ?? meta.symbol);
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${config.FINNHUB_API_KEY}`;
    const data = await withRetry(() => fetchJson<FinnhubQuote>(url));

    if (!data.c || data.c <= 0) {
      throw new Error("Finnhub returned no current price");
    }

    return {
      symbol: meta.symbol,
      name: meta.name,
      logoUrl: await this.logoUrl(meta),
      price: round(data.c),
      change: round(data.d ?? data.c - (data.pc ?? data.c)),
      percentChange: round(data.dp ?? 0),
      sparkline: this.extendSparkline(meta.symbol, data.c),
      source: "finnhub",
      updatedAt: new Date((data.t ?? Date.now() / 1000) * 1000).toISOString()
    };
  }

  private async yahooQuote(meta: SymbolMeta): Promise<MarketQuote> {
    type YahooChart = {
      chart: {
        result?: Array<{
          meta: { regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number };
          timestamp?: number[];
          indicators: { quote?: Array<{ close?: Array<number | null> }> };
        }>;
      };
    };

    const symbol = encodeURIComponent(meta.symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=5m`;
    const data = await withRetry(() => fetchJson<YahooChart>(url));
    const result = data.chart.result?.[0];
    const price = result?.meta.regularMarketPrice;

    if (!price || price <= 0) {
      throw new Error("Yahoo Finance returned no current price");
    }

    const previousClose = result.meta.previousClose ?? result.meta.chartPreviousClose ?? price;
    const closes = result.indicators.quote?.[0]?.close ?? [];
    const timestamps = result.timestamp ?? [];
    const sparkline = closes
      .map((value, index) => (value ? { time: timestamps[index] ? timestamps[index] * 1000 : Date.now(), value: round(value) } : null))
      .filter((point): point is SparkPoint => Boolean(point))
      .slice(-32);

    const change = price - previousClose;

    return {
      symbol: meta.symbol,
      name: meta.name,
      logoUrl: await this.logoUrl(meta),
      price: round(price),
      change: round(change),
      percentChange: round((change / previousClose) * 100),
      sparkline: sparkline.length ? sparkline : this.extendSparkline(meta.symbol, price),
      source: "yahoo",
      updatedAt: new Date().toISOString()
    };
  }

  private async finnhubCandles(meta: SymbolMeta, range: CandleRange): Promise<MarketCandle[]> {
    type FinnhubCandles = {
      c?: number[];
      h?: number[];
      l?: number[];
      o?: number[];
      s?: string;
      t?: number[];
    };

    const { from, limit, resolution, to } = finnhubRange(range);
    const symbol = encodeURIComponent(meta.finnhubSymbol ?? meta.symbol);
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${config.FINNHUB_API_KEY}`;
    const data = await withRetry(() => fetchJson<FinnhubCandles>(url));

    if (data.s !== "ok" || !data.t?.length || !data.o || !data.h || !data.l || !data.c) {
      throw new Error("Finnhub returned no candles");
    }

    return data.t
      .map((time, index) => normalizeCandle({
        time,
        open: data.o?.[index],
        high: data.h?.[index],
        low: data.l?.[index],
        close: data.c?.[index]
      }))
      .filter((candle): candle is MarketCandle => Boolean(candle))
      .slice(-limit);
  }

  private async yahooCandles(meta: SymbolMeta, range: CandleRange): Promise<MarketCandle[]> {
    type YahooChart = {
      chart: {
        result?: Array<{
          timestamp?: number[];
          indicators: {
            quote?: Array<{
              close?: Array<number | null>;
              high?: Array<number | null>;
              low?: Array<number | null>;
              open?: Array<number | null>;
            }>;
          };
        }>;
      };
    };

    const { interval, limit, range: yahooRange } = yahooRangeOptions(range);
    const symbol = encodeURIComponent(meta.symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${yahooRange}&interval=${interval}`;
    const data = await withRetry(() => fetchJson<YahooChart>(url));
    const result = data.chart.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const quote = result?.indicators.quote?.[0];

    if (!timestamps.length || !quote?.open?.length) {
      throw new Error("Yahoo Finance returned no candles");
    }

    return timestamps
      .map((time, index) => normalizeCandle({
        time,
        open: quote.open?.[index],
        high: quote.high?.[index],
        low: quote.low?.[index],
        close: quote.close?.[index]
      }))
      .filter((candle): candle is MarketCandle => Boolean(candle))
      .slice(-limit);
  }

  async simulatedQuote(meta: SymbolMeta): Promise<MarketQuote> {
    const existing = this.simulatedState.get(meta.symbol);
    const basePrice = existing?.price ?? seededPrice(meta.symbol);
    const drift = (Math.random() - 0.47) * Math.max(basePrice * 0.003, 0.2);
    const price = Math.max(basePrice + drift, 1);
    const previous = existing?.sparkline[0]?.value ?? basePrice * 0.99;
    const change = price - previous;

    const quote: MarketQuote = {
      symbol: meta.symbol,
      name: meta.name,
      logoUrl: await this.logoUrl(meta),
      price: round(price),
      change: round(change),
      percentChange: round((change / previous) * 100),
      sparkline: this.extendSparkline(meta.symbol, price),
      source: "simulated",
      updatedAt: new Date().toISOString()
    };

    this.simulatedState.set(meta.symbol, quote);
    return quote;
  }

  simulatedCandles(meta: SymbolMeta, range: CandleRange = "1d"): MarketCandle[] {
    const now = Math.floor(Date.now() / 1000);
    const { intervalSeconds, limit } = simulatedRange(range);
    let close = this.simulatedState.get(meta.symbol)?.price ?? seededPrice(meta.symbol);

    return Array.from({ length: limit }, (_, index) => {
      const time = now - (limit - index) * intervalSeconds;
      const open = close;
      const swing = Math.max(open * (0.002 + Math.random() * 0.005), 0.1);
      close = Math.max(open + (Math.random() - 0.48) * swing, 1);
      const high = Math.max(open, close) + Math.random() * swing;
      const low = Math.min(open, close) - Math.random() * swing;

      return {
        time,
        open: round(open),
        high: round(high),
        low: round(low),
        close: round(close)
      };
    });
  }

  private extendSparkline(symbol: string, price: number): SparkPoint[] {
    const existing = this.simulatedState.get(symbol)?.sparkline ?? [];
    const next = [...existing, { time: Date.now(), value: round(price) }].slice(-32);

    if (next.length < 12) {
      const seed = seededPrice(symbol);
      return Array.from({ length: 12 }, (_, index) => ({
        time: Date.now() - (12 - index) * 5000,
        value: round(seed * (1 + (Math.sin(index / 2) + Math.random() - 0.5) * 0.006))
      })).concat(next).slice(-32);
    }

    return next;
  }

  private async logoUrl(meta: SymbolMeta): Promise<string | undefined> {
    if (meta.logoUrl) return meta.logoUrl;
    if (this.logoState.has(meta.symbol)) return this.logoState.get(meta.symbol);

    const symbol = meta.finnhubSymbol ?? meta.symbol;
    const logo = config.FINNHUB_API_KEY ? await this.finnhubLogo(symbol) : undefined;
    this.logoState.set(meta.symbol, logo);
    return logo;
  }

  private async finnhubLogo(symbol: string): Promise<string | undefined> {
    type FinnhubProfile = {
      logo?: string;
    };

    try {
      const encoded = encodeURIComponent(symbol);
      const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encoded}&token=${config.FINNHUB_API_KEY}`;
      const data = await withRetry(() => fetchJson<FinnhubProfile>(url));
      return data.logo || undefined;
    } catch {
      return undefined;
    }
  }
}

function yahooRangeOptions(range: CandleRange) {
  const ranges: Record<CandleRange, { interval: string; limit: number; range: string }> = {
    "1d": { interval: "5m", limit: 120, range: "1d" },
    "1m": { interval: "1h", limit: 180, range: "1mo" },
    "3m": { interval: "1d", limit: 90, range: "3mo" },
    "1y": { interval: "1d", limit: 260, range: "1y" },
    "5y": { interval: "1wk", limit: 260, range: "5y" },
    all: { interval: "1mo", limit: 360, range: "max" }
  };

  return ranges[range];
}

function finnhubRange(range: CandleRange) {
  const to = Math.floor(Date.now() / 1000);
  const day = 24 * 60 * 60;
  const ranges: Record<CandleRange, { from: number; limit: number; resolution: string; to: number }> = {
    "1d": { from: to - 2 * day, limit: 120, resolution: "5", to },
    "1m": { from: to - 31 * day, limit: 180, resolution: "60", to },
    "3m": { from: to - 95 * day, limit: 95, resolution: "D", to },
    "1y": { from: to - 370 * day, limit: 260, resolution: "D", to },
    "5y": { from: to - 5 * 370 * day, limit: 260, resolution: "W", to },
    all: { from: to - 20 * 370 * day, limit: 360, resolution: "M", to }
  };

  return ranges[range];
}

function simulatedRange(range: CandleRange) {
  const ranges: Record<CandleRange, { intervalSeconds: number; limit: number }> = {
    "1d": { intervalSeconds: 300, limit: 96 },
    "1m": { intervalSeconds: 4 * 60 * 60, limit: 180 },
    "3m": { intervalSeconds: 24 * 60 * 60, limit: 90 },
    "1y": { intervalSeconds: 24 * 60 * 60, limit: 260 },
    "5y": { intervalSeconds: 7 * 24 * 60 * 60, limit: 260 },
    all: { intervalSeconds: 30 * 24 * 60 * 60, limit: 240 }
  };

  return ranges[range];
}

function seededPrice(symbol: string): number {
  const seed = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  if (symbol.includes("GSPC")) return 5200 + seed;
  if (symbol.includes("NDX")) return 17800 + seed;
  if (symbol.includes("DJI")) return 38500 + seed;
  if (symbol.includes("PSEI")) return 6400 + seed / 10;
  return 80 + (seed % 500);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeCandle(candle: {
  time: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
}): MarketCandle | null {
  const { time, open, high, low, close } = candle;

  if (!open || !high || !low || !close) {
    return null;
  }

  return {
    time,
    open: round(open),
    high: round(high),
    low: round(low),
    close: round(close)
  };
}
