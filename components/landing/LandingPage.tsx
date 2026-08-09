'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Zap, Shield, BarChart3, Scan, Ticket, Users,
  ArrowRight, Star, Building2, GraduationCap, CheckCircle2
} from 'lucide-react'
import CyberParticles from './CyberParticles'
import LiveTicker from './LiveTicker'

const FEATURES = [
  {
    icon: Ticket,
    title: 'Digital VIP Passes',
    desc: 'One-tap QR ticket claiming with live availability counters and instant delivery to your pass wallet.',
    glow: 'rgba(0,255,102,0.15)',
  },
  {
    icon: Scan,
    title: 'Real-Time QR Scanner',
    desc: 'Mobile-first camera scanner for gatekeepers — validates tickets in under 200ms with haptic feedback.',
    glow: 'rgba(0,200,255,0.1)',
  },
  {
    icon: BarChart3,
    title: 'Live Analytics',
    desc: 'Track ticket conversions, scan rates, and peak entry hours on your org command center.',
    glow: 'rgba(255,200,0,0.1)',
  },
  {
    icon: Shield,
    title: 'Role-Based Security',
    desc: 'Granular RBAC — from Super Admin to hired Gatekeeper — backed by Supabase RLS policies.',
    glow: 'rgba(200,100,255,0.1)',
  },
  {
    icon: Users,
    title: 'Supervisor Hiring',
    desc: 'Invite students as Event Supervisors with scoped access to specific events via invite codes.',
    glow: 'rgba(0,255,102,0.12)',
  },
  {
    icon: Zap,
    title: 'Atomic Check-Ins',
    desc: 'Race-condition-free PostgreSQL functions prevent double entries — every scan is a database transaction.',
    glow: 'rgba(255,150,0,0.1)',
  },
]

const TICKER_ITEMS = [
  { label: 'Events Today', value: '24', unit: 'active' },
  { label: 'Passes Issued', value: '1,847', unit: 'total' },
  { label: 'Check-Ins', value: '643', unit: 'today' },
  { label: 'Clubs on Platform', value: '38', unit: 'orgs' },
  { label: 'Students Registered', value: '4,291' },
  { label: 'Scan Success Rate', value: '99.8%' },
]

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.5, ease: 'easeOut' },
  }),
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-obsidian-900 overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06]"
        style={{ background: 'rgba(10,13,15,0.85)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00FF66, #00B846)' }}>
              <Zap className="w-4 h-4 text-obsidian-900" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Pulse<span className="text-cyber-green">Pass</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <Link href="/events" className="hover:text-white transition-colors">Events</Link>
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#roles" className="hover:text-white transition-colors">For Clubs</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/auth" className="btn-ghost text-sm">Sign In</Link>
            <Link href="/auth?tab=signup" className="btn-cyber text-sm">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-16 cyber-grid"
        style={{ backgroundSize: '40px 40px' }}>
        {/* Glow orb */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(0,255,102,0.12) 0%, transparent 70%)' }} />

        <CyberParticles />

        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-semibold tracking-widest uppercase"
            style={{
              background: 'rgba(0,255,102,0.08)',
              border: '1px solid rgba(0,255,102,0.2)',
              color: '#00FF66',
            }}>
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
            Campus Event Engine · Now Live
          </div>

          {/* Headline */}
          <h1
            className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[1.05]">
            The Future of<br />
            <span className="text-glow-green">Campus Events</span>
          </h1>

          <p
            className="text-lg md:text-xl text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed">
            One platform for clubs to publish events, students to claim digital VIP passes,
            and gatekeepers to scan QR codes in real-time — all secured by{' '}
            <span className="text-white/80">Supabase row-level security</span>.
          </p>

          <div
            className="flex flex-wrap items-center justify-center gap-4 relative z-50">
            <Link href="/auth?tab=signup&role=org" className="btn-cyber px-8 py-4 text-base">
              Register Your Club <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/events" className="btn-cyber-outline px-8 py-4 text-base">
              Explore Campus Events
            </Link>
          </div>

          {/* Social proof */}
          <div
            className="flex items-center justify-center gap-6 mt-12 text-sm text-white/40">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyber-green" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyber-green" />
              <span>Free for students</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyber-green" />
              <span>Setup in 2 minutes</span>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-pulse">
          <span className="text-xs text-white/30 tracking-widest uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-cyber-green/40 to-transparent" />
        </div>
      </section>

      {/* ── Live Ticker ── */}
      <LiveTicker items={TICKER_ITEMS} />

      {/* ── Feature Grid ── */}
      <section id="features" className="py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}>
            <p className="text-cyber-green text-sm font-semibold tracking-widest uppercase mb-4">
              Platform Features
            </p>
            <h2 className="text-4xl md:text-5xl font-black mb-5">
              Everything a campus needs
            </h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              From ticket creation to live check-in scanning — a complete end-to-end
              event operations platform built for modern universities.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={cardVariants}
              className="glass-card-hover p-6 group">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110"
                style={{ background: f.glow, border: `1px solid ${f.glow}` }}>
                <f.icon className="w-5 h-5 text-cyber-green" />
              </div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Role Showcase ── */}
      <section id="roles" className="py-24 px-6 relative overflow-hidden">
        {/* Background accent */}
        <div className="absolute inset-0 cyber-grid opacity-50" style={{ backgroundSize: '60px 60px' }} />
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0,255,102,0.04) 0%, transparent 100%)' }} />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-cyber-green text-sm font-semibold tracking-widest uppercase mb-4">For Everyone</p>
            <h2 className="text-4xl md:text-5xl font-black">Built for your role</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* For Clubs */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,255,102,0.1)', border: '1px solid rgba(0,255,102,0.2)' }}>
                  <Building2 className="w-6 h-6 text-cyber-green" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">For Clubs & Orgs</h3>
                  <p className="text-white/40 text-sm">Command center access</p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  'Create events with capacity caps & ticket types',
                  'Generate shareable event pages instantly',
                  'Hire students as gatekeepers via invite codes',
                  'Live analytics: scan rates, peak hours, conversions',
                  'Real-time attendee list with check-in status',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/70">
                    <CheckCircle2 className="w-4 h-4 text-cyber-green shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/auth?tab=signup&role=org" className="btn-cyber w-full justify-center">
                  Register Your Organization <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            {/* For Students */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(100,150,255,0.1)', border: '1px solid rgba(100,150,255,0.2)' }}>
                  <GraduationCap className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">For Students</h3>
                  <p className="text-white/40 text-sm">Your digital pass wallet</p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  'Browse upcoming campus events filtered by club & date',
                  'One-tap claim General or VIP digital passes',
                  'Pass wallet with live status: Valid / Checked-In / Expired',
                  'Download ticket PDF for offline access',
                  'Become a gatekeeper for extra campus opportunities',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/70">
                    <Star className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/auth?tab=signup" className="btn-cyber-outline w-full justify-center">
                  Create Student Account <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-32 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center glass-card p-16 relative overflow-hidden">
          {/* Inner glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,255,102,0.1) 0%, transparent 70%)' }} />

          <p className="text-cyber-green text-sm font-semibold tracking-widest uppercase mb-4">Ready to launch?</p>
          <h2 className="text-4xl md:text-5xl font-black mb-6">
            Your campus events,<br />
            <span className="text-glow-green">supercharged.</span>
          </h2>
          <p className="text-white/50 text-lg mb-10 max-w-xl mx-auto">
            Join 38+ campus organizations already running their events on PulsePass.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/auth?tab=signup&role=org" className="btn-cyber px-10 py-4 text-base">
              Register Your Club <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/events" className="btn-ghost px-10 py-4 text-base">
              Browse Events
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00FF66, #00B846)' }}>
              <Zap className="w-3.5 h-3.5 text-obsidian-900" strokeWidth={2.5} />
            </div>
            <span className="font-bold">Pulse<span className="text-cyber-green">Pass</span></span>
          </div>
          <p className="text-white/30 text-sm">
            © 2024 PulsePass. Campus Event & VIP Pass Engine.
          </p>
          <div className="flex gap-5 text-sm text-white/40">
            <Link href="/events" className="hover:text-white transition-colors">Events</Link>
            <Link href="/auth" className="hover:text-white transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
