"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Grid2X2,
  MoreHorizontal,
  PencilLine,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { io, type Socket } from "socket.io-client";
import { addWatchlistSymbol, fetchSnapshot, fetchSymbols, removeWatchlistSymbol, WS_URL } from "@/lib/api";
import type { BubbleSector, MarketCategory, MarketQuote, MarketSignal, Snapshot, SymbolSearchResult } from "@/lib/types";
import { CandlestickChart } from "./CandlestickChart";

const categories: MarketCategory[] = ["Tailwinds", "Headwinds", "Divergence", "Catalysts"];
const symbolFilters = ["All", "Stocks", "Funds", "Futures", "Forex", "Crypto", "Indices", "Bonds", "Economy"] as const;

type SymbolFilter = (typeof symbolFilters)[number];
type SymbolCandidate = SymbolSearchResult & {
  assetType: SymbolFilter;
  exchange: string;
  market: string;
};

type WatchlistGroupKey = Exclude<SymbolFilter, "All">;

const watchlistGroupOrder: WatchlistGroupKey[] = ["Indices", "Stocks", "Funds", "Futures", "Forex", "Crypto", "Bonds", "Economy"];
const visibleEmptyWatchlistGroups = new Set<WatchlistGroupKey>(["Indices", "Stocks", "Futures", "Forex", "Crypto"]);

const suggestedSymbols: SymbolCandidate[] = [
  { symbol: "XAUUSD", name: "Gold", assetType: "Forex", exchange: "OANDA", market: "commodity cfd" },
  { symbol: "XAGUSD", name: "Silver", assetType: "Forex", exchange: "OANDA", market: "commodity cfd" },
  { symbol: "EURUSD", name: "Euro / U.S. Dollar", assetType: "Forex", exchange: "FX", market: "forex" },
  { symbol: "GBPUSD", name: "British Pound / U.S. Dollar", assetType: "Forex", exchange: "FX", market: "forex" },
  { symbol: "USDJPY", name: "U.S. Dollar / Japanese Yen", assetType: "Forex", exchange: "FX", market: "forex" },
  { symbol: "USDPHP", name: "U.S. Dollar / Philippine Peso", assetType: "Forex", exchange: "FX", market: "forex" },
  { symbol: "NQ", name: "E-mini Nasdaq-100 Futures", assetType: "Futures", exchange: "CME", market: "futures" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF TRUST", assetType: "Funds", exchange: "NYSE Arca", market: "fund etf" },
  { symbol: "ES", name: "E-mini S&P 500 Futures", assetType: "Futures", exchange: "CME", market: "futures" },
  { symbol: "MNQ", name: "Micro E-mini Nasdaq-100 Index Futures", assetType: "Futures", exchange: "CME", market: "futures" },
  { symbol: "MES", name: "Micro E-mini S&P 500 Futures", assetType: "Futures", exchange: "CME", market: "futures" },
  { symbol: "YM", name: "E-mini Dow Futures", assetType: "Futures", exchange: "CBOT", market: "futures" },
  { symbol: "RTY", name: "E-mini Russell 2000 Futures", assetType: "Futures", exchange: "CME", market: "futures" },
  { symbol: "CL", name: "Crude Oil Futures", assetType: "Futures", exchange: "NYMEX", market: "futures" },
  { symbol: "GC", name: "Gold Futures", assetType: "Futures", exchange: "COMEX", market: "futures" },
  { symbol: "BTCUSD", name: "Bitcoin / U.S. dollar", assetType: "Crypto", exchange: "Bitstamp", market: "spot crypto defi" },
  { symbol: "BTCUSDT", name: "Bitcoin / TetherUS", assetType: "Crypto", exchange: "Binance", market: "spot crypto defi" },
  { symbol: "ETHUSD", name: "Ethereum / U.S. Dollar", assetType: "Crypto", exchange: "Coinbase", market: "spot crypto defi" },
  { symbol: "SOLUSD", name: "Solana / U.S. Dollar", assetType: "Crypto", exchange: "Coinbase", market: "spot crypto defi" },
  { symbol: "XRPUSD", name: "XRP / U.S. Dollar", assetType: "Crypto", exchange: "Bitstamp", market: "spot crypto defi" },
  { symbol: "SPX", name: "S&P 500", assetType: "Indices", exchange: "SPCFD", market: "index cfd" },
  { symbol: "^GSPC", name: "S&P 500 Index", assetType: "Indices", exchange: "Yahoo", market: "index" },
  { symbol: "^NDX", name: "Nasdaq 100 Index", assetType: "Indices", exchange: "Yahoo", market: "index" },
  { symbol: "^IXIC", name: "Nasdaq Composite", assetType: "Indices", exchange: "Yahoo", market: "index" },
  { symbol: "^DJI", name: "Dow Jones Industrial Average", assetType: "Indices", exchange: "Yahoo", market: "index" },
  { symbol: "^RUT", name: "Russell 2000", assetType: "Indices", exchange: "Yahoo", market: "index" },
  { symbol: "PSEI.PS", name: "PSEi Composite", assetType: "Indices", exchange: "PSE", market: "index" },
  { symbol: "^VIX", name: "CBOE Volatility Index", assetType: "Indices", exchange: "CBOE", market: "index" },
  { symbol: "DXY", name: "U.S. Dollar Index", assetType: "Indices", exchange: "ICE", market: "index" },
  { symbol: "TSLA", name: "Tesla, Inc.", assetType: "Stocks", exchange: "NASDAQ", market: "stock" },
  { symbol: "AAPL", name: "Apple Inc.", assetType: "Stocks", exchange: "NASDAQ", market: "stock" },
  { symbol: "MSFT", name: "Microsoft Corporation", assetType: "Stocks", exchange: "NASDAQ", market: "stock" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", assetType: "Stocks", exchange: "NASDAQ", market: "stock" },
  { symbol: "GOOGL", name: "Alphabet Inc.", assetType: "Stocks", exchange: "NASDAQ", market: "stock" },
  { symbol: "META", name: "Meta Platforms, Inc.", assetType: "Stocks", exchange: "NASDAQ", market: "stock" },
  { symbol: "NFLX", name: "Netflix, Inc.", assetType: "Stocks", exchange: "NASDAQ", market: "stock" },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc.", assetType: "Stocks", exchange: "NASDAQ", market: "stock" },
  { symbol: "AVGO", name: "Broadcom Inc.", assetType: "Stocks", exchange: "NASDAQ", market: "stock" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", assetType: "Stocks", exchange: "NYSE", market: "stock" },
  { symbol: "BRK-B", name: "Berkshire Hathaway Inc.", assetType: "Stocks", exchange: "NYSE", market: "stock" },
  { symbol: "PLTR", name: "Palantir Technologies Inc.", assetType: "Stocks", exchange: "NASDAQ", market: "stock" },
  { symbol: "SM.PS", name: "SM Investments Corporation", assetType: "Stocks", exchange: "PSE", market: "stock" },
  { symbol: "ALI.PS", name: "Ayala Land, Inc.", assetType: "Stocks", exchange: "PSE", market: "stock" },
  { symbol: "BDO.PS", name: "BDO Unibank, Inc.", assetType: "Stocks", exchange: "PSE", market: "stock" },
  { symbol: "QQQ", name: "Invesco QQQ Trust, Series 1", assetType: "Funds", exchange: "NASDAQ", market: "fund etf" },
  { symbol: "NVDA", name: "NVIDIA Corporation", assetType: "Stocks", exchange: "NASDAQ", market: "stock" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF", assetType: "Funds", exchange: "NYSE Arca", market: "fund etf" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", assetType: "Funds", exchange: "NYSE Arca", market: "fund etf" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", assetType: "Funds", exchange: "NYSE Arca", market: "fund etf" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", assetType: "Funds", exchange: "NYSE Arca", market: "fund etf" },
  { symbol: "XLK", name: "Technology Select Sector SPDR Fund", assetType: "Funds", exchange: "NYSE Arca", market: "fund etf" },
  { symbol: "XLF", name: "Financial Select Sector SPDR Fund", assetType: "Funds", exchange: "NYSE Arca", market: "fund etf" },
  { symbol: "SMH", name: "VanEck Semiconductor ETF", assetType: "Funds", exchange: "NASDAQ", market: "fund etf" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", assetType: "Bonds", exchange: "NASDAQ", market: "bond etf" },
  { symbol: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", assetType: "Bonds", exchange: "NASDAQ", market: "bond etf" },
  { symbol: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", assetType: "Bonds", exchange: "NASDAQ", market: "bond etf" },
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", assetType: "Bonds", exchange: "NASDAQ", market: "bond etf" },
  { symbol: "US10Y", name: "U.S. 10 Year Treasury Yield", assetType: "Economy", exchange: "TVC", market: "yield" },
  { symbol: "US02Y", name: "U.S. 2 Year Treasury Yield", assetType: "Economy", exchange: "TVC", market: "yield" },
  { symbol: "CPIAUCSL", name: "U.S. Consumer Price Index", assetType: "Economy", exchange: "FRED", market: "macro" },
  { symbol: "UNRATE", name: "U.S. Unemployment Rate", assetType: "Economy", exchange: "FRED", market: "macro" },
  { symbol: "FEDFUNDS", name: "Federal Funds Effective Rate", assetType: "Economy", exchange: "FRED", market: "macro" }
];

const symbolAliases: Record<string, string> = {
  "^GSPC": "SPX",
  "^NDX": "NDQ",
  "^DJI": "DJI",
  "PSEI.PS": "PSEI"
};

export function Dashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [activeCategory, setActiveCategory] = useState<MarketCategory>("Tailwinds");
  const [selectedSymbol, setSelectedSymbol] = useState("^GSPC");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [symbolResults, setSymbolResults] = useState<SymbolSearchResult[]>([]);
  const [symbolFilter, setSymbolFilter] = useState<SymbolFilter>("All");
  const [isSearchingSymbols, setIsSearchingSymbols] = useState(false);
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const [openWatchlistGroups, setOpenWatchlistGroups] = useState<Record<WatchlistGroupKey, boolean>>({
    Indices: true,
    Stocks: true,
    Funds: true,
    Futures: false,
    Forex: false,
    Crypto: false,
    Bonds: false,
    Economy: false
  });
  const previousWatchlistGroupCountsRef = useRef<Record<WatchlistGroupKey, number>>({
    Indices: 0,
    Stocks: 0,
    Funds: 0,
    Futures: 0,
    Forex: 0,
    Crypto: 0,
    Bonds: 0,
    Economy: 0
  });
  const [localSymbols, setLocalSymbols] = useState<string[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem("market-scope-watchlist");
    if (stored) {
      setLocalSymbols(JSON.parse(stored) as string[]);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot()
      .then(setSnapshot)
      .catch(() => setStatus("offline"));

    const socket: Socket = io(WS_URL, {
      transports: ["websocket"],
      reconnectionDelayMax: 5000
    });

    socket.on("connect", () => setStatus("live"));
    socket.on("disconnect", () => setStatus("offline"));
    socket.on("market:snapshot", (nextSnapshot: Snapshot) => {
      setSnapshot(nextSnapshot);
      setStatus("live");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const selectedSignals = useMemo(() => {
    return snapshot?.signals.filter((signal) => signal.category === activeCategory) ?? [];
  }, [activeCategory, snapshot?.signals]);

  const selectedQuote = useMemo(() => {
    const quotes = [...(snapshot?.indices ?? []), ...(snapshot?.watchlist ?? [])];
    return quotes.find((quote) => quote.symbol === selectedSymbol) ?? quotes[0];
  }, [selectedSymbol, snapshot]);

  useEffect(() => {
    if (selectedQuote && selectedQuote.symbol !== selectedSymbol) {
      setSelectedSymbol(selectedQuote.symbol);
    }
  }, [selectedQuote, selectedSymbol]);

  useEffect(() => {
    if (!isAddDialogOpen) return;

    const query = symbolQuery.trim();
    if (!query) {
      setSymbolResults([]);
      setIsSearchingSymbols(false);
      return;
    }

    let cancelled = false;
    setIsSearchingSymbols(true);
    const timeout = window.setTimeout(() => {
      fetchSymbols(query)
        .then((results) => {
          if (!cancelled) setSymbolResults(results);
        })
        .catch(() => {
          if (!cancelled) setSymbolResults([]);
        })
        .finally(() => {
          if (!cancelled) setIsSearchingSymbols(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isAddDialogOpen, symbolQuery]);

  const addedSymbols = useMemo(() => {
    return new Set([...(snapshot?.indices ?? []), ...(snapshot?.watchlist ?? [])].map((quote) => quote.symbol.toUpperCase()));
  }, [snapshot]);

  const builtInIndexSymbols = useMemo(() => {
    return new Set((snapshot?.indices ?? []).map((quote) => quote.symbol.toUpperCase()));
  }, [snapshot]);

  const dialogSymbols = useMemo(() => {
    const baseSymbols = symbolQuery.trim()
      ? symbolResults.map((result) => ({
          ...result,
          assetType: inferSymbolType(result.symbol),
          exchange: inferExchange(result.symbol),
          market: inferMarket(result.symbol)
        }))
      : suggestedSymbols;

    return baseSymbols.filter((item) => symbolFilter === "All" || item.assetType === symbolFilter);
  }, [symbolFilter, symbolQuery, symbolResults]);

  const watchlistGroups = useMemo(() => {
    const groups = Object.fromEntries(watchlistGroupOrder.map((group) => [group, [] as MarketQuote[]])) as Record<WatchlistGroupKey, MarketQuote[]>;

    (snapshot?.indices ?? []).forEach((quote) => groups.Indices.push(quote));
    (snapshot?.watchlist ?? []).forEach((quote) => {
      const group = inferSymbolType(quote.symbol);
      groups[group].push(quote);
    });

    return groups;
  }, [snapshot]);

  useEffect(() => {
    setOpenWatchlistGroups((current) => {
      let changed = false;
      const next = { ...current };
      const previousCounts = previousWatchlistGroupCountsRef.current;

      watchlistGroupOrder.forEach((group) => {
        const count = watchlistGroups[group].length;

        if (count > 0 && previousCounts[group] === 0 && !current[group]) {
          next[group] = true;
          changed = true;
        }

        previousCounts[group] = count;
      });

      return changed ? next : current;
    });
  }, [watchlistGroups]);

  async function addSymbol(candidate: SymbolSearchResult, closeDialog = false) {
    const next = candidate.symbol.trim().toUpperCase();
    if (!next) return;

    setAddingSymbol(next);
    try {
      await addWatchlistSymbol(next, candidate.name);
      const stored = Array.from(new Set([...localSymbols, next]));
      setLocalSymbols(stored);
      window.localStorage.setItem("market-scope-watchlist", JSON.stringify(stored));
      setSelectedSymbol(next);
      setSnapshot(await fetchSnapshot());
      if (closeDialog) setIsAddDialogOpen(false);
    } finally {
      setAddingSymbol(null);
    }
  }

  async function removeSymbol(nextSymbol: string) {
    await removeWatchlistSymbol(nextSymbol);
    const stored = localSymbols.filter((item) => item !== nextSymbol);
    setLocalSymbols(stored);
    window.localStorage.setItem("market-scope-watchlist", JSON.stringify(stored));
    setSnapshot(await fetchSnapshot());
  }

  return (
    <main className="min-h-screen bg-ink text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="border-b border-line bg-panel lg:border-b-0 lg:border-r">
          <div className="flex h-16 items-center justify-between border-b border-line px-5">
            <button type="button" className="flex items-center gap-2 text-base font-semibold" aria-label="Watchlist menu">
              Watchlist
              <ChevronDown className="h-4 w-4 text-muted" />
            </button>
            <div className="flex items-center gap-1">
              <IconButton label="Add symbol" icon={<Plus className="h-5 w-5" />} onClick={() => setIsAddDialogOpen(true)} />
              <IconButton label="Layout" icon={<Grid2X2 className="h-5 w-5" />} />
              <IconButton label="More" icon={<MoreHorizontal className="h-5 w-5" />} />
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1.25fr)_0.75fr_0.7fr_0.7fr_32px] border-b border-line px-4 py-2 text-xs font-medium text-muted">
            <span>Symbol</span>
            <span className="text-right">Last</span>
            <span className="text-right">Chg</span>
            <span className="text-right">Chg%</span>
            <span />
          </div>

          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto py-2 lg:max-h-none">
            {snapshot ? (
              <>
                {watchlistGroupOrder.map((group) => {
                  const quotes = watchlistGroups[group];
                  const hasRows = quotes.length > 0;
                  const shouldShow = hasRows || visibleEmptyWatchlistGroups.has(group);

                  if (!shouldShow) return null;

                  return (
                    <WatchlistGroup
                      key={group}
                      title={group.toUpperCase()}
                      quotes={quotes}
                      selectedSymbol={selectedSymbol}
                      lockedSymbols={builtInIndexSymbols}
                      open={openWatchlistGroups[group]}
                      onToggle={() => setOpenWatchlistGroups((current) => ({ ...current, [group]: !current[group] }))}
                      onSelect={setSelectedSymbol}
                      onRemove={(nextSymbol) => void removeSymbol(nextSymbol)}
                    />
                  );
                })}
              </>
            ) : (
              <SkeletonList />
            )}
          </div>

          {selectedQuote && <SelectedInstrumentPanel quote={selectedQuote} />}
        </aside>

        <section className="min-w-0">
          <MarketTopBar updatedAt={snapshot?.updatedAt} status={status} />

          <div className="px-5 py-5 sm:px-8 lg:px-10">
            <div className="mx-auto max-w-[1320px]">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted">
                <RefreshCcw className="h-4 w-4" />
                <span>{snapshot ? `Updated ${new Date(snapshot.updatedAt).toLocaleTimeString()}` : "Loading prices"}</span>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {(snapshot?.indices ?? []).map((quote) => (
                  <IndexPill
                    key={quote.symbol}
                    quote={quote}
                    selected={quote.symbol === selectedSymbol}
                    onSelect={() => setSelectedSymbol(quote.symbol)}
                  />
                ))}
                {!snapshot && Array.from({ length: 4 }).map((_, index) => <IndexSkeleton key={index} />)}
              </div>

              <section className="mt-5 border-y border-line py-5">
                {selectedQuote ? (
                  <CandlestickChart candles={snapshot?.candles[selectedQuote.symbol] ?? []} quote={selectedQuote} symbol={selectedQuote.symbol} />
                ) : (
                  <div className="h-[520px] animate-pulse rounded-md bg-elevated" />
                )}
              </section>

              <div className="mt-8 grid gap-4 2xl:grid-cols-[1.25fr_0.75fr]">
                <SignalsPanel
                  activeCategory={activeCategory}
                  onSelect={setActiveCategory}
                  signals={selectedSignals}
                  allSignals={snapshot?.signals ?? []}
                />
                <BubbleMonitor sectors={snapshot?.bubbles ?? []} />
              </div>

          <WatchlistMomentum quotes={snapshot?.watchlist ?? []} />
            </div>
          </div>
        </section>
      </div>
      {isAddDialogOpen && (
        <AddSymbolDialog
          addedSymbols={addedSymbols}
          addingSymbol={addingSymbol}
          filter={symbolFilter}
          isSearching={isSearchingSymbols}
          onAdd={(candidate, closeDialog) => void addSymbol(candidate, closeDialog)}
          onClose={() => setIsAddDialogOpen(false)}
          onFilterChange={setSymbolFilter}
          onQueryChange={setSymbolQuery}
          query={symbolQuery}
          results={dialogSymbols}
        />
      )}
    </main>
  );
}

function MarketTopBar({ status, updatedAt }: { status: "connecting" | "live" | "offline"; updatedAt?: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-ink px-5 lg:px-8">
      <div className="flex min-w-0 items-center gap-6">
        <div className="grid h-8 w-8 shrink-0 place-items-center font-black tracking-normal">M</div>
        <label className="relative hidden w-[260px] sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="h-10 w-full rounded-full border border-line bg-elevated pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-neutral-500"
            placeholder="Search (Ctrl+K)"
            aria-label="Search"
          />
        </label>
        <nav className="hidden items-center gap-7 text-sm font-semibold md:flex">
          <a className="text-foreground" href="#markets">
            Markets
          </a>
          <a className="text-muted transition hover:text-foreground" href="#signals">
            Signals
          </a>
          <a className="text-muted transition hover:text-foreground" href="#heatmap">
            Heatmap
          </a>
          <a className="text-muted transition hover:text-foreground" href="#more">
            More
          </a>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={clsx(
            "h-2.5 w-2.5 rounded-full",
            status === "live" && "bg-teal-400",
            status === "connecting" && "bg-amber-300",
            status === "offline" && "bg-rose-400"
          )}
          title={updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : "Connecting"}
        />
        <IconButton label="Refresh" icon={<RefreshCcw className="h-4 w-4" />} />
        <div className="grid h-10 w-10 place-items-center rounded-full bg-teal-300 text-lg font-semibold text-slate-950">D</div>
      </div>
    </header>
  );
}

function IconButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-elevated hover:text-foreground"
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

function AddSymbolDialog({
  addedSymbols,
  addingSymbol,
  filter,
  isSearching,
  onAdd,
  onClose,
  onFilterChange,
  onQueryChange,
  query,
  results
}: {
  addedSymbols: Set<string>;
  addingSymbol: string | null;
  filter: SymbolFilter;
  isSearching: boolean;
  onAdd: (candidate: SymbolSearchResult, closeDialog?: boolean) => void;
  onClose: () => void;
  onFilterChange: (filter: SymbolFilter) => void;
  onQueryChange: (query: string) => void;
  query: string;
  results: SymbolCandidate[];
}) {
  const firstAvailable = results.find((item) => !addedSymbols.has(item.symbol.toUpperCase()));

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/65 px-4 py-10 backdrop-blur-sm sm:px-8" role="presentation">
      <section
        className="mx-auto flex max-h-[calc(100vh-5rem)] w-full max-w-[980px] flex-col overflow-hidden rounded-md border border-line bg-panel shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-symbol-title"
      >
        <div className="flex items-center justify-between px-6 py-5">
          <h2 id="add-symbol-title" className="text-xl font-semibold">Add symbol</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-elevated hover:text-foreground"
            aria-label="Close add symbol dialog"
            title="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="px-6 pb-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && firstAvailable) {
                  event.preventDefault();
                  onAdd(firstAvailable, event.shiftKey);
                }
              }}
              className="h-12 w-full rounded-md border border-neutral-600 bg-panel pl-11 pr-4 text-base text-foreground outline-none transition placeholder:text-neutral-500 focus:border-neutral-400"
              placeholder="Symbol, ISIN, or CUSIP"
              aria-label="Search symbol"
            />
          </label>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {symbolFilters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onFilterChange(item)}
                className={clsx(
                  "h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition",
                  filter === item ? "bg-foreground text-ink" : "bg-elevated text-foreground hover:bg-neutral-700"
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="px-6 py-10 text-sm text-muted">Searching symbols...</div>
          ) : results.length ? (
            results.map((item) => {
              const normalized = item.symbol.toUpperCase();
              const isAdded = addedSymbols.has(normalized);
              const isAdding = addingSymbol === normalized;

              return (
                <div
                  key={`${item.exchange}-${item.symbol}`}
                  className="grid min-h-12 grid-cols-[minmax(96px,0.45fr)_minmax(180px,1fr)_minmax(120px,0.45fr)_minmax(92px,0.32fr)_44px] items-center border-t border-line px-6 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3 pr-4">
                    <SymbolLogo candidate={item} />
                    <span className="truncate text-base font-semibold">{displaySymbol(item.symbol)}</span>
                  </div>
                  <p className="truncate pr-4 font-semibold">{item.name}</p>
                  <p className="truncate text-right text-xs text-muted">{item.market}</p>
                  <p className="truncate text-right font-semibold">{item.exchange}</p>
                  <button
                    type="button"
                    onClick={() => onAdd(item)}
                    disabled={isAdded || isAdding}
                    className={clsx(
                      "ml-3 grid h-9 w-9 place-items-center rounded-md text-muted transition",
                      isAdded ? "cursor-default opacity-40" : "hover:bg-elevated hover:text-foreground"
                    )}
                    title={isAdded ? `${item.symbol} is already in the watchlist` : `Add ${item.symbol}`}
                    aria-label={isAdded ? `${item.symbol} already added` : `Add ${item.symbol}`}
                  >
                    {isAdding ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-transparent" /> : <Plus className="h-6 w-6" />}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="px-6 py-10 text-sm text-muted">No symbols found.</div>
          )}
        </div>

        <div className="border-t border-line bg-elevated px-6 py-3 text-center text-sm text-muted">
          <kbd className="rounded border border-neutral-600 bg-panel px-2 py-1 text-foreground">Enter</kbd>
          <span className="mx-2">to add the first match</span>
          <kbd className="rounded border border-neutral-600 bg-panel px-2 py-1 text-foreground">Shift</kbd>
          <span className="mx-1">+</span>
          <kbd className="rounded border border-neutral-600 bg-panel px-2 py-1 text-foreground">Enter</kbd>
          <span className="ml-2">to add and close</span>
        </div>
      </section>
    </div>
  );
}

function WatchlistGroup({
  lockedSymbols,
  onRemove,
  onSelect,
  onToggle,
  open,
  quotes,
  selectedSymbol,
  title
}: {
  lockedSymbols: Set<string>;
  onRemove?: (symbol: string) => void;
  onSelect: (symbol: string) => void;
  onToggle: () => void;
  open: boolean;
  quotes: MarketQuote[];
  selectedSymbol: string;
  title: string;
}) {
  return (
    <section className={quotes.length ? "mb-4" : ""}>
      <button
        type="button"
        onClick={onToggle}
        className={clsx(
          "flex h-10 w-full items-center gap-2 border-line px-4 text-left text-xs font-medium text-muted transition hover:bg-elevated hover:text-foreground",
          !quotes.length && "border-b"
        )}
        aria-expanded={open}
      >
        <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
        <span>{title}</span>
      </button>
      {open && quotes.length > 0 && (
        <div>
          {quotes.map((quote) => {
            const canRemove = onRemove && !lockedSymbols.has(quote.symbol.toUpperCase());

            return (
              <WatchlistTableRow
                key={quote.symbol}
                quote={quote}
                selected={quote.symbol === selectedSymbol}
                onSelect={() => onSelect(quote.symbol)}
                onRemove={canRemove ? () => onRemove(quote.symbol) : undefined}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function WatchlistTableRow({
  onRemove,
  onSelect,
  quote,
  selected
}: {
  onRemove?: () => void;
  onSelect: () => void;
  quote: MarketQuote;
  selected: boolean;
}) {
  const positive = quote.change >= 0;
  const flash = useFlashOnChange(quote.price);

  return (
    <div
      className={clsx(
        "group grid h-10 grid-cols-[minmax(0,1.25fr)_0.75fr_0.7fr_0.7fr_32px] items-center px-4 text-sm transition duration-300",
        selected ? "bg-elevated ring-1 ring-neutral-500" : "hover:bg-elevated",
        flash && (positive ? "bg-teal-300/10" : "bg-rose-300/10")
      )}
    >
      <button type="button" onClick={onSelect} className="contents">
        <span className="flex min-w-0 items-center gap-2 pr-2 text-left">
          <LogoBadge quote={quote} />
          <span className="truncate font-semibold">{displaySymbol(quote.symbol)}</span>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
        </span>
        <span className="text-right font-semibold tabular-nums">{formatPrice(quote.price)}</span>
        <span className={clsx("text-right tabular-nums", positive ? "text-teal-300" : "text-rose-400")}>
          {formatSigned(quote.change, quote.price > 1000 ? 0 : 2)}
        </span>
        <span className={clsx("text-right tabular-nums", positive ? "text-teal-300" : "text-rose-400")}>{formatPercent(quote.percentChange)}</span>
      </button>
      {onRemove ? (
        <button
          onClick={onRemove}
          className="grid h-8 w-8 place-items-center rounded-md text-muted opacity-0 transition hover:bg-rose-400/10 hover:text-rose-300 group-hover:opacity-100"
          title={`Remove ${quote.symbol}`}
          aria-label={`Remove ${quote.symbol}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function SelectedInstrumentPanel({ quote }: { quote: MarketQuote }) {
  const positive = quote.change >= 0;

  return (
    <section className="border-t border-line p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <LogoBadge quote={quote} large />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{displaySymbol(quote.symbol)}</h2>
            <p className="truncate text-sm text-muted">{quote.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Edit" icon={<PencilLine className="h-4 w-4" />} />
          <IconButton label="More" icon={<MoreHorizontal className="h-4 w-4" />} />
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-end gap-2">
          <p className="text-4xl font-semibold tabular-nums">{formatPrice(quote.price)}</p>
          <span className="pb-1 text-sm text-muted">USD</span>
        </div>
        <p className={clsx("mt-1 text-base font-semibold tabular-nums", positive ? "text-teal-300" : "text-rose-400")}>
          {formatSigned(quote.change, quote.price > 1000 ? 0 : 2)} {formatPercent(quote.percentChange)}
        </p>
      </div>

      <div className="rounded-md bg-elevated p-3 text-sm">
        <p className="font-semibold">Latest move</p>
        <p className="mt-1 leading-6 text-muted">
          {quote.name} is {positive ? "higher" : "lower"} on the latest update from {quote.source}.
        </p>
      </div>

      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">Source</dt>
          <dd className="font-semibold capitalize">{quote.source}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Updated</dt>
          <dd className="font-semibold">{new Date(quote.updatedAt).toLocaleTimeString()}</dd>
        </div>
      </dl>
    </section>
  );
}

function LogoBadge({ large = false, quote }: { large?: boolean; quote: MarketQuote }) {
  const [failed, setFailed] = useState(false);
  const sizeClass = large ? "h-9 w-9" : "h-6 w-6";
  const logoUrl = quote.logoUrl ?? logoUrlForSymbol(quote.symbol);

  if (logoUrl && !failed) {
    return (
      <span className={clsx("grid shrink-0 place-items-center overflow-hidden rounded-full bg-white", sizeClass)}>
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-contain p-1"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return <SymbolBadge symbol={quote.symbol} large={large} />;
}

function SymbolLogo({ candidate }: { candidate: SymbolCandidate }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = logoUrlForSymbol(candidate.symbol, candidate.assetType, candidate.exchange);

  if (logoUrl && !failed) {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-white">
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-contain p-1"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return <SymbolBadge symbol={candidate.symbol} />;
}

function SymbolBadge({ large = false, symbol }: { large?: boolean; symbol: string }) {
  const color = getSymbolAccent(symbol);

  return (
    <span
      className={clsx("grid shrink-0 place-items-center rounded-full text-xs font-bold text-white", large ? "h-9 w-9" : "h-6 w-6")}
      style={{ backgroundColor: color }}
    >
      {displaySymbol(symbol).slice(0, large ? 2 : 1)}
    </span>
  );
}

function IndexPill({ quote, selected, onSelect }: { quote: MarketQuote; selected: boolean; onSelect: () => void }) {
  const positive = quote.change >= 0;
  const flash = useFlashOnChange(quote.price);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "flex h-16 min-w-[238px] items-center gap-3 rounded-full px-4 text-left transition duration-300",
        selected ? "bg-neutral-800" : "bg-transparent hover:bg-elevated",
        flash && (positive ? "bg-teal-300/10" : "bg-rose-300/10")
      )}
    >
      <LogoBadge quote={quote} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold leading-4">{quote.name}</p>
          <span className="h-1.5 w-3 shrink-0 rounded-full bg-muted" />
        </div>
        <div className="mt-1 flex min-w-0 items-baseline gap-2 whitespace-nowrap">
          <p className="min-w-0 text-base font-semibold leading-5 tabular-nums">
            {formatPriceWithDecimals(quote.price)} <span className="align-baseline text-[10px] font-medium text-muted">USD</span>
          </p>
          <p className={clsx("text-xs font-semibold tabular-nums", positive ? "text-teal-300" : "text-rose-400")}>{formatPercent(quote.percentChange)}</p>
        </div>
      </div>
    </button>
  );
}

function SignalsPanel({
  activeCategory,
  allSignals,
  onSelect,
  signals
}: {
  activeCategory: MarketCategory;
  allSignals: MarketSignal[];
  onSelect: (category: MarketCategory) => void;
  signals: MarketSignal[];
}) {
  const summary = categories.map((category) => ({
    category,
    count: allSignals.filter((signal) => signal.category === category).length
  }));

  return (
    <section id="signals" className="rounded-md border border-line bg-panel p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-lg font-semibold">Signal Engine</h3>
        <div className="grid grid-cols-2 gap-2 md:flex">
          {summary.map((item) => (
            <button
              key={item.category}
              onClick={() => onSelect(item.category)}
              className={clsx(
                "rounded-md border px-3 py-2 text-sm transition",
                activeCategory === item.category ? "border-neutral-500 bg-elevated text-foreground" : "border-line text-muted hover:text-foreground"
              )}
            >
              {item.category}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {signals.map((signal) => (
          <article key={signal.id} className="rounded-md border border-line bg-elevated p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <SignalIcon impact={signal.impact} />
              <span className="text-sm font-medium text-foreground">{signal.strength}/100</span>
            </div>
            <h4 className="font-semibold">{signal.title}</h4>
            <p className="mt-2 text-sm leading-6 text-muted">{signal.detail}</p>
            <div className="mt-4 h-1.5 rounded-full bg-neutral-800">
              <div className="h-1.5 rounded-full bg-teal-400" style={{ width: `${signal.strength}%` }} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SignalIcon({ impact }: { impact: MarketSignal["impact"] }) {
  const className = clsx(
    "grid h-9 w-9 place-items-center rounded-md",
    impact === "positive" && "bg-teal-400/10 text-teal-300",
    impact === "negative" && "bg-rose-400/10 text-rose-300",
    impact === "mixed" && "bg-sky-400/10 text-sky-300",
    impact === "event" && "bg-amber-300/10 text-amber-200"
  );

  if (impact === "positive") return <span className={className}><CheckCircle2 className="h-5 w-5" /></span>;
  if (impact === "negative") return <span className={className}><AlertTriangle className="h-5 w-5" /></span>;
  if (impact === "event") return <span className={className}><Bell className="h-5 w-5" /></span>;
  return <span className={className}><Activity className="h-5 w-5" /></span>;
}

function BubbleMonitor({ sectors }: { sectors: BubbleSector[] }) {
  return (
    <section id="heatmap" className="rounded-md border border-line bg-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Bubble Monitor</h3>
        <AlertTriangle className="h-5 w-5 text-amber-200" />
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sectors} layout="vertical" margin={{ left: 10, right: 10 }}>
            <CartesianGrid stroke="var(--line)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--chart-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="sectorName" type="category" width={118} tick={{ fill: "var(--foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: 6, color: "var(--foreground)" }} />
            <Bar dataKey="bubbleScore" fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid gap-2">
        {sectors.map((sector) => (
          <div key={sector.sectorName} className="flex items-center justify-between rounded-md bg-elevated px-3 py-2 text-sm">
            <span className="truncate pr-3 text-foreground">{sector.sectorName}</span>
            <span className={riskClass(sector.riskLevel)}>
              {sector.riskLevel} | {sector.ytdChange > 0 ? "+" : ""}
              {sector.ytdChange.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WatchlistMomentum({ quotes }: { quotes: MarketQuote[] }) {
  return (
    <section className="mt-4 rounded-md border border-line bg-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Watchlist Momentum</h3>
        <Activity className="h-5 w-5 text-teal-300" />
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={watchlistChartData(quotes)}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: "var(--chart-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--chart-muted)", fontSize: 12 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: 6, color: "var(--foreground)" }} />
            {quotes.slice(0, 5).map((quote, index) => (
              <Line
                key={quote.symbol}
                dataKey={quote.symbol}
                dot={false}
                stroke={["#14b8a6", "#f59e0b", "#38bdf8", "#fb7185", "#a3e635"][index]}
                strokeWidth={2}
                type="monotone"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function useFlashOnChange(value: number) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setFlash(true);
    const timeout = window.setTimeout(() => setFlash(false), 650);
    return () => window.clearTimeout(timeout);
  }, [value]);

  return flash;
}

function SkeletonList() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-md bg-elevated" />
      ))}
    </div>
  );
}

function IndexSkeleton() {
  return <div className="h-20 min-w-[280px] animate-pulse rounded-full bg-elevated" />;
}

function watchlistChartData(quotes: MarketQuote[]) {
  const maxLength = Math.max(...quotes.map((quote) => quote.sparkline.length), 0);

  return Array.from({ length: maxLength }, (_, index) => {
    const row: Record<string, string | number> = { time: `${index + 1}` };
    quotes.forEach((quote) => {
      const value = quote.sparkline[index]?.value;
      if (value) row[quote.symbol] = value;
    });
    return row;
  });
}

function riskClass(risk: BubbleSector["riskLevel"]) {
  return clsx(
    "shrink-0 rounded-md px-2 py-1 text-xs font-medium",
    risk === "moderate" && "bg-sky-400/10 text-sky-300",
    risk === "elevated" && "bg-amber-300/10 text-amber-200",
    risk === "critical" && "bg-rose-400/10 text-rose-300"
  );
}

function displaySymbol(symbol: string) {
  return symbolAliases[symbol] ?? symbol.replace(".PS", "");
}

function inferSymbolType(symbol: string): WatchlistGroupKey {
  const normalized = symbol.toUpperCase();

  if (["BTCUSD", "BTCUSDT", "ETHUSD", "SOLUSD", "XRPUSD"].includes(normalized) || normalized.includes("BTC") || normalized.includes("ETH") || normalized.endsWith("USDT")) {
    return "Crypto";
  }
  if (normalized.startsWith("^") || ["SPX", "PSEI.PS", "DXY"].includes(normalized)) return "Indices";
  if (["SPY", "QQQ", "DIA", "IWM", "VTI", "VOO", "XLK", "XLF", "SMH"].includes(normalized)) return "Funds";
  if (["TLT", "IEF", "SHY", "BND"].includes(normalized)) return "Bonds";
  if (["US10Y", "US02Y", "CPIAUCSL", "UNRATE", "FEDFUNDS"].includes(normalized)) return "Economy";
  if (["ES", "NQ", "MNQ", "MES", "YM", "RTY", "CL", "GC"].includes(normalized)) return "Futures";
  if (normalized.includes("USD") && normalized.length >= 6) return "Forex";

  return "Stocks";
}

function inferExchange(symbol: string) {
  const normalized = symbol.toUpperCase();

  if (normalized.endsWith(".PS") || normalized === "PSEI.PS") return "PSE";
  if (normalized.includes("BTC") || normalized.includes("ETH")) return "Crypto";
  if (["ES", "NQ", "MNQ"].includes(normalized)) return "CME";
  if (normalized === "SPY") return "NYSE Arca";
  if (normalized === "SPX" || normalized.startsWith("^")) return "Index";

  return "NASDAQ";
}

function inferMarket(symbol: string) {
  const type = inferSymbolType(symbol);

  if (type === "Funds") return "fund etf";
  if (type === "Indices") return "index";
  if (type === "Futures") return "futures";
  if (type === "Crypto") return "spot crypto";
  if (type === "Forex") return "forex";

  return "stock";
}

const symbolLogoDomains: Record<string, string> = {
  XAUUSD: "oanda.com",
  XAGUSD: "oanda.com",
  EURUSD: "forex.com",
  GBPUSD: "forex.com",
  USDJPY: "forex.com",
  USDPHP: "forex.com",
  NQ: "cmegroup.com",
  ES: "cmegroup.com",
  MNQ: "cmegroup.com",
  MES: "cmegroup.com",
  YM: "cmegroup.com",
  RTY: "cmegroup.com",
  CL: "cmegroup.com",
  GC: "cmegroup.com",
  BTCUSD: "bitcoin.org",
  BTCUSDT: "bitcoin.org",
  ETHUSD: "ethereum.org",
  SOLUSD: "solana.com",
  XRPUSD: "xrpl.org",
  SPX: "spglobal.com",
  "^GSPC": "ssga.com",
  "^NDX": "invesco.com",
  "^IXIC": "nasdaq.com",
  "^DJI": "spglobal.com",
  "^RUT": "ftserussell.com",
  "PSEI.PS": "pse.com.ph",
  "^VIX": "cboe.com",
  DXY: "theice.com",
  TSLA: "tesla.com",
  AAPL: "apple.com",
  MSFT: "microsoft.com",
  AMZN: "amazon.com",
  GOOGL: "abc.xyz",
  META: "meta.com",
  NFLX: "netflix.com",
  AMD: "amd.com",
  AVGO: "broadcom.com",
  JPM: "jpmorganchase.com",
  "BRK-B": "berkshirehathaway.com",
  PLTR: "palantir.com",
  "SM.PS": "sminvestments.com",
  "ALI.PS": "ayalaland.com.ph",
  "BDO.PS": "bdo.com.ph",
  SPY: "ssga.com",
  QQQ: "invesco.com",
  NVDA: "nvidia.com",
  DIA: "ssga.com",
  IWM: "ishares.com",
  VTI: "vanguard.com",
  VOO: "vanguard.com",
  XLK: "ssga.com",
  XLF: "ssga.com",
  SMH: "vaneck.com",
  TLT: "ishares.com",
  IEF: "ishares.com",
  SHY: "ishares.com",
  BND: "vanguard.com",
  US10Y: "treasury.gov",
  US02Y: "treasury.gov",
  CPIAUCSL: "fred.stlouisfed.org",
  UNRATE: "fred.stlouisfed.org",
  FEDFUNDS: "fred.stlouisfed.org"
};

function logoUrlForSymbol(symbol: string, assetType?: SymbolFilter, exchange?: string) {
  const normalized = symbol.toUpperCase();
  const domain = symbolLogoDomains[normalized] ?? logoDomainForExchange(exchange) ?? logoDomainForAssetType(assetType);

  return domain ? faviconForDomain(domain) : undefined;
}

function logoDomainForExchange(exchange?: string) {
  const normalized = exchange?.toUpperCase();

  if (!normalized) return undefined;
  if (normalized.includes("NASDAQ")) return "nasdaq.com";
  if (normalized.includes("NYSE")) return "nyse.com";
  if (normalized.includes("CME") || normalized.includes("CBOT") || normalized.includes("COMEX") || normalized.includes("NYMEX")) return "cmegroup.com";
  if (normalized.includes("OANDA")) return "oanda.com";
  if (normalized.includes("PSE")) return "pse.com.ph";
  if (normalized.includes("FRED")) return "fred.stlouisfed.org";
  if (normalized.includes("COINBASE")) return "coinbase.com";
  if (normalized.includes("BINANCE")) return "binance.com";
  if (normalized.includes("BITSTAMP")) return "bitstamp.net";

  return undefined;
}

function logoDomainForAssetType(assetType?: SymbolFilter) {
  if (assetType === "Futures") return "cmegroup.com";
  if (assetType === "Forex") return "forex.com";
  if (assetType === "Crypto") return "coinbase.com";
  if (assetType === "Indices") return "spglobal.com";
  if (assetType === "Bonds") return "ishares.com";
  if (assetType === "Economy") return "fred.stlouisfed.org";

  return undefined;
}

function faviconForDomain(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value > 1000 ? 0 : 2,
    minimumFractionDigits: value > 1000 ? 0 : 2
  }).format(value);
}

function formatPriceWithDecimals(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value);
}

function formatSigned(value: number, decimals = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}`;
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getSymbolAccent(symbol: string) {
  const palette = ["#e11d48", "#0891b2", "#0ea5e9", "#16a34a", "#0d9488", "#db2777", "#dc2626", "#4f46e5"];
  const index = symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}
