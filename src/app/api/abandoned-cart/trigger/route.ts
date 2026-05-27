import { NextResponse } from "next/server";

// ABANDONED CART PAUSED — endpoint disabled during testing
export async function POST() {
  return NextResponse?.json({ message: "Abandoned cart process is currently paused." }, { status: 503 });
}

export const dynamic = "force-dynamic";
