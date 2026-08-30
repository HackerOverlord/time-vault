"use client"
/**
 * components/upload/video-recorder.tsx
 *
 * Self-contained live-recording widget for the New Post → Video → Record path.
 *
 * Lifecycle
 * ─────────
 *  idle         → permission requested → previewing → recording → review
 *
 * Stream cleanup
 * ──────────────
 *  Every MediaStream track is stopped (camera/mic indicator cleared) when:
 *    • recording completes
 *    • user presses Retake
 *    • user presses Switch to file picker (onCancel)
 *    • parent calls onCancel (e.g. modal close / Change media)
 *
 *  Parent must call the ref returned by the `onCleanupRef` prop to guarantee
 *  cleanup when the modal unmounts before the user finishes.
 */
import { useState, useRef, useEffect, useCallback } from "react"
import { Video, StopCircle, RotateCcw, Check, AlertCircle, Loader2, Folder } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Recording limits ──────────────────────────────────────────────────────────
export const MAX_RECORD_SECONDS = 120          // 2-minute hard stop
const MAX_VIDEO_BYTES           = 50 * 1024 * 1024

// ── MIME selection ────────────────────────────────────────────────────────────
/** Pick the best MIME type supported by both MediaRecorder and the backend. */
function pickMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ]
  if (typeof MediaRecorder === "undefined") return "video/webm"
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return ""   // let the browser pick — backend will validate the result
}

// ── Types ─────────────────────────────────────────────────────────────────────
type RecordState = "idle" | "requesting" | "previewing" | "recording" | "review" | "error"

interface VideoRecorderProps {
  onUseVideo: (file: File) => void
  onSwitchToFile: () => void
  /** Parent passes a ref setter so it can trigger cleanup on unmount/close. */
  onCleanupRef: (fn: () => void) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach(t => t.stop())
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}

// ── Component ─────────────────────────────────────────────────────────────────
export function VideoRecorder({ onUseVideo, onSwitchToFile, onCleanupRef }: VideoRecorderProps) {
  const [state,       setState]       = useState<RecordState>("idle")
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)
  const [elapsed,     setElapsed]     = useState(0)
  const [reviewUrl,   setReviewUrl]   = useState<string | null>(null)
  const [reviewDur,   setReviewDur]   = useState<number>(0)
  const [sizeError,   setSizeError]   = useState<string | null>(null)

  const liveVideoRef  = useRef<HTMLVideoElement>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const recorderRef   = useRef<MediaRecorder | null>(null)
  const chunksRef     = useRef<BlobPart[]>([])
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeRef       = useRef<string>("")
  const startTimeRef  = useRef<number>(0)

  // ── Cleanup helper (called in many places) ─────────────────────────────────
  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    }
    stopStream(streamRef.current)
    streamRef.current  = null
    recorderRef.current = null
    chunksRef.current   = []
  }, [])

  // Register cleanup with parent so modal close/unmount can call it
  useEffect(() => {
    onCleanupRef(cleanup)
  }, [cleanup, onCleanupRef])

  // Revoke review URL on unmount
  useEffect(() => {
    return () => {
      cleanup()
      if (reviewUrl) URL.revokeObjectURL(reviewUrl)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Request camera permission ──────────────────────────────────────────────
  const requestCamera = useCallback(async () => {
    setState("requesting")
    setErrorMsg(null)
    setSizeError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("Camera not available in this browser or context.")
      setState("error"); return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      setState("previewing")
      // Attach stream to live preview
      requestAnimationFrame(() => {
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream
          liveVideoRef.current.play().catch(() => {})
        }
      })
    } catch (err: unknown) {
      const name = (err as { name?: string }).name ?? ""
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setErrorMsg("Camera or microphone permission was denied. Please allow access in your browser settings.")
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setErrorMsg("No camera or microphone found. Please connect a device and try again.")
      } else if (name === "NotReadableError" || name === "AbortError") {
        setErrorMsg("Camera is in use by another application. Close it and try again.")
      } else {
        setErrorMsg("Could not access camera. Please check browser permissions.")
      }
      setState("error")
    }
  }, [])

  // ── Start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!streamRef.current) return
    chunksRef.current = []
    mimeRef.current   = pickMime()

    let recorder: MediaRecorder
    try {
      recorder = mimeRef.current
        ? new MediaRecorder(streamRef.current, { mimeType: mimeRef.current })
        : new MediaRecorder(streamRef.current)
    } catch {
      setErrorMsg("Recording is not supported in this browser.")
      setState("error"); return
    }

    recorder.ondataavailable = e => {
      if (e.data?.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onerror = () => {
      setErrorMsg("A recording error occurred. Please retake.")
      setState("error")
      cleanup()
    }

    recorder.onstop = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      // Stop camera tracks — mic/camera indicator clears immediately
      stopStream(streamRef.current)
      streamRef.current = null

      const mime = mimeRef.current || "video/webm"
      const blob = new Blob(chunksRef.current, { type: mime })
      chunksRef.current = []

      if (blob.size > MAX_VIDEO_BYTES) {
        setSizeError(`Recorded video exceeds the 50 MB limit. Please record a shorter clip.`)
        setState("review")
      }

      const url = URL.createObjectURL(blob)
      const dur = Math.round((Date.now() - startTimeRef.current) / 1000)
      setReviewUrl(url)
      setReviewDur(dur)
      setState("review")
    }

    recorderRef.current = recorder
    setState("recording")
    setElapsed(0)
    startTimeRef.current = Date.now()

    // Collect data every second for accurate size tracking
    recorder.start(1000)

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1
        if (next >= MAX_RECORD_SECONDS) {
          // Auto-stop at limit
          if (recorderRef.current?.state === "recording") recorderRef.current.stop()
        }
        return next
      })
    }, 1000)
  }, [cleanup])

  // ── Stop recording ─────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop()   // triggers onstop above
    }
  }, [])

  // ── Retake ─────────────────────────────────────────────────────────────────
  const retake = useCallback(() => {
    cleanup()
    if (reviewUrl) { URL.revokeObjectURL(reviewUrl); setReviewUrl(null) }
    setReviewDur(0)
    setSizeError(null)
    setElapsed(0)
    requestCamera()
  }, [cleanup, reviewUrl, requestCamera])

  // ── Use video ──────────────────────────────────────────────────────────────
  const useVideo = useCallback(() => {
    if (!reviewUrl || sizeError) return
    const mime = mimeRef.current || "video/webm"
    // Convert Blob → File so UploadModal's onFile-equivalent treats it as a video file.
    // Extension derived from MIME: webm → .webm, mp4 → .mp4.
    const ext  = mime.includes("mp4") ? "mp4" : "webm"
    fetch(reviewUrl)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], `recording.${ext}`, { type: mime })
        onUseVideo(file)
      })
  }, [reviewUrl, sizeError, onUseVideo])

  // ── Switch to file picker ──────────────────────────────────────────────────
  const switchToFile = useCallback(() => {
    cleanup()
    if (reviewUrl) { URL.revokeObjectURL(reviewUrl); setReviewUrl(null) }
    onSwitchToFile()
  }, [cleanup, reviewUrl, onSwitchToFile])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Idle: choose path ───────────────────────────────────────────── */}
      {state === "idle" && (
        <div className="space-y-3">
          <p className="text-zinc-400 text-sm">How would you like to add a video?</p>
          <button
            onClick={requestCamera}
            aria-label="Record video"
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl border
                       border-zinc-800 bg-zinc-800/30 text-zinc-300 hover:border-primary
                       hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
          >
            <Video className="size-5 shrink-0" />
            <span className="text-sm font-semibold">Record video</span>
          </button>
          <button
            onClick={switchToFile}
            aria-label="Choose video from device"
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl border
                       border-zinc-800 bg-zinc-800/30 text-zinc-300 hover:border-zinc-500
                       hover:text-white transition-all cursor-pointer"
          >
            <Folder className="size-5 shrink-0" />
            <span className="text-sm font-semibold">Choose from device</span>
          </button>
        </div>
      )}

      {/* ── Requesting permission ────────────────────────────────────────── */}
      {state === "requesting" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-zinc-400 text-sm">Requesting camera access…</p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {state === "error" && (
        <div className="space-y-4" role="alert" aria-live="assertive">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={requestCamera}
              aria-label="Try again"
              className="flex-1 py-2.5 rounded-xl bg-primary/15 hover:bg-primary/25
                         text-primary text-sm font-semibold cursor-pointer transition-colors"
            >
              Try again
            </button>
            <button
              onClick={switchToFile}
              aria-label="Choose video from device instead"
              className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10
                         text-zinc-300 text-sm font-semibold cursor-pointer transition-colors"
            >
              Choose from device
            </button>
          </div>
        </div>
      )}

      {/* ── Live preview ─────────────────────────────────────────────────── */}
      {(state === "previewing" || state === "recording") && (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
            <video
              ref={liveVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              aria-label="Live camera preview"
            />
            {/* Recording indicator */}
            {state === "recording" && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5
                              bg-black/60 px-2.5 py-1 rounded-full"
                   role="status" aria-live="polite"
                   aria-label={`Recording: ${formatTime(elapsed)}`}>
                <span className="size-2 rounded-full bg-red-500 animate-pulse" aria-hidden />
                <span className="text-white text-xs font-mono font-bold">
                  {formatTime(elapsed)}
                </span>
                {elapsed >= MAX_RECORD_SECONDS - 10 && (
                  <span className="text-red-400 text-xs ml-1">
                    {MAX_RECORD_SECONDS - elapsed}s left
                  </span>
                )}
              </div>
            )}
          </div>

          {state === "previewing" && (
            <button
              onClick={startRecording}
              aria-label="Start recording"
              className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white
                         font-bold cursor-pointer transition-colors flex items-center
                         justify-center gap-2"
            >
              <span className="size-3 rounded-full bg-white" aria-hidden />
              Start recording
            </button>
          )}

          {state === "recording" && (
            <button
              onClick={stopRecording}
              aria-label="Stop recording"
              className="w-full py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white
                         font-bold cursor-pointer transition-colors flex items-center
                         justify-center gap-2"
            >
              <StopCircle className="size-5" />
              Stop recording
            </button>
          )}
        </div>
      )}

      {/* ── Review ───────────────────────────────────────────────────────── */}
      {state === "review" && reviewUrl && (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-black">
            <video
              src={reviewUrl}
              controls
              playsInline
              className="w-full max-h-52 object-contain"
              aria-label="Recorded video preview"
            />
          </div>

          <p className="text-zinc-400 text-xs text-center">
            Duration: {formatTime(reviewDur)}
          </p>

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
              aria-label="Retake video"
              className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10
                         text-zinc-300 text-sm font-semibold cursor-pointer
                         transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="size-4" />
              Retake
            </button>
            <button
              onClick={useVideo}
              disabled={!!sizeError}
              aria-label="Use recorded video"
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
              Use video
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
