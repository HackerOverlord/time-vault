"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Plus, X, Clock, Image, Video, Type, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { apiFetch, tok, API as API_BASE } from "@/lib/api"
import { VideoRecorder } from "@/components/upload/video-recorder"
import { PhotoCapture } from "@/components/upload/photo-capture"
import type { Group, Post } from "@/lib/types"

// ── Constants derived from backend configuration ──────────────────────────────
// Backend: _MAX_MEDIA_URL_BYTES = 7 * 1024 * 1024 (base64 ceiling for a 5 MB file)
const MAX_IMAGE_BYTES = 5  * 1024 * 1024   // 5 MB — must match _MAX_POST_IMAGE_DECODED_BYTES
const MAX_VIDEO_BYTES = 50 * 1024 * 1024   // 50 MB — must match _MAX_POST_VIDEO_DECODED_BYTES
const MAX_CAPTION_LEN = 500               // backend rejects captions > 500 chars

const FOCUSABLE =
  'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

const TITLE_ID = "upload-modal-title"

// ── Props ─────────────────────────────────────────────────────────────────────

interface UploadModalProps {
  groups: Group[]
  /** Status of the groups request — prevents false "no vaults" when request is in flight or failed. */
  groupsStatus: "idle" | "loading" | "success" | "error"
  onClose: () => void
  onPosted: (p: Post) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UploadModal({ groups, groupsStatus, onClose, onPosted }: UploadModalProps) {
  const [step,            setStep]            = useState<"pick" | "compose" | "record" | "capture">("pick")
  const [videoSubStep,    setVideoSubStep]    = useState<"choose" | "file">("choose")
  const cleanupRecorderRef = useRef<(() => void) | null>(null)
  const cleanupCaptureRef  = useRef<(() => void) | null>(null)
  const [mediaType,       setMediaType]       = useState<"video" | "image" | "text">("video")
  const [mediaFile,       setMediaFile]       = useState<File | null>(null)
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null)
  // Ref always holds the current preview URL so unmount cleanup is not stale.
  const previewUrlRef = useRef<string | null>(null)
  const [uploadProgress,  setUploadProgress]  = useState<number | null>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  // Tracks the media type that the user clicked BEFORE the file dialog opens.
  // Using a ref instead of state ensures onFile always reads the current value
  // regardless of React's batched state update timing.
  const intendedTypeRef = useRef<"video" | "image">("image")
  const abortedRef = useRef(false)

  const cancelUpload = () => {
    if (!xhrRef.current) return
    abortedRef.current = true
    xhrRef.current.abort()
    xhrRef.current = null
    // Revoke the preview URL — the upload is abandoned so we release the resource.
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); setPreview(null) }
    setMediaFile(null)
    setPosting(false); setUploadProgress(null)
  }
  const [caption,         setCaption]         = useState("")
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? "")
  const [unlockDate,      setUnlockDate]      = useState("")
  const [isTimeCapsule,   setIsTimeCapsule]   = useState(false)
  const [posting,         setPosting]         = useState(false)
  // postError: keeps the last error message visible so user can retry.
  // Cleared on any new submit attempt. Caption is preserved across retries.
  const [postError,       setPostError]       = useState<string | null>(null)

  const fileRef     = useRef<HTMLInputElement>(null)

  // Keeps previewUrlRef in sync whenever the state changes.
  const setPreview = (url: string | null) => {
    previewUrlRef.current = url
    setMediaPreviewUrl(url)
  }

  // Cleanup on unmount: revoke current preview URL and abort in-flight XHR.
  // previewUrlRef always holds the current URL, avoiding stale-closure bugs.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      if (xhrRef.current) { abortedRef.current = true; xhrRef.current.abort() }
      cleanupRecorderRef.current?.()
    }
  }, [])  // empty deps — closure over refs, not state
  const dialogRef   = useRef<HTMLDivElement>(null)
  const closeRef    = useRef<HTMLButtonElement>(null)
  // Track whether we have focus so cleanup can be precise
  const hasFocusRef = useRef(false)

  // Tomorrow's date string for the unlock-date min attribute
  const tomorrowISO = new Date(Date.now() + 86_400_000).toISOString().split("T")[0]

  // ── Focus: move into modal on open ─────────────────────────────────────────
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      closeRef.current?.focus()
      hasFocusRef.current = true
    })
    return () => cancelAnimationFrame(id)
  }, [])

  // ── Focus trap + Escape ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !posting) { onClose(); return }
      if (e.key !== "Tab" || !dialogRef.current) return
      const nodes = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter(el => !el.closest("[aria-hidden]"))
      if (nodes.length === 0) return
      const first = nodes[0]
      const last  = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, posting])

  // ── Safe close — blocked while submitting ──────────────────────────────────
  const safeClose = useCallback(() => {
    if (posting) return
    onClose()
  }, [posting, onClose])

  // ── File handler ───────────────────────────────────────────────────────────
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""          // reset so same file can be re-selected
    if (!file) return

    // Mode-mismatch check — the selected file must match the chosen media type.
    // Uses intendedTypeRef (set synchronously before the file dialog opens)
    // rather than the mediaType state, which may not yet be committed due to
    // React batching when the file dialog fires onChange immediately.
    const intended = intendedTypeRef.current
    if (intended === "video" && !file.type.startsWith("video/")) {
      toast.error("Please choose a video file.")
      return
    }
    if (intended === "image" && !file.type.startsWith("image/")) {
      toast.error("Please choose an image file.")
      return
    }
    // General MIME type check — must be video/* or image/*
    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      toast.error("Only image or video files are supported.")
      return
    }

    // Extension/MIME agreement — must use a centralized server-matching allowlist.
    // Keys are lowercase normalised extensions; values are accepted MIME types.
    const ALLOWED: Record<string, string> = {
      ".jpg": "image/jpeg",  ".jpeg": "image/jpeg",
      ".png": "image/png",   ".webp": "image/webp",
      ".gif": "image/gif",
      ".mp4": "video/mp4",   ".webm": "video/webm",  ".mov": "video/quicktime",
    }
    const rawExt  = file.name.includes(".")
      ? ("." + file.name.split(".").pop()!).toLowerCase()
      : ""
    if (!rawExt) {
      toast.error("File must have an extension (e.g. .jpg, .mp4).")
      return
    }
    const expectedMime = ALLOWED[rawExt]
    if (!expectedMime) {
      toast.error(`Unsupported file type "${rawExt}". Accepted: .jpg, .png, .webp, .gif, .mp4, .webm, .mov`)
      return
    }
    if (file.type !== expectedMime) {
      toast.error(`File extension "${rawExt}" does not match its type "${file.type}".`)
      return
    }

    // Size check — must not exceed 5 MB
    const maxBytes = file.type.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    const maxLabel = file.type.startsWith("video/") ? "50 MB" : "5 MB"
    if (file.size > maxBytes) {
      toast.error(`File too large. Maximum ${file.type.startsWith("video/") ? "video" : "image"} size is ${maxLabel}.`)
      return
    }

    // mediaType is already set from the user's explicit selection — do not override it here.
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    setMediaFile(file)
    setPreview(URL.createObjectURL(file))
    setStep("compose")
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!selectedGroupId)
      return "Select a vault to post to."
    if (mediaType !== "text" && !mediaFile)
      return "Add a photo or video first."
    if (mediaType === "text" && !caption.trim())
      return "Write something before sharing."
    if (caption.length > MAX_CAPTION_LEN)
      return `Caption must be ${MAX_CAPTION_LEN} characters or fewer.`
    if (isTimeCapsule && !unlockDate)
      return "Choose an unlock date for the time capsule."
    if (isTimeCapsule && unlockDate && unlockDate <= tomorrowISO) {
      // Belt-and-braces: the date input min already prevents this, but guard anyway
      return "Unlock date must be at least tomorrow."
    }
    return null
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const post = async () => {
    if (posting) return
    const err = validate()
    if (err) { setPostError(err); return }
    setPostError(null); setPosting(true); setUploadProgress(null); abortedRef.current = false
    if (mediaType === "text") {
      try {
        const result = await apiFetch<Post>(`/api/vaults/${selectedGroupId}/posts`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption: caption.trim() || null, media_type: "text",
            unlock_at: isTimeCapsule && unlockDate ? unlockDate : null }),
        })
        if (result.ok) {
          if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); setPreview(null) }
          onPosted(result.data); safeClose()
        }
        else { setPostError(result.error ?? "Something went wrong.") }
      } catch { setPostError("No connection. Check your network.") }
      finally  { setPosting(false) }
    } else {
      const form = new FormData()
      form.append("media", mediaFile!)
      form.append("media_type", mediaType)
      form.append("caption", caption.trim())
      if (isTimeCapsule && unlockDate) form.append("unlock_at", unlockDate)
      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr
      xhr.upload.addEventListener("progress", e => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
      })
      await new Promise<void>(resolve => {
        xhr.onload = () => {
          xhrRef.current = null; setPosting(false); setUploadProgress(null)
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); setPreview(null) }
              onPosted(JSON.parse(xhr.responseText) as Post); safeClose()
            }
            catch { setPostError("Unexpected server response.") }
          } else {
            let msg = "Upload failed. Please try again."
            try { const b = JSON.parse(xhr.responseText); if (typeof b?.error === "string") msg = b.error } catch {}
            setPostError(msg)
          }
          resolve()
        }
        xhr.onerror   = () => {
          xhrRef.current = null; setPosting(false); setUploadProgress(null)
          if (!abortedRef.current) setPostError("Network error. Check your connection.")
          abortedRef.current = false; resolve()
        }
        xhr.ontimeout = () => { xhrRef.current = null; setPosting(false); setUploadProgress(null); setPostError("Upload timed out."); resolve() }
        xhr.timeout = 120_000
        xhr.open("POST", `${API_BASE}/api/vaults/${selectedGroupId}/posts`)
        xhr.setRequestHeader("Authorization", `Bearer ${tok()}`)
        xhr.send(form)
      })
    }
  }

  // ── Change media — go back to pick step ───────────────────────────────────
  const changeMedia = () => {
    cleanupRecorderRef.current?.()
    cleanupCaptureRef.current?.()
    setStep("pick"); setVideoSubStep("choose")
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current) }
    setMediaFile(null); setPreview(null); setUploadProgress(null)
    if (xhrRef.current) { xhrRef.current.abort(); xhrRef.current = null }
  }

  // ── Use captured photo — File from PhotoCapture enters compose flow ────────────
  const handleUseCapturedPhoto = useCallback((file: File) => {
    cleanupCaptureRef.current?.()
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(file)
    setMediaFile(file); setPreview(url); setMediaType("image"); setStep("compose")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Use recorded video — converts File from VideoRecorder into compose flow ────
  const handleUseRecordedVideo = useCallback((file: File) => {
    cleanupRecorderRef.current?.()
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(file)
    setMediaFile(file); setPreview(url); setMediaType("video"); setStep("compose")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop — blocked while submitting */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden
        onClick={safeClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="relative w-full sm:max-w-lg bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-800">
          <h2 id={TITLE_ID} className="text-white font-bold text-lg">New Post</h2>
          <button
            ref={closeRef}
            onClick={safeClose}
            disabled={posting}
            aria-label="Close"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Always-mounted hidden file input — referenced by fileRef from any step */}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={intendedTypeRef.current === "video"
              ? "video/mp4,video/webm,video/quicktime"
              : "image/jpeg,image/png,image/webp,image/gif"}
            aria-label="Select a photo or video"
            onChange={onFile}
          />

          {/* ── Step 1: pick media type ───────────────────────────────────── */}
          {step === "pick" && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm">What are you sharing?</p>
              <div className="grid grid-cols-3 gap-3" role="group" aria-label="Media type">
                {([
                  { type: "video" as const, icon: Video, label: "Video" },
                  { type: "image" as const, icon: Image, label: "Photo" },
                  { type: "text"  as const, icon: Type,  label: "Text"  },
                ]).map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    aria-label={`Share a ${label.toLowerCase()}`}
                    onClick={() => {
                      setMediaType(type)
                      if (type === "text") { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); setMediaFile(null); setPreview(null); setStep("compose") }
                      else if (type === "video") { setMediaType("video"); setVideoSubStep("choose"); setStep("record") }
                      else if (type === "image") { setMediaType("image"); setStep("capture") }
                      else { intendedTypeRef.current = "image"; fileRef.current?.click() }
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 py-5 rounded-2xl border transition-all cursor-pointer min-h-[72px]",
                      mediaType === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-zinc-800 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600 hover:text-white"
                    )}
                  >
                    <Icon className="size-6" />
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 1c: capture photo ───────────────────────────────────── */}
          {step === "capture" && (
            <div className="space-y-4">
              <PhotoCapture
                onUsePhoto={handleUseCapturedPhoto}
                onSwitchToFile={() => {
                  cleanupCaptureRef.current?.()
                  intendedTypeRef.current = "image"
                  setTimeout(() => fileRef.current?.click(), 50)
                }}
                onCleanupRef={fn => { cleanupCaptureRef.current = fn }}
              />
            </div>
          )}

          {/* ── Step 1b: record or choose video file ─────────────────────── */}
          {step === "record" && (
            <div className="space-y-4">
              {videoSubStep === "choose" ? (
                <VideoRecorder
                  onUseVideo={handleUseRecordedVideo}
                  onSwitchToFile={() => {
                    cleanupRecorderRef.current?.()
                    setVideoSubStep("file")
                    intendedTypeRef.current = "video"
                    setTimeout(() => fileRef.current?.click(), 50)
                  }}
                  onCleanupRef={fn => { cleanupRecorderRef.current = fn }}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="text-zinc-400 text-sm">Select a video file from your device.</p>
                  <button onClick={() => { intendedTypeRef.current = "video"; fileRef.current?.click() }}
                    className="text-primary text-sm font-semibold cursor-pointer hover:underline">
                    Browse files
                  </button>
                  <button onClick={() => setVideoSubStep("choose")}
                    className="text-zinc-500 text-xs cursor-pointer hover:text-zinc-300 transition-colors">
                    ← Back
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: compose ──────────────────────────────────────────── */}
          {step === "compose" && (
            <div className="space-y-5">

              {/* Media preview */}
              {mediaPreviewUrl && mediaType === "video" && (
                <video
                  src={mediaPreviewUrl ?? ""}
                  controls
                  playsInline
                  muted
                  className="w-full rounded-2xl max-h-48 object-cover bg-black"
                  aria-label="Video preview"
                />
              )}
              {mediaPreviewUrl && mediaType === "image" && (
                <img
                  src={mediaPreviewUrl ?? ""}
                  className="w-full rounded-2xl max-h-48 object-cover"
                  alt="Preview of selected image"
                />
              )}

              {/* Caption / message */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="upload-caption"
                  className="text-zinc-400 text-xs uppercase tracking-widest font-bold"
                >
                  {mediaType === "text" ? "Your message" : "Caption"}
                </Label>
                <textarea
                  id="upload-caption"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder={mediaType === "text" ? "What do you want to say?" : "Say something…"}
                  maxLength={MAX_CAPTION_LEN}
                  disabled={posting}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white
                             placeholder:text-zinc-500 focus:outline-none focus:border-primary/50 resize-none min-h-[80px]
                             disabled:opacity-50"
                />
                {caption.length > MAX_CAPTION_LEN - 50 && (
                  <p className="text-xs text-right text-zinc-500">
                    {caption.length}/{MAX_CAPTION_LEN}
                  </p>
                )}
              </div>

              {/* Vault selector */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="upload-vault"
                  className="text-zinc-400 text-xs uppercase tracking-widest font-bold"
                >
                  Vault
                </Label>
                {groupsStatus === "error" && groups.length === 0 ? (
                  <p className="text-zinc-500 text-sm">
                    Vault information couldn't be loaded. Close this and try again.
                  </p>
                ) : groupsStatus !== "success" && groups.length === 0 ? (
                  <p className="text-zinc-500 text-sm">Loading vaults…</p>
                ) : groups.length === 0 ? (
                  <p className="text-zinc-500 text-sm">Create a vault first.</p>
                ) : (
                  <select
                    id="upload-vault"
                    value={selectedGroupId}
                    onChange={e => setSelectedGroupId(e.target.value)}
                    disabled={posting}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white
                               focus:outline-none focus:border-primary/50 cursor-pointer disabled:opacity-50"
                  >
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
              </div>

              {/* Time capsule toggle */}
              <button
                aria-pressed={isTimeCapsule}
                aria-label={isTimeCapsule ? "Disable time capsule" : "Enable time capsule"}
                onClick={() => setIsTimeCapsule(t => !t)}
                disabled={posting}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer disabled:opacity-50",
                  isTimeCapsule ? "border-primary/50 bg-primary/10" : "border-zinc-800 bg-zinc-800/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <Clock className={cn("size-4", isTimeCapsule ? "text-primary" : "text-zinc-500")} />
                  <div className="text-left">
                    <p className={cn("text-sm font-semibold", isTimeCapsule ? "text-white" : "text-zinc-400")}>
                      Time Capsule
                    </p>
                    <p className="text-[11px] text-zinc-500">Hide until a future date</p>
                  </div>
                </div>
                <div
                  className={cn(
                    "size-5 rounded-full border-2 flex items-center justify-center transition-all",
                    isTimeCapsule ? "border-primary bg-primary" : "border-zinc-600"
                  )}
                  aria-hidden
                >
                  {isTimeCapsule && <Check className="size-3 text-white" />}
                </div>
              </button>

              {/* Unlock date */}
              {isTimeCapsule && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="upload-unlock-date"
                    className="text-zinc-400 text-xs uppercase tracking-widest font-bold"
                  >
                    Unlock date
                  </Label>
                  <input
                    id="upload-unlock-date"
                    type="date"
                    value={unlockDate}
                    min={tomorrowISO}
                    onChange={e => setUnlockDate(e.target.value)}
                    disabled={posting}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white
                               focus:outline-none focus:border-primary/50 cursor-pointer disabled:opacity-50"
                  />
                </div>
              )}

              {/* Change media link */}
              {mediaType !== "text" && (
                <button
                  onClick={changeMedia}
                  disabled={posting}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  ← Change media
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-zinc-800 space-y-3">
          {/* Inline error — shown above the button so it's visible before submitting */}
          {postError && (
            <p role="alert" className="text-sm text-red-400 text-center leading-snug">
              {postError}
            </p>
          )}
          {step === "pick" ? (
            <Button
              onClick={safeClose}
              aria-label="Cancel and close"
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-12 cursor-pointer"
            >
              Cancel
            </Button>
          ) : (
            <>
              <Button
                onClick={post}
                disabled={posting || !selectedGroupId}
                aria-label={
                  uploadProgress !== null ? `Uploading ${uploadProgress} percent`
                    : posting ? "Posting"
                    : postError ? "Try again"
                    : isTimeCapsule ? "Lock and schedule time capsule"
                    : "Share now"
                }
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-12 cursor-pointer disabled:opacity-50"
              >
                {uploadProgress !== null
                  ? `Uploading… ${uploadProgress}%`
                  : posting ? "Sharing…"
                  : postError ? "Try again"
                  : isTimeCapsule ? "🔒 Lock & Schedule"
                  : "Share Now"}
              </Button>
              {posting && uploadProgress !== null && (
                <button
                  type="button"
                  onClick={cancelUpload}
                  aria-label="Cancel upload"
                  className="text-xs text-zinc-400 hover:text-white cursor-pointer
                             underline underline-offset-2 transition-colors w-full text-center"
                >
                  Cancel upload
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
