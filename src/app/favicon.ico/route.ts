import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse?.redirect(new URL('/assets/images/Favicon-1778145940787.jpg', 'https://cateringhub-rk3rj04.public.builtwithrocket.new'), { status: 301 });
}
