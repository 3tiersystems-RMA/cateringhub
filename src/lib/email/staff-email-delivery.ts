import type { SupabaseClient } from '@supabase/supabase-js';

export function normalizeEmailField(val: string | null | undefined): string | null {
  if (!val || val.trim() === '') return null;
  return val.trim();
}

export interface StaffEmailBranding {
  formHeaderTitle: string | null;
  logoUrl: string | null;
  officeNumber: string | null;
}

export async function loadStaffEmailBranding(
  supabaseAdmin: SupabaseClient
): Promise<StaffEmailBranding> {
  try {
    const { data } = await supabaseAdmin
      .from('correspondence_settings')
      .select('form_header_title, logo_url, office_number')
      .limit(1)
      .maybeSingle();

    return {
      formHeaderTitle: normalizeEmailField(data?.form_header_title),
      logoUrl: normalizeEmailField(data?.logo_url),
      officeNumber: normalizeEmailField(data?.office_number),
    };
  } catch {
    return { formHeaderTitle: null, logoUrl: null, officeNumber: null };
  }
}

export async function invokeStaffEmailEdgeFunction(
  functionName: string,
  payload: Record<string, unknown>
): Promise<{ emailId?: string } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Edge function ${functionName} failed`);
  }

  return data;
}

export async function sendViaEdgeOrResend(
  edgeFunctionName: string,
  payload: Record<string, unknown>,
  resendFallback: () => Promise<{ id: string }>
): Promise<string> {
  try {
    const edgeResult = await invokeStaffEmailEdgeFunction(edgeFunctionName, payload);
    if (edgeResult?.emailId) return edgeResult.emailId;
  } catch (edgeErr) {
    console.warn(`[${edgeFunctionName}] Edge function unavailable, using Resend fallback:`, edgeErr);
  }

  const resendResult = await resendFallback();
  return resendResult.id;
}
