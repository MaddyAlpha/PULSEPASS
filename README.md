# PulsePass — Campus Event & VIP Pass Engine

> A production-grade, multi-tenant SaaS platform for campus event management.

## Tech Stack

- **Next.js 14** — App Router, Server Actions, Route Handlers
- **Supabase** — PostgreSQL + Row Level Security + Auth
- **Tailwind CSS** — Cyber Green/Obsidian dark theme
- **Framer Motion** — Page and component animations
- **qrcode.react** — Dynamic QR ticket generation
- **html5-qrcode** — Mobile camera QR scanner
- **jsPDF** — PDF ticket downloads

## Getting Started

### 1. Set up Supabase

1. Create a [Supabase](https://supabase.com) project
2. Copy your **Project URL** and **Anon Key** from the Supabase dashboard
3. Copy your **Service Role Key** from Settings → API

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
# Then fill in your Supabase credentials
```

### 3. Run Database Migrations

In your Supabase SQL Editor, run the contents of:
```
supabase/migrations/01_schema.sql
```

### 4. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## User Roles & Access

| Role | Access |
|------|--------|
| `student` | Browse events, claim passes, view wallet |
| `org_admin` | Full command center, create events, hire supervisors |
| `supervisor` | Gatekeeper QR scanner access |
| `super_admin` | Global visibility over all data |

## Key Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with live ticker |
| `/auth` | Sign in / Sign up with role selection |
| `/events` | Public event feed with filters |
| `/events/[id]` | Event detail with claim pass |
| `/my-passes` | Student pass wallet |
| `/org/dashboard` | Org command center + analytics |
| `/scanner/[eventId]` | Gatekeeper QR scanner |

## Architecture

```
app/                    # Next.js App Router
├── api/tickets/        # Ticket claiming (atomic)
├── api/checkin/        # QR check-in processing (atomic)
├── events/             # Event feed + detail
├── my-passes/          # Student wallet
├── org/dashboard/      # Org command center
└── scanner/[eventId]/  # Gatekeeper scanner

lib/
├── supabase/           # Browser + server + middleware clients
└── types.ts            # Full TypeScript definitions

supabase/
└── migrations/01_schema.sql  # Full DB schema + RLS + functions
```

## Making Someone a Super Admin

After they sign up, run in Supabase SQL Editor:
```sql
UPDATE public.profiles 
SET role = 'super_admin' 
WHERE email = 'admin@yourdomain.com';
```
