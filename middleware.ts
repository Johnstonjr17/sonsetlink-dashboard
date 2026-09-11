import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME, verifySessionToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Unconditionally allow public routes:
  // - Donor share links (/share/* and /api/share/*)
  // - 12-hour sync cron endpoint (/api/sync)
  // - Login UI and login API endpoint (/login and /api/login)
  // - Static files and icons
  if (
    pathname.startsWith('/share') ||
    pathname.startsWith('/api/share') ||
    pathname.startsWith('/api/sync') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/icon')
  ) {
    return NextResponse.next();
  }

  // 2. Validate session token from cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isValid = await verifySessionToken(token);

  if (isValid) {
    return NextResponse.next();
  }

  // 3. Reject API calls with 401 Unauthorized
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized - Passcode Required' }, { status: 401 });
  }

  // 4. Redirect browser page requests to /login
  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') {
    loginUrl.searchParams.set('from', pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
