'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Loader2, DollarSign, Plus, ArrowUpRight, ArrowDownRight, Image as ImageIcon } from 'lucide-react'
import Navbar from '@/components/ui/Navbar'

export default function FinancesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [committees, setCommittees] = useState<any[]>([])
  const [selectedCommittee, setSelectedCommittee] = useState('')
  const [ledger, setLedger] = useState<any[]>([])
  const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 })

  // Form State
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE')
  const [amount, setAmount] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchProfileAndCommittees()
  }, [])

  useEffect(() => {
    if (selectedCommittee) {
      fetchLedger(selectedCommittee)
    }
  }, [selectedCommittee])

  const fetchProfileAndCommittees = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    // Fetch committees linked to the user's university/college where they might have access
    const { data: coms } = await supabase.from('committees').select('*').eq('university_id', p.university_id_fk)
    setCommittees(coms || [])
    if (coms && coms.length > 0) {
      setSelectedCommittee(coms[0].id)
    }
    setLoading(false)
  }

  const fetchLedger = async (comId: string) => {
    const { data } = await supabase
      .from('committee_finances')
      .select('*, logged_by_profile:profiles!committee_finances_logged_by_fkey(full_name)')
      .eq('committee_id', comId)
      .order('created_at', { ascending: false })

    const records = data || []
    setLedger(records)

    let inc = 0, exp = 0
    records.forEach(r => {
      if (r.type === 'INCOME') inc += Number(r.amount)
      else exp += Number(r.amount)
    })
    setStats({ income: inc, expense: exp, balance: inc - exp })
  }

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    try {
      if (!selectedCommittee) throw new Error('Please select a committee')
      
      const { error } = await supabase.from('committee_finances').insert({
        committee_id: selectedCommittee,
        college_id: profile.college_id,
        university_id: profile.university_id_fk,
        type,
        amount: Number(amount),
        vendor_name: vendorName || null,
        receipt_url: receiptUrl || null,
        logged_by: profile.id
      })

      if (error) throw error

      toast.success('Record added successfully')
      setAmount('')
      setVendorName('')
      setReceiptUrl('')
      fetchLedger(selectedCommittee)
    } catch (err: any) {
      toast.error(err.message || 'Failed to add record')
    } finally {
      setAdding(false)
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
            <DollarSign className="w-8 h-8 text-cyber-green" />
            Financial Ledger
          </h1>
          <p className="text-white/60 mt-2">Manage income and expenses for your committees.</p>
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
                  <p className="text-xs text-white/40 uppercase">Income</p>
                  <p className="text-2xl font-bold text-cyber-green">${stats.income.toFixed(2)}</p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-xs text-white/40 uppercase">Expense</p>
                  <p className="text-2xl font-bold text-red-400">${stats.expense.toFixed(2)}</p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-xs text-white/40 uppercase">Balance</p>
                  <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                    ${stats.balance.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="glass-card p-6">
                <h2 className="text-lg font-bold mb-4">Transaction History</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50 text-sm">
                        <th className="p-4 font-medium uppercase">Type</th>
                        <th className="p-4 font-medium uppercase">Amount</th>
                        <th className="p-4 font-medium uppercase">Vendor / Note</th>
                        <th className="p-4 font-medium uppercase">Logged By</th>
                        <th className="p-4 font-medium uppercase">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.length === 0 ? (
                        <tr><td colSpan={5} className="text-center p-8 text-white/40">No transactions recorded.</td></tr>
                      ) : ledger.map(record => (
                        <tr key={record.id} className="border-b border-white/5">
                          <td className="p-4">
                            {record.type === 'INCOME' ? (
                              <span className="flex items-center gap-1 text-cyber-green font-semibold text-sm">
                                <ArrowUpRight className="w-4 h-4" /> INCOME
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-400 font-semibold text-sm">
                                <ArrowDownRight className="w-4 h-4" /> EXPENSE
                              </span>
                            )}
                          </td>
                          <td className={`p-4 font-mono font-bold ${record.type === 'INCOME' ? 'text-cyber-green' : 'text-red-400'}`}>
                            ${Number(record.amount).toFixed(2)}
                          </td>
                          <td className="p-4 text-white/80">{record.vendor_name || '-'}</td>
                          <td className="p-4 text-white/60 text-sm">{record.logged_by_profile?.full_name || 'Unknown'}</td>
                          <td className="p-4">
                            {record.receipt_url ? (
                              <a href={record.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                                <ImageIcon className="w-4 h-4" /> View
                              </a>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Add Record Form */}
            <div className="glass-card p-6 h-fit">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyber-green" /> Add Record
              </h2>
              <form onSubmit={handleAddRecord} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-white/50 uppercase">Type</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setType('INCOME')}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${type === 'INCOME' ? 'bg-green-500/10 border-cyber-green text-cyber-green' : 'bg-transparent border-white/10 text-white/40'}`}>
                      INCOME
                    </button>
                    <button type="button" onClick={() => setType('EXPENSE')}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${type === 'EXPENSE' ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-transparent border-white/10 text-white/40'}`}>
                      EXPENSE
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/50 uppercase">Amount ($)</label>
                  <input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="input-cyber w-full" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/50 uppercase">Vendor / Description</label>
                  <input required type="text" value={vendorName} onChange={e => setVendorName(e.target.value)} className="input-cyber w-full" placeholder="e.g. Stage Equipment" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/50 uppercase">Receipt URL (Optional)</label>
                  <input type="url" value={receiptUrl} onChange={e => setReceiptUrl(e.target.value)} className="input-cyber w-full" placeholder="https://..." />
                </div>
                <button type="submit" disabled={adding} className="btn-cyber w-full justify-center">
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Transaction'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
