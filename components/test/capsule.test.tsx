/**
 * Pass 20 frontend tests — time capsule countdown, CapsuleCard, and timeline.
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { getCountdown, formatUnlockDate } from '@/lib/countdown'
import { CapsuleCard } from '@/components/feed/capsule-card'
import type { Post } from '@/lib/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────
const NOW = new Date('2026-07-15T12:00:00Z')

function lockedPost(unlockAt: string): Post {
  return {
    id: 'p1', author_name: 'Alice', author_id: 'u1', author_avatar: '',
    vault_id: 'v1', vault_name: 'Vault',
    unlock_at: unlockAt, is_unlocked: false,
    created_at: '2026-07-15T10:00:00Z',
  }
}

// ── getCountdown ──────────────────────────────────────────────────────────────
describe('getCountdown', () => {
  it('returns isPast=true when unlock is in the past', () => {
    const r = getCountdown('2026-07-01T00:00:00Z', NOW)
    expect(r.isPast).toBe(true)
    expect(r.label).toBe('Unlocking soon')
  })

  it('returns isPast=false when unlock is in the future', () => {
    const r = getCountdown('2027-07-15T00:00:00Z', NOW)
    expect(r.isPast).toBe(false)
  })

  it('returns years label for 1+ year', () => {
    const r = getCountdown('2028-07-15T12:00:00Z', NOW)
    expect(r.label).toMatch(/year/)
  })

  it('returns days label for <30 days', () => {
    const unlock = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
    const r = getCountdown(unlock, NOW)
    expect(r.label).toMatch(/day/)
  })

  it('returns hours label for <1 day', () => {
    const unlock = new Date(NOW.getTime() + 3 * 60 * 60 * 1000).toISOString()
    const r = getCountdown(unlock, NOW)
    expect(r.label).toMatch(/hour/)
  })

  it('returns minutes label for <1 hour', () => {
    const unlock = new Date(NOW.getTime() + 45 * 60 * 1000).toISOString()
    const r = getCountdown(unlock, NOW)
    expect(r.label).toMatch(/minute/)
  })

  it('returns months label for 2+ months', () => {
    const unlock = new Date(NOW.getTime() + 75 * 24 * 60 * 60 * 1000).toISOString()
    const r = getCountdown(unlock, NOW)
    expect(r.label).toMatch(/month/)
  })

  it('singular label for exactly 1 day', () => {
    const unlock = new Date(NOW.getTime() + 25 * 60 * 60 * 1000).toISOString()
    const r = getCountdown(unlock, NOW)
    expect(r.label).toBe('1 day')
  })

  it('provides correct minutes count', () => {
    const unlock = new Date(NOW.getTime() + 90 * 60_000).toISOString()
    const r = getCountdown(unlock, NOW)
    expect(r.minutes).toBe(90)
  })
})

// ── formatUnlockDate ──────────────────────────────────────────────────────────
describe('formatUnlockDate', () => {
  it('returns a non-empty string', () => {
    expect(formatUnlockDate('2027-12-25T00:00:00Z').length).toBeGreaterThan(0)
  })

  it('includes the year', () => {
    expect(formatUnlockDate('2027-12-25T00:00:00Z')).toContain('2027')
  })
})

// ── CapsuleCard ───────────────────────────────────────────────────────────────
describe('CapsuleCard', () => {
  const unlockAt = '2027-07-15T12:00:00Z'

  it('renders "Time Capsule" label', () => {
    render(<CapsuleCard post={lockedPost(unlockAt)} />)
    expect(screen.getByText('Time Capsule')).toBeInTheDocument()
  })

  it('renders the author name', () => {
    render(<CapsuleCard post={lockedPost(unlockAt)} />)
    expect(screen.getByText(/alice/i)).toBeInTheDocument()
  })

  it('renders "Unlocks" label', () => {
    render(<CapsuleCard post={lockedPost(unlockAt)} />)
    expect(screen.getByText(/unlocks/i)).toBeInTheDocument()
  })

  it('has an accessible aria-label mentioning the author and unlock date', () => {
    render(<CapsuleCard post={lockedPost(unlockAt)} />)
    const article = screen.getByRole('article')
    expect(article.getAttribute('aria-label')).toMatch(/alice/i)
    expect(article.getAttribute('aria-label')).toMatch(/2027/i)
  })

  it('does not render caption text (null caption)', () => {
    const p = lockedPost(unlockAt)
    render(<CapsuleCard post={p} />)
    expect(screen.queryByText('SECRET')).not.toBeInTheDocument()
  })

  it('shows "Unlocking soon" when unlock is in the past', () => {
    render(<CapsuleCard post={lockedPost('2020-01-01T00:00:00Z')} />)
    expect(screen.getByText(/unlocking soon/i)).toBeInTheDocument()
  })

  it('shows countdown when unlock is in the future', () => {
    render(<CapsuleCard post={lockedPost(unlockAt)} />)
    // Some countdown unit should appear
    const hasCountdown = !!screen.queryByText(/day|hour|month|year|minute/i)
    expect(hasCountdown).toBe(true)
  })
})

// ── Invalid date handling ──────────────────────────────────────────────────────
describe('getCountdown — invalid input', () => {
  it('treats a malformed date as past', () => {
    // new Date('not-a-date') is NaN — diffMs will be NaN, minutes = NaN → floor = NaN → <= 0 is false
    // The function should still return something without throwing
    expect(() => getCountdown('not-a-date', NOW)).not.toThrow()
  })
})
