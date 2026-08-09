'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Star, Search, Loader2, CheckCircle2, XCircle, User, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Event } from '@/lib/types'

export default function VIPIssuerPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [studentEmail, setStudentEmail] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; student?: string } | null>(null)

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select('id, title, starts_at, vip_capacity, vip_tickets_sold, org_id')
        .eq('status', 'published')
        .order('starts_at', { ascending: true })
      if (data) setEvents(data as Event[])
    }
    fetchEvents()
  }, [])

  const handleIssueVIP = async () => {
    if (!selectedEvent || !studentEmail.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/tickets/vip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: selectedEvent.id,
          student_email: studentEmail.trim().toLowerCase(),
          roll_number: rollNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ success: true, message: 'VIP pass issued successfully!', student: data.student?.full_name || studentEmail })
        setStudentEmail('')
        setRollNumber('')
        setNotes('')
      } else {
        setResult({ success: false, message: data.error || 'Failed to issue VIP pass.' })
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const vipRemaining = selectedEvent
    ? selectedEvent.vip_capacity - (selectedEvent.vip_tickets_sold || 0)
    : null

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Star className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="font-black text-xl">Issue VIP Pass</h2>
          <p className="text-white/40 text-sm">Bypasses OCR verification</p>
        </div>
      </div>

      {/* Event Selector */}
      <div className="mb-5">
        <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider">Select Event *</label>
        <div className="space-y-2">
          {events.length === 0 ? (
            <p className="text-white/30 text-sm">No published events available.</p>
          ) : events.map((ev) => {
            const remaining = ev.vip_capacity - (ev.vip_tickets_sold || 0)
            return (
              <button key={ev.id} onClick={() => setSelectedEvent(ev)}
                className="w-full text-left p-4 rounded-xl border transition-all"
                style={{
                  borderColor: selectedEvent?.id === ev.id ? '#F59E0B' : 'rgba(255,255,255,0.06)',
                  background: selectedEvent?.id === ev.id ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                }}>
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-sm">{ev.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${remaining > 0 ? 'text-amber-400 bg-amber-400/10' : 'text-red-400 bg-red-400/10'}`}>
                    {remaining} VIP left
                  </span>
                </div>
                <p className="text-white/30 text-xs mt-1">{new Date(ev.starts_at).toLocaleDateString()}</p>
              </button>
            )
          })}
        </div>
      </div>

      {selectedEvent && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {vipRemaining !== null && vipRemaining <= 0 && (
            <div className="p-3 rounded-xl border border-red-400/30 mb-4 flex items-center gap-2"
              style={{ background: 'rgba(255,50,80,0.06)' }}>
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">VIP capacity is full for this event.</p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Student Email *</label>
            <input type="email" value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="student@university.edu"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 transition-colors" />
          </div>

          <div className="mb-4">
            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Roll Number (optional)</label>
            <input type="text" value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
              placeholder="e.g., 22AG001"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-amber-400 transition-colors" />
          </div>

          <div className="mb-5">
            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Guest speaker, Department head..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 transition-colors resize-none" />
          </div>

          {/* Result */}
          {result && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl border mb-4 flex items-center gap-3 ${result.success ? 'border-cyber-green/30' : 'border-red-400/30'}`}
              style={{ background: result.success ? 'rgba(0,255,102,0.06)' : 'rgba(255,50,80,0.06)' }}>
              {result.success ? <CheckCircle2 className="w-5 h-5 text-cyber-green flex-shrink-0" /> : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
              <div>
                <p className={`font-semibold text-sm ${result.success ? 'text-cyber-green' : 'text-red-400'}`}>{result.message}</p>
                {result.student && <p className="text-white/40 text-xs mt-0.5">Issued to: {result.student}</p>}
              </div>
            </motion.div>
          )}

          <button onClick={handleIssueVIP}
            disabled={loading || !studentEmail.trim() || (vipRemaining !== null && vipRemaining <= 0)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#F59E0B', color: '#000' }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
            Issue VIP Pass
          </button>
        </motion.div>
      )}
    </div>
  )
}
