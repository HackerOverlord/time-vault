"use client"

/**
 * CapsuleCard — Pass 20
 *
 * Placeholder rendered in the Feed and Timeline for locked time-capsule posts.
 * Shows only: lock icon, author, unlock date, and a countdown.
 * No content, no media, no comments, no likes — enforced server-side too.
 *
 * Countdown updates every minute via setInterval.
 * React.memo prevents re-renders when the surrounding feed updates.
 */

import React, { useState, useEffect, useMemo } from "react"
import { Lock, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCountdown, formatUnlockDate } from "@/lib/countdown"
import type { Post } from "@/lib/types"

interface CapsuleCardProps {
  post: Post
  /** Optional additional class names for layout context (e.g. timeline vs feed). */
  className?: string
}

export const CapsuleCard = React.memo(function CapsuleCard({ post, className }: CapsuleCardProps) {
  const unlockAt      = post.unlock_at!
  const unlockDisplay = useMemo(() => formatUnlockDate(unlockAt), [unlockAt])

  // Countdown refreshes every minute — not every second.
  const [countdown, setCountdown] = useState(() => getCountdown(unlockAt))
  useEffect(() => {
    const tick = () => setCountdown(getCountdown(unlockAt))
    const id   = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [unlockAt])

  return (
    <div
      className={cn(
        "relative h-full w-full flex flex-col items-center justify-center gap-4",
        "bg-gradient-to-br from-zinc-900 to-zinc-950 text-center px-6 select-none",
        className,
      )}
      aria-label={`Locked time capsule by ${post.author_name}. Unlocks ${unlockDisplay}.`}
      role="article"
    >
      {/* Lock icon */}
      <div className="size-16 rounded-full bg-white/[0.06] border border-white/[0.10]
                      flex items-center justify-center mb-1">
        <Lock className="size-7 text-white/40" aria-hidden />
      </div>

      {/* Labels */}
      <div className="space-y-1">
        <p className="text-white/85 font-semibold text-base tracking-tight">
          Time Capsule
        </p>
        <p className="text-white/40 text-sm">
          by {post.author_name}
        </p>
      </div>

      {/* Unlock date */}
      <div className="space-y-0.5">
        <p className="text-white/30 text-xs uppercase tracking-widest font-semibold">
          Unlocks
        </p>
        <p className="text-white/70 text-sm font-medium" aria-hidden>
          {unlockDisplay}
        </p>
      </div>

      {/* Countdown */}
      {!countdown.isPast && (
        <div className="flex items-center gap-1.5 text-white/50 text-xs"
             aria-label={`${countdown.label} remaining`}>
          <Clock className="size-3.5 shrink-0" aria-hidden />
          <span>{countdown.label}</span>
        </div>
      )}
      {countdown.isPast && (
        <p className="text-amber-400/80 text-xs font-medium animate-pulse">
          Unlocking soon…
        </p>
      )}

      {/* Disabled interaction overlay — prevents accidental focus on child content */}
      <div className="absolute inset-0 cursor-default" aria-hidden />
    </div>
  )
})
