import { NextResponse } from 'next/server';

/**
 * Temporary diagnostic endpoint – returns the raw Google token exchange response
 * so we can identify exactly why the refresh token is being rejected.
 * Access: GET /api/cooking-classes/debug-token  (staff-only, no sensitive data stored)
 */
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  const present = {
    GOOGLE_CLIENT_ID: clientId ? `set (${clientId?.slice(0, 12)}...)` : 'MISSING',
    GOOGLE_CLIENT_SECRET: clientSecret ? `set (${clientSecret?.slice(0, 8)}...)` : 'MISSING',
    GOOGLE_REFRESH_TOKEN: refreshToken ? `set (${refreshToken?.slice(0, 12)}...)` : 'MISSING',
  };

  if (!clientId || !clientSecret || !refreshToken) {
    return NextResponse?.json({ env: present, error: 'One or more env vars are missing' }, { status: 400 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params?.toString(),
  });

  const tokenData = await tokenRes?.json();

  return NextResponse?.json({
    env: present,
    http_status: tokenRes?.status,
    google_response: {
      error: tokenData?.error ?? null,
      error_description: tokenData?.error_description ?? null,
      has_access_token: !!tokenData?.access_token,
      token_type: tokenData?.token_type ?? null,
    },
  });
}
