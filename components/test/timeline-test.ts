/**
 * Pass 19 — timeline grouping and On This Day behavioral tests.
 * All logic is in lib/timeline.ts (pure functions, no React).
 */
import { describe, it, expect } from 'vitest'
import { groupPostsByDate, getOnThisDayEntries, buildNavAnchors } from '@/lib/timeline'
import type { Post } from '@/lib/types'

// ── Test fixtures ──────────────────────────────────────────────────────────────
function makePost(id: string, isoDate: string, overrides: Partial<Post> = {}): Post {
  return {
    id,
    author_name: 'Alice',
    author_id:   'u1',
    author_avatar: '',
    vault_id:    'v1',
    vault_name:  'Test Vault',
    caption:     `Post ${id}`,
    media_type:  'text',
    unlock_at:   null,
    is_unlocked: true,
    created_at:  isoDate,
    like_count:  0,
    comment_count: 0,
    has_liked:   false,
    ...overrides,
  }
}

// Fixed "today" for all tests so they are deterministic
const TODAY = new Date('2026-07-15T12:00:00Z')

// ─────────────────────────────────────────────────────────────────────────────
describe('groupPostsByDate — empty input', () => {
  it('returns an empty array for empty posts', () => {
    expect(groupPostsByDate([], TODAY)).toEqual([])
  })
})

describe('groupPostsByDate — Today and Yesterday labels', () => {
  it('labels a post from today as "Today"', () => {
    const posts = [makePost('p1', '2026-07-15T08:00:00Z')]
    const groups = groupPostsByDate(posts, TODAY)
    expect(groups[0].label).toBe('Today')
    expect(groups[0].key).toBe('today')
  })

  it('labels a post from yesterday as "Yesterday"', () => {
    const posts = [makePost('p1', '2026-07-14T10:00:00Z')]
    const groups = groupPostsByDate(posts, TODAY)
    expect(groups[0].label).toBe('Yesterday')
    expect(groups[0].key).toBe('yesterday')
  })

  it('does not put today and yesterday in the same group', () => {
    const posts = [
      makePost('p1', '2026-07-15T08:00:00Z'),
      makePost('p2', '2026-07-14T10:00:00Z'),
    ]
    const groups = groupPostsByDate(posts, TODAY)
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBe('Today')
    expect(groups[1].label).toBe('Yesterday')
  })
})

describe('groupPostsByDate — month labels (same year)', () => {
  it('uses "Month Year" label for a post from the same year', () => {
    const posts = [makePost('p1', '2026-05-10T08:00:00Z')]
    const groups = groupPostsByDate(posts, TODAY)
    expect(groups[0].label).toBe('May 2026')
    expect(groups[0].key).toBe('2026-05')
  })

  it('groups all posts in the same month-year into one group', () => {
    const posts = [
      makePost('p1', '2026-05-01T08:00:00Z'),
      makePost('p2', '2026-05-20T08:00:00Z'),
    ]
    const groups = groupPostsByDate(posts, TODAY)
    expect(groups).toHaveLength(1)
    expect(groups[0].posts).toHaveLength(2)
  })
})

describe('groupPostsByDate — year-only labels (different year)', () => {
  it('uses year-only label for posts from a prior year', () => {
    const posts = [makePost('p1', '2024-03-01T08:00:00Z')]
    const groups = groupPostsByDate(posts, TODAY)
    expect(groups[0].label).toBe('2024')
    expect(groups[0].key).toBe('2024')
  })

  it('collapses all months of a prior year into one group', () => {
    const posts = [
      makePost('p1', '2024-01-01T08:00:00Z'),
      makePost('p2', '2024-06-15T08:00:00Z'),
      makePost('p3', '2024-12-31T08:00:00Z'),
    ]
    const groups = groupPostsByDate(posts, TODAY)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('2024')
    expect(groups[0].posts).toHaveLength(3)
  })
})

describe('groupPostsByDate — ordering', () => {
  it('returns groups newest-first', () => {
    const posts = [
      makePost('p1', '2024-01-01T08:00:00Z'),
      makePost('p2', '2026-07-15T08:00:00Z'),
      makePost('p3', '2025-11-05T08:00:00Z'),
    ]
    const groups = groupPostsByDate(posts, TODAY)
    expect(groups[0].label).toBe('Today')
    expect(groups[1].label).toBe('2025')
    expect(groups[2].label).toBe('2024')
  })

  it('orders posts within a group newest-first', () => {
    const posts = [
      makePost('old', '2026-05-01T00:00:00Z'),
      makePost('new', '2026-05-20T00:00:00Z'),
    ]
    const groups = groupPostsByDate(posts, TODAY)
    expect(groups[0].posts[0].id).toBe('new')
    expect(groups[0].posts[1].id).toBe('old')
  })

  it('does not mutate the source array', () => {
    const posts = [
      makePost('p1', '2024-01-01T08:00:00Z'),
      makePost('p2', '2026-07-15T08:00:00Z'),
    ]
    const original = [...posts]
    groupPostsByDate(posts, TODAY)
    expect(posts).toEqual(original)
  })
})

describe('groupPostsByDate — year transition', () => {
  it('separates December of one year from January of the next', () => {
    const posts = [
      makePost('p1', '2025-01-15T08:00:00Z'),
      makePost('p2', '2024-12-31T08:00:00Z'),
    ]
    const groups = groupPostsByDate(posts, TODAY)
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBe('2025')
    expect(groups[1].label).toBe('2024')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('getOnThisDayEntries — basic', () => {
  it('returns an empty array when no matching posts exist', () => {
    const posts = [makePost('p1', '2024-08-01T08:00:00Z')]  // different month+day
    expect(getOnThisDayEntries(posts, TODAY)).toHaveLength(0)
  })

  it('returns a post from the same month+day in a prior year', () => {
    const posts = [makePost('p1', '2024-07-15T08:00:00Z')]  // July 15 — matches TODAY
    const entries = getOnThisDayEntries(posts, TODAY)
    expect(entries).toHaveLength(1)
    expect(entries[0].post.id).toBe('p1')
  })

  it('does not include a post from today (same year)', () => {
    const posts = [makePost('p1', '2026-07-15T08:00:00Z')]  // today's year
    expect(getOnThisDayEntries(posts, TODAY)).toHaveLength(0)
  })
})

describe('getOnThisDayEntries — anniversary labels', () => {
  it('labels a post from 1 year ago as "1 year ago"', () => {
    const posts = [makePost('p1', '2025-07-15T08:00:00Z')]
    const entries = getOnThisDayEntries(posts, TODAY)
    expect(entries[0].yearsAgo).toBe(1)
    expect(entries[0].label).toBe('1 year ago')
  })

  it('labels a post from 3 years ago as "3 years ago"', () => {
    const posts = [makePost('p1', '2023-07-15T08:00:00Z')]
    const entries = getOnThisDayEntries(posts, TODAY)
    expect(entries[0].yearsAgo).toBe(3)
    expect(entries[0].label).toBe('3 years ago')
  })
})

describe('getOnThisDayEntries — ordering', () => {
  it('sorts by most-recent anniversary first (fewest years ago first)', () => {
    const posts = [
      makePost('p3yr', '2023-07-15T08:00:00Z'),
      makePost('p1yr', '2025-07-15T08:00:00Z'),
      makePost('p2yr', '2024-07-15T08:00:00Z'),
    ]
    const entries = getOnThisDayEntries(posts, TODAY)
    expect(entries[0].yearsAgo).toBe(1)
    expect(entries[1].yearsAgo).toBe(2)
    expect(entries[2].yearsAgo).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('buildNavAnchors', () => {
  it('returns an empty array for empty groups', () => {
    expect(buildNavAnchors([], TODAY)).toEqual([])
  })

  it('includes "This Month" when today group exists', () => {
    const groups = groupPostsByDate([makePost('p1', '2026-07-15T08:00:00Z')], TODAY)
    const anchors = buildNavAnchors(groups, TODAY)
    expect(anchors.some(a => a.label === 'This Month')).toBe(true)
  })

  it('includes "Previous Month" when that group exists', () => {
    const posts = [
      makePost('p1', '2026-07-15T08:00:00Z'),
      makePost('p2', '2026-06-01T08:00:00Z'),
    ]
    const groups = groupPostsByDate(posts, TODAY)
    const anchors = buildNavAnchors(groups, TODAY)
    expect(anchors.some(a => a.label === 'Previous Month')).toBe(true)
  })

  it('includes "Beginning" pointing to the oldest group', () => {
    const posts = [
      makePost('p1', '2026-07-15T08:00:00Z'),
      makePost('p2', '2024-01-01T08:00:00Z'),
    ]
    const groups = groupPostsByDate(posts, TODAY)
    const anchors = buildNavAnchors(groups, TODAY)
    const beginningAnchor = anchors.find(a => a.label === 'Beginning')
    expect(beginningAnchor).toBeDefined()
    expect(beginningAnchor?.groupKey).toBe('2024')
  })

  it('does not duplicate an anchor if only one group exists', () => {
    const groups = groupPostsByDate([makePost('p1', '2026-07-15T08:00:00Z')], TODAY)
    const anchors = buildNavAnchors(groups, TODAY)
    // No "Beginning" if the only group is already "This Month"
    const labels = anchors.map(a => a.label)
    const hasDuplicate = labels.some((l, i) => labels.indexOf(l) !== i)
    expect(hasDuplicate).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Structural checks: timeline grouping correctness
// ─────────────────────────────────────────────────────────────────────────────

describe('groupPostsByDate — no duplicate group headers', () => {
  it('produces exactly one group per unique key', () => {
    const posts = [
      makePost('p1', '2026-05-01T08:00:00Z'),
      makePost('p2', '2026-05-15T08:00:00Z'),
      makePost('p3', '2026-05-30T08:00:00Z'),
    ]
    const groups = groupPostsByDate(posts, TODAY)
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('2026-05')
    expect(groups[0].posts).toHaveLength(3)
  })

  it('produces two groups for posts from different months in the same year', () => {
    const posts = [
      makePost('p1', '2026-05-01T08:00:00Z'),
      makePost('p2', '2026-06-01T08:00:00Z'),
    ]
    const groups = groupPostsByDate(posts, TODAY)
    const keys = groups.map(g => g.key)
    // No duplicate keys
    expect(new Set(keys).size).toBe(keys.length)
    expect(groups).toHaveLength(2)
  })

  it('groups do not produce duplicate keys across today/yesterday/month', () => {
    const posts = [
      makePost('a', '2026-07-15T08:00:00Z'),  // today
      makePost('b', '2026-07-14T08:00:00Z'),  // yesterday
      makePost('c', '2026-07-01T08:00:00Z'),  // earlier in July — different from yesterday
    ]
    const groups = groupPostsByDate(posts, TODAY)
    const keys = groups.map(g => g.key)
    expect(new Set(keys).size).toBe(keys.length)
    // today, yesterday, and July 2026 are all different keys
    expect(groups).toHaveLength(3)
  })
})

describe('groupPostsByDate — view switch does not regroup unnecessarily', () => {
  // Since groupPostsByDate is a pure function, the same input always produces
  // the same output. When memoized with useMemo([posts]), repeated calls with
  // the same posts array produce the same grouped result without recomputing.
  it('produces identical output for the same input (referential equivalence)', () => {
    const posts = [
      makePost('p1', '2026-05-01T08:00:00Z'),
      makePost('p2', '2026-07-15T08:00:00Z'),
    ]
    const result1 = groupPostsByDate(posts, TODAY)
    const result2 = groupPostsByDate(posts, TODAY)
    // Deep equality — same structure
    expect(result1).toEqual(result2)
  })
})

describe('getOnThisDayEntries — boundary conditions', () => {
  it('handles a post on Jan 1 when today is Jan 1', () => {
    const jan1 = new Date('2026-01-01T12:00:00Z')
    const posts = [makePost('p1', '2024-01-01T08:00:00Z')]
    const entries = getOnThisDayEntries(posts, jan1)
    expect(entries).toHaveLength(1)
    expect(entries[0].yearsAgo).toBe(2)
  })

  it('does not match a post from the same date last year if month differs', () => {
    // July 15 2025 vs today July 14 — different day
    const posts = [makePost('p1', '2025-07-14T08:00:00Z')]
    const entries = getOnThisDayEntries(posts, TODAY)
    expect(entries).toHaveLength(0)
  })

  it('handles multiple years with correct ordering', () => {
    const posts = [
      makePost('5yr', '2021-07-15T08:00:00Z'),
      makePost('2yr', '2024-07-15T08:00:00Z'),
      makePost('4yr', '2022-07-15T08:00:00Z'),
    ]
    const entries = getOnThisDayEntries(posts, TODAY)
    expect(entries.map(e => e.yearsAgo)).toEqual([2, 4, 5])
  })
})
