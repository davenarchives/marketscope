import type { MarketCandle, Snapshot, SymbolSearchResult } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? API_URL;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function fetchSnapshot(): Promise<Snapshot> {
  return request<Snapshot>("/api/snapshot");
}

export type CandleRange = "1d" | "1m" | "3m" | "1y" | "5y" | "all";

export function fetchCandles(symbol: string, range: CandleRange = "1d"): Promise<MarketCandle[]> {
  return request<MarketCandle[]>(`/api/candles/${encodeURIComponent(symbol)}?range=${range}`);
}

export function fetchSymbols(query: string): Promise<SymbolSearchResult[]> {
  return request<SymbolSearchResult[]>(`/api/symbols?q=${encodeURIComponent(query)}`);
}

export function addWatchlistSymbol(symbol: string, name?: string) {
  return request("/api/watchlist", {
    method: "POST",
    body: JSON.stringify({ symbol, name })
  });
}

export async function removeWatchlistSymbol(symbol: string) {
  const response = await fetch(`${API_URL}/api/watchlist/${encodeURIComponent(symbol)}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
}
