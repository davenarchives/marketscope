import { NextResponse } from "next/server";
import { marketService } from "@/lib/server/market";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(marketService().signals());
}
