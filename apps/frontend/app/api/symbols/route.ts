import { NextRequest, NextResponse } from "next/server";
import { marketService } from "@/lib/server/market";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";

  return NextResponse.json(await marketService().lookupSymbols(query));
}
