import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware per abilitare connessioni da rete locale.
 * HTTPS è gestito da Cloudflare Tunnel — nessun redirect HTTP→HTTPS necessario.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Abilita CORS per rete locale in development
  if (process.env.NODE_ENV === 'development') {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
