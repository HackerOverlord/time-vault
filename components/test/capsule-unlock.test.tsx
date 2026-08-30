/**
 * Pass 21 — capsule unlock scheduling tests.
 *
 * Tests exercise the PRODUCTION hook (useCapsuleUnlockRefresh) and its
 * exported helper (computeNextRefreshDelay) — no logic is re-implemented
 * inside the test file.
 *
 * Timer tests use vi.useFakeTimers() and renderHook.
 * Integration test uses the FeedScreen stub path.
 */
import React, { useCallback, useState } from 'react'
import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest'
import { renderHook, act, render, screen, waitFor } from '@testing-library/react'

// ── Import the PRODUCTION implementations ────────────────────────────────────
import {
  useCapsuleUnlockRefresh,
  computeNextRefreshDelay,
  BACKOFF_STEPS,
  CLOCK_SKEW_BUFFER_MS,
} from '@/lib/useCapsuleUnlockRefresh'
import type { Post } from '@/lib/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────
function lockPost(unlockAt: string): Post {
  return {
    id: 'cap1', author_name: 'Alice', author_id: 'u1', author_avatar: '',
    vault_id: 'v1', vault_name: 'V',
    unlock_at: unlockAt, is_unlocked: false,
    created_at: '2026-01-01T00:00:00Z',
  }
}

function unlockPost(unlockAt: string): Post {
  return {
    ...lockPost(unlockAt),
    caption: 'The memory', media_type: 'text',
    is_unlocked: true,
    like_count: 0, comment_count: 0, has_liked: false,
    posted_at: unlockAt,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// computeNextRefreshDelay — pure-function unit tests
// (no timers, no rendering)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeNextRefreshDelay — production scheduling algorithm', () => {
  const NOW = 1_000_000_000

  it('returns null when there are no locked posts', () => {
    const result = computeNextRefreshDelay([], new Map(), NOW)
    expect(result).toBeNull()
  })

  it('returns null when all posts are unlocked', () => {
    const result = computeNextRefreshDelay([unlockPost(new Date(NOW - 1).toISOString())],
      new Map(), NOW)
    expect(result).toBeNull()
  })

  it('schedules at unlock + CLOCK_SKEW_BUFFER_MS when not yet due', () => {
    const unlockMs = NOW + 60_000
    const result = computeNextRefreshDelay(
      [lockPost(new Date(unlockMs).toISOString())], new Map(), NOW
    )
    expect(result).not.toBeNull()
    expect(result!.delayMs).toBe(60_000 + CLOCK_SKEW_BUFFER_MS)
    expect(result!.isOverdue).toBe(false)
  })

  it('uses first BACKOFF_STEPS value when overdue with no previous retry', () => {
    const unlockMs = NOW - 1_000  // 1 s overdue
    const result = computeNextRefreshDelay(
      [lockPost(new Date(unlockMs).toISOString())], new Map(), NOW
    )
    expect(result!.delayMs).toBe(BACKOFF_STEPS[0])
    expect(result!.isOverdue).toBe(true)
  })

  it('advances to next backoff step on repeated overdue retries', () => {
    const unlockMs = NOW - 1_000
    const key = new Date(unlockMs).toISOString()
    const retryState = new Map([[key, BACKOFF_STEPS[0]]])
    const result = computeNextRefreshDelay(
      [lockPost(key)], retryState, NOW
    )
    expect(result!.delayMs).toBe(BACKOFF_STEPS[1])
  })

  it('returns null when all backoff steps are exhausted', () => {
    const unlockMs = NOW - 1_000
    const key = new Date(unlockMs).toISOString()
    const lastStep = BACKOFF_STEPS[BACKOFF_STEPS.length - 1]
    const retryState = new Map([[key, lastStep]])
    const result = computeNextRefreshDelay([lockPost(key)], retryState, NOW)
    expect(result).toBeNull()
  })

  it('targets the nearest capsule when multiple are locked', () => {
    const nearMs  = NOW + 10_000
    const farMs   = NOW + 100_000
    const result = computeNextRefreshDelay(
      [
        lockPost(new Date(farMs).toISOString()),
        lockPost(new Date(nearMs).toISOString()),
      ],
      new Map(), NOW
    )
    expect(result!.delayMs).toBe(10_000 + CLOCK_SKEW_BUFFER_MS)
  })

  it('resets backoff key when capsule becomes not-yet-due (future re-lock)', () => {
    const unlockMs = NOW + 30_000
    const key = new Date(unlockMs).toISOString()
    // Simulate a stale retry entry from when this was overdue
    const retryState = new Map([[key, BACKOFF_STEPS[2]]])
    const result = computeNextRefreshDelay([lockPost(key)], retryState, NOW)
    // Future capsule ignores the retry state
    expect(result!.isOverdue).toBe(false)
    expect(result!.delayMs).toBe(30_000 + CLOCK_SKEW_BUFFER_MS)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// useCapsuleUnlockRefresh — hook tests with fake timers
// ─────────────────────────────────────────────────────────────────────────────

describe('useCapsuleUnlockRefresh — real hook, fake timers', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  function makeHook(posts: Post[], onRefresh = vi.fn()) {
    return renderHook(
      ({ p, cb }) => useCapsuleUnlockRefresh(p, cb),
      { initialProps: { p: posts, cb: onRefresh } }
    )
  }

  it('does not call onRefresh before unlock_at', () => {
    const onRefresh = vi.fn()
    const unlockAt = new Date(Date.now() + 60_000).toISOString()
    makeHook([lockPost(unlockAt)], onRefresh)

    // Advance 30 s — still before unlock + buffer
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('calls onRefresh after unlock_at + buffer elapses', () => {
    const onRefresh = vi.fn()
    const unlockAt = new Date(Date.now() + 10_000).toISOString()
    makeHook([lockPost(unlockAt)], onRefresh)

    // Advance past 10 s + 5 s buffer
    act(() => { vi.advanceTimersByTime(16_000) })
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not fire immediately for overdue capsule (first backoff = 15 s)', () => {
    const onRefresh = vi.fn()
    const unlockAt = new Date(Date.now() - 1_000).toISOString()  // 1 s overdue
    makeHook([lockPost(unlockAt)], onRefresh)

    // Advance only 5 s — less than first backoff step (15 s)
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('fires after first backoff delay for overdue capsule', () => {
    const onRefresh = vi.fn()
    const unlockAt = new Date(Date.now() - 1_000).toISOString()
    makeHook([lockPost(unlockAt)], onRefresh)

    act(() => { vi.advanceTimersByTime(BACKOFF_STEPS[0] + 100) })
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('cancels timer on unmount — no call after unmount', () => {
    const onRefresh = vi.fn()
    const unlockAt = new Date(Date.now() + 30_000).toISOString()
    const { unmount } = makeHook([lockPost(unlockAt)], onRefresh)

    unmount()

    act(() => { vi.advanceTimersByTime(40_000) })
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('cancels old timer and schedules new one when posts changes', () => {
    const onRefresh = vi.fn()
    const farUnlock  = new Date(Date.now() + 60_000).toISOString()
    const nearUnlock = new Date(Date.now() + 10_000).toISOString()

    const { rerender } = makeHook([lockPost(farUnlock)], onRefresh)

    // Switch to a nearer capsule — should cancel the far timer and set a near one
    rerender({ p: [lockPost(nearUnlock)], cb: onRefresh })

    // At 55 s the original far timer would have fired — it must not
    act(() => { vi.advanceTimersByTime(55_000) })
    // Near timer fires at ~15 s, far timer was cancelled
    // So onRefresh was called once (near) not twice
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not call onRefresh when there are no locked posts', () => {
    const onRefresh = vi.fn()
    makeHook([], onRefresh)
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('targets the nearest capsule among multiple locked posts', () => {
    const onRefresh = vi.fn()
    const nearUnlock = new Date(Date.now() + 10_000).toISOString()
    const farUnlock  = new Date(Date.now() + 90_000).toISOString()
    makeHook([lockPost(farUnlock), lockPost(nearUnlock)], onRefresh)

    // Only the near timer should fire at 15 s
    act(() => { vi.advanceTimersByTime(16_000) })
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('stops scheduling after all backoff steps are exhausted', () => {
    const onRefresh = vi.fn()
    const unlockAt = new Date(Date.now() - 1_000).toISOString()
    const { rerender } = makeHook([lockPost(unlockAt)], onRefresh)

    // Exhaust all backoff steps by re-rendering with the still-locked post each time
    let totalMs = 0
    for (const step of BACKOFF_STEPS) {
      act(() => { vi.advanceTimersByTime(step + 100) })
      totalMs += step + 100
      // Re-render as if the server came back still locked
      rerender({ p: [lockPost(unlockAt)], cb: onRefresh })
    }

    const callsAfterExhaustion = onRefresh.mock.calls.length

    // Advance another large interval — no more timers should fire
    act(() => { vi.advanceTimersByTime(600_000) })
    expect(onRefresh.mock.calls.length).toBe(callsAfterExhaustion)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: FeedScreen stub — unlock transition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal harness that uses the real useCapsuleUnlockRefresh hook and
 * simulates what FeedScreen does:
 *   1. Start with a locked post.
 *   2. The hook schedules a refresh.
 *   3. The refresh returns an unlocked post from the "server".
 *   4. The unlocked post content appears — not before.
 */
function FeedHarness({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState(initialPosts)

  const onRefresh = useCallback(() => {
    // Simulate API returning unlocked post
    setPosts(prev => prev.map(p =>
      p.unlock_at ? unlockPost(p.unlock_at) : p
    ))
  }, [])

  useCapsuleUnlockRefresh(posts, onRefresh)

  return (
    <div>
      {posts.map(p =>
        p.is_unlocked
          ? <div key={p.id} data-testid="post-content">{p.caption}</div>
          : <div key={p.id} data-testid="locked-placeholder">Locked</div>
      )}
    </div>
  )
}

describe('useCapsuleUnlockRefresh — UI unlock transition', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('renders locked placeholder initially, reveals content after server refresh', async () => {
    const unlockAt = new Date(Date.now() + 10_000).toISOString()
    render(<FeedHarness initialPosts={[lockPost(unlockAt)]} />)

    // Initially locked
    expect(screen.getByTestId('locked-placeholder')).toBeInTheDocument()
    expect(screen.queryByTestId('post-content')).not.toBeInTheDocument()

    // Advance past unlock + buffer, then flush React state updates
    await act(async () => { vi.advanceTimersByTime(16_000) })

    // After server refresh (onRefresh called synchronously in FeedHarness),
    // state should be updated
    expect(screen.queryByTestId('locked-placeholder')).not.toBeInTheDocument()
    expect(screen.getByTestId('post-content')).toHaveTextContent('The memory')
  })

  it('advancing timer alone does not reveal content when server stays locked', () => {
    const unlockAt = new Date(Date.now() + 10_000).toISOString()

    // Override onRefresh so it does NOT unlock (simulates server still locked)
    function StillLockedHarness() {
      const [posts, setPosts] = useState([lockPost(unlockAt)])
      const onRefresh = useCallback(() => {
        // Server still returns locked — do NOT change is_unlocked
        setPosts(prev => [...prev])  // same data, just re-set
      }, [])
      useCapsuleUnlockRefresh(posts, onRefresh)
      return (
        <div>
          {posts.map(p =>
            p.is_unlocked
              ? <div key={p.id} data-testid="post-content">{p.caption}</div>
              : <div key={p.id} data-testid="locked-placeholder">Locked</div>
          )}
        </div>
      )
    }

    render(<StillLockedHarness />)

    act(() => { vi.advanceTimersByTime(60_000) })

    // Placeholder should persist — server never confirmed unlock
    expect(screen.getByTestId('locked-placeholder')).toBeInTheDocument()
    expect(screen.queryByTestId('post-content')).not.toBeInTheDocument()
  })
})
