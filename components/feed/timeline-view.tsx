"use client"

/**
 * TimelineView — Pass 25A
 *
 * Chronological memory browser ordered oldest → newest,
 * grouped by year then month.
 *
 * Design decisions
 * ─────────────────
 * • groupByYearMonth() from lib/timeline.ts handles all grouping logic.
 * • Compact MemoryCard thumbnails — NOT full-screen FeedPost — keep the
 *   timeline scannable.  Clicking a card opens a FeedPost modal viewer.
 * • Year quick-nav + month sub-nav use scrollIntoView(smooth).
 * • Videos show a play-button overlay; autoplay is never triggered.
 * • Locked capsules render a locked placeholder — no content leaked.
 * • Normal feed (FeedPost snap-scroll) is completely unchanged.
 */

import React, {
  useMemo, useRef, useCallback, useState, useEffect,
} from "react"
import { Calendar, Lock, Play, X, History, Clock, Clapperboard, Image } from "lucide-react"
import { cn } from "@/lib/utils"
import { FeedPost } from "@/components/feed/feed-post"
import { CapsuleCard } from "@/components/feed/capsule-card"
import { MemoryReel } from "@/components/feed/memory-reel"
import {
  groupByYearMonth,
  extractYears,
  getOnThisDayEntries,
  MONTH_SHORT,
} from "@/lib/timeline"
import type { Post } from "@/lib/types"

// ── Props ─────────────────────────────────────────────────────────────────────

interface TimelineViewProps {
  posts:            Post[]
  currentUserId:    string
  isVaultOwner:     boolean
  hasActiveFilter:  boolean
  onLike:           (postId: string) => void
  onDelete:         (postId: string) => void
  onCommentCountChange: (postId: string, delta: number) => void
  onUpload:         () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TimelineView = React.memo(function TimelineView({
  posts,
  currentUserId,
  isVaultOwner,
  hasActiveFilter,
  onLike,
  onDelete,
  onCommentCountChange,
  onUpload,
}: TimelineViewProps) {
  const today       = useMemo(() => new Date(), [])
  const yearGroups  = useMemo(() => groupByYearMonth(posts), [posts])
  const years       = useMemo(() => extractYears(yearGroups), [yearGroups])
  const onThisDay   = useMemo(() => getOnThisDayEntries(posts, today), [posts, today])

  // ── Selected year for month sub-nav ──────────────────────────────────────
  const [activeYear, setActiveYear] = useState<number | null>(null)
  useEffect(() => {
    // Default to the most recent year
    if (years.length > 0) setActiveYear(years[years.length - 1])
  }, [years])

  // ── Viewer modal state ────────────────────────────────────────────────────
  const [viewedPost, setViewedPost] = useState<Post | null>(null)
  const [reelOpen,   setReelOpen]   = useState(false)

  // Playable posts: unlocked + have content. Locked placeholders still
  // appear in the reel (as locked cards) so we include all posts.
  const reelPosts = useMemo(() => posts, [posts])

  // ── Scroll refs: year-key → section element ───────────────────────────────
  const yearRefs  = useRef<Record<string, HTMLElement | null>>({})
  const monthRefs = useRef<Record<string, HTMLElement | null>>({})

  const scrollToYear = useCallback((year: number) => {
    setActiveYear(year)
    yearRefs.current[String(year)]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const scrollToMonth = useCallback((key: string) => {
    monthRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  // ── Empty states ──────────────────────────────────────────────────────────
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20 text-center px-8"
           role="status">
        <Calendar className="size-12 text-white/15" aria-hidden />
        <div className="space-y-2 max-w-xs">
          <p className="text-white/85 font-semibold text-lg">
            {hasActiveFilter ? "No memories match your filter" : "No memories on this timeline yet."}
          </p>
          <p className="text-white/40 text-sm leading-relaxed">
            {hasActiveFilter
              ? "Try clearing the search or media filter."
              : "Your timeline will appear here once you share your first memory."}
          </p>
        </div>
        {!hasActiveFilter && (
          <button
            onClick={onUpload}
            className="bg-primary hover:bg-primary/90 text-white text-sm font-semibold
                       rounded-2xl px-6 h-10 cursor-pointer transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            Share your first memory
          </button>
        )}
      </div>
    )
  }

  // Active year's month group for sub-nav
  const activeYearGroup = yearGroups.find(g => g.year === activeYear)

  return (
    <>
      {/* ── Year quick-nav ─────────────────────────────────────────────────── */}
      {/* ── Play Memories entry ─────────────────────────────────────────── */}
      {posts.length > 0 && (
        <div className="flex justify-end px-4 py-2 border-b border-white/[0.04] shrink-0">
          <button
            onClick={() => setReelOpen(true)}
            aria-label="Play memories as a reel"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                       font-semibold bg-primary/15 hover:bg-primary/25 text-primary
                       cursor-pointer transition-colors shrink-0
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-primary/60"
          >
            <Clapperboard className="size-3.5" />
            Play memories
          </button>
        </div>
      )}

      {years.length > 0 && (
        <nav aria-label="Jump to year"
             className="flex gap-1 px-4 py-2 overflow-x-auto border-b border-white/[0.06]
                        shrink-0"
             style={{ scrollbarWidth: "none" }}>
          {years.map(year => (
            <button
              key={year}
              onClick={() => scrollToYear(year)}
              aria-current={activeYear === year ? "true" : undefined}
              className={cn(
                "shrink-0 text-sm font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                activeYear === year
                  ? "bg-primary/20 text-primary"
                  : "text-white/40 hover:text-white/80 hover:bg-white/[0.06]"
              )}
            >
              {year}
            </button>
          ))}
        </nav>
      )}

      {/* ── Month sub-nav (for the active year) ─────────────────────────────── */}
      {activeYearGroup && activeYearGroup.months.length > 1 && (
        <nav aria-label={`Months in ${activeYear}`}
             className="flex gap-1 px-4 py-1.5 overflow-x-auto border-b border-white/[0.04]
                        shrink-0"
             style={{ scrollbarWidth: "none" }}>
          {activeYearGroup.months.map(mg => (
            <button
              key={mg.key}
              onClick={() => scrollToMonth(mg.key)}
              className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full
                         text-white/35 hover:text-white/70 hover:bg-white/[0.05]
                         transition-colors cursor-pointer
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              {MONTH_SHORT[mg.month]}
            </button>
          ))}
        </nav>
      )}

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <div className="overflow-y-auto flex-1 pb-24 lg:pb-24" style={{ scrollbarWidth: "thin", paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}>

        {/* ── On This Day ─────────────────────────────────────────────────── */}
        {onThisDay.length > 0 && (
          <section aria-label="On This Day" className="px-4 pt-5 pb-2">
            <header className="flex items-center gap-2 mb-3">
              <History className="size-4 text-amber-400" aria-hidden />
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                On This Day
              </h2>
            </header>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {onThisDay.map(({ post, label }) => (
                <div key={post.id} className="relative shrink-0 w-32">
                  <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1
                                  bg-black/60 text-amber-300 text-[9px] font-semibold
                                  px-1.5 py-0.5 rounded-full backdrop-blur-sm"
                       aria-label={label}>
                    <Clock className="size-2.5" aria-hidden />
                    {label}
                  </div>
                  <MemoryCard post={post} onClick={() => setViewedPost(post)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Year/Month groups ────────────────────────────────────────────── */}
        <div className="px-4 pt-5 space-y-10">
          {yearGroups.map(yg => (
            <section
              key={yg.year}
              aria-label={String(yg.year)}
              ref={el => { yearRefs.current[String(yg.year)] = el }}
            >
              {/* Year heading */}
              <div className="sticky top-0 z-20 -mx-4 px-4 py-2 mb-4"
                   style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}
                   onClick={() => setActiveYear(yg.year)}>
                <h2 className="text-2xl font-black text-white/90 tracking-tight">
                  {yg.year}
                </h2>
              </div>

              {/* Month groups */}
              <div className="space-y-8">
                {yg.months.map(mg => (
                  <section
                    key={mg.key}
                    aria-label={`${mg.label} ${yg.year}`}
                    ref={el => { monthRefs.current[mg.key] = el }}
                  >
                    <h3 className="text-sm font-semibold text-white/50 uppercase
                                   tracking-widest mb-3 ml-0.5">
                      {mg.label}
                    </h3>

                    {/* Memory card grid: 2 cols mobile, 3–4 cols desktop */}
                    <div className="grid grid-cols-3 gap-2">
                      {mg.posts.map(post => (
                        <MemoryCard
                          key={post.id}
                          post={post}
                          onClick={() => post.is_unlocked ? setViewedPost(post) : undefined}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* ── Viewer modal ─────────────────────────────────────────────────────── */}
      {reelOpen && (
        <MemoryReel
          posts={reelPosts}
          onExit={() => setReelOpen(false)}
        />
      )}

      {viewedPost && (
        <MemoryViewer
          post={viewedPost}
          currentUserId={currentUserId}
          isVaultOwner={isVaultOwner}
          onLike={onLike}
          onDelete={postId => { onDelete(postId); setViewedPost(null) }}
          onCommentCountChange={onCommentCountChange}
          onClose={() => setViewedPost(null)}
        />
      )}
    </>
  )
})

// ── Compact memory card ───────────────────────────────────────────────────────
// Square thumbnail grid cell — no autoplay, no full FeedPost overhead.

interface MemoryCardProps {
  post:    Post
  onClick: () => void
}

const MemoryCard = React.memo(function MemoryCard({ post, onClick }: MemoryCardProps) {
  const date = new Date(post.created_at).toLocaleDateString(undefined, {
    month: "short", day: "numeric",
  })

  // ── Locked capsule ────────────────────────────────────────────────────────
  if (!post.is_unlocked) {
    return (
      <div
        className="relative rounded-2xl overflow-hidden
                   border border-white/[0.08] bg-zinc-900/60
                   flex flex-col items-center justify-center gap-2 text-center p-3"
        style={{ aspectRatio: "4/3" }}
        role="img"
        aria-label="Locked time capsule"
      >
        <Lock className="size-5 text-white/25" aria-hidden />
        <p className="text-[9px] text-white/40 font-semibold leading-tight">{post.vault_name}</p>
        {post.author_name && (
          <p className="text-[8px] text-white/25 leading-tight">{post.author_name}</p>
        )}
        <p className="text-[8px] text-white/20 leading-tight font-mono">{date}</p>
      </div>
    )
  }

  // ── Image memory ──────────────────────────────────────────────────────────
  if (post.media_type === "image" && post.media_url) {
    return (
      <button
        onClick={onClick}
        className="relative rounded-2xl overflow-hidden
                   border border-white/[0.06] bg-zinc-900 cursor-pointer group
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        style={{ aspectRatio: "4/3" }}
        aria-label={post.caption ?? `Photo from ${date}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.media_url}
          alt={post.caption ?? "Memory photo"}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={e => {
            const el = e.currentTarget as HTMLImageElement
            el.style.display = "none"
            el.nextElementSibling?.classList.remove("hidden")
          }}
        />
        {/* Error fallback — hidden until img onError fires */}
        <div className="hidden w-full h-full flex-col items-center justify-center gap-1 p-3 bg-zinc-900">
          <Image className="size-5 text-white/20" aria-hidden />
          <p className="text-white/30 text-[9px] text-center line-clamp-2">{post.caption}</p>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 pointer-events-none">
          {post.caption && (
            <p className="text-white text-[9px] font-medium leading-tight line-clamp-2 mb-0.5">
              {post.caption}
            </p>
          )}
          <p className="text-white/50 text-[8px] font-mono">
            {post.author_name} · {date}
          </p>
        </div>
      </button>
    )
  }

  // ── Video memory ──────────────────────────────────────────────────────────
  if (post.media_type === "video") {
    return (
      <button
        onClick={onClick}
        className="relative rounded-2xl overflow-hidden
                   border border-white/[0.06] bg-zinc-900 cursor-pointer group
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        style={{ aspectRatio: "4/3" }}
        aria-label={post.caption ?? `Video from ${date}`}
      >
        {/* Video: preload=metadata loads first frame on most browsers */}
        {post.media_url ? (
          <video
            src={post.media_url}
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
            aria-hidden
          />
        ) : (
          /* No URL — show an informative placeholder */
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5
                          bg-zinc-900 p-3 text-center">
            <Play className="size-6 text-white/20" aria-hidden />
            {post.caption && (
              <p className="text-white/50 text-[9px] leading-tight line-clamp-3">{post.caption}</p>
            )}
            <p className="text-white/25 text-[8px] font-mono">{date}</p>
          </div>
        )}
        {/* Play overlay — lighter so frame shows through */}
        {post.media_url && (
          <div className="absolute inset-0 flex items-center justify-center
                          bg-black/20 group-hover:bg-black/10 transition-colors">
            <div className="size-9 rounded-full bg-black/50 backdrop-blur-sm
                            flex items-center justify-center">
              <Play className="size-3.5 text-white fill-white ml-0.5" aria-hidden />
            </div>
          </div>
        )}
        {/* Gradient + metadata overlay */}
        {post.media_url && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent
                          pointer-events-none" />
        )}
        <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 pointer-events-none">
          {post.caption && (
            <p className="text-white text-[9px] font-medium leading-tight line-clamp-2 mb-0.5">
              {post.caption}
            </p>
          )}
          <p className="text-white/50 text-[8px] font-mono">
            {post.author_name} · {date}
          </p>
        </div>
      </button>
    )
  }

  // ── Text memory ───────────────────────────────────────────────────────────
  return (
    <button
      onClick={onClick}
      className="relative rounded-2xl overflow-hidden border border-white/[0.06]
                 bg-zinc-900/80 p-3 cursor-pointer group text-left
                 hover:bg-zinc-800/80 transition-colors flex flex-col justify-between
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      style={{ aspectRatio: "4/3" }}
      aria-label={post.caption ?? `Text memory from ${date}`}
    >
      <p className="text-white/85 text-[11px] leading-relaxed line-clamp-5 group-hover:text-white
                    transition-colors flex-1">
        {post.caption ?? "—"}
      </p>
      <p className="text-white/30 text-[8px] font-mono mt-2 shrink-0">
        {post.author_name} · {date}
      </p>
    </button>
  )
})

// ── Full-screen memory viewer ─────────────────────────────────────────────────
// Opens a clicked timeline card in a modal using the existing FeedPost component.
// All interactions (like/comment/delete/archive) flow back to the parent.

interface MemoryViewerProps {
  post:            Post
  currentUserId:   string
  isVaultOwner:    boolean
  onLike:          (id: string) => void
  onDelete:        (id: string) => void
  onCommentCountChange: (id: string, delta: number) => void
  onClose:         () => void
}

function MemoryViewer({
  post, currentUserId, isVaultOwner,
  onLike, onDelete, onCommentCountChange,
  onClose,
}: MemoryViewerProps) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Memory viewer"
    >
      {/* Close button */}
      <div className="flex justify-end p-3 shrink-0">
        <button
          onClick={onClose}
          aria-label="Close memory viewer"
          className="size-10 rounded-full bg-white/[0.08] hover:bg-white/15
                     flex items-center justify-center cursor-pointer transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <X className="size-5 text-white/70" />
        </button>
      </div>

      {/* FeedPost in "active" mode — enables media playback, likes, comments */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto">
          <FeedPost
            post={post}
            isActive={true}
            currentUserId={currentUserId}
            isVaultOwner={isVaultOwner}
            muted={false}
            onMuteChange={() => {}}
            preload="auto"
            onLike={onLike}
            onDelete={onDelete}
            onCommentCountChange={onCommentCountChange}
          />
        </div>
      </div>
    </div>
  )
}
