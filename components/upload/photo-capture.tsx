"use client"
/**
 * components/upload/photo-capture.tsx — Pass 24C
 *
 * In-app photo capture widget for the New Post → Photo → Take photo flow.
 *
 * Lifecycle: idle → requesting → previewing → captured → (use or retake)
 *
 * Stream cleanup
 * ──────────────
 *   Camera tracks are stopped whenever:
 *     • photo is captured (live stream no longer needed)
 *     • Retake (old stream stopped, fresh one requested)
 *     • Switch to file picker (onSwitchToFile)
 *     • Parent calls cleanup via onCleanupRef (modal close / Change media / unmount)
 *
 * Capture format
 * ──────────────
 *   Captured at the video's natural dimensions, capped at MAX_EXPORT_PX on
 *   the longest side to keep file sizes reasonable.
 *   Exported as image/jpeg at quality JPEG_QUALITY.
 */
import React, { useState, useRef, useEffect, useCallback } from "react"
import { Camera, RotateCcw, Check, AlertCircle, Loader2, Folder, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Constants ─────────────────────────────────────────────────────────────────
/** Longest side cap before JPEG compression. */
export const MAX_EXPORT_PX  = 1920
/** JPEG quality: 0.88 → good quality, ~40–80 % smaller than PNG. */
export const JPEG_QUALITY   = 0.88
const MAX_IMAGE_BYTES       = 5 * 1024 * 1024   // must match backend + upload-modal

// ── Types ─────────────────────────────────────────────────────────────────────
type CaptureState = "idle" | "requesting" | "previewing" | "captured" | "error"

interface PhotoCaptureProps {
  onUsePhoto:      (file: File) => void
  onSwitchToFile:  () => void
  /** Parent passes a ref-setter so modal close/unmount can trigger cleanup. */
  onCleanupRef:    (fn: () => void) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach(t => t.stop())
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PhotoCapture({ onUsePhoto, onSwitchToFile, onCleanupRef }: PhotoCaptureProps) {
  const [state,        setState]        = useState<CaptureState>("idle")
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null)
  const [capturedUrl,  setCapturedUrl]  = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [sizeError,    setSizeError]    = useState<string | null>(null)
  const [facingFront,  setFacingFront]  = useState(false)

  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    stopStream(streamRef.current)
    streamRef.current = null
  }, [])

  useEffect(() => {
    onCleanupRef(cleanup)
  }, [cleanup, onCleanupRef])

  useEffect(() => {
    return () => {
      cleanup()
      if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Open camera ───────────────────────────────────────────────────────────
  const openCamera = useCallback(async (front = false) => {
    setState("requesting")
    setErrorMsg(null)
    setSizeError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("Camera not available in this browser or context.")
      setState("error"); return
    }

    // Stop any existing stream first (Retake / switch facing mode)
    stopStream(streamRef.current)
    streamRef.current = null

    // Prefer environment (rear) camera on mobile; fall back to any camera.
    // Using "ideal" (not "exact") so desktop webcams still work.
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: front ? { ideal: "user" } : { ideal: "environment" },
        width:  { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      setState("previewing")
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
    } catch (err: unknown) {
      const name = (err as { name?: string }).name ?? ""
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setErrorMsg("Camera permission was denied. Please allow camera access in your browser settings.")
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setErrorMsg("No camera found. Please connect a camera and try again.")
      } else if (name === "NotReadableError" || name === "AbortError") {
        setErrorMsg("Camera is in use by another app. Close it and try again.")
      } else {
        setErrorMsg("Could not access camera. Please check browser permissions.")
      }
      setState("error")
    }
  }, [])

  // ── Switch camera facing ──────────────────────────────────────────────────
  const switchCamera = useCallback(() => {
    const newFront = !facingFront
    setFacingFront(newFront)
    openCamera(newFront)
  }, [facingFront, openCamera])

  // ── Capture photo ─────────────────────────────────────────────────────────
  const capturePhoto = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    // Calculate capped export dimensions preserving aspect ratio
    const srcW = video.videoWidth  || video.clientWidth  || 1280
    const srcH = video.videoHeight || video.clientHeight || 720
    const scale = Math.min(1, MAX_EXPORT_PX / Math.max(srcW, srcH))
    const w = Math.round(srcW * scale)
    const h = Math.round(srcH * scale)

    canvas.width  = w
    canvas.height = h

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setErrorMsg("Could not capture photo. Please try again.")
      setState("error"); return
    }

    ctx.drawImage(video, 0, 0, w, h)

    // Stop camera stream — no longer needed after capture
    stopStream(streamRef.current)
    streamRef.current = null

    canvas.toBlob(blob => {
      if (!blob) {
        setErrorMsg("Photo capture failed. Please try again.")
        setState("error"); return
      }

      if (blob.size > MAX_IMAGE_BYTES) {
        setSizeError("Captured photo exceeds the 5 MB limit. Please retake.")
        const url = URL.createObjectURL(blob)
        setCapturedUrl(url)
        setState("captured"); return
      }

      const file = new File([blob], "capture.jpg", { type: "image/jpeg" })
      const url  = URL.createObjectURL(blob)
      setCapturedFile(file)
      setCapturedUrl(url)
      setState("captured")
    }, "image/jpeg", JPEG_QUALITY)
  }, [])

  // ── Retake ────────────────────────────────────────────────────────────────
  const retake = useCallback(() => {
    if (capturedUrl) { URL.revokeObjectURL(capturedUrl); setCapturedUrl(null) }
    setCapturedFile(null)
    setSizeError(null)
    openCamera(facingFront)
  }, [capturedUrl, facingFront, openCamera])

  // ── Use photo ─────────────────────────────────────────────────────────────
  const usePhoto = useCallback(() => {
    if (!capturedFile || sizeError) return
    onUsePhoto(capturedFile)
  }, [capturedFile, sizeError, onUsePhoto])

  // ── Switch to file picker ─────────────────────────────────────────────────
  const switchToFile = useCallback(() => {
    cleanup()
    if (capturedUrl) { URL.revokeObjectURL(capturedUrl); setCapturedUrl(null) }
    onSwitchToFile()
  }, [cleanup, capturedUrl, onSwitchToFile])

  // ── Render ────────────────────────────────────────────────────────────────

  // Hidden canvas used for capture (never displayed)
  const hiddenCanvas = (
    <canvas ref={canvasRef} aria-hidden className="hidden" />
  )

  return (
    <div className="space-y-3">
      {hiddenCanvas}

      {/* ── Idle: choose path ──────────────────────────────────────────── */}
      {state === "idle" && (
        <>
          <p className="text-zinc-400 text-sm">How would you like to add a photo?</p>
          <button
            onClick={() => openCamera(false)}
            aria-label="Take photo"
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl border
                       border-zinc-800 bg-zinc-800/30 text-zinc-300 hover:border-primary
                       hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
          >
            <Camera className="size-5 shrink-0" />
            <span className="text-sm font-semibold">Take photo</span>
          </button>
          <button
            onClick={switchToFile}
            aria-label="Choose photo from device"
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl border
                       border-zinc-800 bg-zinc-800/30 text-zinc-300 hover:border-zinc-500
                       hover:text-white transition-all cursor-pointer"
          >
            <Folder className="size-5 shrink-0" />
            <span className="text-sm font-semibold">Choose from device</span>
          </button>
        </>
      )}

      {/* ── Requesting permission ──────────────────────────────────────── */}
      {state === "requesting" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-zinc-400 text-sm">Requesting camera access…</p>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {state === "error" && (
        <div className="space-y-3" role="alert" aria-live="assertive">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openCamera(facingFront)}
              aria-label="Try camera again"
              className="flex-1 py-2.5 rounded-xl bg-primary/15 hover:bg-primary/25
                         text-primary text-sm font-semibold cursor-pointer transition-colors"
            >
              Try again
            </button>
            <button
              onClick={switchToFile}
              aria-label="Choose photo from device instead"
              className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10
                         text-zinc-300 text-sm font-semibold cursor-pointer transition-colors"
            >
              Choose from device
            </button>
          </div>
        </div>
      )}

      {/* ── Live preview ──────────────────────────────────────────────── */}
      {state === "previewing" && (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              aria-label="Live camera preview"
            />
            {/* Switch camera button (top-right) */}
            <button
              onClick={switchCamera}
              aria-label="Switch camera"
              className="absolute top-2 right-2 size-9 rounded-full bg-black/50 backdrop-blur-sm
                         flex items-center justify-center cursor-pointer hover:bg-black/70
                         transition-colors"
            >
              <RefreshCw className="size-4 text-white" />
            </button>
          </div>
          <button
            onClick={capturePhoto}
            aria-label="Capture photo"
            className="w-full py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white
                       font-bold cursor-pointer transition-colors flex items-center
                       justify-center gap-2"
          >
            <Camera className="size-5" />
            Capture photo
          </button>
        </div>
      )}

      {/* ── Review captured photo ─────────────────────────────────────── */}
      {state === "captured" && capturedUrl && (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capturedUrl}
            alt="Captured photo preview"
            className="w-full rounded-2xl object-contain max-h-64 bg-black"
          />

          {sizeError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10
                            border border-red-500/20"
                 role="alert" aria-live="assertive">
              <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{sizeError}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={retake}
              aria-label="Retake photo"
              className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10
                         text-zinc-300 text-sm font-semibold cursor-pointer
                         transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="size-4" />
              Retake
            </button>
            <button
              onClick={usePhoto}
              disabled={!!sizeError}
              aria-label="Use captured photo"
              aria-disabled={!!sizeError}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer",
                "transition-colors flex items-center justify-center gap-2",
                sizeError
                  ? "bg-white/[0.04] text-zinc-600 cursor-not-allowed"
                  : "bg-primary hover:bg-primary/90 text-white"
              )}
            >
              <Check className="size-4" />
              Use photo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
