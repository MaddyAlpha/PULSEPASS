// ============================================================
// PulsePass — Full TypeScript Type Definitions
// ============================================================

export type UserRole = 'student' | 'org_admin' | 'supervisor' | 'super_admin'
export type TicketType = 'general' | 'vip'
export type TicketStatus = 'valid' | 'checked_in' | 'expired' | 'cancelled'
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed'
export type OrgMemberRole = 'admin' | 'supervisor' | 'viewer'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  university_id: string | null
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

export interface Event {
  id: string
  org_id: string
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
  roll_number_pattern?: string
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

export interface Ticket {
  id: string
  event_id: string
  user_id: string
  ticket_type: TicketType
  ticket_status: TicketStatus
  qr_token: string
  seat_number: string | null
  notes: string | null
  claimed_at: string
  expires_at: string | null
  updated_at: string
  // Joined fields
  event?: Event
  profile?: Profile
}

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

// API Response Types
export interface CheckInResult {
  success: boolean
  reason: 'VALID' | 'ALREADY_USED' | 'INVALID_QR' | 'INVALID_STATUS'
  message: string
  ticket_id?: string
  ticket_type?: TicketType
  user_id?: string
  checkin_id?: string
  checkin_at?: string
}

// Dashboard Analytics
export interface OrgAnalytics {
  total_events: number
  published_events: number
  total_tickets_sold: number
  total_checkins: number
  checkin_rate: number
  vip_tickets_sold: number
  peak_entry_hour?: number
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

// Form Types
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
}

export interface InviteSupervisorForm {
  email: string
  event_scopes: string[]  // empty = all events
}

export interface SignUpForm {
  email: string
  password: string
  full_name: string
  role: 'student' | 'org_admin'
  // For org_admin
  org_name?: string
  org_department?: string
  verification_code?: string
}

// Live Ticker Types
export interface LiveStats {
  events_today: number
  passes_issued_today: number
  checkins_today: number
  active_events: number
}

// QR Ticket Pass Display
export interface PassDisplayData {
  ticket: Ticket
  event: Event
  organization: Organization
  holder: Profile
}
