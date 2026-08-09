'use client'

/**
 * PulsePass — Phase 1 OCR ID Card Claim Screen
 *
 * Flow:
 * 1. Enter roll number
 * 2. Open camera, Laplacian sharpness filter runs every 200ms
 * 3. Capture enabled only when frame is sharp enough
 * 4. Tesseract.js OCR runs locally on captured frame
 * 5. Success → claim ticket via /api/tickets → show QR pass
 * 6. Failure (3x) → reveal manual review submission
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, CheckCircle2, XCircle, Loader2, ChevronRight,
  Shield, AlertTriangle, ScanLine, Upload, RotateCcw,
  Aperture, ZapOff, Zap, ArrowLeft
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Event } from '@/lib/types'
import Link from 'next/link'

type ClaimStep = 'roll_number' | 'camera' | 'scanning_ocr' | 'success' | 'failed' | 'manual_review' | 'reviewing'

const SHARPNESS_THRESHOLD = 15  // Laplacian variance threshold (realistic for webcams/DroidCam)
const LAPLACIAN_INTERVAL_MS = 200
const MAX_OCR_RETRIES = 3

/**
 * Computes Laplacian variance of a canvas frame.
 * Higher value = sharper image. Used as a blur detection proxy.
 */
function computeLaplacianVariance(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  let sum = 0
  let count = 0
  const w = width

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * w + x) * 4
      const center = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      const top = 0.299 * data[((y - 1) * w + x) * 4] + 0.587 * data[((y - 1) * w + x) * 4 + 1] + 0.114 * data[((y - 1) * w + x) * 4 + 2]
      const bottom = 0.299 * data[((y + 1) * w + x) * 4] + 0.587 * data[((y + 1) * w + x) * 4 + 1] + 0.114 * data[((y + 1) * w + x) * 4 + 2]
      const left = 0.299 * data[(y * w + x - 1) * 4] + 0.587 * data[(y * w + x - 1) * 4 + 1] + 0.114 * data[(y * w + x - 1) * 4 + 2]
      const right = 0.299 * data[(y * w + x + 1) * 4] + 0.587 * data[(y * w + x + 1) * 4 + 1] + 0.114 * data[(y * w + x + 1) * 4 + 2]
      const lap = Math.abs(4 * center - top - bottom - left - right)
      sum += lap
      count++
    }
  }
  return count > 0 ? sum / count : 0
}

export default function ClaimPage() {
  const { eventId } = useParams() as { eventId: string }
  const router = useRouter()
  const searchParams = useSearchParams()
  const ticketType = searchParams.get('type') === 'vip' ? 'vip' : 'general'
  const supabase = createClient()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sharpnessIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Ref callback: fires the INSTANT the <video> element appears in the DOM
  const videoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el
    if (el && streamRef.current) {
      el.srcObject = streamRef.current
      el.play().catch(e => console.error('Video play error:', e))
    }
  }, [])

  const [step, setStep] = useState<ClaimStep>('roll_number')
  const [rollNumber, setRollNumber] = useState('')
  const [event, setEvent] = useState<Event | null>(null)
  const [sharpness, setSharpness] = useState(0)
  const [isSharp, setIsSharp] = useState(false)
  const [ocrRetries, setOcrRetries] = useState(0)
  const [ocrStatus, setOcrStatus] = useState('')
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch event details and OCR keywords
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from('events')
        .select('*, organization:organizations(name)')
        .eq('id', eventId)
        .single()
      setEvent(data as Event)
    }
    init()
  }, [eventId])

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available (requires HTTPS)')
      }
      
      let stream: MediaStream
      try {
        // Try rear/environment camera first (mobile)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        })
      } catch {
        // Fallback to any available camera (desktop webcams, DroidCam, etc.)
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }
      
      streamRef.current = stream

      // If the video element is already mounted (ref callback already fired),
      // attach the stream directly. Otherwise the ref callback will do it.
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(e => console.error('Video play error:', e))
      }

      setStep('camera')

      // Start Laplacian sharpness polling
      sharpnessIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx || video.readyState < 2) return

        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const score = computeLaplacianVariance(canvas)
        setSharpness(Math.round(score))
        setIsSharp(score >= SHARPNESS_THRESHOLD)
      }, LAPLACIAN_INTERVAL_MS)
    } catch (err: any) {
      console.error('Camera error:', err)
      setStatusMessage(err.message || 'Camera permission denied or requires HTTPS. Please use the fallback below.')
      setIsSharp(true)
      setStep('camera')
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (sharpnessIntervalRef.current) clearInterval(sharpnessIntervalRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  // Capture and run OCR
  const handleCapture = useCallback(async (fileBlob?: Blob) => {
    setStep('scanning_ocr')
    setOcrStatus('Preparing frame...')

    let imageDataUrl = ''
    if (fileBlob) {
      // Use fallback file
      imageDataUrl = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(fileBlob)
      })
    } else {
      if (!canvasRef.current || !isSharp) return
      const canvas = canvasRef.current
      imageDataUrl = canvas.toDataURL('image/jpeg', 0.9)
    }

    setCapturedImageDataUrl(imageDataUrl)
    stopCamera()

    try {
      setOcrStatus('Loading OCR engine...')
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        // Use jsDelivr CDN for fast global delivery + smaller standard model
        langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js-data@4.0.0/traineddata/fast/',
        logger: (m) => {
          if (m.status === 'loading tesseract core') {
            setOcrStatus(`Loading engine... ${Math.round(m.progress * 100)}%`)
          } else if (m.status === 'loading language traineddata') {
            setOcrStatus(`Downloading language model... ${Math.round(m.progress * 100)}%`)
          } else if (m.status === 'initializing tesseract') {
            setOcrStatus('Initializing OCR...')
          } else if (m.status === 'recognizing text') {
            setOcrStatus(`Scanning... ${Math.round(m.progress * 100)}%`)
          }
        },
      })

      setOcrStatus('Scanning ID card...')
      const { data: { text } } = await worker.recognize(imageDataUrl)
      await worker.terminate()

      // Get event OCR keywords (case-insensitive check)
      const keywords: string[] = event?.ocr_keywords || []
      const lowerText = text.toLowerCase()

      const allMatch = keywords.length === 0 ||
        keywords.every((kw) => lowerText.includes(kw.toLowerCase().trim()))

      if (allMatch) {
        setOcrStatus('ID verified! Issuing pass...')
        setStep('success')
        await claimTicket()
      } else {
        const newRetries = ocrRetries + 1
        setOcrRetries(newRetries)
        const missedKeywords = keywords.filter((kw) => !lowerText.includes(kw.toLowerCase().trim()))
        setStatusMessage(`Could not verify: "${missedKeywords.join('", "')}" not found on ID card.`)

        if (newRetries >= MAX_OCR_RETRIES) {
          setStep('failed')
        } else {
          setStep('failed')
        }
      }
    } catch (err) {
      console.error('OCR error:', err)
      setStatusMessage('OCR failed due to a technical error. Please retry.')
      setStep('failed')
      setOcrRetries((r) => r + 1)
    }
  }, [isSharp, event, ocrRetries])

  // Claim ticket via API
  const claimTicket = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          ticket_type: ticketType,
          ocr_verified: true,
          roll_number: rollNumber,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push('/my-passes?claimed=true')
      } else {
        setStatusMessage(data.error || 'Failed to claim ticket.')
        setStep('failed')
      }
    } catch (err) {
      setStatusMessage('Network error. Please check your connection.')
      setStep('failed')
    } finally {
      setLoading(false)
    }
  }

  // Submit for manual review
  const handleManualReview = async () => {
    if (!capturedImageDataUrl) return
    setStep('reviewing')
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      // Convert dataURL to blob for upload
      const blob = await fetch(capturedImageDataUrl).then((r) => r.blob())
      const filePath = `id-review/${user.id}-${eventId}-${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('id-review')
        .upload(filePath, blob, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      // Get signed URL (or use filePath as reference)
      const { data: urlData } = supabase.storage.from('id-review').getPublicUrl(filePath)

      const { error: insertError } = await supabase.from('manual_review_queue').upsert({
        user_id: user.id,
        event_id: eventId,
        roll_number: rollNumber,
        id_card_image_url: urlData.publicUrl,
        status: 'pending',
      }, { onConflict: 'user_id,event_id' })

      if (insertError) throw insertError

      router.push('/my-passes?review=pending')
    } catch (err) {
      console.error('Manual review error:', err)
      setStatusMessage('Failed to submit for review. Please try again.')
      setStep('failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    setCapturedImageDataUrl(null)
    setStatusMessage('')
    setOcrStatus('')
    setSharpness(0)
    setIsSharp(false)
    setStep('camera')
    startCamera()
  }

  const sharpnessPercent = Math.min(100, Math.round((sharpness / SHARPNESS_THRESHOLD) * 100))

  return (
    <div className="min-h-screen bg-obsidian-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]"
        style={{ background: 'rgba(5,7,9,0.97)', backdropFilter: 'blur(16px)' }}>
        <Link href={`/events/${eventId}`} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="font-bold text-sm">{event?.title || 'Claim Your Pass'}</p>
          <p className="text-white/40 text-xs">{event?.organization?.name || ''}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${
              (step === 'roll_number' && s === 1) ||
              (step === 'camera' && s === 2) ||
              (['scanning_ocr', 'success', 'failed', 'manual_review', 'reviewing'].includes(step) && s === 3)
                ? 'bg-cyber-green w-6' : 'bg-white/20 w-3'
            }`} />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">

        {/* ── STEP 1: Roll Number ── */}
        <AnimatePresence mode="wait">
          {step === 'roll_number' && (
            <motion.div key="roll" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="w-full">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(0,255,102,0.15), rgba(0,255,102,0.05))', border: '1px solid rgba(0,255,102,0.2)' }}>
                  <Shield className="w-8 h-8 text-cyber-green" />
                </div>
                <h1 className="text-2xl font-black mb-2">Verify Your Identity</h1>
                <p className="text-white/50 text-sm">Enter your roll number, then we'll scan your ID card to issue your pass.</p>
              </div>

              <div className="mb-6">
                <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider">Roll Number</label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                  placeholder="e.g., 22AG001"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-lg font-mono font-bold focus:outline-none focus:border-cyber-green transition-colors text-center tracking-widest"
                  autoFocus
                />
              </div>

              {event?.ocr_keywords && event.ocr_keywords.length > 0 && (
                <div className="mb-6 p-4 rounded-xl border border-white/[0.06]"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-xs text-white/40 mb-2">Your ID card must show:</p>
                  <div className="flex flex-wrap gap-2">
                    {event.ocr_keywords.map((kw) => (
                      <span key={kw} className="text-xs px-2.5 py-1 rounded-full border border-cyber-green/30 text-cyber-green/70">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => { if (rollNumber.trim()) startCamera() }}
                disabled={!rollNumber.trim()}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: rollNumber.trim() ? '#00FF66' : '#00FF6640' }}>
                <Camera className="w-5 h-5" />
                Open Camera for ID Scan
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* ── STEP 2: Camera + Blur Detection ── */}
          {step === 'camera' && (
            <motion.div key="camera" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="w-full">
              <div className="text-center mb-4">
                <p className="font-bold">Point camera at your ID card</p>
                <p className="text-white/40 text-xs mt-1">Hold steady until the frame turns green</p>
                {statusMessage && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                    {statusMessage}
                  </div>
                )}
              </div>

              {/* Camera viewfinder */}
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-4"
                style={{ border: `2px solid ${isSharp ? '#00FF66' : 'rgba(255,255,255,0.1)'}`, transition: 'border-color 0.3s' }}>
                <video ref={videoCallbackRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                {/* Corner frame overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {['top-2 left-2 border-t-2 border-l-2', 'top-2 right-2 border-t-2 border-r-2',
                    'bottom-2 left-2 border-b-2 border-l-2', 'bottom-2 right-2 border-b-2 border-r-2'].map((cls, i) => (
                    <div key={i} className={`absolute w-7 h-7 rounded-sm ${cls} transition-colors`}
                      style={{ borderColor: isSharp ? '#00FF66' : 'rgba(255,255,255,0.4)' }} />
                  ))}
                </div>

                {/* Sharpness badge */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    isSharp ? 'text-black' : 'text-white/70'
                  }`} style={{ background: isSharp ? '#00FF66' : 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
                    {isSharp ? <Zap className="w-3.5 h-3.5" /> : <ZapOff className="w-3.5 h-3.5" />}
                    {isSharp ? 'Sharp — Ready to Capture' : 'Hold Still...'}
                  </div>
                </div>
              </div>

              {/* Sharpness progress bar */}
              <div className="mb-5">
                <div className="flex justify-between text-xs text-white/40 mb-1.5">
                  <span>Sharpness</span>
                  <span>{sharpnessPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${sharpnessPercent}%`,
                      background: sharpnessPercent >= 100 ? '#00FF66' : `hsl(${sharpnessPercent * 1.2}, 100%, 50%)`,
                    }}
                    animate={{ width: `${sharpnessPercent}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>

              {statusMessage ? (
                <div className="w-full relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCapture(e.target.files[0])
                      }
                    }}
                  />
                  <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-black transition-all bg-cyber-green">
                    <Camera className="w-5 h-5" />
                    Take Photo Manually
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleCapture()}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-black transition-all"
                  style={{ background: '#00FF66' }}>
                  <Aperture className="w-5 h-5" />
                  Capture & Scan ID Card
                </button>
              )}
            </motion.div>
          )}

          {/* ── STEP 3: OCR Scanning ── */}
          {step === 'scanning_ocr' && (
            <motion.div key="ocr" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full text-center">
              <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center relative"
                style={{ background: 'rgba(0,255,102,0.1)', border: '1px solid rgba(0,255,102,0.2)' }}>
                <ScanLine className="w-10 h-10 text-cyber-green" />
                <div className="absolute inset-0 rounded-3xl animate-pulse"
                  style={{ background: 'rgba(0,255,102,0.05)' }} />
              </div>
              <h2 className="text-xl font-black mb-2">Scanning ID Card</h2>
              <p className="text-cyber-green text-sm font-medium mb-6">{ocrStatus}</p>
              <div className="flex justify-center">
                <Loader2 className="w-6 h-6 text-cyber-green animate-spin" />
              </div>
            </motion.div>
          )}

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full text-center">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center"
                style={{ background: 'rgba(0,255,102,0.15)', border: '2px solid rgba(0,255,102,0.4)', boxShadow: '0 0 40px rgba(0,255,102,0.2)' }}>
                <CheckCircle2 className="w-12 h-12 text-cyber-green" />
              </motion.div>
              <h2 className="text-2xl font-black text-cyber-green mb-2">Identity Verified!</h2>
              <p className="text-white/50 text-sm mb-6">Issuing your pass...</p>
              <Loader2 className="w-6 h-6 text-cyber-green animate-spin mx-auto" />
            </motion.div>
          )}

          {/* ── FAILURE ── */}
          {step === 'failed' && (
            <motion.div key="failed" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="w-full">
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'rgba(255,50,80,0.1)', border: '1px solid rgba(255,50,80,0.3)' }}>
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-xl font-black mb-2">Verification Failed</h2>
                {statusMessage && <p className="text-red-400/80 text-sm mb-2">{statusMessage}</p>}
                <p className="text-white/40 text-xs">
                  Attempt {ocrRetries} of {MAX_OCR_RETRIES}
                </p>
              </div>

              {/* Show captured image preview */}
              {capturedImageDataUrl && (
                <div className="mb-5 rounded-2xl overflow-hidden border border-white/10">
                  <img src={capturedImageDataUrl} alt="Captured ID" className="w-full object-cover opacity-70" />
                </div>
              )}

              <div className="space-y-3">
                {ocrRetries < MAX_OCR_RETRIES && (
                  <button onClick={handleRetry}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-black"
                    style={{ background: '#00FF66' }}>
                    <RotateCcw className="w-4 h-4" />
                    Retry Scan ({MAX_OCR_RETRIES - ocrRetries} left)
                  </button>
                )}

                {ocrRetries >= MAX_OCR_RETRIES && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="p-4 rounded-xl border border-amber-500/30 mb-3"
                      style={{ background: 'rgba(245,158,11,0.06)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <p className="text-amber-400 text-sm font-semibold">OCR limit reached</p>
                      </div>
                      <p className="text-white/50 text-xs">You can submit your ID for manual review. An admin will verify and approve your pass within the event window.</p>
                    </div>
                    <button onClick={handleManualReview} disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold border transition-all disabled:opacity-50"
                      style={{ borderColor: 'rgba(245,158,11,0.4)', color: '#F59E0B', background: 'rgba(245,158,11,0.08)' }}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Submit for Manual Review
                    </button>
                  </motion.div>
                )}

                <Link href={`/events/${eventId}`}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all">
                  Cancel
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── MANUAL REVIEW SUBMITTING ── */}
          {step === 'reviewing' && (
            <motion.div key="reviewing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full text-center">
              <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <Upload className="w-10 h-10 text-amber-400" />
              </div>
              <h2 className="text-xl font-black mb-2">Submitting for Review</h2>
              <p className="text-white/40 text-sm mb-6">Uploading your ID card securely...</p>
              <Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
