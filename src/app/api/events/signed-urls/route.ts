import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { paths } = await request.json();

    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ urls: {} });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('signed-urls error: SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json({ urls: {} }, { status: 500 });
    }

    // Use service role key so unauthenticated visitors can get signed URLs
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const urlMap: Record<string, string> = {};

    const normalizedPathMap = new Map<string, string>();
    for (const rawPath of paths) {
      if (typeof rawPath !== 'string') continue;
      const original = rawPath.trim();
      if (!original) continue;
      const normalized = original.replace(/^\/+/, '');
      // Preserve original key expected by the client mapping.
      if (!normalizedPathMap.has(original)) {
        normalizedPathMap.set(original, normalized);
      }
    }

    await Promise.all(
      Array.from(normalizedPathMap.entries()).map(async ([originalPath, normalizedPath]) => {
        const { data, error } = await supabaseAdmin.storage
          .from('event-photos')
          .createSignedUrl(normalizedPath, 3600);
        if (!error && data?.signedUrl) {
          urlMap[originalPath] = data.signedUrl;
          return;
        }

        // Backward-compat: some rows might include a leading slash in storage path.
        if (originalPath !== normalizedPath) {
          const fallback = await supabaseAdmin.storage
            .from('event-photos')
            .createSignedUrl(originalPath, 3600);
          if (!fallback.error && fallback.data?.signedUrl) {
            urlMap[originalPath] = fallback.data.signedUrl;
          }
        }
      })
    );

    return NextResponse.json({ urls: urlMap });
  } catch (err) {
    console.error('signed-urls error:', err);
    return NextResponse.json({ urls: {} }, { status: 500 });
  }
}
