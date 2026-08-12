'use client'

/**
 * PulsePass — Phase 2 Station 3: Verifier UI
 *
 * Subscribes to Supabase Realtime channel `gate:[eventId]`.
 * Receives tickets from Station 2 and displays a live-updating grid.
 * Admin clicks "Admit" to permanently burn the ticket (checked_in = true).
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, CheckCircle2, XCircle, Loader2, ArrowLeft,
  Clock, Star, User, Zap, RefreshCw, Bell
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Event, GateRealtimePayload } from '@/lib/types'
import Link from 'next/link'

interface PendingEntry extends GateRealtimePayload {
  full_name?: string
  email?: string
  avatar_url?: string | null
  admitting?: boolean
  admitted?: boolean
  rejected?: boolean
}

export default function VerifierPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const eventId = params.eventId as string
  const channelRef = useRef<any>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const [event, setEvent] = useState<Event | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [pendingTickets, setPendingTickets] = useState<PendingEntry[]>([])
  const [admittedCount, setAdmittedCount] = useState(0)
  const [connected, setConnected] = useState(false)
  const [flashGreen, setFlashGreen] = useState(false)
  const [crBatchPrefix, setCrBatchPrefix] = useState<string | null>(null)

  // Audio feedback using Web Audio API
  const playBeep = (success: boolean) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(success ? 880 : 220, ctx.currentTime)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    } catch { /* Audio not available */ }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const isAuth = ['organiser', 'committee_admin', 'supervisor', 'super_admin', 'university_admin'].includes(profile?.role || '')
      setAuthorized(isAuth)
      if (!isAuth) { setAuthChecking(false); return }

      const { data: ev } = await supabase
        .from('events').select('*, organization:organizations(id, name)').eq('id', eventId).single()
      setEvent(ev as Event)
      
      let assignedBatchPrefix = null
      if (ev?.org_id) {
        const { data: mem } = await supabase.from('org_members_supervisors')
          .select('cr_batch_prefix')
          .eq('user_id', user.id)
          .eq('org_id', ev.org_id)
          .maybeSingle()
        if (mem?.cr_batch_prefix) assignedBatchPrefix = mem.cr_batch_prefix
      }
      setCrBatchPrefix(assignedBatchPrefix)

      // Load currently-pending tickets from DB (for page refresh recovery)
      const { data: existing } = await supabase
        .from('tickets')
        .select('id, ticket_type, user_id, roll_number, is_vip_bypass, profile:profiles!user_id(full_name, email, avatar_url)')
        .eq('event_id', eventId)
        .eq('ticket_status', 'pending_verification')

      if (existing) {
        const mapped: PendingEntry[] = existing.map((t: any) => ({
          ticket_id: t.id,
          ticket_type: t.ticket_type,
          user_id: t.user_id,
          roll_number: t.roll_number,
          is_vip: t.is_vip_bypass,
          full_name: t.profile?.full_name,
          email: t.profile?.email,
          avatar_url: t.profile?.avatar_url,
          scanned_at: new Date().toISOString(),
          event_id: eventId,
        }))
        // Pre-filter on page load as well
        setPendingTickets(mapped.filter(t => !assignedBatchPrefix || (t.roll_number && t.roll_number.startsWith(assignedBatchPrefix))))
      }

      // Count admitted
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('checkins').select('*', { count: 'exact', head: true })
        .eq('event_id', eventId).eq('success', true).gte('scanned_at', today.toISOString())
      setAdmittedCount(count || 0)

      // Subscribe to Realtime gate channel
      channelRef.current = supabase
        .channel(`gate:${eventId}`)
        .on('broadcast', { event: 'ticket_pending' }, ({ payload }) => {
          const entry = payload as PendingEntry
          
          // Smart CR Routing: Only accept if no prefix assigned OR if roll number matches prefix
          if (assignedBatchPrefix && (!entry.roll_number || !entry.roll_number.startsWith(assignedBatchPrefix))) {
            return
          }

          setPendingTickets((prev) => {
            // Avoid duplicates
            if (prev.some((p) => p.ticket_id === entry.ticket_id)) return prev
            return [entry, ...prev]
          })
          // Flash notification
          setFlashGreen(true)
          setTimeout(() => setFlashGreen(false), 1000)
          if (navigator.vibrate) navigator.vibrate(200)
          playBeep(true)
        })
        .on('broadcast', { event: 'ticket_admitted' }, ({ payload }) => {
          setAdmittedCount((c) => c + 1)
          // Could also remove from pending if admitted by another station
          setPendingTickets((prev) => prev.filter((p) => p.ticket_id !== payload.ticket_id))
        })
        .subscribe((status) => {
          setConnected(status === 'SUBSCRIBED')
        })

      setAuthChecking(false)
    }
    init()
    return () => { channelRef.current?.unsubscribe() }
  }, [eventId])

  const handleAdmit = useCallback(async (entry: PendingEntry) => {
    setPendingTickets((prev) => prev.map((p) => p.ticket_id === entry.ticket_id ? { ...p, admitting: true } : p))

    try {
      const res = await fetch('/api/station3-admit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: entry.ticket_id, event_id: eventId, device_info: navigator.userAgent }),
      })
      const data = await res.json()

      if (data.success) {
        setPendingTickets((prev) => prev.map((p) => p.ticket_id === entry.ticket_id ? { ...p, admitting: false, admitted: true } : p))
        setAdmittedCount((c) => c + 1)
        if (navigator.vibrate) navigator.vibrate([100, 50, 100])
        playBeep(true)
        
        // Broadcast final admit to all gate devices
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'ticket_admitted',
            payload: { ticket_id: entry.ticket_id, event_id: eventId }
          })
        }

        // Remove after animation
        setTimeout(() => {
          setPendingTickets((prev) => prev.filter((p) => p.ticket_id !== entry.ticket_id))
        }, 1500)
      } else {
        setPendingTickets((prev) => prev.map((p) => p.ticket_id === entry.ticket_id ? { ...p, admitting: false } : p))
        playBeep(false)
      }
    } catch {
      setPendingTickets((prev) => prev.map((p) => p.ticket_id === entry.ticket_id ? { ...p, admitting: false } : p))
    }
  }, [eventId])

  const handleReject = useCallback(async (entry: PendingEntry) => {
    setPendingTickets((prev) => prev.map((p) => p.ticket_id === entry.ticket_id ? { ...p, admitting: true } : p))

    try {
      await fetch('/api/station3-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: entry.ticket_id, event_id: eventId }),
      })
      setPendingTickets((prev) => prev.map((p) => p.ticket_id === entry.ticket_id ? { ...p, admitting: false, rejected: true } : p))
      playBeep(false)
      setTimeout(() => {
        setPendingTickets((prev) => prev.filter((p) => p.ticket_id !== entry.ticket_id))
      }, 1200)
    } catch {
      setPendingTickets((prev) => prev.map((p) => p.ticket_id === entry.ticket_id ? { ...p, admitting: false } : p))
    }
  }, [eventId])

  if (authChecking) {
    return <div className="min-h-screen bg-obsidian-900 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
    </div>
  }

  if (!authorized) {
    return <div className="min-h-screen bg-obsidian-900 flex items-center justify-center p-6">
      <div className="text-center">
        <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="font-bold text-xl mb-2">Access Denied</h2>
        <Link href="/events" className="btn-cyber-outline">Back to Events</Link>
      </div>
    </div>
  }

  return (
    <div className="min-h-screen bg-obsidian-950 flex flex-col">
      {/* Green flash on new arrival */}
      <AnimatePresence>
        {flashGreen && (
          <motion.div key="flash"
            initial={{ opacity: 0.6 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 pointer-events-none z-50"
            style={{ background: 'rgba(0,255,102,0.15)' }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] sticky top-0 z-40"
        style={{ background: 'rgba(5,7,9,0.97)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-3">
          <Link href={`/scanner/${eventId}`} className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-cyber-green animate-pulse' : 'bg-white/20'}`} />
              <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Station 3 · Verifier</p>
              {crBatchPrefix && (
                <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  CR BATCH: {crBatchPrefix}
                </span>
              )}
            </div>
            <p className="font-bold text-sm leading-tight">{event?.title || 'Verifier'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-xl font-black text-purple-400">{pendingTickets.length}</p>
            <p className="text-[10px] text-white/30 uppercase">pending</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-cyber-green">{admittedCount}</p>
            <p className="text-[10px] text-white/30 uppercase">admitted</p>
          </div>
        </div>
      </div>

      {/* Pending Queue */}
      <div className="flex-1 p-4 overflow-y-auto">
        {pendingTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-64 text-center">
            <div className="w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(168,139,250,0.08)', border: '1px solid rgba(168,139,250,0.2)' }}>
              <Clock className="w-10 h-10 text-purple-400 opacity-50" />
            </div>
            <p className="text-white/30 font-medium">Waiting for tickets from Station 2...</p>
            <p className="text-white/20 text-sm mt-1">New arrivals appear here in real-time</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {pendingTickets.map((entry) => (
                <motion.div
                  key={entry.ticket_id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: -20 }}
                  animate={{
                    opacity: entry.admitted || entry.rejected ? 0 : 1,
                    scale: entry.admitted ? 1.02 : entry.rejected ? 0.95 : 1,
                    y: 0,
                  }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: entry.admitted ? '#00FF66' : entry.rejected ? '#FF3250' :
                      entry.is_vip ? 'rgba(245,158,11,0.3)' : 'rgba(168,139,250,0.3)',
                    background: entry.admitted ? 'rgba(0,255,102,0.08)' : entry.rejected ? 'rgba(255,50,80,0.08)' :
                      entry.is_vip ? 'rgba(245,158,11,0.04)' : 'rgba(168,139,250,0.04)',
                  }}>
                  <div className="p-4">
                    {/* Avatar + Name */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.06)' }}>
                        {entry.avatar_url
                          ? <img src={entry.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                          : <User className="w-6 h-6 text-white/30" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{entry.full_name || 'Anonymous'}</p>
                        <p className="text-white/40 text-xs truncate">{entry.email || entry.user_id.slice(0, 12) + '...'}</p>
                        {entry.roll_number && (
                          <p className="text-white/30 text-xs font-mono mt-0.5">{entry.roll_number}</p>
                        )}
                      </div>
                      {entry.is_vip && (
                        <div className="flex-shrink-0 px-2 py-1 rounded-lg text-xs font-bold"
                          style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                          ⭐ VIP
                        </div>
                      )}
                    </div>

                    {/* Ticket type badge + scan time */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{
                          background: entry.is_vip ? 'rgba(245,158,11,0.15)' : 'rgba(168,139,250,0.15)',
                          color: entry.is_vip ? '#F59E0B' : '#A78BFA'
                        }}>
                        {entry.ticket_type?.toUpperCase()} PASS
                      </span>
                      <span className="text-[10px] text-white/30">
                        {new Date(entry.scanned_at).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Action buttons */}
                    {!entry.admitted && !entry.rejected && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAdmit(entry)}
                          disabled={entry.admitting}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm text-black transition-all disabled:opacity-60"
                          style={{ background: '#00FF66' }}>
                          {entry.admitting
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <CheckCircle2 className="w-4 h-4" />}
                          Admit
                        </button>
                        <button
                          onClick={() => handleReject(entry)}
                          disabled={entry.admitting}
                          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 text-red-400"
                          style={{ background: 'rgba(255,50,80,0.12)', border: '1px solid rgba(255,50,80,0.2)' }}>
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Admitted state */}
                    {entry.admitted && (
                      <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-cyber-green"
                        style={{ background: 'rgba(0,255,102,0.12)' }}>
                        <CheckCircle2 className="w-4 h-4" />
                        Admitted!
                      </div>
                    )}

                    {/* Rejected state */}
                    {entry.rejected && (
                      <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-red-400"
                        style={{ background: 'rgba(255,50,80,0.12)' }}>
                        <XCircle className="w-4 h-4" />
                        Rejected
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/[0.06]"
        style={{ background: 'rgba(5,7,9,0.97)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-cyber-green animate-pulse' : 'bg-red-400'}`} />
            <span className="text-white/40 text-xs">{connected ? 'Realtime Connected' : 'Reconnecting...'}</span>
          </div>
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <Zap className="w-3.5 h-3.5" />
            Station 3 of 3 · Final Admit
          </div>
        </div>
      </div>
    </div>
  )
}
