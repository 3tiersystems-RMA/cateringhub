import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Redirect /favicon.ico to our custom favicon image
  if (pathname === '/favicon.ico') {
    const url = request.nextUrl.clone();
    url.pathname = '/assets/images/Favicon-1778145940787.jpg';
    return NextResponse.redirect(url, { status: 302 });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /staff/workspace - redirect to login if not authenticated
  if (pathname.startsWith('/staff/workspace') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/staff/login';
    return NextResponse.redirect(url);
  }

  // Protect /staff/orders - redirect to login if not authenticated
  if (pathname.startsWith('/staff/orders') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/staff/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login page
  if (pathname === '/staff/login' && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/staff/workspace';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
