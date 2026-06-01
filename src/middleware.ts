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
  // Admin: operations + business management + analytics + scanner (no system settings).
  admin: [
    '/staff/workspace',
    '/staff/orders',
    '/staff/analytics',
    '/staff/scanner',
    '/staff/guide',
    '/staff/reset-password',
  ],
  // Staff: daily operations only — orders, scanner, guide (no analytics page).
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRole: StaffRole | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role && ['admin', 'staff', 'super_admin'].includes(profile.role)) {
      userRole = profile.role as StaffRole;
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
