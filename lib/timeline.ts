/**
 * Timeline grouping and "On This Day" logic (Pass 19).
 *
 * Pure functions — no React, no side-effects, independently testable.
 * All grouping is performed client-side from the already-fetched posts array.
 */

import type { Post } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimelineGroup {
  /** Display label, e.g. "Today", "Yesterday", "July 2026", "2025" */
  label: string
  /** Stable key for React (no spaces, e.g. "today", "2026-07", "2025") */
  key:   string
  posts: Post[]
}

export interface OnThisDayEntry {
  post:       Post
  /** Positive integer: 1 = last year, 2 = two years ago, etc. */
  yearsAgo:  number
  /** "1 year ago" | "2 years ago" | … */
  label:     string
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Parse a post timestamp to a local Date, falling back to created_at. */
function postDate(post: Post): Date {
  return new Date(post.created_at)
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  )
}

function isYesterday(d: Date, today: Date): boolean {
  const yest = new Date(today)
  yest.setDate(today.getDate() - 1)
  return isSameDay(d, yest)
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

/**
 * Derive a group label and stable key for a given post date.
 *
 * Labelling rules:
 *   Same calendar day as today          → "Today"
 *   Same calendar day as yesterday      → "Yesterday"
 *   Same calendar year as today         → "July 2026"
 *   Different calendar year from today  → "2025"
 */
function groupLabel(d: Date, today: Date): { label: string; key: string } {
  if (isSameDay(d, today)) {
    return { label: "Today", key: "today" }
  }
  if (isYesterday(d, today)) {
    return { label: "Yesterday", key: "yesterday" }
  }
  const year  = d.getFullYear()
  const month = d.getMonth()
  if (year === today.getFullYear()) {
    return {
      label: `${MONTH_NAMES[month]} ${year}`,
      key:   `${year}-${String(month + 1).padStart(2, "0")}`,
    }
  }
  // Different year: collapse the whole year into one group
  return { label: String(year), key: String(year) }
}

// ── Grouping ──────────────────────────────────────────────────────────────────

/**
 * Group posts into timeline sections ordered newest-first.
 *
 * Adjacent posts that belong to the same group share a single header.
 * The input array is NOT mutated; the output shares post object references.
 *
 * @param posts    Already-filtered posts (from filterPosts or raw API).
 * @param today    Injectable today date — makes tests deterministic.
 */
export function groupPostsByDate(
  posts: Post[],
  today: Date = new Date(),
): TimelineGroup[] {
  if (posts.length === 0) return []

  // Sort newest-first (defensive — feed may already be sorted, but guarantee it)
  const sorted = [...posts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const groups: TimelineGroup[] = []
  let currentKey = ""

  for (const post of sorted) {
    const d   = postDate(post)
    const { label, key } = groupLabel(d, today)

    if (key !== currentKey) {
      groups.push({ label, key, posts: [] })
      currentKey = key
    }
    groups[groups.length - 1].posts.push(post)
  }

  return groups
}

// ── On This Day ───────────────────────────────────────────────────────────────

/**
 * Return posts whose month+day matches today's month+day from prior years,
 * ordered by most-recent anniversary first (e.g. last year before two years ago).
 *
 * Only posts from previous calendar years are included — today's posts are
 * already visible at the top of the feed/timeline.
 *
 * @param posts    Already-filtered posts the user can access.
 * @param today    Injectable today date — makes tests deterministic.
 */
export function getOnThisDayEntries(
  posts: Post[],
  today: Date = new Date(),
): OnThisDayEntry[] {
  const todayMonth = today.getMonth()
  const todayDay   = today.getDate()
  const todayYear  = today.getFullYear()

  const entries: OnThisDayEntry[] = posts
    .filter(post => {
      const d = postDate(post)
      return (
        d.getMonth() === todayMonth &&
        d.getDate()  === todayDay   &&
        d.getFullYear() < todayYear   // only prior years
      )
    })
    .map(post => {
      const yearsAgo = todayYear - postDate(post).getFullYear()
      return {
        post,
        yearsAgo,
        label: yearsAgo === 1 ? "1 year ago" : `${yearsAgo} years ago`,
      }
    })
    .sort((a, b) => a.yearsAgo - b.yearsAgo)  // most-recent anniversary first

  return entries
}

// ── Quick-navigation anchors ──────────────────────────────────────────────────

export interface NavAnchor {
  label: string
  groupKey: string
}

/**
 * Generate quick-navigation anchors for the timeline:
 *   "This Month", "Previous Month", "Beginning"
 *
 * Only anchors that correspond to existing groups are returned.
 */
export function buildNavAnchors(
  groups: TimelineGroup[],
  today: Date = new Date(),
): NavAnchor[] {
  const anchors: NavAnchor[] = []
  const keys = new Set(groups.map(g => g.key))

  // This Month
  const thisKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  const thisMonthCandidates = ["today", "yesterday", thisKey]
  const hasThisMonth = thisMonthCandidates.some(k => keys.has(k))
  if (hasThisMonth) {
    const firstMatchKey = thisMonthCandidates.find(k => keys.has(k))!
    anchors.push({ label: "This Month", groupKey: firstMatchKey })
  }

  // Previous Month
  const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevKey  = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`
  if (keys.has(prevKey)) {
    anchors.push({ label: "Previous Month", groupKey: prevKey })
  }

  // Beginning (last group = oldest)
  if (groups.length > 0) {
    const lastGroup = groups[groups.length - 1]
    const alreadyIncluded = anchors.some(a => a.groupKey === lastGroup.key)
    if (!alreadyIncluded) {
      anchors.push({ label: "Beginning", groupKey: lastGroup.key })
    }
  }

  return anchors
}

// ── Pass 25A: Year/Month grouping (oldest → newest) ──────────────────────────

export const MONTH_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
]

export interface YearGroup {
  year:   number
  months: MonthGroup[]
}

export interface MonthGroup {
  /** 0-indexed month */
  month:    number
  /** Stable key, e.g. "2024-03" */
  key:      string
  /** Display label, e.g. "March" */
  label:    string
  posts:    Post[]
}

/**
 * Group posts into year/month buckets, ordered oldest → newest.
 *
 * Uses `created_at` as the canonical date.  Locked capsule created_at is
 * always present — the caption/media remain redacted in the card render.
 */
export function groupByYearMonth(
  posts: Post[],
): YearGroup[] {
  if (posts.length === 0) return []

  // Sort oldest first
  const sorted = [...posts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  const yearMap = new Map<number, Map<number, Post[]>>()

  for (const post of sorted) {
    const d     = new Date(post.created_at)
    const year  = d.getFullYear()
    const month = d.getMonth()   // 0-indexed

    if (!yearMap.has(year)) yearMap.set(year, new Map())
    const monthMap = yearMap.get(year)!
    if (!monthMap.has(month)) monthMap.set(month, [])
    monthMap.get(month)!.push(post)
  }

  const yearGroups: YearGroup[] = []
  for (const [year, monthMap] of yearMap) {
    const months: MonthGroup[] = []
    for (const [month, posts] of monthMap) {
      months.push({
        month,
        key:   `${year}-${String(month + 1).padStart(2, "0")}`,
        label: MONTH_NAMES[month],
        posts,
      })
    }
    // months already in insertion order (oldest month first, since we iterated sorted posts)
    yearGroups.push({ year, months })
  }

  // Years oldest first
  yearGroups.sort((a, b) => a.year - b.year)
  return yearGroups
}

/** Extract the distinct years present in a groupByYearMonth result. */
export function extractYears(yearGroups: YearGroup[]): number[] {
  return yearGroups.map(g => g.year)
}
