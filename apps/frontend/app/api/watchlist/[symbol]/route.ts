import { NextResponse } from "next/server";
import { marketService } from "@/lib/server/market";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  await marketService().removeWatchlistItem(decodeURIComponent(symbol));

  return new NextResponse(null, { status: 204 });
}
