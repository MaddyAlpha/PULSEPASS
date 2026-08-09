// ============================================================
// PulsePass — Full TypeScript Type Definitions
// Updated for Multi-Tenant Architecture (02_multi_tenant.sql)
// ============================================================

export type UserRole =
  | 'student'
  | 'org_admin'
  | 'committee_admin'
  | 'college_admin'
  | 'university_admin'
  | 'supervisor'
  | 'super_admin'

export type TicketType = 'general' | 'vip'
export type TicketStatus = 'valid' | 'pending_verification' | 'checked_in' | 'expired' | 'cancelled'
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed'
export type OrgMemberRole = 'admin' | 'supervisor' | 'viewer'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

// ── Tenant Hierarchy ────────────────────────────────────────

export interface University {
  id: string
  name: string
  slug: string
  domain_alias: string | null
  logo_url: string | null
  is_active: boolean
  feature_flags: {
    ocr_required: boolean
    vip_enabled: boolean
    manual_review_enabled: boolean
    ocr_keywords: string[]
  }
  created_by: string | null
  created_at: string
  updated_at: string
  admins?: { id: string; email: string; full_name: string | null; role: string }[]
}

export interface College {
  id: string
  university_id: string
  name: string
  slug: string
  created_at: string
  // Joined
  university?: University
}

export interface Committee {
  id: string
  college_id: string
  university_id: string
  name: string
  slug: string
  org_id: string | null
  created_at: string
  // Joined
  college?: College
  university?: University
  organization?: Organization
}

// ── Core Profiles ───────────────────────────────────────────

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  university_id: string | null        // legacy text field (keep for compat)
  university_id_fk: string | null     // FK to universities table
  college_id: string | null
  committee_id: string | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  department: string | null
  logo_url: string | null
  banner_url: string | null
  verification_code: string | null
  verified: boolean
  owner_id: string
  created_at: string
  updated_at: string
  // Joined fields
  owner?: Profile
  member_count?: number
  event_count?: number
}

export interface OrgMemberSupervisor {
  id: string
  org_id: string
  user_id: string
  member_role: OrgMemberRole
  invited_by: string | null
  invite_email: string | null
  event_scopes: string[]
  accepted: boolean
  created_at: string
  // Joined fields
  profile?: Profile
  organization?: Organization
}

// ── Events ──────────────────────────────────────────────────

export interface Event {
  id: string
  org_id: string
  university_id: string | null
  tenant_slug: string | null
  title: string
  slug: string
  description: string | null
  banner_url: string | null
  venue: string
  venue_map_url: string | null
  starts_at: string
  ends_at: string
  status: EventStatus
  general_capacity: number
  vip_capacity: number
  general_tickets_sold: number
  vip_tickets_sold: number
  requires_approval: boolean
  roll_number_pattern: string | null
  ocr_keywords: string[]              // event-specific OCR keywords (case-insensitive)
  tags: string[]
  created_by: string
  created_at: string
  updated_at: string
  // Joined fields
  organization?: Organization
  tickets_remaining?: number
  vip_remaining?: number
  user_ticket?: Ticket | null
}

// ── Tickets ─────────────────────────────────────────────────

export interface Ticket {
  id: string
  event_id: string
  user_id: string
  ticket_type: TicketType
  ticket_status: TicketStatus
  qr_token: string
  seat_number: string | null
  notes: string | null
  ocr_verified: boolean
  is_vip_bypass: boolean
  verification_station: 'station_2' | 'station_3' | null
  roll_number: string | null
  claimed_at: string
  expires_at: string | null
  updated_at: string
  // Joined fields
  event?: Event
  profile?: Profile
}

// ── Check-Ins ───────────────────────────────────────────────

export interface CheckIn {
  id: string
  ticket_id: string
  event_id: string
  scanned_by: string
  scanned_at: string
  device_info: string | null
  success: boolean
  failure_reason: string | null
  // Joined fields
  ticket?: Ticket
  scanner?: Profile
}

// ── Audit Logs ──────────────────────────────────────────────

export interface AuditLog {
  id: string
  actor_id: string | null
  actor_role: UserRole | null
  university_id: string | null
  action: string
  target_table: string | null
  target_id: string | null
  payload: Record<string, unknown>
  ip_address: string | null
  created_at: string
  // Joined
  actor?: Profile
  university?: University
}

// ── Manual Review Queue ──────────────────────────────────────

export interface ManualReviewItem {
  id: string
  user_id: string
  event_id: string
  roll_number: string
  id_card_image_url: string
  status: ReviewStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  ticket_id: string | null
  submitted_at: string
  // Joined
  profile?: Profile
  event?: Event
  reviewer?: Profile
}

// ── API Response Types ───────────────────────────────────────

export interface CheckInResult {
  success: boolean
  reason: 'VALID' | 'ALREADY_USED' | 'INVALID_QR' | 'INVALID_STATUS' | 'ALREADY_PENDING' | 'PENDING'
  message: string
  ticket_id?: string
  ticket_type?: TicketType
  user_id?: string
  checkin_id?: string
  checkin_at?: string
  is_vip?: boolean
  roll_number?: string
}

export interface Station2ScanResult {
  success: boolean
  reason: 'PENDING' | 'ALREADY_USED' | 'INVALID_QR' | 'INVALID_STATUS' | 'ALREADY_PENDING'
  message: string
  ticket_id?: string
  ticket_type?: TicketType
  user_id?: string
  is_vip?: boolean
  roll_number?: string
}

export interface QRRefreshResponse {
  jwt_token: string
  expires_at: number   // Unix timestamp
}

// ── Dashboard Analytics ──────────────────────────────────────

export interface OrgAnalytics {
  total_events: number
  published_events: number
  total_tickets_sold: number
  total_checkins: number
  checkin_rate: number
  vip_tickets_sold: number
  peak_entry_hour?: number
  pending_reviews?: number
  recent_events: EventAnalytics[]
}

export interface EventAnalytics {
  event_id: string
  title: string
  starts_at: string
  general_sold: number
  general_capacity: number
  vip_sold: number
  vip_capacity: number
  total_checkins: number
  checkin_rate: number
}

// ── Platform Analytics (Super Admin) ─────────────────────────

export interface PlatformStats {
  total_universities: number
  total_events: number
  total_tickets: number
  total_checkins: number
  active_universities: number
}

// ── Form Types ───────────────────────────────────────────────

export interface CreateEventForm {
  title: string
  description: string
  venue: string
  venue_map_url?: string
  starts_at: string
  ends_at: string
  general_capacity: number
  vip_capacity: number
  tags: string[]
  requires_approval: boolean
  banner_url?: string
  ocr_keywords?: string[]   // new: event creator sets these
  university_id?: string
  tenant_slug?: string
}

export interface InviteSupervisorForm {
  email: string
  event_scopes: string[]
}

export interface SignUpForm {
  email: string
  password: string
  full_name: string
  role: 'student' | 'org_admin'
  org_name?: string
  org_department?: string
  verification_code?: string
}

export interface CreateUniversityForm {
  name: string
  slug: string
  domain_alias?: string
  logo_url?: string
  feature_flags: {
    ocr_required: boolean
    vip_enabled: boolean
    manual_review_enabled: boolean
    ocr_keywords: string[]
  }
}

export interface IssueVIPPassForm {
  event_id: string
  student_email: string
  roll_number?: string
  notes?: string
}

// ── Live Ticker ──────────────────────────────────────────────

export interface LiveStats {
  events_today: number
  passes_issued_today: number
  checkins_today: number
  active_events: number
}

// ── QR Pass Display ──────────────────────────────────────────

export interface PassDisplayData {
  ticket: Ticket
  event: Event
  organization: Organization
  holder: Profile
}

// ── Realtime Payloads (Phase 2 Gate) ─────────────────────────

export interface GateRealtimePayload {
  ticket_id: string
  ticket_type: TicketType
  user_id: string
  roll_number: string | null
  is_vip: boolean
  scanned_at: string
  event_id: string
}
