/**
 * Invoke send-payment-confirmation edge function from server routes.
 * Mirrors booking-payfast-confirmation-email (apikey + service role required by Supabase).
 */
export async function invokeSendPaymentConfirmationEdgeFunction(
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; emailId?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, error: "Missing Supabase configuration" };
  }

  const edgeRes = await fetch(`${supabaseUrl}/functions/v1/send-payment-confirmation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(body),
  });

  let responseData: { error?: string; message?: string; emailId?: string } = {};
  try {
    responseData = (await edgeRes.json()) as {
      error?: string;
      message?: string;
      emailId?: string;
    };
  } catch {
    responseData = { error: `Edge function returned status ${edgeRes.status}` };
  }

  if (!edgeRes.ok) {
    return {
      ok: false,
      error:
        responseData.error ||
        responseData.message ||
        `Edge function failed with status ${edgeRes.status}`,
    };
  }

  if (responseData.error) {
    return { ok: false, error: responseData.error };
  }

  return { ok: true, emailId: responseData.emailId };
}

/**
 * Invoke send-eft-order-received edge function from server routes.
 */
export async function invokeSendEftOrderReceivedEdgeFunction(
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; emailId?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, error: "Missing Supabase configuration" };
  }

  const edgeRes = await fetch(`${supabaseUrl}/functions/v1/send-eft-order-received`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(body),
  });

  let responseData: { error?: string; message?: string; emailId?: string } = {};
  try {
    responseData = (await edgeRes.json()) as {
      error?: string;
      message?: string;
      emailId?: string;
    };
  } catch {
    responseData = { error: `Edge function returned status ${edgeRes.status}` };
  }

  if (!edgeRes.ok) {
    return {
      ok: false,
      error:
        responseData.error ||
        responseData.message ||
        `Edge function failed with status ${edgeRes.status}`,
    };
  }

  if (responseData.error) {
    return { ok: false, error: responseData.error };
  }

  return { ok: true, emailId: responseData.emailId };
}

export function buildAdminEmailsList(
  infoEmail?: string | null,
  adminEmail?: string | null
): string[] {
  const list: string[] = [];
  const info = infoEmail?.trim();
  const admin = adminEmail?.trim();
  if (info) list.push(info);
  if (admin && admin !== info) list.push(admin);
  return list;
}
