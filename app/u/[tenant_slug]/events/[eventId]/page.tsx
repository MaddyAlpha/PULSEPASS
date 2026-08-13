'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, MapPin, Users, Clock, Zap, Ticket, Tag, ArrowLeft,
  CheckCircle2, ExternalLink, Loader2, Shield
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Event, Ticket as TicketType, Profile } from '@/lib/types'
import toast from 'react-hot-toast'
import Navbar from '@/components/ui/Navbar'

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const eventId = params.eventId as string

  const [event, setEvent] = useState<Event | null>(null)
  const [userTicket, setUserTicket] = useState<TicketType | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [selectedType, setSelectedType] = useState<'general' | 'vip'>('general')
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rollNumberInput, setRollNumberInput] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)

      const { data: eventData } = await supabase
        .from('events')
        .select('*, organization:organizations(id,name,logo_url,department)')
        .eq('id', eventId)
        .single()

      setEvent(eventData)

      if (u) {
        const [{ data: ticket }, { data: profileData }] = await Promise.all([
          supabase.from('tickets').select('*').eq('event_id', eventId).eq('user_id', u.id).maybeSingle(),
          supabase.from('profiles').select('*').eq('id', u.id).single()
        ])
        setUserTicket(ticket)
        setProfile(profileData)
        if (profileData?.university_id) {
          setRollNumberInput(profileData.university_id)
        }
      }

      setLoading(false)
    }
    load()
  }, [eventId])

  const handleClaimPassClick = () => {
    if (!user) {
      router.push(`/auth?redirect=/u/${params.tenant_slug}/events/${eventId}`)
      return
    }
    // Route to OCR Claim screen
    router.push(`/u/${params.tenant_slug}/events/${eventId}/claim?type=${selectedType}`)
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-obsidian-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-[100dvh] bg-obsidian-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 text-lg">Event not found</p>
          <Link href={`/u/${params.tenant_slug}/events`} className="btn-cyber-outline mt-4">Back to Events</Link>
        </div>
      </div>
    )
  }

  const generalFull = event.general_tickets_sold >= event.general_capacity
  const vipFull = event.vip_tickets_sold >= event.vip_capacity
  const isPast = new Date(event.ends_at) < new Date()

  return (
    <div className="min-h-[100dvh] bg-obsidian-900">
      <Navbar />

      {/* Banner */}
      <div className="relative h-72 md:h-96 pt-16 bg-obsidian-800 overflow-hidden"
        style={event.banner_url ? {
          backgroundImage: `url(${event.banner_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {}}>
        <div className="absolute inset-0 cyber-grid opacity-20" style={{ backgroundSize: '30px 30px' }} />
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, #0A0D0F 0%, rgba(10,13,15,0.6) 40%, transparent 100%)' }} />

        <div className="absolute bottom-6 left-6 right-6">
          <div className="max-w-5xl mx-auto">
            {event.organization && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm mb-3"
                style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="text-white/60">{event.organization.name}</span>
                {event.organization.department && (
                  <span className="text-white/30">• {event.organization.department}</span>
                )}
              </div>
            )}
            <h1 className="text-3xl md:text-5xl font-black leading-tight">{event.title}</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Left: Details */}
          <div className="md:col-span-2 space-y-8">
            {/* Back link */}
            <Link href={`/u/${params.tenant_slug}/events`} className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              All Events
            </Link>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Calendar, label: 'Date & Time', value: new Date(event.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                { icon: MapPin, label: 'Venue', value: event.venue },
                { icon: Users, label: 'General Capacity', value: `${event.general_tickets_sold} / ${event.general_capacity} claimed` },
                { icon: Clock, label: 'Ends At', value: new Date(event.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
              ].map(item => (
                <div key={item.label} className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <item.icon className="w-4 h-4 text-cyber-green" />
                    <span className="text-xs text-white/40 uppercase tracking-wider">{item.label}</span>
                  </div>
                  <p className="text-sm font-medium text-white/80">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            {event.description && (
              <div className="glass-card p-6">
                <h2 className="font-bold text-lg mb-3">About This Event</h2>
                <p className="text-white/60 leading-relaxed whitespace-pre-line">{event.description}</p>
              </div>
            )}

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {event.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(232,237,242,0.5)' }}>
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Map link */}
            {event.venue_map_url && (
              <a href={event.venue_map_url} target="_blank" rel="noopener noreferrer"
                className="btn-ghost inline-flex">
                <MapPin className="w-4 h-4" />
                View Venue on Map
                <ExternalLink className="w-3.5 h-3.5 opacity-50" />
              </a>
            )}
          </div>

          {/* Right: Claim Pass */}
          <div className="md:col-span-1">
            <div className="sticky top-24">
              <AnimatePresence mode="wait">
                {userTicket ? (
                  <motion.div
                    key="has-ticket"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-6 text-center"
                    style={{ border: '1px solid rgba(0,255,102,0.2)' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                      style={{ background: 'rgba(0,255,102,0.12)', border: '1px solid rgba(0,255,102,0.3)' }}>
                      <CheckCircle2 className="w-8 h-8 text-cyber-green" />
                    </div>
                    <h3 className="font-bold text-xl mb-1 text-cyber-green">Pass Claimed!</h3>
                    <p className="text-white/50 text-sm mb-1">
                      {userTicket.ticket_type.toUpperCase()} ticket
                    </p>
                    <div className={`mt-3 mb-5 ${
                      userTicket.ticket_status === 'valid' ? 'badge-valid' :
                      userTicket.ticket_status === 'checked_in' ? 'badge-used' : 'badge-expired'
                    } mx-auto w-fit`}>
                      {userTicket.ticket_status === 'valid' ? '● Valid' :
                       userTicket.ticket_status === 'checked_in' ? '● Checked In' : '● Expired'}
                    </div>
                    <Link href="/my-passes" className="btn-cyber w-full justify-center">
                      <Ticket className="w-4 h-4" />
                      View My Passes
                    </Link>
                  </motion.div>
                ) : isPast ? (
                  <motion.div
                    key="past"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="glass-card p-6 text-center">
                    <p className="text-white/40">This event has ended</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="claim"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-6">
                    <h3 className="font-bold text-lg mb-5">Claim Your Pass</h3>

                    {/* Ticket type selection */}
                    <div className="space-y-3 mb-6">
                      <button
                        onClick={() => setSelectedType('general')}
                        className="w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200"
                        style={selectedType === 'general' ? {
                          background: 'rgba(0,255,102,0.08)',
                          border: '1px solid rgba(0,255,102,0.3)',
                        } : {
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                        <div className="flex items-center gap-3">
                          <Ticket className={`w-5 h-5 ${selectedType === 'general' ? 'text-cyber-green' : 'text-white/40'}`} />
                          <div className="text-left">
                            <p className={`font-semibold text-sm ${selectedType === 'general' ? 'text-cyber-green' : 'text-white/70'}`}>
                              General Pass
                            </p>
                            <p className="text-xs text-white/30 mt-0.5">
                              {event.general_capacity - event.general_tickets_sold} remaining
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-cyber-green/70">FREE</span>
                      </button>

                      {event.vip_capacity > 0 && (
                        <button
                          onClick={() => setSelectedType('vip')}
                          disabled={vipFull}
                          className="w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 disabled:opacity-40"
                          style={selectedType === 'vip' ? {
                            background: 'rgba(0,255,102,0.08)',
                            border: '1px solid rgba(0,255,102,0.3)',
                          } : {
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}>
                          <div className="flex items-center gap-3">
                            <Zap className={`w-5 h-5 ${selectedType === 'vip' ? 'text-cyber-green' : 'text-white/40'}`} />
                            <div className="text-left">
                              <p className={`font-semibold text-sm ${selectedType === 'vip' ? 'text-cyber-green' : 'text-white/70'}`}>
                                VIP Pass
                              </p>
                              <p className="text-xs text-white/30 mt-0.5">
                                {vipFull ? 'Sold out' : `${event.vip_capacity - event.vip_tickets_sold} remaining`}
                              </p>
                            </div>
                          </div>
                          <span className="badge-vip">VIP</span>
                        </button>
                      )}
                    </div>

                    {event.roll_number_pattern && (
                      <div className="mb-6 space-y-2">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                          College Roll Number Required
                        </label>
                        <input
                          type="text"
                          required
                          value={rollNumberInput}
                          onChange={e => setRollNumberInput(e.target.value.toUpperCase())}
                          placeholder="Enter your roll number..."
                          className="input-cyber w-full uppercase"
                        />
                      </div>
                    )}

                    {generalFull && selectedType === 'general' ? (
                      <div className="text-center py-3 px-4 rounded-xl text-sm font-medium"
                        style={{ background: 'rgba(255,50,80,0.1)', border: '1px solid rgba(255,50,80,0.2)', color: '#FF3250' }}>
                        General tickets are sold out
                      </div>
                    ) : (
                      <button
                        onClick={handleClaimPassClick}
                        className="btn-cyber w-full justify-center py-3.5">
                        {claiming ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Ticket className="w-4 h-4" />
                            Claim {selectedType === 'vip' ? 'VIP ' : ''}Pass
                          </>
                        )}
                      </button>
                    )}

                    <div className="flex items-center gap-2 mt-4 text-xs text-white/30 justify-center">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Secured by Supabase RLS · No double claims</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
