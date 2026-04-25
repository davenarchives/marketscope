import { NextRequest, NextResponse } from "next/server";
import { marketService } from "@/lib/server/market";

export const dynamic = "force-dynamic";

export async function GET() {
  const service = marketService();

  return NextResponse.json({
    items: await service.watchlistItems(),
    quotes: await service.watchlistQuotes()
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { symbol?: unknown; name?: unknown } | null;
  const symbol = typeof body?.symbol === "string" ? body.symbol.trim().slice(0, 24) : "";

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : undefined;
  const item = await marketService().addWatchlistItem(symbol, name);

  return NextResponse.json(item, { status: 201 });
}
