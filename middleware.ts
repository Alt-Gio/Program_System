import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This middleware prevents NextAuth from redirecting to sign-in
// for routes that don't require authentication
export function middleware(request: NextRequest) {
  // Allow all routes - no authentication required
  // Only Settings page uses Google OAuth for Sheets sync
  return NextResponse.next()
}

// Don't run middleware on static files, api routes, or _next
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
}
