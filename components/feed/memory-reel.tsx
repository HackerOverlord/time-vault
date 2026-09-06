"use client"
/**
 * components/feed/memory-reel.tsx — Pass 25B
 *
 * Fullscreen Play Memories reel.  One memory at a time, oldest → newest.
 *
 * Design principles
 * ─────────────────
 * • Pure CSS transitions + Tailwind — no animation library.
 * • prefers-reduced-motion: fades only, no slides.
 * • No autoplay on mount — user must press Play.
 * • Videos: wait for "ended" event before auto-advancing (capped at 30 s).
 * • Music: state/refs wired up; no track bundled — call setMusicSrc() later.
 * • Cleanup: all timers, audio, video paused on unmount/exit.
 * • Locked capsules: only metadata rendered — no caption/media touched.
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react"
import {
  X, ChevronLeft, ChevronRight, Play, Pause,
  Volume2, VolumeX, Maximize2, Heart, MessageCircle, Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { CommentSheet } from "@/components/feed/feed-post"
import type { Post, Comment } from "@/lib/types"

// ── Constants ─────────────────────────────────────────────────────────────────
const PHOTO_TEXT_DURATION_MS  = 5_000   // 5 s for photos and text memories
const VIDEO_MAX_DURATION_MS   = 30_000  // 30 s hard cap on video auto-advance
const TRANSITION_DURATION_MS  = 400     // cross-fade duration (halved with reduced-motion)
const CONTROLS_HIDE_DELAY_MS  = 3_000   // hide controls after 3 s of inactivity

// ── Helpers ───────────────────────────────────────────────────────────────────
function useReducedMotion(): boolean {
  const [pref, setPref] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPref(mq.matches)
    const handler = () => setPref(mq.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  return pref
}

/** Sort posts oldest → newest (same rule as groupByYearMonth). */
function sortChronological(posts: Post[]): Post[] {
  return [...posts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface MemoryReelProps {
  posts:  Post[]
  onExit: () => void
  /** Interaction wiring — same handlers Feed and Timeline already use. */
  currentUserId?:        string
  isVaultOwner?:         boolean
  onLike?:               (id: string) => void
  onDelete?:             (id: string) => void
  onCommentCountChange?: (id: string, delta: number) => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MemoryReel({
  posts, onExit,
  currentUserId, isVaultOwner = false,
  onLike, onDelete, onCommentCountChange,
}: MemoryReelProps) {
  const sorted       = useMemo(() => sortChronological(posts), [posts])
  const reducedMotion = useReducedMotion()

  const [index,      setIndex]      = useState(0)
  const [playing,    setPlaying]    = useState(false)
  const [visible,    setVisible]    = useState(false)   // for cross-fade
  const [showCtrl,   setShowCtrl]   = useState(true)
  const [musicOn,    setMusicOn]    = useState(false)   // off by default

  const videoRef    = useRef<HTMLVideoElement | null>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const ctrlTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playingRef  = useRef(playing)
  playingRef.current = playing

  const current = sorted[index] ?? null

  // ── Comments — opened OVER the reel; the reel stays mounted. ───────────────
  // State is keyed to the currently-shown post and reset on navigation, so
  // index, playback and prev/next controls are all untouched.
  const [showComments,    setShowComments]    = useState(false)
  const [comments,        setComments]        = useState<Comment[]>([])
  const [commentText,     setCommentText]     = useState("")
  const [commentsLoaded,  setCommentsLoaded]  = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const commentBtnRef = useRef<HTMLButtonElement | null>(null)

  // Reset comment state whenever the reel moves to a different memory.
  useEffect(() => {
    setShowComments(false)
    setComments([])
    setCommentText("")
    setCommentsLoaded(false)
  }, [index])

  const loadComments = async () => {
    if (!current || commentsLoaded) return
    setCommentsLoading(true)
    const result = await apiFetch<Comment[]>(`/api/posts/${current.id}/comments`)
    setCommentsLoading(false)
    if (result.ok) { setComments(result.data); setCommentsLoaded(true) }
    else toast.error("Could not load comments")
  }

  const submitComment = async () => {
    if (!current || !commentText.trim() || submitting) return
    setSubmitting(true)
    const result = await apiFetch<Comment>(`/api/posts/${current.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentText }),
    })
    if (result.ok) {
      setComments(prev => [...prev, result.data])
      setCommentText("")
      onCommentCountChange?.(current.id, +1)
    } else {
      toast.error(result.error ?? "Could not post comment")
    }
    setSubmitting(false)
  }

  const deleteComment = async (commentId: string) => {
    if (!current) return
    const result = await apiFetch(`/api/comments/${commentId}`, { method: "DELETE" })
    if (result.ok) {
      setComments(prev => prev.filter(c => c.id !== commentId))
      onCommentCountChange?.(current.id, -1)
    } else {
      toast.error(result.error ?? "Could not delete comment")
    }
  }

  // ── Fade-in on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  // ── Clear advance timer ────────────────────────────────────────────────────
  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }, [])

  // ── Go to specific index ───────────────────────────────────────────────────
  // Manual nav: clears timer, pauses video, stops autoplay
  const goTo = useCallback((nextIdx: number) => {
    clearTimer()
    videoRef.current?.pause()
    setPlaying(false)
    setIndex(Math.max(0, Math.min(nextIdx, sorted.length - 1)))
  }, [sorted.length, clearTimer])

  // Auto nav: same but keeps playing state unchanged
  const autoGoTo = useCallback((nextIdx: number) => {
    clearTimer()
    videoRef.current?.pause()
    setIndex(Math.max(0, Math.min(nextIdx, sorted.length - 1)))
  }, [sorted.length, clearTimer])

  const prev = useCallback(() => goTo(index - 1), [goTo, index])
  const next = useCallback(() => goTo(index + 1), [goTo, index])

  // ── Schedule advance (called after render when playing + correct type) ─────
  const scheduleAdvance = useCallback((ms: number) => {
    clearTimer()
    if (!playingRef.current) return
    timerRef.current = setTimeout(() => {
      setIndex(prev => {
        const next = prev + 1
        if (next >= sorted.length) {
          setPlaying(false)   // end of reel
          return prev
        }
        return next
      })
    }, ms)
  }, [clearTimer, sorted.length])

  // ── When index changes, schedule advance for photos/text ──────────────────
  useEffect(() => {
    clearTimer()
    if (!current || !playing) return
    if (current.is_unlocked && current.media_type === "video") {
      // Video: let videoRef handle advance via "ended" event (see below)
      // but cap at VIDEO_MAX_DURATION_MS
      scheduleAdvance(VIDEO_MAX_DURATION_MS)
    } else {
      scheduleAdvance(PHOTO_TEXT_DURATION_MS)
    }
    return clearTimer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, playing])

  // ── Music: sync with playing state ────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing && musicOn) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [playing, musicOn])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimer()
      if (ctrlTimer.current) clearTimeout(ctrlTimer.current)
      videoRef.current?.pause()
      audioRef.current?.pause()
    }
  }, [clearTimer])

  // ── Keyboard controls ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const target = e.target as Element | null
      if (target?.closest?.("input, textarea, [contenteditable]")) return
      if (e.key === "Escape")      { handleExit(); return }
      if (e.key === "ArrowLeft")   { prev(); return }
      if (e.key === "ArrowRight")  { next(); return }
      if (e.key === " ")           { e.preventDefault(); togglePlay() }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prev, next])

  // ── Auto-hide controls ─────────────────────────────────────────────────────
  const resetCtrlTimer = useCallback(() => {
    setShowCtrl(true)
    if (ctrlTimer.current) clearTimeout(ctrlTimer.current)
    if (playing) {
      ctrlTimer.current = setTimeout(() => setShowCtrl(false), CONTROLS_HIDE_DELAY_MS)
    }
  }, [playing])

  useEffect(() => {
    resetCtrlTimer()
    return () => { if (ctrlTimer.current) clearTimeout(ctrlTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index])

  // ── Exit ──────────────────────────────────────────────────────────────────
  const handleExit = useCallback(() => {
    clearTimer()
    videoRef.current?.pause()
    audioRef.current?.pause()
    setPlaying(false)
    setVisible(false)
    setTimeout(onExit, reducedMotion ? 0 : TRANSITION_DURATION_MS)
  }, [clearTimer, onExit, reducedMotion])

  const togglePlay = useCallback(() => {
    setPlaying(p => !p)
  }, [])

  const toggleMusic = useCallback(() => {
    setMusicOn(m => !m)
    // Require user gesture before audio starts — handled in the effect above
  }, [])

  if (!current) return null

  const isFirst   = index === 0
  const isLast    = index === sorted.length - 1
  const transMs   = reducedMotion ? 0 : TRANSITION_DURATION_MS

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] bg-black flex flex-col",
        "transition-opacity",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ transitionDuration: `${transMs}ms` }}
      role="dialog"
      aria-modal="true"
      aria-label="Memory reel"
      onMouseMove={resetCtrlTimer}
      onTouchStart={resetCtrlTimer}
      onClick={resetCtrlTimer}
    >
      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 flex gap-0.5 px-3 pt-3 z-10 pointer-events-none"
           aria-hidden>
        {sorted.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-0.5 flex-1 rounded-full transition-colors",
              i < index  ? "bg-white/70"
              : i === index ? "bg-white"
              : "bg-white/20",
            )}
          />
        ))}
      </div>

      {/* ── Top controls ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-10 pb-4 z-10",
          "bg-gradient-to-b from-black/70 via-black/20 to-transparent",
          "transition-opacity",
          showCtrl ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        style={{ transitionDuration: `${transMs}ms` }}
      >
        {/* Metadata */}
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">
            {current.vault_name}
          </p>
          <p className="text-white/60 text-xs">
            {formatDate(current.created_at)}
            {current.is_unlocked && current.author_name && ` · ${current.author_name}`}
          </p>
        </div>
        {/* Exit + music */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Music toggle — wired but no track bundled */}
          <button
            onClick={toggleMusic}
            aria-label={musicOn ? "Mute background music" : "Unmute background music"}
            className="size-9 rounded-full bg-black/30 hover:bg-black/50 flex items-center
                       justify-center cursor-pointer transition-colors"
          >
            {musicOn
              ? <Volume2 className="size-4 text-white" />
              : <VolumeX className="size-4 text-white/60" />}
          </button>
          <button
            onClick={handleExit}
            aria-label="Exit memory reel"
            className="size-9 rounded-full bg-black/30 hover:bg-black/50 flex items-center
                       justify-center cursor-pointer transition-colors"
          >
            <X className="size-5 text-white" />
          </button>
        </div>
      </div>

      {/* ── Main memory view — bounded so controls render below it ─────── */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative overflow-hidden">
        <MemorySlide
          post={current}
          playing={playing}
          reducedMotion={reducedMotion}
          videoRef={videoRef}
          onVideoEnded={() => {
            clearTimer()
            if (playingRef.current && !isLast) autoGoTo(index + 1)
            else setPlaying(false)
          }}
        />
        {/* ── Action stack — same hierarchy as Feed ──
             Mute lives in the reel's own control bar, so this group is the
             social family only: heart / comment / delete. Rendered only when
             the parent supplies handlers, so the reel degrades gracefully. */}
        {current.is_unlocked && !showComments && (onLike || onCommentCountChange || onDelete) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-4 z-20
                          lg:right-6 lg:mt-6
                          flex flex-col items-center gap-5 lg:gap-6">
            {onLike && (
              <button
                onClick={() => onLike(current.id)}
                aria-label={current.has_liked ? "Unlike" : "Like"}
                aria-pressed={current.has_liked}
                className="flex flex-col items-center gap-1 cursor-pointer group min-h-11 min-w-11 justify-center
                           rounded-full bg-black/25 hover:bg-black/40 transition-colors py-1.5 px-1.5"
              >
                <Heart className={cn("size-6 transition-colors duration-150 drop-shadow",
                  current.has_liked ? "fill-red-500 text-red-500" : "text-white/90 group-hover:text-white")} />
                {(current.like_count ?? 0) > 0 && (
                  <span className="text-white/80 text-[10px] font-semibold tabular-nums drop-shadow">
                    {current.like_count ?? 0}
                  </span>
                )}
              </button>
            )}

            {onCommentCountChange && (
              <button
                ref={commentBtnRef}
                onClick={() => { setShowComments(true); loadComments() }}
                aria-label="Comments"
                aria-haspopup="dialog"
                className="flex flex-col items-center gap-1 cursor-pointer group min-h-11 min-w-11 justify-center
                           rounded-full bg-black/25 hover:bg-black/40 transition-colors py-1.5 px-1.5"
              >
                <MessageCircle className="size-6 text-white/90 group-hover:text-white transition-colors duration-150 drop-shadow" />
                {(current.comment_count ?? 0) > 0 && (
                  <span className="text-white/80 text-[10px] font-semibold tabular-nums drop-shadow">
                    {current.comment_count ?? 0}
                  </span>
                )}
              </button>
            )}

            {onDelete && (currentUserId === current.author_id || isVaultOwner) && (
              <button
                onClick={() => confirm("Delete this post?") && onDelete(current.id)}
                aria-label="Delete post"
                className="flex min-h-11 min-w-11 items-center justify-center cursor-pointer group
                           rounded-full bg-black/25 hover:bg-black/40 transition-colors p-1.5"
              >
                <Trash2 className="size-6 text-white/50 group-hover:text-red-400 transition-colors duration-150 drop-shadow" />
              </button>
            )}
          </div>
        )}

        {/* Comments — rendered OVER the reel. The reel stays mounted, so
            index, prev/next and playback state are all preserved. */}
        {showComments && current && (
          <CommentSheet
            comments={comments}
            commentsLoading={commentsLoading}
            commentsLoaded={commentsLoaded}
            commentText={commentText}
            submitting={submitting}
            currentUserId={currentUserId}
            isVaultOwner={isVaultOwner}
            commentButtonRef={commentBtnRef}
            onClose={() => setShowComments(false)}
            onChangeText={setCommentText}
            onSubmit={submitComment}
            onDelete={deleteComment}
          />
        )}

        {/* Caption overlay — stays on top of media */}
        {current.is_unlocked && current.caption && (
          <div className="absolute bottom-0 left-0 right-0
                          bg-gradient-to-t from-black/70 via-black/20 to-transparent
                          px-6 pt-10 pb-3 pointer-events-none">
            <p className="text-white/90 text-sm leading-relaxed text-center max-w-lg mx-auto
                          line-clamp-3">
              {current.caption}
            </p>
          </div>
        )}
      </div>

      {/* ── Navigation controls — in normal flow BELOW media, 16px gap ───── */}
      <div
        className={cn(
          "flex flex-col items-center gap-3 px-6 pt-2 pb-10 shrink-0",
          "transition-opacity",
          showCtrl ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        style={{ transitionDuration: `${transMs}ms` }}
      >
        {/* Playback controls */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={prev}
            disabled={isFirst}
            aria-label="Previous memory"
            className="size-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center
                       justify-center cursor-pointer transition-colors disabled:opacity-30
                       disabled:cursor-not-allowed focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <ChevronLeft className="size-6 text-white" />
          </button>

          <button
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            aria-pressed={playing}
            className="size-14 rounded-full bg-white flex items-center justify-center
                       cursor-pointer hover:bg-white/90 transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {playing
              ? <Pause  className="size-7 text-black" />
              : <Play   className="size-7 text-black ml-0.5" />}
          </button>

          <button
            onClick={next}
            disabled={isLast}
            aria-label="Next memory"
            className="size-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center
                       justify-center cursor-pointer transition-colors disabled:opacity-30
                       disabled:cursor-not-allowed focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <ChevronRight className="size-6 text-white" />
          </button>
        </div>

        {/* Counter */}
        <p className="text-white/40 text-xs text-center font-mono">
          {index + 1} / {sorted.length}
        </p>
      </div>

      {/* Hidden audio element — no src until music is added externally */}
      {/* Parent can call audioRef.current?.src = url to add music later */}
      <audio ref={audioRef} loop aria-hidden preload="none" />
    </div>
  )
}

// ── MemorySlide — renders a single memory ────────────────────────────────────

interface MemorySlideProps {
  post:           Post
  playing:        boolean
  reducedMotion:  boolean
  videoRef:       React.RefObject<HTMLVideoElement | null>
  onVideoEnded:   () => void
}

const MemorySlide = React.memo(function MemorySlide({
  post, playing, reducedMotion, videoRef, onVideoEnded,
}: MemorySlideProps) {
  // ── Locked capsule ─────────────────────────────────────────────────────────
  if (!post.is_unlocked) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="size-20 rounded-full bg-white/[0.06] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
               className="size-8 text-white/30" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-white/40 text-sm font-semibold">Locked memory</p>
          <p className="text-white/25 text-xs">
            {post.vault_name} · {new Date(post.created_at).getFullYear()}
          </p>
        </div>
      </div>
    )
  }

  // ── Image ──────────────────────────────────────────────────────────────────
  if (post.media_type === "image" && post.media_url) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Blurred background — same image, low opacity */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.media_url}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-20"
        />
        {/* Main image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.media_url}
          alt={post.caption ?? "Memory photo"}
          className={cn(
            "relative z-10 max-w-full max-h-full object-contain rounded-xl",
            "shadow-2xl",
            !reducedMotion && "transition-transform duration-700 ease-out",
          )}
          style={{ maxHeight: "calc(100vh - 180px)" }}
        />
      </div>
    )
  }

  // ── Video ──────────────────────────────────────────────────────────────────
  if (post.media_type === "video" && post.media_url) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          src={post.media_url}
          preload="metadata"        // load metadata only, not the whole file
          playsInline
          muted={false}
          controls={false}
          aria-label={post.caption ?? "Memory video"}
          className="max-w-full max-h-full rounded-xl object-contain"
          style={{ maxHeight: "calc(100vh - 180px)" }}
          onEnded={onVideoEnded}
        />
        {/* Auto-play/pause the video element with the reel play state */}
        <VideoController
          videoRef={videoRef as React.RefObject<HTMLVideoElement>}
          playing={playing}
        />
      </div>
    )
  }

  // ── Text ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-center w-full h-full px-8 py-16 max-w-lg mx-auto">
      <p className="text-white/90 text-xl md:text-2xl font-light leading-relaxed text-center">
        {post.caption ?? "—"}
      </p>
    </div>
  )
})

// ── VideoController — syncs video play/pause without re-rendering ─────────────
function VideoController({
  videoRef, playing,
}: {
  videoRef: React.RefObject<HTMLVideoElement>
  playing:  boolean
}) {
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (playing) {
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }, [playing, videoRef])
  return null
}
