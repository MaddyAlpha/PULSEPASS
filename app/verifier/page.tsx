'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, UserCheck, Calendar } from 'lucide-react'
import Navbar from '@/components/ui/Navbar'

export default function VerifierIndexPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      // First check if they are owner of any org
      let orgIds: string[] = []
      const { data: ownedOrgs } = await supabase.from('organizations').select('id').eq('owner_id', user.id)
      if (ownedOrgs && ownedOrgs.length > 0) {
        orgIds.push(...ownedOrgs.map(o => o.id))
      }

      // Then check if they are added as a member to any org
      const { data: memberOrgs } = await supabase.from('org_members_supervisors').select('org_id').eq('user_id', user.id)
      if (memberOrgs && memberOrgs.length > 0) {
        orgIds.push(...memberOrgs.map(m => m.org_id))
      }

      // Remove duplicates
      orgIds = Array.from(new Set(orgIds))

      if (orgIds.length === 0) {
        setError('You are not assigned to any organization as a verifier.')
        setLoading(false)
        return
      }

      // Get events for these orgs
      const { data: eventsData, error: evError } = await supabase
        .from('events')
        .select('id, title, starts_at, status')
        .in('org_id', orgIds)
        .order('starts_at', { ascending: false })

      if (evError || !eventsData || eventsData.length === 0) {
        setError('No events found for your organization.')
        setLoading(false)
        return
      }

      if (eventsData.length === 1) {
        router.replace(`/verifier/${eventsData[0].id}`)
        return
      }

      setEvents(eventsData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-obsidian-900">
      <Navbar />
      <div className="pt-24 px-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.1)', color: '#A78BFA' }}>
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Select Event to Verify</h1>
            <p className="text-white/40">Choose the event you are verifying tickets for</p>
          </div>
        </div>

        {error ? (
          <div className="glass-card p-8 text-center text-red-400 border border-red-500/20" style={{ background: 'rgba(255,50,80,0.05)' }}>
            {error}
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map(ev => (
              <button
                key={ev.id}
                onClick={() => router.push(`/verifier/${ev.id}`)}
                className="glass-card p-6 flex items-center justify-between hover:border-purple-500/50 transition-all text-left"
              >
                <div>
                  <h3 className="font-bold text-lg mb-1">{ev.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-white/40">
                    <Calendar className="w-4 h-4" />
                    {new Date(ev.starts_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="btn-cyber text-sm px-6 py-2" style={{ background: '#A78BFA', color: '#000' }}>
                  Open Verifier
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
