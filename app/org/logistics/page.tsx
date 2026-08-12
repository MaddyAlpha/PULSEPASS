'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Loader2, Package, Plus, PackageCheck, PackageX, Truck } from 'lucide-react'
import Navbar from '@/components/ui/Navbar'

export default function LogisticsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [committees, setCommittees] = useState<any[]>([])
  const [selectedCommittee, setSelectedCommittee] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [stats, setStats] = useState({ pending: 0, procured: 0, returned: 0 })

  // Form State
  const [itemName, setItemName] = useState('')
  const [vendorContact, setVendorContact] = useState('')
  const [adding, setAdding] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchProfileAndCommittees()
  }, [])

  useEffect(() => {
    if (selectedCommittee) {
      fetchItems(selectedCommittee)
    }
  }, [selectedCommittee])

  const fetchProfileAndCommittees = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    // Fetch committees linked to the user's university
    const { data: coms } = await supabase.from('committees').select('*').eq('university_id', p.university_id_fk)
    setCommittees(coms || [])
    if (coms && coms.length > 0) {
      setSelectedCommittee(coms[0].id)
    }
    setLoading(false)
  }

  const fetchItems = async (comId: string) => {
    const { data } = await supabase
      .from('committee_logistics')
      .select('*, assignee:profiles!committee_logistics_assigned_to_fkey(full_name)')
      .eq('committee_id', comId)
      .order('created_at', { ascending: false })

    const records = data || []
    setItems(records)

    let p = 0, pr = 0, r = 0
    records.forEach(item => {
      if (item.status === 'PENDING') p++
      else if (item.status === 'PROCURED') pr++
      else if (item.status === 'RETURNED') r++
    })
    setStats({ pending: p, procured: pr, returned: r })
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    try {
      if (!selectedCommittee) throw new Error('Please select a committee')
      if (!itemName.trim()) throw new Error('Item name is required')
      
      const { error } = await supabase.from('committee_logistics').insert({
        committee_id: selectedCommittee,
        college_id: profile.college_id,
        university_id: profile.university_id_fk,
        item_name: itemName.trim(),
        vendor_contact: vendorContact || null,
        status: 'PENDING',
        assigned_to: profile.id
      })

      if (error) throw error

      toast.success('Item added to logistics tracker')
      setItemName('')
      setVendorContact('')
      fetchItems(selectedCommittee)
    } catch (err: any) {
      toast.error(err.message || 'Failed to add item')
    } finally {
      setAdding(false)
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: 'PENDING' | 'PROCURED' | 'RETURNED') => {
    setActionLoading(id)
    try {
      const { error } = await supabase.from('committee_logistics').update({ status: newStatus }).eq('id', id)
      if (error) throw error
      toast.success(`Status updated to ${newStatus}`)
      fetchItems(selectedCommittee)
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-obsidian-900">
      <Navbar />
      <div className="pt-24 pb-16 max-w-6xl mx-auto px-6 space-y-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Package className="w-8 h-8 text-cyber-green" />
            Logistics Tracker
          </h1>
          <p className="text-white/60 mt-2">Manage physical inventory, procurement, and vendor contacts.</p>
        </div>

        {committees.length > 0 ? (
          <div className="mb-6 max-w-sm">
            <label className="text-xs text-white/50 uppercase">Select Committee</label>
            <select
              value={selectedCommittee}
              onChange={(e) => setSelectedCommittee(e.target.value)}
              className="input-cyber w-full mt-1 bg-obsidian-900"
            >
              {committees.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="p-8 border border-dashed border-white/10 rounded-xl text-center">
            No committees found.
          </div>
        )}

        {selectedCommittee && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="glass-card p-4">
                  <p className="text-xs text-white/40 uppercase">Pending</p>
                  <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-xs text-white/40 uppercase">Procured</p>
                  <p className="text-2xl font-bold text-cyber-green">{stats.procured}</p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-xs text-white/40 uppercase">Returned</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.returned}</p>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="glass-card p-12 text-center text-white/40 border-dashed">
                    No items tracking yet.
                  </div>
                ) : items.map(item => (
                  <div key={item.id} className="glass-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        {item.item_name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-white/50 mt-1">
                        {item.vendor_contact && (
                          <span className="flex items-center gap-1"><Truck className="w-4 h-4" /> {item.vendor_contact}</span>
                        )}
                        <span>Assigned to: {item.assignee?.full_name || 'Unassigned'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0 bg-white/5 p-1 rounded-xl">
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'PENDING')}
                        disabled={actionLoading === item.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${item.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/40 hover:bg-white/10'}`}>
                        PENDING
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'PROCURED')}
                        disabled={actionLoading === item.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${item.status === 'PROCURED' ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/30' : 'text-white/40 hover:bg-white/10'}`}>
                        PROCURED
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'RETURNED')}
                        disabled={actionLoading === item.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${item.status === 'RETURNED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-white/40 hover:bg-white/10'}`}>
                        RETURNED
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Item Form */}
            <div className="glass-card p-6 h-fit">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyber-green" /> Add Item
              </h2>
              <form onSubmit={handleAddItem} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-white/50 uppercase">Item Name</label>
                  <input required type="text" value={itemName} onChange={e => setItemName(e.target.value)} className="input-cyber w-full" placeholder="e.g. 10x JBL Speakers" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/50 uppercase">Vendor Info (Optional)</label>
                  <input type="text" value={vendorContact} onChange={e => setVendorContact(e.target.value)} className="input-cyber w-full" placeholder="e.g. SoundCo (+91 99999...)" />
                </div>
                <button type="submit" disabled={adding} className="btn-cyber w-full justify-center">
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Track Item'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
