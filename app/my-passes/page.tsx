'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Ticket, Calendar, Zap, Clock, Search, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Ticket as TicketType, Event, Organization, Profile } from '@/lib/types'
import TicketPass from '@/components/passes/TicketPass'
import Navbar from '@/components/ui/Navbar'

interface TicketWithRelations extends TicketType {
  event: Event & { organization: Organization }
}

export default function MyPassesPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<TicketWithRelations[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<TicketWithRelations | null>(null)
  const [filter, setFilter] = useState<'all' | 'valid' | 'checked_in' | 'expired'>('all')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: profileData }, { data: ticketsData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase
          .from('tickets')
          .select('*, event:events(*, organization:organizations(id,name,department,slug))')
          .eq('user_id', user.id)
          .order('claimed_at', { ascending: false }),
      ])

      setProfile(profileData)
      setTickets((ticketsData || []) as TicketWithRelations[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = tickets.filter(t => filter === 'all' || t.ticket_status === filter)

  const stats = {
    total: tickets.length,
    valid: tickets.filter(t => t.ticket_status === 'valid').length,
    checked_in: tickets.filter(t => t.ticket_status === 'checked_in').length,
    vip: tickets.filter(t => t.ticket_type === 'vip').length,
  }

  return (
    <div className="min-h-screen bg-obsidian-900">
      <Navbar />

      <div className="pt-20 pb-16 max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-10">
          <h1 className="text-3xl md:text-4xl font-black mb-2">
            My <span className="text-cyber-green">Passes</span>
          </h1>
          <p className="text-white/50">Your digital ticket wallet — all passes in one place.</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Passes', value: stats.total, color: '#E8EDF2' },
            { label: 'Valid', value: stats.valid, color: '#00FF66' },
            { label: 'Used', value: stats.checked_in, color: '#FFA500' },
            { label: 'VIP', value: stats.vip, color: '#00FF66' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass-card p-5">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">{stat.label}</p>
              <p className="text-3xl font-black" style={{ color: stat.color }}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {(['all', 'valid', 'checked_in', 'expired'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 capitalize"
              style={filter === f ? {
                background: 'rgba(0,255,102,0.12)',
                border: '1px solid rgba(0,255,102,0.3)',
                color: '#00FF66',
              } : {
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(232,237,242,0.4)',
              }}>
              {f === 'checked_in' ? 'Used' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card h-48 shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <Ticket className="w-12 h-12 text-white/15 mx-auto mb-4" />
            <p className="text-white/40 text-lg font-medium">No passes found</p>
            <p className="text-white/25 text-sm mt-1">
              {filter === 'all' ? 'Browse events and claim your first pass!' : `No ${filter} passes`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((ticket, i) => {
              const statusConfig = {
                valid: { label: '● Valid', color: '#00FF66', bg: 'rgba(0,255,102,0.1)', border: 'rgba(0,255,102,0.2)' },
                checked_in: { label: '● Checked In', color: '#FFA500', bg: 'rgba(255,165,0,0.1)', border: 'rgba(255,165,0,0.2)' },
                expired: { label: '● Expired', color: '#FF3250', bg: 'rgba(255,50,80,0.1)', border: 'rgba(255,50,80,0.2)' },
                cancelled: { label: '● Cancelled', color: '#666', bg: 'rgba(100,100,100,0.1)', border: 'rgba(100,100,100,0.2)' },
              }[ticket.ticket_status]

              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => setSelectedTicket(ticket)}
                  className="glass-card-hover p-5 cursor-pointer">

                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      {ticket.ticket_type === 'vip' && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold mb-2"
                          style={{ background: 'rgba(0,255,102,0.1)', color: '#00FF66', border: '1px solid rgba(0,255,102,0.2)' }}>
                          <Zap className="w-2.5 h-2.5" /> VIP
                        </div>
                      )}
                      <h3 className="font-bold text-base leading-tight line-clamp-2">
                        {ticket.event?.title}
                      </h3>
                    </div>
                    <div className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ml-3"
                      style={{ background: statusConfig.bg, border: `1px solid ${statusConfig.border}`, color: statusConfig.color }}>
                      {statusConfig.label}
                    </div>
                  </div>

                  {/* Event meta */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-sm text-white/40">
                      <Calendar className="w-3.5 h-3.5 text-white/25" />
                      {new Date(ticket.event?.starts_at || '').toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/30">
                      <Clock className="w-3 h-3" />
                      Claimed {new Date(ticket.claimed_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Org */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
                    <span className="text-xs text-white/30">{ticket.event?.organization?.name}</span>
                    <span className="text-xs text-cyber-green font-medium">View Pass →</span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Ticket Modal */}
        <AnimatePresence>
          {selectedTicket && profile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
              onClick={e => { if (e.target === e.currentTarget) setSelectedTicket(null) }}>
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-sm overflow-y-auto max-h-[90vh]">
                <TicketPass
                  data={{
                    ticket: selectedTicket,
                    event: selectedTicket.event,
                    organization: selectedTicket.event.organization,
                    holder: profile,
                  }}
                />
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="btn-ghost w-full justify-center mt-3">
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
