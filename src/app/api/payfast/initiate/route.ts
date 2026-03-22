import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse?.json(
    { error: "PayFast integration has been removed." },
    { status: 410 }
  );
}
