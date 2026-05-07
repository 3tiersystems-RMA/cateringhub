import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { paths } = await request.json();

    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ urls: {} });
    }

    // Use service role key so unauthenticated visitors can get signed URLs
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const urlMap: Record<string, string> = {};

    await Promise.all(
      paths.map(async (path: string) => {
        const { data, error } = await supabaseAdmin.storage
          .from('event-photos')
          .createSignedUrl(path, 3600);
        if (!error && data?.signedUrl) {
          urlMap[path] = data.signedUrl;
        }
      })
    );

    return NextResponse.json({ urls: urlMap });
  } catch (err) {
    console.error('signed-urls error:', err);
    return NextResponse.json({ urls: {} }, { status: 500 });
  }
}
