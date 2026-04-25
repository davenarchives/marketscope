import { NextRequest, NextResponse } from "next/server";
import { marketService } from "@/lib/server/market";
import type { CandleRange } from "@/lib/server/services/providers";

export const dynamic = "force-dynamic";

const candleRanges = new Set<CandleRange>(["1d", "1m", "3m", "1y", "5y", "all"]);

export async function GET(request: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const requestedRange = request.nextUrl.searchParams.get("range") ?? "1d";
  const range = candleRanges.has(requestedRange as CandleRange) ? (requestedRange as CandleRange) : "1d";

  return NextResponse.json(await marketService().candles(decodeURIComponent(symbol), undefined, range));
}
