import { NextResponse } from "next/server";
import { marketService } from "@/lib/server/market";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await marketService().snapshot());
}
