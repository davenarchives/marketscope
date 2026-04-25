"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ChartCandlestick, ChartLine } from "lucide-react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type AreaData,
  type CandlestickData,
  type IChartApi,
  type ISeriesMarkersPluginApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp
} from "lightweight-charts";
import { fetchCandles, type CandleRange } from "@/lib/api";
import type { MarketCandle, MarketQuote } from "@/lib/types";
import { useTheme } from "./ThemeProvider";

interface CandlestickChartProps {
  candles: MarketCandle[];
  quote?: MarketQuote;
  symbol: string;
}

const ranges: Array<{ label: string; value: CandleRange }> = [
  { label: "1D", value: "1d" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "1Y", value: "1y" },
  { label: "5Y", value: "5y" },
  { label: "All", value: "all" }
];

type ChartStyle = "area" | "candles";
type ChartSeries = ISeriesApi<"Area"> | ISeriesApi<"Candlestick">;

export function CandlestickChart({ candles, quote, symbol }: CandlestickChartProps) {
  const { theme } = useTheme();
  const [activeRange, setActiveRange] = useState<CandleRange>("1d");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("area");
  const [rangeCandles, setRangeCandles] = useState<MarketCandle[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ChartSeries | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const previousSymbolRef = useRef(symbol);
  const previousRangeRef = useRef(activeRange);
  const previousLengthRef = useRef(0);
  const hasLoadedDataRef = useRef(false);
  const selectedCandles = activeRange === "1d" ? candles : rangeCandles;
  const chartCandles = useMemo(() => {
    if (selectedCandles.length) return selectedCandles;
    if (!quote?.sparkline.length) return [];

    return quote.sparkline.map((point, index) => {
      const previous = quote.sparkline[index - 1]?.value ?? point.value;
      const spread = Math.max(point.value * 0.0012, 0.05);

      return {
        time: Math.floor(point.time / 1000),
        open: previous,
        high: Math.max(previous, point.value) + spread,
        low: Math.min(previous, point.value) - spread,
        close: point.value
      };
    });
  }, [quote?.sparkline, selectedCandles]);

  useEffect(() => {
    if (activeRange === "1d") {
      setRangeCandles([]);
      return;
    }

    let cancelled = false;
    fetchCandles(symbol, activeRange)
      .then((nextCandles) => {
        if (!cancelled) setRangeCandles(nextCandles);
      })
      .catch(() => {
        if (!cancelled) setRangeCandles([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRange, symbol]);

  useEffect(() => {
    if (!containerRef.current) return;
    const colors = getChartColors();

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.text,
        attributionLogo: false
      },
      grid: {
        horzLines: { color: colors.line },
        vertLines: { color: colors.lineSoft }
      },
      crosshair: {
        mode: 1
      },
      rightPriceScale: {
        borderColor: colors.line,
        scaleMargins: {
          top: 0.08,
          bottom: 0.08
        }
      },
      timeScale: {
        borderColor: colors.line,
        rightOffset: 0,
        rightOffsetPixels: 32,
        barSpacing: 10,
        fixRightEdge: true,
        shiftVisibleRangeOnNewBar: true,
        timeVisible: true,
        secondsVisible: false
      },
      handleScroll: false,
      handleScale: false,
      kineticScroll: {
        mouse: false,
        touch: false
      }
    });

    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      hasLoadedDataRef.current = false;
      previousLengthRef.current = 0;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;

    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
    }

    seriesRef.current = createSeries(chartRef.current, chartStyle);
    markersRef.current =
      chartStyle === "area"
        ? createSeriesMarkers(seriesRef.current as ISeriesApi<"Area">, [], {
            autoScale: false,
            zOrder: "top"
          })
        : null;
    hasLoadedDataRef.current = false;
    previousLengthRef.current = 0;
  }, [chartStyle]);

  useEffect(() => {
    if (!chartRef.current) return;
    const colors = getChartColors();

    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.text,
        attributionLogo: false
      },
      grid: {
        horzLines: { color: colors.line },
        vertLines: { color: colors.lineSoft }
      },
      rightPriceScale: {
        borderColor: colors.line
      },
      timeScale: {
        borderColor: colors.line,
        rightOffset: 0,
        rightOffsetPixels: 32,
        fixRightEdge: true
      }
    });
  }, [theme]);

  useEffect(() => {
    if (!seriesRef.current || !chartCandles.length) return;

    const data = chartStyle === "area" ? chartCandles.map(toAreaPoint) : chartCandles.map(toChartCandle);
    const symbolChanged = previousSymbolRef.current !== symbol;
    const rangeChanged = previousRangeRef.current !== activeRange;
    const lengthChanged = previousLengthRef.current !== data.length;

    if (!hasLoadedDataRef.current || symbolChanged || rangeChanged || lengthChanged || previousLengthRef.current === 0) {
      setSeriesData(seriesRef.current, chartStyle, data);
      chartRef.current?.timeScale().fitContent();
      hasLoadedDataRef.current = true;
    } else {
      updateSeriesData(seriesRef.current, chartStyle, data[data.length - 1]);
    }
    syncLatestMarker(markersRef.current, chartStyle, data);

    previousSymbolRef.current = symbol;
    previousRangeRef.current = activeRange;
    previousLengthRef.current = data.length;
  }, [activeRange, chartCandles, chartStyle, symbol]);

  return (
    <div className="h-[520px] min-h-[420px] w-full">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">{symbol}</p>
          <h3 className="text-2xl font-semibold">{quote?.name ?? symbol}</h3>
        </div>
        {quote && (
          <div className="text-left sm:text-right">
            <p className="text-3xl font-semibold tabular-nums">{formatPrice(quote.price)}</p>
            <p className={quote.change >= 0 ? "text-sm text-teal-200" : "text-sm text-rose-200"}>
              {quote.change >= 0 ? "+" : ""}
              {quote.change.toFixed(2)} ({quote.change >= 0 ? "+" : ""}
              {quote.percentChange.toFixed(2)}%)
            </p>
          </div>
        )}
      </div>
      <div ref={containerRef} className="h-[380px] w-full" />
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {ranges.map((range) => (
            <button
              key={range.value}
              type="button"
              onClick={() => setActiveRange(range.value)}
              className={clsx(
                "h-10 min-w-12 rounded-md px-3 text-sm font-semibold transition",
                activeRange === range.value ? "bg-elevated text-foreground" : "text-foreground hover:bg-elevated"
              )}
            >
              {range.label}
            </button>
          ))}
        </div>

        <div className="flex h-10 shrink-0 items-center rounded-md bg-neutral-800 p-1">
          <ChartStyleButton
            active={chartStyle === "area"}
            label="Area chart"
            onClick={() => setChartStyle("area")}
          >
            <ChartLine className="h-5 w-5" />
          </ChartStyleButton>
          <ChartStyleButton
            active={chartStyle === "candles"}
            label="Candlestick chart"
            onClick={() => setChartStyle("candles")}
          >
            <ChartCandlestick className="h-5 w-5" />
          </ChartStyleButton>
        </div>
      </div>
    </div>
  );
}

function ChartStyleButton({
  active,
  children,
  label,
  onClick
}: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "grid h-8 w-8 place-items-center rounded text-muted transition hover:text-foreground",
        active && "bg-neutral-600 text-foreground shadow-inner"
      )}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function createSeries(chart: IChartApi, chartStyle: ChartStyle): ChartSeries {
  if (chartStyle === "area") {
    return chart.addSeries(AreaSeries, {
      lineColor: "#14b8a6",
      topColor: "rgba(20, 184, 166, 0.24)",
      bottomColor: "rgba(20, 184, 166, 0.02)",
      lineWidth: 2,
      priceLineColor: "#14b8a6",
      lastValueVisible: true,
      priceLineVisible: true
    });
  }

  return chart.addSeries(CandlestickSeries, {
    upColor: "#2dd4bf",
    downColor: "#fb7185",
    borderUpColor: "#2dd4bf",
    borderDownColor: "#fb7185",
    wickUpColor: "#5eead4",
    wickDownColor: "#fda4af",
    lastValueVisible: true,
    priceLineVisible: true
  });
}

function setSeriesData(series: ChartSeries, chartStyle: ChartStyle, data: AreaData[] | CandlestickData[]) {
  if (chartStyle === "area") {
    (series as ISeriesApi<"Area">).setData(data as AreaData[]);
    return;
  }

  (series as ISeriesApi<"Candlestick">).setData(data as CandlestickData[]);
}

function updateSeriesData(series: ChartSeries, chartStyle: ChartStyle, point: AreaData | CandlestickData) {
  if (chartStyle === "area") {
    (series as ISeriesApi<"Area">).update(point as AreaData);
    return;
  }

  (series as ISeriesApi<"Candlestick">).update(point as CandlestickData);
}

function syncLatestMarker(
  markers: ISeriesMarkersPluginApi<Time> | null,
  chartStyle: ChartStyle,
  data: AreaData[] | CandlestickData[]
) {
  if (!markers || chartStyle !== "area") return;

  const latest = data[data.length - 1] as AreaData | undefined;
  const marker: SeriesMarker<Time>[] = latest
    ? [
        {
          time: latest.time,
          position: "atPriceMiddle",
          price: latest.value,
          shape: "circle",
          color: "#14b8a6",
          size: 1.25
        }
      ]
    : [];

  markers.setMarkers(marker);
}

function toAreaPoint(candle: MarketCandle): AreaData {
  return {
    time: candle.time as UTCTimestamp,
    value: candle.close
  };
}

function toChartCandle(candle: MarketCandle): CandlestickData {
  return {
    time: candle.time as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close
  };
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value > 1000 ? 0 : 2,
    minimumFractionDigits: value > 1000 ? 0 : 2
  }).format(value);
}

function getChartColors() {
  const styles = getComputedStyle(document.documentElement);

  return {
    text: styles.getPropertyValue("--foreground").trim(),
    line: styles.getPropertyValue("--line").trim(),
    lineSoft: styles.getPropertyValue("--line").trim()
  };
}
