import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { getTenantSlugFromPath } from '@/lib/tenant'

// Routes that require authentication
const PROTECTED_ROUTES = ['/my-passes', '/org', '/scanner', '/verifier', '/super-admin', '/u']

// Routes that redirect authenticated users away
const AUTH_ROUTES = ['/auth']

// Routes that require specific roles (checked via x-user-role header set after session update)
const SUPER_ADMIN_ROUTES = ['/super-admin']
const SUPERVISOR_ROUTES = ['/scanner', '/verifier']

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  // ── 1. Tenant slug detection from /u/[slug] path prefix ──────────────────
  const tenantSlug = getTenantSlugFromPath(pathname)
  if (tenantSlug) {
    // Inject tenant slug into request headers for server components to consume
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-tenant-slug', tenantSlug)

    // Clone the supabaseResponse and merge in the new header
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    })

    // Copy all cookies from supabaseResponse into our response to avoid breaking auth
    supabaseResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        response.headers.append('set-cookie', value)
      }
    })

    // If tenant route is protected and user is not authenticated, redirect to auth
    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/auth'
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    return response
  }

  // ── 2. Redirect unauthenticated users away from protected routes ──────────
  if (!user && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // ── 3. Redirect authenticated users away from auth page ───────────────────
  if (user && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/events'
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
