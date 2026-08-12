'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Download, Zap, Ticket, User, Calendar, MapPin, Shield, RefreshCw } from 'lucide-react'
import type { PassDisplayData } from '@/lib/types'
import toast from 'react-hot-toast'

interface TicketPassProps {
  data: PassDisplayData
}

export default function TicketPass({ data }: TicketPassProps) {
  const { ticket, event, organization, holder } = data
  const passRef = useRef<HTMLDivElement>(null)
  const [dynamicQrToken, setDynamicQrToken] = useState(ticket.qr_token)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Poll for a fresh JWT token every 25 seconds
  useEffect(() => {
    // Only refresh if ticket is valid
    if (ticket.ticket_status !== 'valid' && ticket.ticket_status !== 'pending_verification') return

    const interval = setInterval(async () => {
      setIsRefreshing(true)
      try {
        const res = await fetch('/api/tickets/refresh-qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket_id: ticket.id })
        })
        const json = await res.json()
        if (res.ok && json.jwt_token) {
          setDynamicQrToken(json.jwt_token)
        }
      } catch (err) {
        console.error('Failed to refresh QR:', err)
      } finally {
        setIsRefreshing(false)
      }
    }, 25000)

    return () => clearInterval(interval)
  }, [ticket.id, ticket.ticket_status])

  const statusColor = {
    valid: { text: '#00FF66', bg: 'rgba(0,255,102,0.12)', border: 'rgba(0,255,102,0.25)' },
    pending_verification: { text: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
    checked_in: { text: '#FFA500', bg: 'rgba(255,165,0,0.12)', border: 'rgba(255,165,0,0.25)' },
    expired: { text: '#FF3250', bg: 'rgba(255,50,80,0.12)', border: 'rgba(255,50,80,0.25)' },
    cancelled: { text: '#666', bg: 'rgba(100,100,100,0.1)', border: 'rgba(100,100,100,0.2)' },
  }[ticket.ticket_status]

  const statusLabel = {
    valid: '● Valid Pass',
    pending_verification: '⏳ Pending Verification',
    checked_in: '● Checked In',
    expired: '● Expired',
    cancelled: '● Cancelled',
  }[ticket.ticket_status]

  const qrPayload = JSON.stringify({
    t: dynamicQrToken,
    e: event.id,
    v: 1,
  })

  const handleDownloadPDF = useCallback(async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })

      const W = 148, H = 210
      const margin = 14

      // Background
      doc.setFillColor(10, 13, 15)
      doc.rect(0, 0, W, H, 'F')

      // Cyber green accent bar
      doc.setFillColor(0, 255, 102)
      doc.rect(0, 0, W, 2, 'F')

      // Header
      doc.setTextColor(0, 255, 102)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('PULSEPASS', margin, 20)

      doc.setTextColor(100, 110, 120)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('DIGITAL EVENT TICKET', margin, 26)

      // Divider
      doc.setDrawColor(0, 255, 102)
      doc.setLineWidth(0.3)
      doc.line(margin, 30, W - margin, 30)

      // Ticket type badge
      const isVIP = ticket.ticket_type === 'vip'
      doc.setFillColor(isVIP ? 0 : 30, isVIP ? 40 : 30, isVIP ? 20 : 20)
      doc.roundedRect(margin, 35, 30, 8, 2, 2, 'F')
      doc.setTextColor(0, 255, 102)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text(isVIP ? 'VIP PASS' : 'GENERAL PASS', margin + 2, 40.5)

      // Event name
      doc.setTextColor(230, 237, 242)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      const titleLines = doc.splitTextToSize(event.title, W - margin * 2)
      doc.text(titleLines, margin, 52)

      // Event details
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(130, 140, 150)
      const yStart = 52 + (titleLines.length * 7)
      doc.text(`VENUE: ${event.venue}`, margin, yStart + 8)
      doc.text(`DATE: ${new Date(event.starts_at).toLocaleString()}`, margin, yStart + 15)
      doc.text(`ORG: ${organization.name}`, margin, yStart + 22)

      // Holder info
      doc.setDrawColor(40, 50, 60)
      doc.line(margin, yStart + 28, W - margin, yStart + 28)
      doc.setTextColor(80, 90, 100)
      doc.setFontSize(7)
      doc.text('TICKET HOLDER', margin, yStart + 34)
      doc.setTextColor(200, 210, 220)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(holder.full_name || holder.email, margin, yStart + 41)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(80, 90, 100)
      doc.text(holder.email, margin, yStart + 47)
      if (holder.university_id) {
        doc.setTextColor(0, 255, 102)
        doc.setFontSize(9)
        doc.text(`ROLL NO: ${holder.university_id}`, margin, yStart + 54)
      }

      const appUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://pulsepass.vercel.app'}/my-passes`

      // Draw a "Sticker / Button" instead of a QR Code
      const buttonWidth = 80
      const buttonHeight = 16
      const buttonX = (W - buttonWidth) / 2
      const buttonY = H - 60

      doc.setFillColor(0, 255, 102) // Cyber Green
      doc.roundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 3, 3, 'F')

      // Button Text
      doc.setTextColor(10, 13, 15) // Dark text
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('TAP HERE TO OPEN LIVE PASS', W / 2, buttonY + 10.5, { align: 'center' })

      // Make the entire button area clickable!
      doc.link(buttonX, buttonY, buttonWidth, buttonHeight, { url: appUrl })

      // Subtitle below button
      doc.setTextColor(100, 110, 120)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('(Requires internet connection to verify at the door)', W / 2, buttonY + 22, { align: 'center' })

      doc.setFontSize(6)
      doc.setTextColor(50, 60, 70)
      doc.text(`TICKET ID: ${ticket.id.split('-')[0].toUpperCase()}`, W / 2, H - 12, { align: 'center' })
      doc.setDrawColor(0, 255, 102)
      doc.setLineWidth(0.3)
      doc.line(margin, H - 16, W - margin, H - 16)

      doc.save(`pulsepass-${event.title.replace(/\s+/g, '-').toLowerCase()}-ticket.pdf`)
      toast.success('Ticket PDF downloaded!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    }
  }, [ticket, event, organization, holder])

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Digital Ticket Card */}
      <div ref={passRef} className="ticket-card overflow-hidden">
        {/* Header strip */}
        <div className="px-6 pt-5 pb-4 relative"
          style={{ background: 'linear-gradient(135deg, rgba(0,255,102,0.08) 0%, transparent 100%)' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #00FF66, #00B846)' }}>
                <Zap className="w-3.5 h-3.5 text-obsidian-900" strokeWidth={2.5} />
              </div>
              <span className="text-xs font-bold tracking-wider text-white/60 uppercase">PulsePass</span>
            </div>
            <div className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: statusColor.bg, border: `1px solid ${statusColor.border}`, color: statusColor.text }}>
              {statusLabel}
            </div>
          </div>

          {/* Ticket type */}
          {ticket.ticket_type === 'vip' ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mt-1"
              style={{ background: 'linear-gradient(135deg, rgba(0,255,102,0.2), rgba(0,200,82,0.1))', border: '1px solid rgba(0,255,102,0.3)', color: '#00FF66' }}>
              <Zap className="w-3 h-3" /> VIP PASS
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mt-1"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(232,237,242,0.6)' }}>
              <Ticket className="w-3 h-3" /> GENERAL PASS
            </div>
          )}
        </div>

        {/* Perforated divider */}
        <div className="relative flex items-center px-3 my-1">
          <div className="w-5 h-5 rounded-full bg-obsidian-900 border border-white/[0.06] -ml-5" />
          <div className="flex-1 border-t border-dashed border-white/10 mx-1" />
          <div className="w-5 h-5 rounded-full bg-obsidian-900 border border-white/[0.06] -mr-5" />
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center py-6 px-4">
          <div className="p-4 rounded-2xl"
            style={{ background: '#fff', boxShadow: '0 0 30px rgba(0,255,102,0.15)' }}>
            <QRCodeCanvas
              id="ticket-qr-canvas"
              value={qrPayload}
              size={1024}
              style={{ width: 160, height: 160 }}
              level="H"
              fgColor="#0A0D0F"
              bgColor="#ffffff"
              imageSettings={{
                src: '/logo-qr.png',
                height: 154,
                width: 154,
                excavate: true,
              }}
            />
          </div>
          <div className="mt-3 flex flex-col items-center gap-1">
            <p className="text-xs text-white/30 font-mono tracking-wider flex items-center gap-1.5">
              {dynamicQrToken.slice(0, 8).toUpperCase()}...{dynamicQrToken.slice(-8).toUpperCase()}
              {isRefreshing && <RefreshCw className="w-3 h-3 animate-spin text-cyber-green" />}
            </p>
            <p className="text-[10px] text-cyber-green/50 animate-pulse">QR rotates every 30s</p>
          </div>
        </div>

        {/* Perforated divider */}
        <div className="relative flex items-center px-3 my-1">
          <div className="w-5 h-5 rounded-full bg-obsidian-900 border border-white/[0.06] -ml-5" />
          <div className="flex-1 border-t border-dashed border-white/10 mx-1" />
          <div className="w-5 h-5 rounded-full bg-obsidian-900 border border-white/[0.06] -mr-5" />
        </div>

        {/* Event details */}
        <div className="px-6 pb-6 space-y-4 mt-2">
          <div>
            <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Event</p>
            <p className="font-bold text-lg leading-tight">{event.title}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Date</p>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyber-green shrink-0" />
                <p className="text-sm font-medium text-white/80">
                  {new Date(event.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Venue</p>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyber-green shrink-0" />
                <p className="text-sm font-medium text-white/80 truncate">{event.venue}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Holder</p>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyber-green shrink-0" />
              <div>
                <p className="text-sm font-medium text-white/80">{holder.full_name || holder.email}</p>
                {holder.university_id && (
                  <p className="text-xs text-cyber-green/70 font-mono mt-0.5">Roll No: {holder.university_id}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Shield className="w-3 h-3 text-white/20" />
            <p className="text-[10px] text-white/20 font-mono">SECURED · SINGLE USE · TAMPER-PROOF</p>
          </div>
        </div>
      </div>

      {/* Download Button */}
      <button
        onClick={handleDownloadPDF}
        className="btn-cyber-outline w-full justify-center mt-4">
        <Download className="w-4 h-4" />
        Download PDF Ticket
      </button>
    </div>
  )
}
