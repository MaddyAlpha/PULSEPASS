/**
 * PulsePass — Tenant Resolution Utilities
 *
 * Handles extracting tenant context from the /u/[tenant_slug] URL path prefix.
 * All database queries in tenant-scoped routes use these helpers to scope data.
 */

import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface TenantContext {
  slug: string
  university_id: string
  name: string
  is_active: boolean
  feature_flags: {
    ocr_required: boolean
    vip_enabled: boolean
    manual_review_enabled: boolean
    ocr_keywords: string[]
  }
}

/**
 * Extracts the tenant slug from a /u/[slug]/... URL path.
 * Returns null if the route is not tenant-scoped.
 */
export function getTenantSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/u\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Fetches tenant context by slug from the database.
 * Uses the supabase client passed in (server or browser).
 */
export async function getTenantBySlug(
  slug: string,
  supabase: SupabaseClient
): Promise<TenantContext | null> {
  const { data, error } = await supabase
    .from('universities')
    .select('id, slug, name, is_active, feature_flags')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !data) return null

  return {
    slug: data.slug,
    university_id: data.id,
    name: data.name,
    is_active: data.is_active,
    feature_flags: data.feature_flags as TenantContext['feature_flags'],
  }
}

/**
 * Checks whether a given user profile has access to the specified university.
 * Throws an error if access is denied.
 */
export function assertTenantAccess(
  profileUniversityId: string | null | undefined,
  profileRole: string,
  tenantUniversityId: string
): void {
  // super_admin bypasses all tenant checks
  if (profileRole === 'super_admin') return

  if (!profileUniversityId || profileUniversityId !== tenantUniversityId) {
    throw new Error('ACCESS_DENIED: You do not have access to this tenant.')
  }
}

/**
 * Validates OCR-extracted text against event-specific keywords (case-insensitive).
 * Returns true if ALL provided keywords are found in the OCR text.
 * An empty keyword list means no OCR requirement for this event.
 */
export function validateOCRText(ocrText: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return true
  const lowerText = ocrText.toLowerCase()
  return keywords.every((kw) => lowerText.includes(kw.toLowerCase().trim()))
}
