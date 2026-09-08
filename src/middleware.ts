import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type StaffRole = 'admin' | 'staff' | 'super_admin';

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

function injectTokenFromHeader(request: NextRequest): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  const hasCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token'));
  if (hasCookie) return;
  request.cookies.set(`sb-${getProjectRef()}-auth-token`, token);
}

const ROLE_DASHBOARDS: Record<StaffRole, string> = {
  super_admin: '/staff/workspace',
  admin: '/staff/workspace',
  staff: '/staff/workspace',
};

const ROLE_ALLOWED_ROUTES: Record<StaffRole, string[]> = {
  super_admin: [
    '/staff/workspace',
    '/staff/orders',
    '/staff/analytics',
    '/staff/scanner',
    '/staff/guide',
    '/staff/reset-password',
  ],
  admin: [
    '/staff/workspace',
    '/staff/orders',
    '/staff/analytics',
    '/staff/scanner',
    '/staff/guide',
    '/staff/reset-password',
  ],
  staff: [
    '/staff/workspace',
    '/staff/orders',
    '/staff/scanner',
    '/staff/guide',
    '/staff/reset-password',
  ],
};

function isStaffRoute(pathname: string): boolean {
  return pathname.startsWith('/staff') && pathname !== '/staff/login';
}

function isStaffRelatedRoute(pathname: string): boolean {
  return pathname.startsWith('/staff') || pathname.startsWith('/dashboard');
}

function isRouteAllowedForRole(pathname: string, role: StaffRole): boolean {
  const allowed = ROLE_ALLOWED_ROUTES[role];
  return allowed.some((route) => pathname.startsWith(route));
}

function redirect(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Only run auth logic for staff/dashboard routes — skip DB queries for all other routes
  // to prevent edge function crashes on public pages
  if (!isStaffRelatedRoute(pathname)) {
    return NextResponse.next({ request });
  }

  injectTokenFromHeader(request);
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // If auth check fails, treat as unauthenticated
    user = null;
  }

  let userRole: StaffRole | null = null;
  if (user) {
    // Retry once on schema cache errors (transient Supabase cold-start issue)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profileError?.message?.toLowerCase().includes('schema cache') && attempt === 0) {
          // Wait briefly and retry
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        if (profile?.role && ['admin', 'staff', 'super_admin'].includes(profile.role)) {
          userRole = profile.role as StaffRole;
        }
        break;
      } catch {
        // If profile fetch fails, treat as no role
        userRole = null;
        break;
      }
    }
  }

  // --- Staff route protection ---

  if (isStaffRoute(pathname) && !user) {
    return redirect(request, '/staff/login');
  }

  if (isStaffRoute(pathname) && user && !userRole) {
    return redirect(request, '/homepage');
  }

  if (isStaffRoute(pathname) && user && userRole && !isRouteAllowedForRole(pathname, userRole)) {
    return redirect(request, ROLE_DASHBOARDS[userRole]);
  }

  // --- Login page redirect for authenticated staff ---

  if (pathname === '/staff/login' && user && userRole) {
    return redirect(request, ROLE_DASHBOARDS[userRole]);
  }

  // --- /dashboard catch-all: redirect to role-appropriate page ---

  if (pathname.startsWith('/dashboard')) {
    if (!user) return redirect(request, '/staff/login');
    return redirect(request, userRole ? ROLE_DASHBOARDS[userRole] : '/homepage');
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
