'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Scan, CheckCircle2, XCircle, Zap, Camera, ArrowLeft, Loader2, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Event, CheckInResult } from '@/lib/types'
import Link from 'next/link'

type ScanState = 'idle' | 'scanning' | 'success' | 'error' | 'loading'

interface ScanResultDisplay {
  state: 'success' | 'error'
  title: string
  message: string
  detail?: string
  ticket_type?: string
}

export default function GatekeeperScannerPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const eventId = params.eventId as string

  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrRef = useRef<any>(null)

  const [event, setEvent] = useState<Event | null>(null)
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [result, setResult] = useState<ScanResultDisplay | null>(null)
  const [checkinCount, setCheckinCount] = useState(0)
  const [authorized, setAuthorized] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [cameraStarted, setCameraStarted] = useState(false)
  const [scanCooldown, setScanCooldown] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      // Check authorization
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const isAuth = ['org_admin', 'supervisor', 'super_admin'].includes(profile?.role || '')
      setAuthorized(isAuth)

      if (!isAuth) { setAuthChecking(false); return }

      // Fetch event
      const { data: ev } = await supabase
        .from('events').select('*, organization:organizations(name)').eq('id', eventId).single()
      setEvent(ev)

      // Fetch today's check-in count
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('checkins')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('success', true)
        .gte('scanned_at', today.toISOString())
      setCheckinCount(count || 0)

      setAuthChecking(false)
    }
    init()
  }, [eventId])

  const processQrScan = useCallback(async (qrToken: string) => {
    if (scanCooldown || scanState === 'loading') return
    setScanCooldown(true)
    setScanState('loading')

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_token: qrToken,
          event_id: eventId,
          device_info: navigator.userAgent,
        }),
      })
      const data: CheckInResult = await res.json()

      if (data.success) {
        setResult({
          state: 'success',
          title: 'Check-In Successful',
          message: `${data.ticket_type?.toUpperCase()} pass verified`,
          detail: 'Entry granted',
          ticket_type: data.ticket_type,
        })
        setScanState('success')
        setCheckinCount(prev => prev + 1)

        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate([100, 50, 100])
      } else {
        const reasonMap: Record<string, { title: string; message: string }> = {
          ALREADY_USED: { title: 'Already Checked In', message: 'This ticket was already scanned' },
          INVALID_QR: { title: 'Invalid QR Code', message: 'This QR code is not recognized' },
          INVALID_STATUS: { title: 'Invalid Ticket', message: `Ticket is ${data.reason?.toLowerCase()}` },
        }
        const display = reasonMap[data.reason || ''] || { title: 'Scan Failed', message: data.message }
        setResult({ state: 'error', ...display })
        setScanState('error')

        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
      }
    } catch (err) {
      setResult({ state: 'error', title: 'Network Error', message: 'Failed to verify ticket. Check connection.' })
      setScanState('error')
    } finally {
      // Auto-dismiss after 3 seconds
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

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          try {
            // Try to parse PulsePass QR payload
            const payload = JSON.parse(decodedText)
            if (payload.t && payload.e === eventId) {
              processQrScan(payload.t)
            } else if (payload.t) {
              processQrScan(payload.t)
            } else {
              processQrScan(decodedText)
            }
          } catch {
            processQrScan(decodedText)
          }
        },
        () => {} // error callback (ignore frame errors)
      )
      setCameraStarted(true)
      setScanState('scanning')
    } catch (err) {
      console.error('Camera error:', err)
      setScanState('error')
      setResult({ state: 'error', title: 'Camera Error', message: 'Could not access camera. Check permissions.' })
    }
  }, [cameraStarted, processQrScan, eventId])

  useEffect(() => {
    return () => {
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {})
      }
    }
  }, [])

  if (authChecking) {
    return (
      <div className="min-h-screen bg-obsidian-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-obsidian-900 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="font-bold text-xl mb-2">Access Denied</h2>
          <p className="text-white/50 mb-6">You must be an assigned supervisor to access the scanner.</p>
          <Link href="/events" className="btn-cyber-outline">Back to Events</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-obsidian-950 flex flex-col">
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
              <p className="text-xs font-semibold text-cyber-green uppercase tracking-wider">Live Scanner</p>
            </div>
            <p className="font-bold text-sm leading-tight">{event?.title || 'Event Scanner'}</p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-cyber-green">{checkinCount}</p>
          <p className="text-[10px] text-white/30 uppercase tracking-wider">checked in</p>
        </div>
      </div>

      {/* Scanner viewport */}
      <div className="flex-1 flex flex-col items-center justify-center relative bg-obsidian-950 overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 cyber-grid opacity-20" style={{ backgroundSize: '30px 30px' }} />

        {/* Camera container */}
        <div className="relative w-full max-w-sm mx-auto aspect-square">
          <div
            id="qr-scanner-container"
            ref={scannerRef}
            className="w-full h-full"
            style={{ minHeight: '300px' }}
          />

          {/* Corner frame */}
          {!result && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Corners */}
              {[
                'top-0 left-0 border-t-2 border-l-2',
                'top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2',
                'bottom-0 right-0 border-b-2 border-r-2',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 ${cls}`}
                  style={{ borderColor: '#00FF66' }} />
              ))}
              {/* Scan line */}
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
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl overflow-hidden"
                style={result.state === 'success' ? {
                  background: 'rgba(0,255,102,0.12)',
                  border: '2px solid #00FF66',
                  boxShadow: '0 0 40px rgba(0,255,102,0.3), inset 0 0 40px rgba(0,255,102,0.05)',
                } : {
                  background: 'rgba(255,50,80,0.12)',
                  border: '2px solid #FF3250',
                  boxShadow: '0 0 40px rgba(255,50,80,0.3), inset 0 0 40px rgba(255,50,80,0.05)',
                }}>
                {result.state === 'success' ? (
                  <CheckCircle2 className="w-20 h-20 text-cyber-green mb-4" />
                ) : (
                  <XCircle className="w-20 h-20 text-red-400 mb-4" />
                )}
                <p className="text-2xl font-black mb-1"
                  style={{ color: result.state === 'success' ? '#00FF66' : '#FF3250' }}>
                  {result.title}
                </p>
                <p className="text-white/70 text-sm text-center px-4">{result.message}</p>
                {result.ticket_type && (
                  <div className="mt-3 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: 'rgba(0,255,102,0.15)', color: '#00FF66', border: '1px solid rgba(0,255,102,0.3)' }}>
                    {result.ticket_type.toUpperCase()} PASS
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Start camera button */}
          {!cameraStarted && scanState === 'idle' && !result && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl"
              style={{ background: 'rgba(10,13,15,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Camera className="w-12 h-12 text-white/20" />
              <p className="text-white/40 text-sm">Camera not started</p>
              <button onClick={startScanner} className="btn-cyber">
                <Scan className="w-4 h-4" />
                Start Camera
              </button>
            </div>
          )}

          {/* Loading overlay */}
          {scanState === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-cyber-green animate-spin" />
                <p className="text-cyber-green text-sm font-semibold">Verifying...</p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        {scanState === 'scanning' && !result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center px-6">
            <p className="text-white/50 text-sm">Point camera at attendee's QR code</p>
            <p className="text-white/25 text-xs mt-1">Results appear in under 200ms</p>
          </motion.div>
        )}

        {/* Start button when idle */}
        {scanState === 'idle' && !cameraStarted && (
          <div className="mt-8 px-6 w-full max-w-sm">
            <button onClick={startScanner} className="btn-cyber w-full justify-center py-4 text-base">
              <Scan className="w-5 h-5" />
              Initialize Scanner
            </button>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-5 py-4 border-t border-white/[0.06]"
        style={{ background: 'rgba(5,7,9,0.95)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${cameraStarted ? 'bg-cyber-green animate-pulse' : 'bg-white/20'}`} />
            <span className="text-white/40">{cameraStarted ? 'Camera Active' : 'Camera Off'}</span>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <Shield className="w-3.5 h-3.5" />
            <span className="text-xs">Secured · Atomic check-ins</span>
          </div>
        </div>
      </div>
    </div>
  )
}
