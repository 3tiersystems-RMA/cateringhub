import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/cooking-classes/send-confirmation
 * Server-side proxy that calls the send-cooking-class-confirmation Edge Function
 * via direct fetch (not supabase.functions.invoke) so that real error messages
 * from the edge function are surfaced instead of the generic
 * "Edge Function returned a non-2xx status code" wrapper.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-cooking-class-confirmation`;

    const edgeRes = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify(body),
    });

    let responseData: unknown;
    try {
      responseData = await edgeRes.json();
    } catch {
      responseData = { error: `Edge function returned status ${edgeRes.status}` };
    }

    if (!edgeRes.ok) {
      const errorMessage =
        (responseData as { error?: string; message?: string })?.error ||
        (responseData as { error?: string; message?: string })?.message ||
        `Edge function failed with status ${edgeRes.status}`;

      console.error("[send-confirmation] Edge function error:", errorMessage, responseData);
      return NextResponse.json({ error: errorMessage }, { status: edgeRes.status });
    }

    return NextResponse.json({ success: true, ...(responseData as object) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-confirmation] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
