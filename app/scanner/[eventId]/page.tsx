'use client'

/**
 * PulsePass — Phase 2 Gate Scanner (Station 2)
 *
 * Updated behavior:
 * - Scans JWT-signed QR tokens (not raw qr_token values)
 * - Sets ticket to `pending_verification` via process_station2_scan RPC
 * - Broadcasts ticket to Supabase Realtime channel `gate:[eventId]`
 *   so Station 3 Verifier sees it instantly
 * - Full-screen green/red flash + haptic feedback
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Scan, CheckCircle2, XCircle, Zap, Camera, ArrowLeft, Loader2, Shield, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Event, Station2ScanResult } from '@/lib/types'
import Link from 'next/link'

type ScanState = 'idle' | 'scanning' | 'success' | 'pending' | 'error' | 'loading'

interface ScanResultDisplay {
  state: 'success' | 'pending' | 'error'
  title: string
  message: string
  detail?: string
  ticket_type?: string
  is_vip?: boolean
}

export default function GatekeeperScannerPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const eventId = params.eventId as string

  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrRef = useRef<any>(null)
  const channelRef = useRef<any>(null)

  const [event, setEvent] = useState<Event | null>(null)
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [result, setResult] = useState<ScanResultDisplay | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [checkinCount, setCheckinCount] = useState(0)
  const [authorized, setAuthorized] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [cameraStarted, setCameraStarted] = useState(false)
  const [scanCooldown, setScanCooldown] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const isAuth = ['organiser', 'committee_admin', 'supervisor', 'super_admin'].includes(profile?.role || '')
      setAuthorized(isAuth)
      if (!isAuth) { setAuthChecking(false); return }

      const { data: ev } = await supabase
        .from('events').select('*, organization:organizations(name)').eq('id', eventId).single()
      setEvent(ev as Event)

      // Count today's check-ins and pending
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const { count: ciCount } = await supabase
        .from('checkins').select('*', { count: 'exact', head: true })
        .eq('event_id', eventId).eq('success', true).gte('scanned_at', today.toISOString())
      setCheckinCount(ciCount || 0)

      const { count: pendCount } = await supabase
        .from('tickets').select('*', { count: 'exact', head: true })
        .eq('event_id', eventId).eq('ticket_status', 'pending_verification')
      setPendingCount(pendCount || 0)

      // Subscribe to gate channel to receive Station 3 admits
      channelRef.current = supabase
        .channel(`gate:${eventId}`)
        .on('broadcast', { event: 'ticket_admitted' }, () => {
          setCheckinCount((c) => c + 1)
          setPendingCount((c) => Math.max(0, c - 1))
        })
        .subscribe()

      setAuthChecking(false)
    }
    init()
    return () => { channelRef.current?.unsubscribe() }
  }, [eventId])

  const lastScannedRef = useRef<{ code: string, time: number }>({ code: '', time: 0 })

  const processQrScan = useCallback(async (rawQrText: string) => {
    if (scanCooldown || scanState === 'loading') return
    
    // Prevent duplicate scans of the exact same QR code within 10 seconds
    const now = Date.now()
    if (lastScannedRef.current.code === rawQrText && (now - lastScannedRef.current.time) < 10000) {
      return
    }
    lastScannedRef.current = { code: rawQrText, time: now }

    setScanCooldown(true)
    setScanState('loading')

    try {
      // Extract JWT token from QR payload
      // QR code contains either: a raw JWT string, or JSON { jwt: "..." }
      let jwtToken = rawQrText
      try {
        const parsed = JSON.parse(rawQrText)
        if (parsed.jwt) jwtToken = parsed.jwt
      } catch { /* raw JWT string */ }

      const res = await fetch('/api/station2-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jwt_token: jwtToken,
          event_id: eventId,
          device_info: navigator.userAgent,
        }),
      })
      const data: Station2ScanResult = await res.json()

      if (data.success && data.reason === 'PENDING') {
        setResult({
          state: 'pending',
          title: 'Queued for Verification',
          message: `${data.ticket_type?.toUpperCase()} • Awaiting Station 3`,
          ticket_type: data.ticket_type,
          is_vip: data.is_vip,
        })
        setScanState('pending')
        setPendingCount((c) => c + 1)
        if (navigator.vibrate) navigator.vibrate([100, 50, 100])
      } else {
        const reasonMap: Record<string, { title: string; message: string }> = {
          ALREADY_USED: { title: 'Already Admitted', message: 'This ticket was already fully checked in' },
          ALREADY_PENDING: { title: 'Already Queued', message: 'This ticket is already at Station 3' },
          INVALID_QR: { title: 'Invalid QR', message: 'QR code is invalid or expired' },
          INVALID_STATUS: { title: 'Invalid Ticket', message: data.message },
        }
        const display = reasonMap[data.reason] || { title: 'Scan Failed', message: data.message || (data as any).error || JSON.stringify(data) }
        setResult({ state: 'error', ...display })
        setScanState('error')
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
      }
    } catch {
      setResult({ state: 'error', title: 'Network Error', message: 'Failed to verify. Check connection.' })
      setScanState('error')
    } finally {
      setTimeout(() => {
        setResult(null)
        setScanState('scanning')
        setScanCooldown(false)
      }, 3000)
    }
  }, [eventId, scanCooldown, scanState])

  const startScanner = useCallback(async () => {
    if (cameraStarted) return
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-scanner-container')
      html5QrRef.current = scanner
      
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 280 }, aspectRatio: 1.0 },
          (decodedText: string) => { processQrScan(decodedText) },
          () => {}
        )
      } catch (err) {
        // Fallback for desktops without an environment camera
        const devices = await Html5Qrcode.getCameras()
        if (devices && devices.length > 0) {
          await scanner.start(
            devices[0].id,
            { fps: 10, qrbox: { width: 280, height: 280 }, aspectRatio: 1.0 },
            (decodedText: string) => { processQrScan(decodedText) },
            () => {}
          )
        }
      }
      setCameraStarted(true)
      setScanState('scanning')
    } catch {
      setScanState('error')
      setResult({ state: 'error', title: 'Camera Error', message: 'Could not access camera.' })
    }
  }, [cameraStarted, processQrScan])

  useEffect(() => {
    return () => { html5QrRef.current?.stop().catch(() => {}) }
  }, [])

  const resultBgColor = result?.state === 'success' ? 'rgba(0,255,102,0.12)' :
    result?.state === 'pending' ? 'rgba(168,139,250,0.12)' : 'rgba(255,50,80,0.12)'
  const resultBorderColor = result?.state === 'success' ? '#00FF66' :
    result?.state === 'pending' ? '#A78BFA' : '#FF3250'

  if (authChecking) {
    return <div className="min-h-screen bg-obsidian-900 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
    </div>
  }

  if (!authorized) {
    return <div className="min-h-screen bg-obsidian-900 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="font-bold text-xl mb-2">Access Denied</h2>
        <p className="text-white/50 mb-6">Supervisor access required for the gate scanner.</p>
        <Link href="/events" className="btn-cyber-outline">Back to Events</Link>
      </div>
    </div>
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-obsidian-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]"
        style={{ background: 'rgba(5,7,9,0.95)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-3">
          <Link href="/org/dashboard" className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
              <p className="text-xs font-semibold text-cyber-green uppercase tracking-wider">Station 2 · Scanner</p>
            </div>
            <p className="font-bold text-sm leading-tight">{event?.title || 'Event Scanner'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <p className="text-xl font-black text-purple-400">{pendingCount}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">pending</p>
          </div>
          <div>
            <p className="text-xl font-black text-cyber-green">{checkinCount}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">admitted</p>
          </div>
        </div>
      </div>

      {/* Scanner viewport */}
      <div className="flex-1 flex flex-col items-center justify-center relative bg-obsidian-950 overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-20" style={{ backgroundSize: '30px 30px' }} />

        <div className="relative w-full max-w-sm mx-auto aspect-square">
          <div id="qr-scanner-container" ref={scannerRef} className="w-full h-full" style={{ minHeight: '300px' }} />

          {/* Corner frame */}
          {!result && (
            <div className="absolute inset-0 pointer-events-none">
              {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 ${cls}`} style={{ borderColor: '#00FF66' }} />
              ))}
              {scanState === 'scanning' && (
                <div className="absolute inset-x-0 top-0 h-px bg-cyber-green animate-scan-line opacity-70"
                  style={{ boxShadow: '0 0 8px #00FF66' }} />
              )}
            </div>
          )}

          {/* Result overlay */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25 }}
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl overflow-hidden"
                style={{ background: resultBgColor, border: `2px solid ${resultBorderColor}`, boxShadow: `0 0 40px ${resultBorderColor}40` }}>
                {result.state === 'pending'
                  ? <Clock className="w-20 h-20 mb-4" style={{ color: '#A78BFA' }} />
                  : result.state === 'success'
                    ? <CheckCircle2 className="w-20 h-20 text-cyber-green mb-4" />
                    : <XCircle className="w-20 h-20 text-red-400 mb-4" />}
                <p className="text-2xl font-black mb-1" style={{ color: resultBorderColor }}>{result.title}</p>
                <p className="text-white/70 text-sm text-center px-4">{result.message}</p>
                {result.ticket_type && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: `${resultBorderColor}20`, color: resultBorderColor, border: `1px solid ${resultBorderColor}40` }}>
                      {result.ticket_type.toUpperCase()} PASS
                    </div>
                    {result.is_vip && (
                      <div className="px-3 py-1 rounded-full text-xs font-bold"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                        ⭐ VIP
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Start camera */}
          {!cameraStarted && scanState === 'idle' && !result && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl"
              style={{ background: 'rgba(10,13,15,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Camera className="w-12 h-12 text-white/20" />
              <p className="text-white/40 text-sm">Camera not started</p>
              <button onClick={startScanner} className="btn-cyber"><Scan className="w-4 h-4" />Start Scanner</button>
            </div>
          )}

          {scanState === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-cyber-green animate-spin" />
                <p className="text-cyber-green text-sm font-semibold">Verifying token...</p>
              </div>
            </div>
          )}
        </div>

        {scanState === 'scanning' && !result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center px-6">
            <p className="text-white/50 text-sm">Point camera at attendee's QR code</p>
            <p className="text-white/25 text-xs mt-1">JWT tokens verified server-side</p>
          </motion.div>
        )}

        {/* Go to verifier link */}
        {pendingCount > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-6 px-6 w-full max-w-sm">
            <Link href={`/verifier/${eventId}`}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all border"
              style={{ borderColor: 'rgba(168,139,250,0.3)', color: '#A78BFA', background: 'rgba(168,139,250,0.08)' }}>
              <Clock className="w-4 h-4" />
              {pendingCount} ticket{pendingCount !== 1 ? 's' : ''} pending → Open Verifier
            </Link>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/[0.06]"
        style={{ background: 'rgba(5,7,9,0.95)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${cameraStarted ? 'bg-cyber-green animate-pulse' : 'bg-white/20'}`} />
            <span className="text-white/40">{cameraStarted ? 'Camera Active' : 'Camera Off'}</span>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <Shield className="w-3.5 h-3.5" />
            <span className="text-xs">JWT-signed · Station 2 of 3</span>
          </div>
        </div>
      </div>
    </div>
  )
}
