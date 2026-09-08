import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('esporta_admin_token')?.value;
  const path = request.nextUrl.pathname;

  // Secure API Bridge for Bearer tokens
  if (path.startsWith('/api/v1/')) {
    const backendUrl = process.env.ESPORTA_BACKEND_URL || 'https://private.esporta.site';
    const url = new URL(path, backendUrl);
    url.search = request.nextUrl.search;
    
    const requestHeaders = new Headers(request.headers);
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
    
    return NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  const isLoginPage = path.startsWith('/login');

  if (!token && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
