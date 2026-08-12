'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, Calendar, MapPin, Users, Clock, Zap, Tag, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Event } from '@/lib/types'
import EventCard from './EventCard'
import Navbar from '@/components/ui/Navbar'

const FILTERS = {
  type: [
    { label: 'All Events', value: 'all' },
    { label: 'Free Entry', value: 'free' },
    { label: 'VIP Available', value: 'vip' },
  ],
  sort: [
    { label: 'Upcoming First', value: 'starts_at' },
    { label: 'Most Popular', value: 'tickets' },
    { label: 'Newest Added', value: 'created_at' },
  ],
}

export default function EventFeedPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('starts_at')
  const [showFilters, setShowFilters] = useState(false)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('events')
        .select(`
          *,
          organization:organizations(id, name, department, slug)
        `)
        .eq('status', 'published')
        .gte('ends_at', new Date().toISOString())
        .order(sortBy === 'starts_at' ? 'starts_at' : 'created_at', { ascending: sortBy !== 'created_at' })

      if (typeFilter === 'vip') {
        query = query.gt('vip_capacity', 0)
      }

      const { data, error } = await query.limit(100)
      if (error) throw error

      let filteredEvents = (data || []) as Event[]

      if (search.trim()) {
        const q = search.toLowerCase().trim()
        filteredEvents = filteredEvents.filter(e => {
          const matchTitle = e.title?.toLowerCase().includes(q)
          const matchVenue = e.venue?.toLowerCase().includes(q)
          const matchOrg = e.organization?.name?.toLowerCase().includes(q)
          const matchDept = e.organization?.department?.toLowerCase().includes(q)
          const matchTags = e.tags?.some(t => t.toLowerCase().includes(q))
          return matchTitle || matchVenue || matchOrg || matchDept || matchTags
        })
      }

      setEvents(filteredEvents)
    } catch (err) {
      console.error('Failed to fetch events:', err)
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, sortBy])

  useEffect(() => {
    const debounce = setTimeout(fetchEvents, 300)
    return () => clearTimeout(debounce)
  }, [fetchEvents])

  return (
    <div className="min-h-screen bg-obsidian-900">
      <Navbar />

      <div className="pt-20 pb-16">
        {/* Header */}
        <div className="border-b border-white/[0.06] bg-obsidian-900/80"
          style={{ backdropFilter: 'blur(12px)' }}>
          <div className="max-w-7xl mx-auto px-6 py-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}>
              <h1 className="text-3xl md:text-4xl font-black mb-2">
                Campus <span className="text-cyber-green">Events</span>
              </h1>
              <p className="text-white/50">Discover, claim passes, and never miss what's happening on campus.</p>
            </motion.div>

            {/* Search + Filters */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mt-6 flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search by university, department, club, venue, or title..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-cyber w-full pl-11"
                />
              </div>

              {/* Type filter */}
              <div className="flex gap-2">
                {FILTERS.type.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setTypeFilter(f.value)}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                    style={typeFilter === f.value ? {
                      background: 'rgba(0,255,102,0.12)',
                      border: '1px solid rgba(0,255,102,0.3)',
                      color: '#00FF66',
                    } : {
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(232,237,242,0.5)',
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="input-cyber appearance-none pr-10 cursor-pointer">
                  {FILTERS.sort.map(s => (
                    <option key={s.value} value={s.value} style={{ background: '#121619' }}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Event Grid */}
        <div className="max-w-7xl mx-auto px-6 py-10">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card h-80 animate-pulse">
                  <div className="h-40 rounded-t-2xl shimmer" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 rounded shimmer w-3/4" />
                    <div className="h-3 rounded shimmer w-1/2" />
                    <div className="h-3 rounded shimmer w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-24">
              <Calendar className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40 text-lg font-medium">No events found</p>
              <p className="text-white/25 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {events.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}>
                  <EventCard event={event} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
