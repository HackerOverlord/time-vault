"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import {
  Heart, MessageCircle, Trash2, Lock, Play, Pause,
  Volume2, VolumeX, Send, X, ChevronDown, Loader2, Maximize2,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { CapsuleCard } from "@/components/feed/capsule-card"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import type { Post, Comment } from "@/lib/types"

// ─── Props ────────────────────────────────────────────────────────────────────

interface FeedPostProps {
  post: Post
  isActive: boolean
  currentUserId?: string
  isVaultOwner: boolean
  // Controlled mute — owned by FeedScreen so it persists across posts.
  muted: boolean
  onMuteChange: (m: boolean) => void
  // Native <video preload> value forwarded from FeedScreen.
  preload: "auto" | "metadata" | "none"
  onLike: (postId: string) => void
  onDelete: (postId: string) => void
  onCommentCountChange: (postId: string, delta: number) => void
  onArchive?: (postId: string, archive: boolean) => void
  showArchived?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

function FeedPostInner({
  post, isActive, currentUserId, isVaultOwner,
  muted, onMuteChange, preload,
  onLike, onDelete, onCommentCountChange,
  onArchive, showArchived = false,
}: FeedPostProps) {
  // playing: user's intent (true = wants to play).
  // Separate from whether the <video> is actually playing, because autoplay
  // can be deferred by the browser or blocked by reduced-motion.
  const [playing, setPlaying]               = useState(true)
  const [showComments, setShowComments]     = useState(false)
  const [comments, setComments]             = useState<Comment[]>([])
  const [commentText, setCommentText]       = useState("")
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [submitting, setSubmitting]         = useState(false)
  const [captionExpanded, setCaptionExpanded] = useState(false)
  // Buffering indicator: true while the active video is waiting for data.
  const [buffering, setBuffering]           = useState(false)
  // Progress [0,1] — coarse updates via timeupdate.
  const [progress, setProgress]             = useState(0)
  // Ghost label re-fire key.
  const [ghostKey, setGhostKey]             = useState(0)

  // Reactive reduced-motion preference: initialised in useEffect so it is
  // SSR-safe and responds if the user changes their OS setting at runtime.
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const videoRef        = useRef<HTMLVideoElement>(null)
  const loadTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Whether the video was playing before comments opened, so we can resume.
  const wasPlayingRef   = useRef(false)
  // Ref to the comment button so focus returns to it when the sheet closes.
  const commentButtonRef = useRef<HTMLButtonElement>(null)
  // Stable close handler — used by both CommentSheet render paths.
  const handleCloseComments = useCallback(() => {
    setShowComments(false)
    requestAnimationFrame(() => commentButtonRef.current?.focus())
  }, [])

  // ── Ghost label ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isActive) setGhostKey(k => k + 1)
  }, [isActive, post.id])

  // ── Reset per-post transient state when source changes ────────────────────
  useEffect(() => {
    setCaptionExpanded(false)
    setProgress(0)
    setBuffering(false)
    setPlaying(true)   // intent resets: new post should play
  }, [post.id])

  // ── Video playback lifecycle ───────────────────────────────────────────────
  //
  // Rules:
  //  1. Only the active post may play.
  //  2. Off-screen posts always pause.
  //  3. prefers-reduced-motion suppresses autoplay; manual play still works.
  //  4. Comments opening pauses; closing resumes if post is active + was playing.
  //  5. Play-promise rejections are handled silently.
  //
  // reducedMotion added to deps: if user changes OS preference at runtime,
  // the callback re-creates and the useEffect re-runs, pausing the video.
  const applyPlayback = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    const shouldPlay = isActive && playing && !showComments && !reducedMotion
    if (shouldPlay) {
      // Expected failures (AbortError, NotAllowedError) are silently ignored.
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [isActive, playing, showComments, reducedMotion])

  // Run playback rule whenever dependencies change.
  useEffect(() => {
    applyPlayback()
  }, [applyPlayback])

  // ── Comments pause / resume ────────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (showComments) {
      wasPlayingRef.current = !el.paused
      el.pause()
    } else if (wasPlayingRef.current && isActive) {
      el.play().catch(() => {})
    }
  }, [showComments, isActive])

  // ── Native video event listeners ──────────────────────────────────────────
  // Attach/detach when the video element's src changes (post.id changes).
  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    const onWaiting  = () => { if (isActive) setBuffering(true) }
    const onPlaying  = () => setBuffering(false)
    const onCanPlay  = () => setBuffering(false)
    const onPause    = () => setBuffering(false)
    const onEnded    = () => setBuffering(false)
    const onTimeUpdate = () => {
      if (el.duration > 0) {
        // Coarse update: round to nearest 1% to avoid excessive re-renders.
        const pct = Math.round((el.currentTime / el.duration) * 100) / 100
        setProgress(p => Math.abs(p - pct) >= 0.01 ? pct : p)
      }
    }

    el.addEventListener("waiting",    onWaiting)
    el.addEventListener("playing",    onPlaying)
    el.addEventListener("canplay",    onCanPlay)
    el.addEventListener("pause",      onPause)
    el.addEventListener("ended",      onEnded)
    el.addEventListener("timeupdate", onTimeUpdate)

    return () => {
      el.removeEventListener("waiting",    onWaiting)
      el.removeEventListener("playing",    onPlaying)
      el.removeEventListener("canplay",    onCanPlay)
      el.removeEventListener("pause",      onPause)
      el.removeEventListener("ended",      onEnded)
      el.removeEventListener("timeupdate", onTimeUpdate)
    }
  // Re-attach when post changes; isActive is read inside handlers via closure.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id])

  // Clear buffering state when post becomes inactive.
  useEffect(() => {
    if (!isActive) setBuffering(false)
  }, [isActive])

  // ── Comment handlers (behaviour unchanged) ────────────────────────────────

  const loadComments = async () => {
    if (commentsLoaded) return
    loadTimerRef.current = setTimeout(() => setCommentsLoading(true), 150)
    const result = await apiFetch<Comment[]>(`/api/posts/${post.id}/comments`)
    if (loadTimerRef.current) { clearTimeout(loadTimerRef.current); loadTimerRef.current = null }
    setCommentsLoading(false)
    if (result.ok) {
      setComments(result.data)
      setCommentsLoaded(true)
    } else {
      toast.error("Could not load comments")
    }
  }

  const submitComment = async () => {
    if (!commentText.trim() || submitting) return
    setSubmitting(true)
    const result = await apiFetch<Comment>(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentText }),
    })
    if (result.ok) {
      setComments(prev => [...prev, result.data])
      setCommentText("")
      onCommentCountChange(post.id, +1)
    } else {
      toast.error(result.error ?? "Could not post comment")
    }
    setSubmitting(false)
  }

  const deleteComment = async (commentId: string) => {
    const result = await apiFetch(`/api/comments/${commentId}`, { method: "DELETE" })
    if (result.ok) {
      setComments(prev => prev.filter(c => c.id !== commentId))
      onCommentCountChange(post.id, -1)
    } else {
      toast.error(result.error ?? "Could not delete comment")
    }
  }

  // Clean up load-delay timer on unmount.
  useEffect(() => () => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
  }, [])

  const canDeletePost = post.author_id === currentUserId || isVaultOwner
  const canArchive    = !!(onArchive && (post.author_id === currentUserId || isVaultOwner))

  const formattedDate = new Date(post.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })

  const daysUntil = post.unlock_at
    ? Math.ceil((new Date(post.unlock_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCKED CAPSULE — visual unchanged from Pass 2
  // ═══════════════════════════════════════════════════════════════════════════
  // Locked time-capsule: return CapsuleCard placeholder — no content exposed.
  // The API already withholds caption, media, counts, and likes server-side;
  // this client-side guard provides defence-in-depth.
  if (!post.is_unlocked) {
    return <CapsuleCard post={post} className="h-full w-full" />
  }

  if (post.media_type === "text") {
    return (
      <div
        className="h-full w-full relative overflow-hidden flex flex-col"
        style={{
          background:
            "radial-gradient(ellipse 120% 100% at 50% 50%, oklch(0.21 0.02 260) 0%, oklch(0.09 0.015 260) 100%)",
        }}
      >
        <div
          key={ghostKey}
          className="absolute top-24 inset-x-0 flex justify-center pointer-events-none animate-vault-entry"
          aria-hidden
        >
          <span className="text-white/20 text-[10px] font-semibold uppercase tracking-[0.25em]">
            {post.vault_name}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center px-8 py-20">
          <p
            className="text-white text-center leading-relaxed"
            style={{
              fontSize: "clamp(1.25rem, 5vw, 1.875rem)",
              fontWeight: 500,
              textShadow: "0 2px 12px rgba(0,0,0,0.4)",
              letterSpacing: "-0.01em",
            }}
          >
            {post.caption}
          </p>
        </div>
        <div
          className="absolute bottom-0 left-0 right-16 px-5 space-y-3 pb-20 lg:pb-6"
        >
          <div className="flex items-center gap-2.5">
            <Avatar className="size-9 ring-1 ring-white/20 shrink-0">
              <AvatarImage src={post.author_avatar} className="object-cover" />
              <AvatarFallback
                className="text-xs font-bold"
                style={{ background: "oklch(0.65 0.18 240 / 0.3)", color: "oklch(0.65 0.18 240)" }}
              >
                {post.author_name[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white/90 text-[15px] font-semibold leading-tight">
                {post.author_name}
              </p>
              <p className="text-white/30 text-[11px] mt-0.5">{formattedDate}</p>
            </div>
          </div>
        </div>
        <ActionRail
          post={post} canDeletePost={canDeletePost} onLike={onLike}
          canArchive={canArchive} showArchived={showArchived} onArchive={onArchive}
          onOpenComments={() => { setShowComments(true); loadComments() }}
          onDelete={onDelete}
          commentButtonRef={commentButtonRef}
        />
        {showComments && (
          <CommentSheet
            comments={comments} commentsLoading={commentsLoading}
            commentsLoaded={commentsLoaded}
            commentText={commentText} submitting={submitting}
            currentUserId={currentUserId} isVaultOwner={isVaultOwner}
            commentButtonRef={commentButtonRef}
            onClose={handleCloseComments}
            onChangeText={setCommentText}
            onSubmit={submitComment} onDelete={deleteComment}
          />
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA POST (image / video)
  //
  // Required DOM structure (spec):
  //   FeedPostCard (flex-col, h-full, rounded on mobile)
  //     MediaRegion (flex-1, min-h-0, relative)
  //       media (video/img, object-contain mobile / object-cover lg)
  //       scrim overlay
  //       mute button        ← INSIDE card, top-right of media
  //       like button        ← INSIDE card, right side of media
  //       comment button     ← INSIDE card, right side of media
  //       delete button      ← INSIDE card, right side of media
  //       play/pause center  ← INSIDE card, centre of media
  //       buffering spinner  ← INSIDE card, centre of media
  //     MetadataFooter (shrink-0)
  //       avatar, author, vault, date, caption
  //     PlaybackControls (shrink-0, video only)
  //       play/pause, scrubber, timestamp, fullscreen-toggle
  //
  // Media shrinks via flex-1 min-h-0 — footer and playback always get their
  // natural height first; media takes what remains.
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full w-full overflow-hidden rounded-2xl relative
                    lg:h-auto lg:flex lg:flex-col lg:rounded-2xl lg:border lg:border-white/[0.07]"
         style={{ background: "#000" }}>

      {/* ── MediaRegion — fills the entire card (flex-1 removed; card is now h-full) */}
      {/* Metadata overlays over bottom gradient — reclaims footer height for media */}
      {/* Mobile: absolute overlay fills card. Desktop: flex-1 min-h-0. */}
      {/* Mobile: absolute fill of the snap viewport.
          Desktop: static block with 16/10 aspect ratio so the card has natural height. */}
      <div className="absolute inset-0 lg:static lg:relative lg:overflow-hidden lg:aspect-[16/10]">

        {/* Video */}
        {post.media_type === "video" && post.media_url && (
          <video
            ref={videoRef}
            src={post.media_url}
            loop
            muted={muted}
            playsInline
            preload={preload}
            className="absolute inset-0 w-full h-full object-contain lg:object-cover"
            onClick={() => setPlaying(p => !p)}
            aria-label={`${post.author_name}'s video in ${post.vault_name}`}
          />
        )}

        {/* Image */}
        {post.media_type === "image" && post.media_url && (
          <img
            src={post.media_url}
            alt={post.caption ?? `${post.author_name}'s photo in ${post.vault_name}`}
            className="absolute inset-0 w-full h-full object-contain lg:object-cover"
            loading={isActive ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={isActive ? "high" : "low"}
          />
        )}

        {/* Centre tap-to-play/pause */}
        {post.media_type === "video" && (
          <>
            <button
              onClick={() => setPlaying(p => !p)}
              aria-label={playing ? "Pause" : "Play"}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-14 rounded-full bg-black/30
                         flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            >
              {playing ? <Pause className="size-6 text-white" /> : <Play className="size-6 text-white ml-0.5" />}
            </button>

            {reducedMotion && !playing && (
              <button
                onClick={() => setPlaying(true)}
                aria-label="Play"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-14 rounded-full bg-black/40
                           flex items-center justify-center cursor-pointer"
              >
                <Play className="size-6 text-white ml-0.5" />
              </button>
            )}

            {isActive && buffering && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <Loader2 className="size-8 text-white/40 animate-spin" />
              </div>
            )}
          </>
        )}

        {/* Vault ghost label */}
        <div
          key={ghostKey}
          className="absolute top-12 inset-x-0 flex justify-center pointer-events-none animate-vault-entry"
          aria-hidden
        >
          <span className="text-white/25 text-[10px] font-semibold uppercase tracking-[0.25em] text-scrim">
            {post.vault_name}
          </span>
        </div>

        {/* Right-side actions — mobile/tablet only; desktop uses overlay controls */}
        <div className="absolute right-3 top-14 flex flex-col items-center gap-4 lg:hidden">
          {/* Mute — video only */}
          {post.media_type === "video" && (
            <button
              onClick={() => onMuteChange(!muted)}
              aria-label={muted ? "Unmute" : "Mute"}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full
                         bg-black/20 text-white/90 hover:text-white transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
          )}

          {/* Like */}
          <button
            onClick={() => onLike(post.id)}
            aria-label={post.has_liked ? "Unlike" : "Like"}
            aria-pressed={post.has_liked}
            className="flex flex-col items-center gap-1 cursor-pointer group min-h-11 min-w-11 justify-center
                       rounded-full bg-black/20 py-1.5 px-1.5"
          >
            <Heart className={cn("size-6 transition-colors duration-150 drop-shadow",
              post.has_liked ? "fill-red-500 text-red-500" : "text-white/90 group-hover:text-white")} />
            {(post.like_count ?? 0) > 0 && (
              <span className="text-white/80 text-[10px] font-semibold tabular-nums drop-shadow">
                {post.like_count ?? 0}
              </span>
            )}
          </button>

          {/* Comment */}
          <button
            ref={commentButtonRef as React.RefObject<HTMLButtonElement>}
            onClick={() => { setShowComments(true); loadComments() }}
            aria-label="Comments"
            aria-haspopup="dialog"
            className="flex flex-col items-center gap-1 cursor-pointer group min-h-11 min-w-11 justify-center
                       rounded-full bg-black/20 py-1.5 px-1.5"
          >
            <MessageCircle className="size-6 text-white/90 group-hover:text-white transition-colors duration-150 drop-shadow" />
            {(post.comment_count ?? 0) > 0 && (
              <span className="text-white/80 text-[10px] font-semibold tabular-nums drop-shadow">
                {post.comment_count ?? 0}
              </span>
            )}
          </button>

          {/* Delete */}
          {canDeletePost && (
            <button
              onClick={() => confirm("Delete this post?") && onDelete(post.id)}
              aria-label="Delete post"
              className="flex min-h-11 min-w-11 items-center justify-center cursor-pointer group
                         rounded-full bg-black/20 p-1.5"
            >
              <Trash2 className="size-6 text-white/50 group-hover:text-red-400 transition-colors duration-150 drop-shadow" />
            </button>
          )}
        </div>

        {/* ── Bottom gradient overlay — MOBILE ONLY ── */}
        {/* Double-wrapped: outer lg:hidden for CSS, inner is the styled div */}
        <div className="lg:hidden">
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 40%, transparent 100%)" }}
        >
          {/* Metadata */}
          <div className="px-4 pt-8 pb-2 space-y-1">
            <div className="flex items-center gap-2">
              <Avatar className="size-8 ring-1 ring-white/20 shrink-0">
                <AvatarImage src={post.author_avatar} className="object-cover" />
                <AvatarFallback className="text-xs font-bold"
                  style={{ background: "oklch(0.65 0.18 240 / 0.35)", color: "oklch(0.65 0.18 240)" }}>
                  {post.author_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-white text-[13px] font-semibold leading-tight drop-shadow truncate">
                  {post.author_name}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white/60"
                        style={{ background: "rgba(255,255,255,0.10)" }}>
                    {post.vault_name}
                  </span>
                  <span className="text-white/40 text-[10px] drop-shadow">{formattedDate}</span>
                </div>
              </div>
            </div>

            {post.caption && (
              <p className={cn("text-white/85 text-[13px] leading-snug drop-shadow", !captionExpanded && "line-clamp-2")}>
                {post.caption}
                {post.caption.length > 80 && (
                  <button
                    onClick={() => setCaptionExpanded(e => !e)}
                    className="ml-1 text-white/50 text-[11px] font-medium hover:text-white/80 cursor-pointer"
                  >
                    {captionExpanded ? " less" : " more"}
                  </button>
                )}
              </p>
            )}
          </div>

          {/* Playback controls — video only */}
          {post.media_type === "video" && (
            <div className="flex items-center gap-3 px-4 pb-4 pt-1">
              <button
                onClick={() => setPlaying(p => !p)}
                aria-label={playing ? "Pause" : "Play"}
                className="flex items-center justify-center size-8 shrink-0 cursor-pointer"
              >
                {playing
                  ? <Pause className="size-5 text-white/90 drop-shadow" />
                  : <Play className="size-5 text-white/90 drop-shadow ml-0.5" />}
              </button>

              {/* Scrubber */}
              <div className="flex-1 relative h-5 flex items-center cursor-pointer"
                   onClick={e => {
                     const rect = e.currentTarget.getBoundingClientRect()
                     const pct  = (e.clientX - rect.left) / rect.width
                     if (videoRef.current) videoRef.current.currentTime = pct * (videoRef.current.duration || 0)
                   }}>
                <div className="w-full h-[3px] bg-white/25 rounded-full relative">
                  <div className="absolute inset-y-0 left-0 bg-white/80 rounded-full"
                       style={{ width: `${progress * 100}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3 rounded-full bg-white shadow-lg"
                       style={{ left: `${progress * 100}%` }} />
                </div>
              </div>

              {/* Timestamp */}
              {videoRef.current && (
                <span className="text-white/50 text-[10px] tabular-nums shrink-0 drop-shadow">
                  {Math.floor((videoRef.current.currentTime || 0) / 60).toString().padStart(2,"0")}
                  :{Math.floor((videoRef.current.currentTime || 0) % 60).toString().padStart(2,"0")}
                  {" / "}
                  {Math.floor((videoRef.current.duration || 0) / 60).toString().padStart(2,"0")}
                  :{Math.floor((videoRef.current.duration || 0) % 60).toString().padStart(2,"0")}
                </span>
              )}

              {/* Fullscreen */}
              <button
                onClick={() => {
                  const el = videoRef.current
                  if (!el) return
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {})
                  } else if (el.requestFullscreen) {
                    el.requestFullscreen().catch(() => {})
                  } else if ((el as any).webkitEnterFullscreen) {
                    // iOS Safari fallback — native video fullscreen
                    ;(el as any).webkitEnterFullscreen()
                  }
                }}
                aria-label="Fullscreen"
                className="flex items-center justify-center size-9 shrink-0 cursor-pointer"
              >
                <Maximize2 className="size-5 text-white/75 drop-shadow" />
              </button>
            </div>
          )}
        </div>
      </div>
      </div>{/* end mobile-only wrapper */}

      {/* ── Desktop MetadataFooter (hidden on mobile, shown lg+) ───────── */}
      <div className="hidden lg:block shrink-0 px-5 pt-3 pb-2 space-y-1.5"
           style={{ background: "rgba(0,0,0,0.97)" }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="size-9 ring-1 ring-white/20 shrink-0">
            <AvatarImage src={post.author_avatar} className="object-cover" />
            <AvatarFallback className="text-sm font-bold"
              style={{ background: "oklch(0.65 0.18 240 / 0.35)", color: "oklch(0.65 0.18 240)" }}>
              {post.author_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-white text-[14px] font-semibold leading-tight truncate">{post.author_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white/50"
                    style={{ background: "rgba(255,255,255,0.07)" }}>
                {post.vault_name}
              </span>
              <span className="text-white/30 text-[10px]">{formattedDate}</span>
            </div>
          </div>
        </div>
        {post.caption && (
          <p className={cn("text-white/80 text-[13px] leading-snug", !captionExpanded && "line-clamp-2")}>
            {post.caption}
            {post.caption.length > 80 && (
              <button onClick={() => setCaptionExpanded(e => !e)}
                className="ml-1 text-white/40 text-[11px] font-medium hover:text-white/70 cursor-pointer">
                {captionExpanded ? " less" : " more"}
              </button>
            )}
          </p>
        )}
      </div>

      {/* ── Desktop PlaybackControls (hidden on mobile, shown lg+) ──────── */}
      {post.media_type === "video" && (
        <div className="hidden lg:flex shrink-0 items-center gap-3 px-5 pt-1 pb-3"
             style={{ background: "rgba(0,0,0,0.97)" }}>
          <button onClick={() => setPlaying(p => !p)} aria-label={playing ? "Pause" : "Play"}
                  className="flex items-center justify-center size-8 shrink-0 cursor-pointer">
            {playing ? <Pause className="size-5 text-white/80" /> : <Play className="size-5 text-white/80 ml-0.5" />}
          </button>
          <div className="flex-1 relative h-5 flex items-center cursor-pointer"
               onClick={e => {
                 const rect = e.currentTarget.getBoundingClientRect()
                 const pct = (e.clientX - rect.left) / rect.width
                 if (videoRef.current) videoRef.current.currentTime = pct * (videoRef.current.duration || 0)
               }}>
            <div className="w-full h-[3px] bg-white/25 rounded-full relative">
              <div className="absolute inset-y-0 left-0 bg-white/70 rounded-full"
                   style={{ width: `${progress * 100}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3 rounded-full bg-white shadow"
                   style={{ left: `${progress * 100}%` }} />
            </div>
          </div>
          {videoRef.current && (
            <span className="text-white/40 text-[11px] tabular-nums shrink-0">
              {Math.floor((videoRef.current.currentTime || 0) / 60).toString().padStart(2,"00")}
              :{Math.floor((videoRef.current.currentTime || 0) % 60).toString().padStart(2,"00")}
              {" / "}
              {Math.floor((videoRef.current.duration || 0) / 60).toString().padStart(2,"00")}
              :{Math.floor((videoRef.current.duration || 0) % 60).toString().padStart(2,"00")}
            </span>
          )}
        </div>
      )}

      {showComments && (
        <CommentSheet
          comments={comments} commentsLoading={commentsLoading}
          commentsLoaded={commentsLoaded}
          commentText={commentText} submitting={submitting}
          currentUserId={currentUserId} isVaultOwner={isVaultOwner}
          commentButtonRef={commentButtonRef}
          onClose={handleCloseComments}
          onChangeText={setCommentText}
          onSubmit={submitComment} onDelete={deleteComment}
        />
      )}
    </div>
  )
}


/**
 * Memoized export — prevents unnecessary rerenders when unrelated
 * FeedScreen state changes (notifications, search input, etc.).
 * onLike/onDelete/onCommentCountChange accept a postId parameter so
 * FeedScreen passes the same stable function reference to every post.
 */
export const FeedPost = React.memo(FeedPostInner)

// ─── ActionRail — unchanged from Pass 2 ──────────────────────────────────────

interface ActionRailProps {
  post: Post
  canDeletePost: boolean
  onLike: (postId: string) => void
  onOpenComments: () => void
  onDelete: (postId: string) => void
  commentButtonRef: React.RefObject<HTMLButtonElement | null>
  // Pass 23
  canArchive?: boolean
  showArchived?: boolean
  onArchive?: (postId: string, archive: boolean) => void
}

function ActionRail({ post, canDeletePost, onLike, onOpenComments, onDelete, commentButtonRef,
  canArchive = false, showArchived = false, onArchive }: ActionRailProps) {
  return (
    <div
      className="absolute right-3 bottom-4 flex flex-col items-center gap-5"
    >
      <button
        onClick={() => onLike(post.id)}
        aria-label={post.has_liked ? "Unlike" : "Like"}
        aria-pressed={post.has_liked}
        className="flex flex-col items-center gap-1.5 cursor-pointer group min-h-11 min-w-11 justify-center"
      >
        <Heart
          className={cn(
            "size-7 transition-colors duration-150",
            post.has_liked ? "fill-red-500 text-red-500" : "text-white/80 group-hover:text-white"
          )}
        />
        {(post.like_count ?? 0) > 0 && (
          <span className="text-white/70 text-[11px] font-semibold tabular-nums text-scrim">
            {post.like_count ?? 0}
          </span>
        )}
      </button>

      <button
        ref={commentButtonRef as React.RefObject<HTMLButtonElement>}
        onClick={onOpenComments}
        aria-label="Comments"
        aria-haspopup="dialog"
        className="flex flex-col items-center gap-1.5 cursor-pointer group min-h-11 min-w-11 justify-center"
      >
        <MessageCircle className="size-7 text-white/80 group-hover:text-white transition-colors duration-150" />
        {(post.comment_count ?? 0) > 0 && (
          <span className="text-white/70 text-[11px] font-semibold tabular-nums text-scrim">
            {post.comment_count ?? 0}
          </span>
        )}
      </button>

      {canArchive && onArchive && (
        <button
          onClick={() => onArchive(post.id, !showArchived)}
          aria-label={showArchived ? "Restore post" : "Archive post"}
          className="flex flex-col items-center gap-1 cursor-pointer group min-h-11 min-w-11 justify-center"
        >
          <span className="text-white/35 group-hover:text-amber-400 transition-colors duration-150
                           text-lg leading-none select-none">
            {showArchived ? "↩" : "📦"}
          </span>
        </button>
      )}

      {canDeletePost && (
        <button
          onClick={() => confirm("Delete this post?") && onDelete(post.id)}
          aria-label="Delete post"
          className="flex flex-col items-center cursor-pointer group min-h-11 min-w-11 justify-center"
        >
          <Trash2 className="size-6 text-white/35 group-hover:text-red-400 transition-colors duration-150" />
        </button>
      )}
    </div>
  )
}

// ─── CommentSheet — unchanged from Pass 2 ────────────────────────────────────

interface CommentSheetProps {
  comments: Comment[]
  commentsLoading: boolean
  commentsLoaded: boolean
  commentText: string
  submitting: boolean
  currentUserId?: string
  isVaultOwner: boolean
  commentButtonRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
  onChangeText: (v: string) => void
  onSubmit: () => void
  onDelete: (id: string) => void
}

function CommentSheet({
  comments, commentsLoading, commentsLoaded,
  commentText, submitting,
  currentUserId, isVaultOwner,
  commentButtonRef,
  onClose, onChangeText, onSubmit, onDelete,
}: CommentSheetProps) {
  const TITLE_ID      = "comment-sheet-title"
  const inputRef      = useRef<HTMLInputElement>(null)
  const sheetRef      = useRef<HTMLDivElement>(null)
  // Prevents re-focusing on every re-render (e.g. when the user types).
  const hasFocusedRef = useRef(false)

  // Focus the input once after comments load.
  useEffect(() => {
    if (commentsLoaded && !hasFocusedRef.current) {
      hasFocusedRef.current = true
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [commentsLoaded])

  // Also focus immediately on mount when comments were already loaded.
  useEffect(() => {
    if (commentsLoaded && !hasFocusedRef.current) {
      hasFocusedRef.current = true
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keyboard handler: Escape closes the sheet; Tab wraps focus within it.
  useEffect(() => {
    const FOCUSABLE =
      'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),'
      + 'select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return }
      if (e.key !== "Tab" || !sheetRef.current) return

      const nodes = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter(el => !el.closest('[aria-hidden]'))
      if (nodes.length === 0) return

      const first = nodes[0]
      const last  = nodes[nodes.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function relativeTime(iso: string): string {
    const diff  = Date.now() - new Date(iso).getTime()
    const mins  = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days  = Math.floor(diff / 86_400_000)
    if (mins  <  1) return "just now"
    if (mins  < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days  <  7) return `${days}d ago`
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      ref={sheetRef}
      className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl border-t border-white/[0.08]"
      style={{
        maxHeight: "min(85dvh, 85vh)",
        minHeight: "min(55dvh, 55vh)",
        background: "oklch(0.13 0.02 260 / 0.97)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1 shrink-0" aria-hidden>
        <div className="w-9 h-1 rounded-full bg-white/20" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] shrink-0">
        <h3 id={TITLE_ID} className="text-white/90 font-semibold text-[15px]">Comments</h3>
        <button
          onClick={onClose}
          aria-label="Close comments"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-white/40 hover:text-white/80 transition-colors cursor-pointer"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Scrollable list — flex-1 so it fills available space above the input */}
      <div className="flex-1 overflow-y-auto px-5 py-2 min-h-0">
        {commentsLoading ? (
          <div className="flex justify-center py-10">
            <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-10">No comments yet.</p>
        ) : (
          <div className="space-y-5 py-1">
            {comments.map(c => {
              const canDeleteComment = c.author_id === currentUserId || isVaultOwner
              return (
                <div key={c.id} className="flex gap-3 items-start">
                  <Avatar className="size-8 shrink-0 mt-0.5">
                    <AvatarImage src={c.author_avatar} className="object-cover" />
                    <AvatarFallback
                      className="text-xs font-bold"
                      style={{ background: "oklch(0.65 0.18 240 / 0.25)", color: "oklch(0.65 0.18 240)" }}
                    >
                      {c.author_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-white/90 text-[13px] font-semibold leading-snug">{c.author_name}</p>
                      <p className="text-white/25 text-[10px] shrink-0">{relativeTime(c.created_at)}</p>
                    </div>
                    <p className="text-white/75 text-[14px] leading-snug mt-0.5">{c.body}</p>
                  </div>
                  {canDeleteComment && (
                    <button
                      onClick={() => onDelete(c.id)}
                      aria-label={`Delete ${c.author_name}'s comment`}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-white/20 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Input row — shrink-0 keeps it always visible; never scrolls away */}
      <div className="px-4 pt-3 pb-3 border-t border-white/[0.06] flex gap-2.5 shrink-0">
        <input
          ref={inputRef}
          value={commentText}
          onChange={e => onChangeText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) onSubmit() }}
          placeholder="Say something…"
          aria-label="Write a comment"
          className="flex-1 bg-white/[0.07] border border-white/10 text-white/90 placeholder:text-white/30
                     rounded-2xl px-4 h-10 text-[14px] outline-none focus:border-white/25
                     transition-colors min-w-0"
        />
        <button
          onClick={onSubmit}
          disabled={submitting || !commentText.trim()}
          aria-label="Post comment"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-primary
                     hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
        >
          <Send className="size-4 text-white" />
        </button>
      </div>
    </div>
  )
}
