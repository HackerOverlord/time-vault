"use client"

/**
 * components/feed/notification-panel.tsx — Pass 26
 *
 * Changes from Pass 25E:
 *  • Individual "mark read" (swipe-like dismiss button per row)
 *  • "Mark all read" button in the header
 *  • Action routing: tapping certain notification types navigates contextually
 *  • claim_invite_created icon added (Pass 21 type)
 *  • Notification type union tightened in local usage
 *  • Backend: POST /api/notifications/<id>/read (added in app.py this pass)
 */

import React, {
  useEffect, useRef, useMemo, useState, useCallback,
} from "react"
import {
  Bell, X, MessageCircle, UserPlus, Users, Lock,
  Image, Info, ArrowLeft, Check, CheckCheck, Gift, Heart, LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { API, ah, apiFetch } from "@/lib/api"
import type { Notification } from "@/lib/types"

export type { Notification }   // re-export so existing imports keep working

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationPanelProps {
  notifications: Notification[]
  unreadCount: number
  onClose: () => void
  onNotificationsChange: React.Dispatch<React.SetStateAction<Notification[]>>
  onUnreadCountChange:   React.Dispatch<React.SetStateAction<number>>
  /** Called when a notification action should navigate to a vault. */
  onNavigateToVault?: (vaultId: string) => void
}

interface NotificationBellProps {
  triggerRef: React.RefObject<HTMLButtonElement | null>
  unreadCount: number
  onClick: () => void
  className?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FOCUSABLE =
  'button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Notification types that have a navigation action.
// Key = type string; value = field on the notification used to identify target.
const ACTIONABLE_TYPES = new Set([
  "comment_received",
  "new_post",
  "capsule_unlocked",
  "member_joined",
  "member_left",
  "member_added",
  "vault_sent",
  "vault_received",
  "claim_invite_created",
  "post_liked",
])

// ─── Icons ────────────────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  const cls = "size-4 shrink-0"
  switch (type) {
    case "comment_received":       return <MessageCircle className={cn(cls, "text-blue-400")} />
    case "member_added":           return <UserPlus      className={cn(cls, "text-emerald-400")} />
    case "member_joined":          return <Users         className={cn(cls, "text-emerald-400")} />
    case "capsule_unlocked":       return <Lock          className={cn(cls, "text-amber-400")} />
    case "new_post":               return <Image         className={cn(cls, "text-violet-400")} />
    case "vault_sent":
    case "vault_received":         return <ArrowLeft     className={cn(cls, "text-primary")} />
    case "vault_deleted":          return <X             className={cn(cls, "text-red-400")} />
    case "member_left":            return <LogOut        className={cn(cls, "text-white/40")} />
    case "member_removed":         return <X             className={cn(cls, "text-red-400")} />
    case "post_liked":             return <Heart         className={cn(cls, "text-rose-400")} />
    case "claim_invite_created":   return <Gift          className={cn(cls, "text-amber-400")} />
    case "family_joined":
    case "family_left":            return <Users         className={cn(cls, "text-white/40")} />
    default:                       return <Info          className={cn(cls, "text-white/40")} />
  }
}

// ─── Relative time ────────────────────────────────────────────────────────────

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

// ─── NotificationPanel ────────────────────────────────────────────────────────

export function NotificationPanel({
  notifications, unreadCount,
  onClose, onNotificationsChange, onUnreadCountChange,
  onNavigateToVault,
}: NotificationPanelProps) {
  const panelRef       = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Guard: only mark-all once per panel-open session.
  const hasMarkedAllRef = useRef(false)

  // Track individual notifications being dismissed (for loading state).
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set())

  // Focus on open.
  useEffect(() => {
    const id = requestAnimationFrame(() => closeButtonRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  // Escape + Tab trap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return }
      if (e.key !== "Tab" || !panelRef.current) return
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter(el => !el.closest("[aria-hidden]"))
      if (nodes.length === 0) return
      const first = nodes[0]; const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Click-outside closes.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    const id = setTimeout(() => document.addEventListener("mousedown", onDown), 0)
    return () => { clearTimeout(id); document.removeEventListener("mousedown", onDown) }
  }, [onClose])

  // ── Individual dismiss ─────────────────────────────────────────────────────
  const dismissOne = useCallback(async (notifId: string) => {
    // Optimistic update
    setDismissingIds(s => new Set([...s, notifId]))
    onNotificationsChange(prev => prev.map(n =>
      n.id === notifId ? { ...n, is_read: true } : n
    ))
    onUnreadCountChange(c => Math.max(0, c - 1))

    const result = await apiFetch(`/api/notifications/${notifId}/read`, { method: "POST" })
    if (!result.ok) {
      // Rollback on failure
      onNotificationsChange(prev => prev.map(n =>
        n.id === notifId ? { ...n, is_read: false } : n
      ))
      onUnreadCountChange(c => c + 1)
    }
    setDismissingIds(s => { const next = new Set(s); next.delete(notifId); return next })
  }, [onNotificationsChange, onUnreadCountChange])

  // ── Mark all read ──────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (hasMarkedAllRef.current || unreadCount === 0) return
    hasMarkedAllRef.current = true
    const markedIds = new Set(notifications.filter(n => !n.is_read).map(n => n.id))
    onNotificationsChange(prev => prev.map(n =>
      markedIds.has(n.id) ? { ...n, is_read: true } : n
    ))
    onUnreadCountChange(0)
    const res = await fetch(`${API}/api/notifications/read-all`, {
      method: "POST", headers: ah(),
    })
    if (!res.ok) {
      // Rollback
      onNotificationsChange(prev => {
        const rolled = prev.map(n => markedIds.has(n.id) ? { ...n, is_read: false } : n)
        onUnreadCountChange(rolled.filter(n => !n.is_read).length)
        return rolled
      })
      hasMarkedAllRef.current = false
    }
  }, [notifications, unreadCount, onNotificationsChange, onUnreadCountChange])

  // On first open with unread items, silently mark all read (existing behavior).
  // If user explicitly taps "Mark all read", markAllRead() also handles that.
  useEffect(() => {
    if (hasMarkedAllRef.current || unreadCount === 0) return
    hasMarkedAllRef.current = true
    const markedIds = new Set(notifications.filter(n => !n.is_read).map(n => n.id))
    onNotificationsChange(prev =>
      prev.map(n => markedIds.has(n.id) ? { ...n, is_read: true } : n)
    )
    onUnreadCountChange(0)
    fetch(`${API}/api/notifications/read-all`, { method: "POST", headers: ah() })
      .then(res => { if (!res.ok) throw new Error("read-all failed") })
      .catch(() => {
        onNotificationsChange(prev => {
          const rolled = prev.map(n => markedIds.has(n.id) ? { ...n, is_read: false } : n)
          onUnreadCountChange(rolled.filter(n => !n.is_read).length)
          return rolled
        })
        hasMarkedAllRef.current = false
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Action routing ─────────────────────────────────────────────────────────
  const handleNotifClick = useCallback((n: Notification) => {
    if (!ACTIONABLE_TYPES.has(n.type)) return
    // Mark this notification read if not already
    if (!n.is_read) dismissOne(n.id)
    // Navigate to vault if a vault_id is present on the notification
    if ((n as any).vault_id && onNavigateToVault) {
      onNavigateToVault((n as any).vault_id)
      onClose()
    }
  }, [dismissOne, onNavigateToVault, onClose])

  // Memoize relative timestamps.
  const times = useMemo(
    () => Object.fromEntries(notifications.map(n => [n.id, relativeTime(n.created_at)])),
    [notifications]
  )

  // SSR-safe reduced-motion.
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handle = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", handle)
    return () => mq.removeEventListener("change", handle)
  }, [])

  const hasUnread = unreadCount > 0 ||
    notifications.some(n => !n.is_read)

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/30" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className={cn(
          "fixed top-0 right-0 z-[70] h-full w-full max-w-sm flex flex-col",
          "border-l border-white/[0.07] shadow-2xl",
          !reducedMotion && "transition-transform duration-250 ease-out"
        )}
        style={{
          background: "oklch(0.12 0.02 260 / 0.98)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <Bell className="size-4 text-white/50" />
            <h2 className="text-white/90 font-semibold text-[15px]">Notifications</h2>
            {unreadCount > 0 && (
              <span className="text-[11px] font-semibold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full tabular-nums">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Mark all read */}
            {hasUnread && (
              <button
                onClick={markAllRead}
                aria-label="Mark all notifications as read"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px]
                           font-semibold text-white/40 hover:text-white/80 hover:bg-white/[0.06]
                           transition-colors cursor-pointer"
              >
                <CheckCheck className="size-3.5" />
                All read
              </button>
            )}
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close notifications"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full
                         text-white/40 hover:text-white/80 transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 px-8 text-center">
              <div className="relative size-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-white/[0.05]" />
                <div className="absolute inset-3 rounded-full border border-white/[0.08]" />
                <div className="absolute inset-6 rounded-full"
                     style={{ background: "oklch(0.20 0.02 260)" }} />
                <Bell className="size-7 text-white/20 relative z-10" />
              </div>
              <div className="space-y-1.5">
                <p className="text-white/70 font-semibold text-[15px]">All quiet here</p>
                <p className="text-white/30 text-[13px] leading-relaxed max-w-[220px] mx-auto">
                  You'll see activity from your vaults here when something happens.
                </p>
              </div>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-white/[0.04]">
              {notifications.map(n => {
                const isActionable = ACTIONABLE_TYPES.has(n.type)
                const isDismissing = dismissingIds.has(n.id)
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-4 group",
                      !n.is_read && "bg-white/[0.03]",
                      isActionable && "hover:bg-white/[0.05] transition-colors"
                    )}
                  >
                    {/* Unread dot + icon */}
                    <div className="flex flex-col items-center gap-1.5 pt-0.5 shrink-0">
                      <div
                        className={cn(
                          "size-1.5 rounded-full mt-0.5",
                          n.is_read ? "bg-transparent" : "bg-primary"
                        )}
                        aria-hidden
                      />
                      <NotifIcon type={n.type} />
                    </div>

                    {/* Message area — clickable if actionable */}
                    <div
                      className={cn("flex-1 min-w-0", isActionable && "cursor-pointer")}
                      onClick={() => isActionable && handleNotifClick(n)}
                      role={isActionable ? "button" : undefined}
                      tabIndex={isActionable ? 0 : undefined}
                      aria-label={isActionable ? n.message : undefined}
                      onKeyDown={isActionable
                        ? e => { if (e.key === "Enter" || e.key === " ") handleNotifClick(n) }
                        : undefined}
                    >
                      <p className={cn(
                        "text-[13px] leading-snug",
                        n.is_read ? "text-white/50" : "text-white/90 font-medium"
                      )}>
                        {n.message}
                      </p>
                      <p className="text-[11px] text-white/25 mt-1">{times[n.id]}</p>
                    </div>

                    {/* Individual dismiss (visible on hover or if unread) */}
                    {!n.is_read && (
                      <button
                        onClick={() => dismissOne(n.id)}
                        disabled={isDismissing}
                        aria-label={`Dismiss notification: ${n.message}`}
                        className={cn(
                          "shrink-0 size-7 rounded-full flex items-center justify-center",
                          "text-white/20 hover:text-white/60 hover:bg-white/[0.08]",
                          "transition-colors cursor-pointer",
                          // Mobile (touch): always visible at low opacity for discoverability
                          // Desktop (hover device): hidden until hover/focus
                          "opacity-30 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100",
                          isDismissing && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Check className="size-3.5" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

// ─── NotificationBell ─────────────────────────────────────────────────────────

export function NotificationBell({
  triggerRef, unreadCount, onClick, className,
}: NotificationBellProps) {
  return (
    <button
      ref={triggerRef as React.RefObject<HTMLButtonElement>}
      onClick={onClick}
      aria-label={unreadCount > 0
        ? `Notifications, ${unreadCount} unread`
        : "Notifications"}
      aria-haspopup="dialog"
      className={cn(
        "relative flex min-h-11 min-w-11 items-center justify-center rounded-full",
        "text-white/60 hover:text-white transition-colors cursor-pointer",
        className
      )}
    >
      <Bell className="size-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" aria-hidden />
      )}
    </button>
  )
}
