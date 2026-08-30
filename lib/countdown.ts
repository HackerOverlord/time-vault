/**
 * Countdown helper — Pass 20.
 *
 * Pure functions; no React, no side-effects.
 * Returns the largest useful unit of time remaining before a target date.
 * Minute-level precision is sufficient — do not update every second.
 */

export interface CountdownResult {
  /** Human-readable label, e.g. "148 days" | "3 hours" | "Unlocking soon" */
  label:     string
  /** True when unlock_at is in the past (already unlocked or due to unlock). */
  isPast:    boolean
  /** Total minutes remaining (useful for deciding update interval). */
  minutes:   number
}

/**
 * Compute how long until `unlockAt` from the perspective of `now`.
 *
 * @param unlockAt  The UTC unlock datetime string (ISO 8601).
 * @param now       Injectable current time — makes callers testable.
 */
export function getCountdown(
  unlockAt: string,
  now: Date = new Date(),
): CountdownResult {
  const target  = new Date(unlockAt)
  const diffMs  = target.getTime() - now.getTime()
  const minutes = Math.floor(diffMs / 60_000)

  if (minutes <= 0) {
    return { label: "Unlocking soon", isPast: true, minutes }
  }

  const hours = Math.floor(minutes / 60)
  const days  = Math.floor(hours  / 24)
  const months = Math.floor(days  / 30)
  const years  = Math.floor(days  / 365)

  let label: string
  if (years  >= 1) label = `${years}  ${years  === 1 ? "year"  : "years"}`
  else if (months >= 2) label = `${months} ${months === 1 ? "month" : "months"}`
  else if (days   >= 1) label = `${days}   ${days   === 1 ? "day"   : "days"}`
  else if (hours  >= 1) label = `${hours}  ${hours  === 1 ? "hour"  : "hours"}`
  else                  label = `${minutes} ${minutes === 1 ? "minute" : "minutes"}`

  // Trim internal whitespace produced by alignment padding above
  label = label.replace(/\s+/g, " ").trim()

  return { label, isPast: false, minutes }
}

/**
 * Format an ISO date string as a localised short date for display.
 * e.g. "Jul 15, 2027"
 */
export function formatUnlockDate(unlockAt: string): string {
  return new Date(unlockAt).toLocaleDateString(undefined, {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  })
}
