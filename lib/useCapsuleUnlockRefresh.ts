/**
 * useCapsuleUnlockRefresh — Pass 21
 *
 * Schedules a server refresh after the nearest locked capsule's unlock_at
 * time arrives. The refresh callback is provided by the caller (FeedScreen
 * calls fetchAll + cache-clear).
 *
 * Design constraints:
 *   • No local reveal — content withheld until server confirms is_unlocked.
 *   • One timer per render — targets the nearest capsule only.
 *   • Bounded backoff — if the server is still locked, retry at 15 s,
 *     30 s, 60 s, 120 s, 480 s, then stop. Manual refresh still works.
 *   • Timer cleanup — clearTimeout returned from useEffect.
 *   • Changing posts cancels the existing timer and schedules a new one.
 */

import { useEffect, useRef } from "react"
import type { Post } from "@/lib/types"

export const BACKOFF_STEPS = [15_000, 30_000, 60_000, 120_000, 480_000] as const
export const CLOCK_SKEW_BUFFER_MS = 5_000

/**
 * Given a list of posts and the current time, compute what delay (in ms)
 * to wait before calling onRefresh.
 *
 * Returns null when:
 *   • no locked capsules exist (nothing to schedule)
 *   • all retries for the nearest overdue capsule are exhausted
 *
 * Exported for unit testing — callers must not re-implement this logic.
 */
export function computeNextRefreshDelay(
  posts: Pick<Post, "is_unlocked" | "unlock_at">[],
  retryState: Map<string, number>,
  now: number,
): { delayMs: number; nearestKey: string; isOverdue: boolean } | null {
  const locked = posts.filter(p => !p.is_unlocked && p.unlock_at)
  if (locked.length === 0) return null

  const nearestMs = Math.min(...locked.map(p => new Date(p.unlock_at!).getTime()))
  const nearestKey = locked.find(
    p => new Date(p.unlock_at!).getTime() === nearestMs
  )!.unlock_at!

  const rawDelay = nearestMs - now

  if (rawDelay > 0) {
    // Not yet due — fire 5 s after unlock (clock-skew buffer).
    return { delayMs: rawDelay + CLOCK_SKEW_BUFFER_MS, nearestKey, isOverdue: false }
  }

  // Overdue — exponential backoff.
  const prevDelay = retryState.get(nearestKey) ?? 0
  const nextIdx = BACKOFF_STEPS.findIndex(s => s > prevDelay)
  if (nextIdx === -1) return null  // all retries exhausted

  return { delayMs: BACKOFF_STEPS[nextIdx], nearestKey, isOverdue: true }
}

/**
 * React hook used by FeedScreen. Accepts the current posts array and a
 * stable onRefresh callback. Schedules timers automatically; cleans up
 * on unmount and whenever posts changes.
 */
export function useCapsuleUnlockRefresh(
  posts: Post[],
  onRefresh: () => void,
): void {
  // Maps (unlock_at ISO key → last backoff delay used) across renders.
  // useRef so mutations do not trigger re-renders.
  const retryState = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const result = computeNextRefreshDelay(posts, retryState.current, Date.now())

    if (!result) {
      // No locked capsules or retries exhausted.
      if (posts.every(p => p.is_unlocked)) retryState.current.clear()
      return
    }

    const { delayMs, nearestKey, isOverdue } = result

    if (isOverdue) {
      retryState.current.set(nearestKey, delayMs)
    } else {
      retryState.current.delete(nearestKey)  // reset backoff for future-due key
    }

    const id = setTimeout(onRefresh, delayMs)
    return () => clearTimeout(id)
  }, [posts, onRefresh])
}
