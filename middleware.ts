import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { getTenantSlugFromPath } from '@/lib/tenant'

// Routes that require authentication
const PROTECTED_ROUTES = ['/my-passes', '/org', '/scanner', '/verifier', '/super-admin', '/u', '/admin', '/university-admin', '/college-admin']

// Role-based home routes after login
function getRoleHome(role: string): string {
  switch (role) {
    case 'super_admin': return '/super-admin'
    case 'university_admin': return '/university-admin'
    case 'college_admin': return '/college-admin'
    case 'org_admin': return '/org/dashboard'
    case 'organiser': return '/org/setup'
    case 'supervisor':
    case 'committee_admin': return '/my-passes'
    case 'student':
    default: return '/my-passes'
  }
}

// Routes that redirect authenticated users away
const AUTH_ROUTES = ['/auth']

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, profile } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  const role = profile?.role || 'student'
  const universityId = profile?.university_id_fk || ''
  const collegeId = profile?.college_id || ''

  // Set roles and tenant context in headers for server components
  let response = supabaseResponse
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-role', role)
  if (universityId) requestHeaders.set('x-university-id', universityId)
  if (collegeId) requestHeaders.set('x-college-id', collegeId)

  // ── 1. Tenant slug detection from /u/[slug] path prefix ──────────────────
  const tenantSlug = getTenantSlugFromPath(pathname)
  if (tenantSlug) {
    requestHeaders.set('x-tenant-slug', tenantSlug)
    response = NextResponse.next({ request: { headers: requestHeaders } })
    
    // Copy cookies
    supabaseResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        response.headers.append('set-cookie', value)
      }
    })

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

  // ── 3. Role-based routing for authenticated users ──────────
  if (user) {
    const home = getRoleHome(role)
    if (pathname.startsWith('/super-admin') && role !== 'super_admin') {
      return NextResponse.redirect(new URL(home, request.url))
    }
    if (pathname.startsWith('/university-admin') && !['super_admin', 'university_admin'].includes(role)) {
      return NextResponse.redirect(new URL(home, request.url))
    }
    if (pathname.startsWith('/college-admin') && !['super_admin', 'university_admin', 'college_admin'].includes(role)) {
      return NextResponse.redirect(new URL(home, request.url))
    }
    if (pathname.startsWith('/org') && !['super_admin', 'university_admin', 'college_admin', 'organiser', 'org_admin'].includes(role)) {
      return NextResponse.redirect(new URL(home, request.url))
    }
  }

  // ── 4. Redirect authenticated users away from auth page ───────────────────
  if (user && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    // Check for explicit redirect param first
    const redirectParam = request.nextUrl.searchParams.get('redirect')
    if (redirectParam) {
      return NextResponse.redirect(new URL(redirectParam, request.url))
    }
    // Otherwise route to role-specific home
    return NextResponse.redirect(new URL(getRoleHome(role), request.url))
  }

  response = NextResponse.next({ request: { headers: requestHeaders } })
  // Copy cookies again just to be safe
  supabaseResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      response.headers.append('set-cookie', value)
    }
  })

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
