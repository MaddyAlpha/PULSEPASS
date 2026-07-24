'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Calendar, MapPin, Users, Clock, Zap, Ticket, Tag, ArrowRight
} from 'lucide-react'
import type { Event } from '@/lib/types'

interface EventCardProps {
  event: Event
}

function CountdownBadge({ startsAt }: { startsAt: string }) {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = new Date(startsAt).getTime() - Date.now()
      if (diff <= 0) { setDisplay('Happening Now'); return }
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      if (days > 0) setDisplay(`${days}d ${hours}h`)
      else if (hours > 0) setDisplay(`${hours}h ${mins}m`)
      else setDisplay(`${mins}m`)
    }
    update()
    const t = setInterval(update, 60000)
    return () => clearInterval(t)
  }, [startsAt])

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono font-bold"
      style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,102,0.2)' }}>
      <Clock className="w-3 h-3 text-cyber-green" />
      <span className="text-cyber-green">{display}</span>
    </div>
  )
}

export default function EventCard({ event }: EventCardProps) {
  const generalFull = event.general_tickets_sold >= event.general_capacity
  const vipFull = event.vip_capacity > 0 && event.vip_tickets_sold >= event.vip_capacity
  const generalRemaining = event.general_capacity - event.general_tickets_sold
  const vipRemaining = event.vip_capacity - event.vip_tickets_sold
  const isSoldOut = generalFull && (event.vip_capacity === 0 || vipFull)

  const fillPercent = Math.round((event.general_tickets_sold / Math.max(event.general_capacity, 1)) * 100)

  return (
    <Link href={`/events/${event.id}`} className="block h-full">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        className="glass-card h-full flex flex-col overflow-hidden group cursor-pointer"
        style={{ transition: 'all 0.3s ease' }}>

        {/* Banner */}
        <div className="relative h-44 overflow-hidden bg-obsidian-800"
          style={{
            background: event.banner_url
              ? `url(${event.banner_url}) center/cover`
              : 'linear-gradient(135deg, #0F1317, #1E2428)',
          }}>
          {/* Grid overlay */}
          <div className="absolute inset-0 cyber-grid opacity-30" style={{ backgroundSize: '20px 20px' }} />
          {/* Gradient overlay */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(10,13,15,0.9) 0%, transparent 60%)' }} />

          {/* Org badge */}
          <div className="absolute top-3 left-3 max-w-[70%]">
            {event.organization && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium truncate"
                style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="text-white/90 font-semibold truncate">{event.organization.name}</span>
                {event.organization.department && (
                  <span className="text-white/40 border-l border-white/20 pl-1.5 truncate">
                    {event.organization.department}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
            {event.vip_capacity > 0 && (
              <span className="badge-vip">
                <Zap className="w-2.5 h-2.5" /> VIP
              </span>
            )}
            {isSoldOut && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(255,50,80,0.15)', border: '1px solid rgba(255,50,80,0.3)', color: '#FF3250' }}>
                Sold Out
              </span>
            )}
          </div>

          {/* Countdown */}
          <div className="absolute bottom-3 left-3">
            <CountdownBadge startsAt={event.starts_at} />
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-5">
          <h3 className="font-bold text-lg leading-tight mb-3 group-hover:text-cyber-green transition-colors duration-200 line-clamp-2">
            {event.title}
          </h3>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-white/50">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-white/30" />
              <span className="truncate">{event.venue}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Calendar className="w-3.5 h-3.5 shrink-0 text-white/30" />
              <span>{new Date(event.starts_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}</span>
            </div>
          </div>

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {event.tags.slice(0, 3).map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(232,237,242,0.5)' }}>
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Capacity bar */}
          <div className="mt-auto">
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-white/50">
                <Users className="w-3.5 h-3.5" />
                <span>{generalRemaining > 0 ? `${generalRemaining} spots left` : 'General Sold Out'}</span>
              </div>
              {event.vip_capacity > 0 && (
                <span className="text-cyber-green/70 font-mono">{vipRemaining} VIP left</span>
              )}
            </div>
            <div className="h-1 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${fillPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{
                  background: fillPercent > 80
                    ? 'linear-gradient(to right, #FF3250, #FF6080)'
                    : 'linear-gradient(to right, #00FF66, #00E55C)',
                }} />
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-5 py-3 border-t border-white/[0.05] flex items-center justify-between">
          <span className="text-xs text-white/30">Click to view details</span>
          <div className="flex items-center gap-1 text-xs font-semibold text-cyber-green group-hover:gap-2 transition-all duration-200">
            <Ticket className="w-3.5 h-3.5" />
            Claim Pass
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}
