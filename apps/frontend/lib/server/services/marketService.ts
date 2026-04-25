import { BUBBLE_SECTORS, BASE_SIGNALS, INDEX_SYMBOLS } from "../data/symbols";
import type { BubbleSector, MarketCandle, MarketQuote, MarketSignal, WatchlistItem } from "../types";
import { CacheService } from "./cache";
import { MarketDataProvider, type CandleRange, type SymbolMeta } from "./providers";
import { WatchlistStore } from "./watchlistStore";

export class MarketService {
  constructor(
    private readonly cache: CacheService,
    private readonly provider: MarketDataProvider,
    private readonly watchlist: WatchlistStore
  ) {}

  async indices(): Promise<MarketQuote[]> {
    return Promise.all(INDEX_SYMBOLS.map((symbol) => this.cachedQuote(symbol)));
  }

  async watchlistItems(): Promise<WatchlistItem[]> {
    return this.watchlist.list();
  }

  async watchlistQuotes(): Promise<MarketQuote[]> {
    const items = await this.watchlist.list();
    return Promise.all(items.map((item) => this.cachedQuote(item)));
  }

  async snapshot() {
    const [indices, watchlist] = await Promise.all([this.indices(), this.watchlistQuotes()]);
    const symbols = [...indices, ...watchlist];
    const candleEntries = await Promise.all(
      symbols.map(async (quote) => [quote.symbol, await this.candles(quote.symbol, quote, "1d")] as const)
    );

    return {
      indices,
      watchlist,
      candles: Object.fromEntries(candleEntries),
      signals: this.signals(),
      bubbles: this.bubbles(),
      updatedAt: new Date().toISOString()
    };
  }

  async candles(symbol: string, latestQuote?: MarketQuote, range: CandleRange = "1d"): Promise<MarketCandle[]> {
    const meta = await this.resolveSymbol(symbol);
    const key = `candles:${meta.symbol}:${range}`;
    const cached = await this.cache.get<MarketCandle[]>(key);

    if (cached?.length) {
      const updated = latestQuote && range === "1d" ? normalizeCandleSeries(updateLastCandle(cached, latestQuote.price), latestQuote.price) : cached;
      await this.cache.set(key, updated, 30);
      return updated;
    }

    const candles = await this.provider.candles(meta, range);
    const updated = latestQuote && range === "1d" ? normalizeCandleSeries(updateLastCandle(candles, latestQuote.price), latestQuote.price) : candles;
    await this.cache.set(key, updated, 30);
    return updated;
  }

  async addWatchlistItem(symbol: string, name?: string): Promise<WatchlistItem> {
    return this.watchlist.add(symbol, name);
  }

  async removeWatchlistItem(symbol: string): Promise<void> {
    await this.watchlist.remove(symbol);
  }

  async lookupSymbols(query: string): Promise<Array<{ symbol: string; name: string }>> {
    const normalized = query.trim().toUpperCase();
    if (!normalized) return [];

    const watchlist = await this.watchlist.list();
    const known = [...INDEX_SYMBOLS, ...watchlist];
    const matches = known
      .filter((item) => item.symbol.includes(normalized) || item.name.toUpperCase().includes(normalized))
      .map((item) => ({ symbol: item.symbol, name: item.name }));

    if (matches.length) {
      return matches.slice(0, 8);
    }

    return [{ symbol: normalized, name: normalized }];
  }

  signals(): MarketSignal[] {
    return BASE_SIGNALS.map((signal, index) => ({
      ...signal,
      id: `${signal.category.toLowerCase()}-${index}`,
      strength: clamp(55 + Math.round(Math.sin(Date.now() / 150000 + index) * 24 + Math.random() * 8), 35, 95),
      updatedAt: new Date().toISOString()
    }));
  }

  bubbles(): BubbleSector[] {
    return BUBBLE_SECTORS.map((sector, index) => {
      const score = clamp(sector.bubbleScore + Math.round(Math.sin(Date.now() / 180000 + index) * 4), 0, 100);

      return {
        ...sector,
        bubbleScore: score,
        riskLevel: score >= 80 ? "critical" : score >= 60 ? "elevated" : "moderate",
        ytdChange: Math.round((sector.ytdChange + Math.sin(Date.now() / 210000 + index) * 2.5) * 10) / 10
      };
    });
  }

  private async cachedQuote(symbol: SymbolMeta): Promise<MarketQuote> {
    const key = `quote:${symbol.symbol}`;
    const cached = await this.cache.get<MarketQuote>(key);
    if (cached) return cached;

    const quote = await this.provider.quote(symbol);
    await this.cache.set(key, quote);
    return quote;
  }

  private async resolveSymbol(symbol: string): Promise<SymbolMeta> {
    const normalized = symbol.toUpperCase();
    const index = INDEX_SYMBOLS.find((item) => item.symbol.toUpperCase() === normalized);
    if (index) return index;

    const watchlist = await this.watchlist.list();
    const item = watchlist.find((candidate) => candidate.symbol.toUpperCase() === normalized);
    if (item) return item;

    return { symbol: normalized, name: normalized };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function updateLastCandle(candles: MarketCandle[], price: number): MarketCandle[] {
  const bucketTime = Math.floor(Date.now() / 300000) * 300;
  const last = candles.at(-1);

  if (!last) {
    return [{ time: bucketTime, open: price, high: price, low: price, close: price }];
  }

  if (last.time < bucketTime && bucketTime - last.time <= 900) {
    return [...candles, { time: bucketTime, open: last.close, high: Math.max(last.close, price), low: Math.min(last.close, price), close: price }].slice(-120);
  }

  return candles.slice(0, -1).concat({
    ...last,
    high: Math.max(last.high, price),
    low: Math.min(last.low, price),
    close: price
  });
}

function normalizeCandleSeries(candles: MarketCandle[], latestPrice: number): MarketCandle[] {
  if (!candles.length || latestPrice <= 0) return candles;

  const closeValues = candles.map((candle) => candle.close).filter((value) => value > 0);
  const medianClose = closeValues.sort((a, b) => a - b)[Math.floor(closeValues.length / 2)] ?? latestPrice;
  const seriesIsStale = Math.abs(medianClose - latestPrice) / latestPrice > 0.35;

  if (seriesIsStale) {
    return buildSyntheticCandles(latestPrice, candles.at(-1)?.time);
  }

  return candles.map((candle, index) => {
    const isLast = index === candles.length - 1;
    const open = isLast && Math.abs(candle.open - latestPrice) / latestPrice > 0.25 ? latestPrice : candle.open;
    const close = isLast ? latestPrice : candle.close;
    const anchor = (open + close) / 2;
    const maxRange = Math.max(anchor * 0.08, 1);
    const high = Math.min(Math.max(candle.high, open, close), anchor + maxRange);
    const low = Math.max(Math.min(candle.low, open, close), anchor - maxRange);

    return {
      ...candle,
      open: round(open),
      high: round(Math.max(high, open, close)),
      low: round(Math.min(low, open, close)),
      close: round(close)
    };
  });
}

function buildSyntheticCandles(latestPrice: number, lastTime = Math.floor(Date.now() / 300000) * 300): MarketCandle[] {
  let close = latestPrice * 0.992;

  return Array.from({ length: 96 }, (_, index) => {
    const time = lastTime - (95 - index) * 300;
    const progress = index / 95;
    const target = latestPrice * (0.992 + progress * 0.008);
    const open = close;
    close = target + Math.sin(index / 4) * latestPrice * 0.0008;
    const spread = Math.max(latestPrice * 0.0016, 0.2);

    return {
      time,
      open: round(open),
      high: round(Math.max(open, close) + spread),
      low: round(Math.min(open, close) - spread),
      close: round(close)
    };
  });
}
