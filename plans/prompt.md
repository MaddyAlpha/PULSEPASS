# AGENT DIRECTIVE: PulsePass Architecture Refactoring & Full Feature Implementation

**Role:** Senior Technical Lead / Lead Software Architect  
**Target Platform:** PulsePass Web Application (Next.js, Supabase, Tailwind CSS, WebSockets)  
**Task:** Audit the current codebase, implement missing core features, and refactor the architecture according to the attached technical specification, Mermaid logic flow, and visual diagram.

---

## 📥 ATTACHED REFERENCE INPUTS
Before generating or modifying any code, ingest and cross-reference the following three source assets attached in this context:
1. `pulsepass_blueprint.md` — The master functional requirements, schema rules, and role permissions.
2. `pulsepass_architecture.mmd` — The strict Mermaid logic flowchart defining database state transitions, route locks, and event triggers.
3. `pulsepass_flowchart.png` — The high-level visual topology diagram for UI/UX spatial layout verification.

---

## 🛠️ CORE ENGINEERING MODULES TO IMPLEMENT

### Module 1: Multi-Tenant Routing & Authentication Scoping
* **Public Discovery:** Implement dynamic URL paths for student event discovery (`/u/[tenant_slug]/events`).
* **Private Admin Dashboards:** Implement silent-token access via Supabase Row Level Security (RLS) for `/org/dashboard`, `/admin/college`, and `/admin/university`. The university scope must be silently embedded into the JWT session on login.
* **Student Auth & Regex Locking:** Update the public `/signup` form. When a student selects their university from the dropdown, dynamically enforce the official university Roll Number Regex pattern on the client and server side.

### Module 2: Two-Tier "Double Lock" Organiser Approval Workflow
* **Database Schema:** Ensure `college_invite_codes` and `role_requests` tables are correctly configured with appropriate foreign keys.
* **Code Generation UI:** Build a UI component in the College Admin Portal (`/admin/college`) allowing `college_admin` users to generate single-use/team invite codes bound strictly to their `college_id`.
* **Submission Logic:** When a student enters a code in their dashboard, validate it against `college_invite_codes`. If valid, **do not** automatically elevate their role. Create an entry in `role_requests` with `status = 'pending'`.
* **Approval UI:** On the University Admin Portal (`/admin/university`), render the pending requests table. Display the applicant's name, roll number, and targeted college. Provide Server Actions for `Approve` (which updates `profiles.role` to `'organiser'` and assigns `college_id`) and `Reject`.

### Module 3: Smart CR Verification Routing (Pre-Event ID Review)
* **Master Batch Codes:** Create a `university_batch_codes` table (`id`, `university_id`, `prefix_code`, `description`). Restrict write access to `university_admin`.
* **Organiser CR Assignment:** In the Organiser Dashboard (`/org/dashboard`), build an "Assign CR Verifier" panel. Do not allow free-text input for batch scopes. Force the Organiser to select a batch scope from a dropdown populated strictly by `university_batch_codes`.
* **Smart Queue Filtering:** Update the pre-event ID selfie verification queue. When a student claims a ticket, route their pending ID selfie strictly to the dashboard of the CR whose assigned `prefix_code` matches the student's roll number prefix.

### Module 4: High-Performance Realtime Gate Scanning Pipeline
* **Station 1 (Scanner Volunteer UI - `/scanner`):**
  * Integrate the Web Barcode Detection API for high-speed camera scanning.
  * Trigger browser haptic feedback (`navigator.vibrate([100, 50, 100])`) and distinct audio chimes on successful scan.
  * Implement a 60-second **Soft Lock** in the database upon scan, updating the ticket state to `status = 'pending_verification'` to block simultaneous duplicate scans across multiple devices.
* **Station 2 (Verifier Volunteer UI - `/verifier`):**
  * Establish a Supabase Realtime WebSocket subscription listening for changes on `tickets` where `status = 'pending_verification'`.
  * Instantly render the student's stored Phase 1 ID selfie photo URL on the Verifier's screen in real time with **zero page reloads**.
  * Add an `Admit` button that updates ticket `status = 'checked_in'` and burns the dynamic QR token.

### Module 5: Committee Operations & Financial Ledger
* **Committee Management:** Build the `committees` structure allowing Organisers to appoint Committee Heads via Roll Number and generate 4-digit join codes for general members.
* **Financial Ledger (`committee_finances`):** Build a ledger UI for the Finance Committee to record `INCOME` and `EXPENSE` items, net balance calculations, vendor names, and image uploads for physical receipts.
* **Logistics Tracker (`committee_logistics`):** Build an interactive inventory checklist for the Logistics Committee to track procurement statuses (`PENDING`, `PROCURED`, `RETURNED`) and assigned student handlers.

---

## 🚫 EXCLUSIONS & DEPRECATION NOTICE
Do **NOT** implement the following features as they have been officially removed from the product scope:
* Academic Attendance & ECA Credit Sync
* Vetted Guest (Plus-One) Sponsoring Systems
* Real-Time Broadcast Notification Banners

---

## 🔒 TECHNICAL & CODING CONSTRAINTS
1. **No Stubs or Mock Data:** All database interactions must use live Supabase queries and Server Actions with robust error handling.
2. **Strict RLS:** Every new database table must have Row Level Security enabled, enforcing tenant isolation by `university_id` and `college_id`.
3. **UI/UX Standard:** Maintain the obsidian/cyber-green dark theme across all dashboard views. Ensure high scannability and contrast for sunlight visibility at physical gate stations.

Proceed with the step-by-step implementation, starting with database migrations and RLS policies, followed by backend route handlers, and finally rendering the frontend dashboard components.