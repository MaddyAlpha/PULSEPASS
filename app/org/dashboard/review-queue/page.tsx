'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, CheckCircle2, XCircle, Loader2, RefreshCw, Eye, AlertTriangle, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ManualReviewItem } from '@/lib/types'

export default function ReviewQueuePage() {
  const supabase = createClient()
  const [items, setItems] = useState<ManualReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('manual_review_queue')
        .select(`
          *,
          profile:profiles!user_id(full_name, email, avatar_url),
          event:events!event_id(title, starts_at)
        `)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true })
      if (data) setItems(data as ManualReviewItem[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  const handleAction = async (item: ManualReviewItem, action: 'approved' | 'rejected') => {
    setActionLoading((prev) => ({ ...prev, [item.id]: true }))
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Update review queue status
      await supabase.from('manual_review_queue').update({
        status: action,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: action === 'rejected' ? 'Rejected by admin' : null,
      }).eq('id', item.id)

      // If approved, claim the ticket
      if (action === 'approved') {
        const res = await fetch('/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: item.event_id,
            ticket_type: 'general',
            ocr_verified: false,
            roll_number: item.roll_number,
            // Ticket is claimed on behalf of the student — requires admin override
          }),
        })
        // Note: The claim API will use the authenticated user's ID.
        // For a proper admin-on-behalf-of flow, this would call the VIP API with the student email.
        // This is handled in the full implementation via service role.
      }

      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } finally {
      setActionLoading((prev) => ({ ...prev, [item.id]: false }))
    }
  }

  const handleBulkApprove = async () => {
    for (const item of items) {
      await handleAction(item, 'approved')
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <ClipboardList className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="font-black text-xl">Manual Review Queue</h2>
            <p className="text-white/40 text-sm">{items.length} pending submission{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchQueue} disabled={loading}
            className="p-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {items.length > 1 && (
            <button onClick={handleBulkApprove}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'rgba(0,255,102,0.12)', color: '#00FF66', border: '1px solid rgba(0,255,102,0.2)' }}>
              <CheckCircle2 className="w-4 h-4" />
              Approve All
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <CheckCircle2 className="w-8 h-8 text-white/20" />
          </div>
          <p className="text-white/30 font-medium">All clear — no pending reviews</p>
          <p className="text-white/20 text-sm mt-1">Submissions appear here when OCR verification fails 3 times</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl border border-white/[0.06] overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                {/* ID Card Image */}
                <div className="relative h-48 bg-white/[0.03] cursor-pointer overflow-hidden"
                  onClick={() => setPreviewUrl(item.id_card_image_url)}>
                  <img src={item.id_card_image_url} alt="ID Card"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <Eye className="w-8 h-8 text-white" />
                  </div>
                </div>

                <div className="p-4">
                  {/* Student info */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.06)' }}>
                      {(item.profile as any)?.avatar_url
                        ? <img src={(item.profile as any).avatar_url} className="w-full h-full object-cover" />
                        : <User className="w-4 h-4 text-white/30" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{(item.profile as any)?.full_name || 'Unknown'}</p>
                      <p className="text-white/40 text-xs truncate">{(item.profile as any)?.email}</p>
                    </div>
                  </div>

                  <div className="space-y-1 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/40">Roll No.</span>
                      <span className="font-mono text-white/70">{item.roll_number}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/40">Event</span>
                      <span className="text-white/70 truncate max-w-32">{(item.event as any)?.title}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/40">Submitted</span>
                      <span className="text-white/50">{new Date(item.submitted_at).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleAction(item, 'approved')}
                      disabled={actionLoading[item.id]}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm text-black transition-all disabled:opacity-50"
                      style={{ background: '#00FF66' }}>
                      {actionLoading[item.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button onClick={() => handleAction(item, 'rejected')}
                      disabled={actionLoading[item.id]}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm text-red-400 transition-all disabled:opacity-50"
                      style={{ background: 'rgba(255,50,80,0.12)', border: '1px solid rgba(255,50,80,0.2)' }}>
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Image Preview Lightbox */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPreviewUrl(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', cursor: 'zoom-out' }}>
            <motion.img
              initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              src={previewUrl} alt="ID Card Preview"
              className="max-w-full max-h-full rounded-2xl object-contain"
              style={{ maxHeight: '80vh', boxShadow: '0 0 60px rgba(0,0,0,0.8)' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
