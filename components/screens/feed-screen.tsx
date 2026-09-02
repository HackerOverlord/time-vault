"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { Plus, Settings, LogOut, Image, Search, X as XIcon, Vault, LogIn, RefreshCw, WifiOff, AlertTriangle, LayoutList, Rows3, History, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { API, ah, apiFetch } from "@/lib/api"
import type { Screen } from "@/lib/navigation"
import type { Post, Group } from "@/lib/types"
import { GroupPill } from "@/components/feed/group-pill"
import { NotificationPanel, NotificationBell } from "@/components/feed/notification-panel"
import { CreateVaultForm } from "@/components/feed/create-vault-form"
import { JoinVaultForm } from "@/components/feed/join-vault-form"
import { DesktopSidebar } from "@/components/feed/desktop-sidebar"
import { FeedPost } from "@/components/feed/feed-post"
import { TimelineView } from "@/components/feed/timeline-view"
import { useCapsuleUnlockRefresh } from "@/lib/useCapsuleUnlockRefresh"
import { filterPosts } from "@/lib/filterPosts"
import type { FeedFilter } from "@/lib/filterPosts"
import { UploadModal } from "@/components/upload/upload-modal"
import { MobileBottomNav } from "@/components/feed/mobile-bottom-nav"
import { Logo } from "@/components/logo"

interface FeedScreenProps {
  onNavigate: (s: Screen, g?: Group) => void
  groupsVersion?: number
}

const CACHE_TTL = 60_000

// ─── Vault action buttons ─────────────────────────────────────────────────────
// ── New/Join buttons only (used in mobile heading row) ─────────────────────
interface NewJoinButtonsProps {
  showCreateForm: boolean
  showJoinForm: boolean
  onOpenCreate: (e: React.MouseEvent<HTMLButtonElement>) => void
  onOpenJoin:   (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
}
const NewJoinButtons = React.memo(function NewJoinButtons({
  showCreateForm, showJoinForm, onOpenCreate, onOpenJoin, disabled = false,
}: NewJoinButtonsProps) {
  return (
    <>
      <button
        onClick={onOpenCreate}
        disabled={disabled}
        aria-expanded={showCreateForm}
        aria-label="New vault"
        className={cn(
          "inline-flex items-center gap-1 px-2.5 min-h-8 rounded-full text-[11px] font-semibold transition-all cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40 disabled:cursor-not-allowed",
          "border",
          showCreateForm
            ? "bg-white/15 text-white border-white/20"
            : "bg-transparent text-white/80 border-white/20 hover:bg-white/[0.08] hover:text-white"
        )}
      >
        <Plus className="size-3.5" aria-hidden /> New vault
      </button>
      <button
        onClick={onOpenJoin}
        disabled={disabled}
        aria-expanded={showJoinForm}
        aria-label="Join vault"
        className={cn(
          "inline-flex items-center gap-1 px-2.5 min-h-8 rounded-full text-[11px] font-semibold transition-all cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40 disabled:cursor-not-allowed",
          "border",
          showJoinForm
            ? "bg-white/15 text-white border-white/20"
            : "bg-transparent text-white/80 border-white/20 hover:bg-white/[0.08] hover:text-white"
        )}
      >
        <LogIn className="size-3.5" aria-hidden /> Join vault
      </button>
    </>
  )
})

// ── Feed/Timeline toggle only (used below heading row on mobile) ─────────────
interface FeedTimelineToggleProps {
  viewMode: "feed" | "timeline" | "vaults" | null
  onSetViewMode: (mode: "feed" | "timeline") => void
  disabled?: boolean
}
const FeedTimelineToggle = React.memo(function FeedTimelineToggle({
  viewMode, onSetViewMode, disabled = false,
}: FeedTimelineToggleProps) {
  return (
    <div
      className="flex items-center rounded-full bg-white/[0.08] p-0.5 w-fit"
      role="group"
      aria-label="View mode"
    >
      <button
        onClick={() => onSetViewMode("feed")}
        aria-pressed={viewMode === "feed"}
        aria-label="Feed view"
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold",
          "transition-colors cursor-pointer select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          viewMode === "feed"
            ? "bg-white/20 text-white shadow-sm"
            : "text-white/50 hover:text-white/80"
        )}
      >
        <LayoutList className="size-3.5" aria-hidden />
        Feed
      </button>
      <button
        onClick={() => onSetViewMode("timeline")}
        aria-pressed={viewMode === "timeline"}
        aria-label="Timeline view"
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold",
          "transition-colors cursor-pointer select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          viewMode === "timeline"
            ? "bg-white/20 text-white shadow-sm"
            : "text-white/50 hover:text-white/80"
        )}
      >
        <History className="size-3.5" aria-hidden />
        Timeline
      </button>
    </div>
  )
})

// ── Combined (used in desktop header) ────────────────────────────────────────
interface VaultActionButtonsProps {
  showCreateForm: boolean
  showJoinForm: boolean
  onOpenCreate: (e: React.MouseEvent<HTMLButtonElement>) => void
  onOpenJoin:   (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  viewMode: "feed" | "timeline" | "vaults" | null
  onSetViewMode: (mode: "feed" | "timeline") => void
}
const VaultActionButtons = React.memo(function VaultActionButtons({
  showCreateForm, showJoinForm, onOpenCreate, onOpenJoin, disabled = false,
  viewMode, onSetViewMode,
}: VaultActionButtonsProps) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Vault actions">
      <NewJoinButtons
        showCreateForm={showCreateForm}
        showJoinForm={showJoinForm}
        onOpenCreate={onOpenCreate}
        onOpenJoin={onOpenJoin}
        disabled={disabled}
      />
      <FeedTimelineToggle viewMode={viewMode} onSetViewMode={onSetViewMode} disabled={disabled} />
    </div>
  )
})

// ─── Main component ───────────────────────────────────────────────────────────
export function FeedScreen({ onNavigate, groupsVersion = 0 }: FeedScreenProps) {
  const [posts, setPosts]                 = useState<Post[]>([])
  const [groups, setGroups]               = useState<Group[]>([])
  const [currentUser, setCurrentUser]     = useState<any>(null)
  const [activeGroupId, setActiveGroupId] = useState<string>("all")
  const [isUploadOpen, setIsUploadOpen]   = useState(false)
  const [showArchived, setShowArchived]    = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [loading, setLoading]             = useState(true)
  // hasLoadedFeed: true once any successful posts response has been received.
  const [hasLoadedFeed, setHasLoadedFeed]   = useState(false)
  // initialLoadError: full-page error shown only when no feed data has ever loaded.
  const [initialLoadError, setInitialLoadError] = useState(false)
  // refreshError: non-blocking notice when a background refresh fails but posts are shown.
  const [refreshError, setRefreshError]     = useState(false)
  // groupsStatus: sole source of truth for vault-request state.
  // "idle"    — no request sent yet
  // "loading" — retry in flight (set only by retryGroups, not by fetchAll)
  // "success" — at least one successful response received
  // "error"   — most recent request failed; groups[] may hold stale data
  // Warning banner visibility is derived from this value in the render:
  //   groupsStatus === "error" && !initialLoadError && !loading
  const [groupsStatus, setGroupsStatus]     = useState<"idle"|"loading"|"success"|"error">("idle")
  // isOffline: SSR-safe — starts false, synced to navigator.onLine in useEffect.
  const [isOffline, setIsOffline]           = useState(false)
  const [currentIndex, setCurrentIndex]   = useState(0)
  const [activePostId, setActivePostId]   = useState<string | null>(null)
  const [muted, setMuted]                 = useState(true)

  // ── Create / join vault — single source of truth ────────────────────────
  // Forms are hoisted outside both responsive header trees so only ONE
  // instance of each form mounts at any breakpoint. These booleans gate
  // rendering of the form components (which render null when closed).
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showJoinForm,   setShowJoinForm]   = useState(false)

  // Tracks whichever button actually opened the form so focus returns to
  // that exact element. Both header buttons AND empty-state buttons set this.
  const createTriggerRef = useRef<HTMLButtonElement | null>(null)
  const joinTriggerRef   = useRef<HTMLButtonElement | null>(null)

  const openCreate = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    createTriggerRef.current = e.currentTarget
    setShowJoinForm(false)
    setShowCreateForm(true)
  }, [])

  const closeCreate = useCallback(() => {
    setShowCreateForm(false)
    // Only focus the trigger if it is still in the document and visible
    const t = createTriggerRef.current
    if (t && document.body.contains(t) && t.offsetParent !== null) {
      requestAnimationFrame(() => t.focus())
    }
    createTriggerRef.current = null
  }, [])

  const openJoin = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    joinTriggerRef.current = e.currentTarget
    setShowCreateForm(false)
    setShowJoinForm(true)
  }, [])

  const closeJoin = useCallback(() => {
    setShowJoinForm(false)
    const t = joinTriggerRef.current
    if (t && document.body.contains(t) && t.offsetParent !== null) {
      requestAnimationFrame(() => t.focus())
    }
    joinTriggerRef.current = null
  }, [])

  // ── Search and filter state ──────────────────────────────────────────────
  const [rawSearch,       setRawSearch]       = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [feedFilter,      setFeedFilter]      = useState<FeedFilter>("all")
  // View mode: null means "preference not yet resolved from localStorage".
  // Starts null on both server and client — no hydration mismatch.
  // useEffect resolves it after mount: reads localStorage, validates the
  // value, defaults to "feed" for missing/invalid/unavailable storage.
  // While null the UI renders the SkeletonFeed placeholder, so the user
  // never sees Feed content flash before Timeline content appears.
  const [viewMode, setViewModeRaw] = useState<"feed" | "timeline" | "vaults" | null>(null)
  const setViewMode = useCallback((mode: "feed" | "timeline" | "vaults") => {
    setViewModeRaw(mode)
    try { localStorage.setItem("tv-view-mode", mode) } catch { /* private browsing */ }
  }, [])
  useEffect(() => {
    // Runs only on the client, after hydration.
    // Server always rendered null → skeleton; client resolves the real preference.
    let resolved: "feed" | "timeline" = "feed"
    try {
      const stored = localStorage.getItem("tv-view-mode")
      if (stored === "timeline" || stored === "feed") resolved = stored
      // Any other value (malformed, future value) falls through to "feed"
    } catch { /* storage unavailable — private browsing, security policy */ }
    setViewModeRaw(resolved)
  }, [])
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Notification panel ───────────────────────────────────────────────────
  const [showNotifPanel, setShowNotifPanel]   = useState(false)
  const mobileNotifBellRef  = useRef<HTMLButtonElement>(null)
  const desktopNotifBellRef = useRef<HTMLButtonElement>(null)
  const activeNotifTriggerRef = useRef<HTMLButtonElement | null>(null)

  const handleCloseNotifications = useCallback(() => {
    setShowNotifPanel(false)
    requestAnimationFrame(() => {
      activeNotifTriggerRef.current?.focus()
      activeNotifTriggerRef.current = null
    })
  }, [])

  // ── Scroll / cache refs ──────────────────────────────────────────────────
  const vaultCache = useRef<Map<string, {
    posts: Post[]; scrollTop: number; currentIndex: number; cachedAt: number
  }>>(new Map())
  const scrollRef        = useRef<HTMLDivElement | null>(null)
  const postRefs         = useRef<(HTMLDivElement | null)[]>([])
  const pendingScrollRef = useRef<number | null>(null)
  const pillStripRef     = useRef<HTMLDivElement | null>(null)
  const postsRef         = useRef<Post[]>([])
  const activeGroupIdRef = useRef<string>("all")

  useEffect(() => { postsRef.current = posts }, [posts])
  useEffect(() => { activeGroupIdRef.current = activeGroupId }, [activeGroupId])

  // ── Offline / online detection (SSR-safe) ────────────────────────────
  // navigator is only available in the browser, not during SSR.
  // Starting with false avoids hydration mismatches.
  useEffect(() => {
    const updateConnection = () => setIsOffline(!navigator.onLine)
    updateConnection()          // sync immediately on client mount
    window.addEventListener("online",  updateConnection)
    window.addEventListener("offline", updateConnection)
    return () => {
      window.removeEventListener("online",  updateConnection)
      window.removeEventListener("offline", updateConnection)
    }
  }, [])


  // ── Scroll active pill into view ─────────────────────────────────────────
  useEffect(() => {
    const strip = pillStripRef.current
    if (!strip) return
    const active = strip.querySelector('[aria-current="true"]') as HTMLElement | null
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
  }, [activeGroupId])

  // ── Filtered posts and active index ─────────────────────────────────────
  const visiblePosts = useMemo(
    () => filterPosts(posts, debouncedSearch, feedFilter),
    [posts, debouncedSearch, feedFilter]
  )

  const activeVisibleIndex = useMemo(() => {
    if (visiblePosts.length === 0) return 0
    const idx = visiblePosts.findIndex(p => p.id === activePostId)
    return idx === -1 ? 0 : idx
  }, [visiblePosts, activePostId])

  const hasActiveFilter = debouncedSearch.trim() !== "" || feedFilter !== "all"

  // ── IntersectionObserver ──────────────────────────────────────────────────
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = postRefs.current.findIndex(r => r === entry.target)
          if (idx !== -1) {
            setCurrentIndex(idx)
            setActivePostId(visiblePosts[idx]?.id ?? null)
          }
        }
      })
    }, { threshold: 0.6 })
    postRefs.current.forEach(r => r && obs.observe(r))
    return () => obs.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePosts])

  useEffect(() => {
    if (visiblePosts.length === 0) return
    if (!visiblePosts.some(p => p.id === activePostId)) {
      setActivePostId(visiblePosts[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePosts])

  // ── Search debounce ──────────────────────────────────────────────────────
  const handleSearchChange = useCallback((value: string) => {
    setRawSearch(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 250)
  }, [])

  const clearSearch = useCallback(() => {
    setRawSearch("")
    setDebouncedSearch("")
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
  }, [])

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
  }, [])

  // ── Scroll restoration ────────────────────────────────────────────────────
  useEffect(() => {
    const target = pendingScrollRef.current
    if (target === null || !scrollRef.current) return
    pendingScrollRef.current = null
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = target
    })
  }, [posts])

  // ── Data fetch ────────────────────────────────────────────────────────────
  // fetchAll is called:
  //   • on initial mount (activeGroupId = "all")
  //   • when the user switches vault (activeGroupId changes)
  //   • when the user presses the full-page retry button
  // It does NOT reset search or filter — those are independent UI state.
  // Error classification:
  //   initialLoadError  — posts critical request failed, no feed data to show
  //   refreshError      — posts failed but we already have visible data
  const fetchAll = useCallback(async () => {
    // Save current scroll before switching vault
    const prev = vaultCache.current.get(activeGroupId)
    if (prev && scrollRef.current) {
      prev.scrollTop    = scrollRef.current.scrollTop
      prev.currentIndex = currentIndex
    }

    // ── Cache hit: serve cached posts immediately, refresh metadata in bg ──
    const cached  = vaultCache.current.get(activeGroupId)
    const isFresh = cached && (Date.now() - cached.cachedAt < CACHE_TTL)
    if (isFresh && cached) {
      setPosts(cached.posts)
      setCurrentIndex(cached.currentIndex)
      setLoading(false)
      pendingScrollRef.current = cached.scrollTop
      // Background-refresh optional data; failures are silent here
      const h = { headers: ah() }
      const results = await Promise.allSettled([
        fetch(`${API}/api/vaults`, h),
        fetch(`${API}/api/me`, h),
        fetch(`${API}/api/notifications`, h),
      ])
      const [gS, mS, nS] = results
      // 401 on any critical request → log out
      if (
        (gS.status === "fulfilled" && gS.value.status === 401) ||
        (mS.status === "fulfilled" && mS.value.status === 401)
      ) { sessionStorage.removeItem("token"); onNavigate("login"); return }
      if (gS.status === "fulfilled" && gS.value.ok) {
        setGroups(await gS.value.json())
        setGroupsStatus("success")
      } else {
        // Groups failed in background; keep stale groups, preserve existing groupsStatus if success
        if (groupsStatus !== "success") setGroupsStatus("error")
      }
      if (mS.status === "fulfilled" && mS.value.ok) setCurrentUser(await mS.value.json())
      if (nS.status === "fulfilled" && nS.value.ok) {
        const nd = await nS.value.json()
        setNotifications(nd); setUnreadCount(nd.filter((n: any) => !n.is_read).length)
      }
      return
    }

    // ── Cache miss: full load required ───────────────────────────────────────
    // Only show the skeleton when we have nothing to display.
    // If hasLoadedFeed is true (vault switch after already having data),
    // we continue showing the previous vault's posts until new ones arrive.
    if (!hasLoadedFeed) setLoading(true)
    setInitialLoadError(false)
    setRefreshError(false)
    if (groupsStatus === "idle") setGroupsStatus("loading")

    // Fetch posts (critical) and optional data independently.
    // Optional requests (groups, me, notifications) never cause the feed error.
    const h = { headers: ah() }
    const archiveParam = showArchived ? "archived=true" : ""
    const baseUrl = activeGroupId === "all" ? `${API}/api/posts` : `${API}/api/posts?vault_id=${activeGroupId}`
    const url = archiveParam
      ? baseUrl + (baseUrl.includes("?") ? "&" : "?") + archiveParam
      : baseUrl

    let postsResponse: Response
    try {
      postsResponse = await fetch(url, h)
    } catch {
      // Network error fetching posts — critical path failed
      if (hasLoadedFeed) {
        setRefreshError(true)     // Non-blocking: keep existing posts visible
      } else {
        setInitialLoadError(true) // Full-page error: nothing to show
      }
      setLoading(false)
      return
    }

    if (postsResponse.status === 401) {
      sessionStorage.removeItem("token"); onNavigate("login"); return
    }

    if (!postsResponse.ok) {
      if (hasLoadedFeed) {
        setRefreshError(true)
      } else {
        setInitialLoadError(true)
      }
      setLoading(false)
      return
    }

    // Posts loaded successfully
    const pD: Post[] = await postsResponse.json()

    // Fetch optional data concurrently; individual failures don't fail the feed
    const [gS, mS, nS] = await Promise.allSettled([
      fetch(`${API}/api/vaults`, h),
      fetch(`${API}/api/me`, h),
      fetch(`${API}/api/notifications`, h),
    ])

    // 401 on groups or me still requires logout
    if (
      (gS.status === "fulfilled" && gS.value.status === 401) ||
      (mS.status === "fulfilled" && mS.value.status === 401)
    ) { sessionStorage.removeItem("token"); onNavigate("login"); return }

    // Apply successful optional responses; silently ignore failures
    if (gS.status === "fulfilled" && gS.value.ok) {
      setGroups(await gS.value.json())
      setGroupsStatus("success")
    } else {
      // Groups failed — record error status; existing groups[] are NOT cleared.
      // Warning banner is shown whenever groupsStatus === "error" and posts are
      // visible — the render derives visibility, not fetchAll.
      setGroupsStatus("error")
    }
    if (mS.status === "fulfilled" && mS.value.ok) setCurrentUser(await mS.value.json())
    // me failure: keep currentUser if already set; no separate warning shown
    if (nS.status === "fulfilled" && nS.value.ok) {
      const nd = await nS.value.json()
      setNotifications(nd); setUnreadCount(nd.filter((n: any) => !n.is_read).length)
    }

    setPosts(pD)
    setHasLoadedFeed(true)
    setInitialLoadError(false)
    setRefreshError(false)
    setLoading(false)
    vaultCache.current.set(activeGroupId, {
      posts: pD, scrollTop: 0, currentIndex: 0, cachedAt: Date.now()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, showArchived, onNavigate, hasLoadedFeed])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Retry groups only (non-blocking) ─────────────────────────────────────
  // Called from the groupsError warning banner. Does NOT reset search/filter
  // or vault selection. Existing groups are preserved if the retry also fails.
  const retryGroups = useCallback(async () => {
    setGroupsStatus("loading")
    const h = { headers: ah() }
    const [gS, mS] = await Promise.allSettled([
      fetch(`${API}/api/vaults`, h),
      fetch(`${API}/api/me`, h),
    ])
    if (
      (gS.status === "fulfilled" && gS.value.status === 401) ||
      (mS.status === "fulfilled" && mS.value.status === 401)
    ) { sessionStorage.removeItem("token"); onNavigate("login"); return }
    if (gS.status === "fulfilled" && gS.value.ok) {
      const newGroups: Group[] = await gS.value.json()
      setGroups(newGroups)
      setGroupsStatus("success")
      // If the previously selected vault no longer exists, fall back to "all"
      if (activeGroupIdRef.current !== "all" &&
          !newGroups.some(g => g.id === activeGroupIdRef.current)) {
        setActiveGroupId("all")
      }
    } else {
      // Stay "error"; warning remains visible — groups still unavailable
      setGroupsStatus("error")
    }
    if (mS.status === "fulfilled" && mS.value.ok) setCurrentUser(await mS.value.json())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNavigate])

  // Targeted groups refresh (vault rename/leave/delete via GroupScreen).
  // Uses Promise.allSettled so a notification failure does not abort groups/me.
  useEffect(() => { vaultCache.current.clear() }, [showArchived])

  useEffect(() => {
    if (groupsVersion === 0) return
    vaultCache.current.clear()
    const h = { headers: ah() }
    Promise.allSettled([
      fetch(`${API}/api/vaults`, h),
      fetch(`${API}/api/me`, h),
      fetch(`${API}/api/notifications`, h),
    ]).then(([gS, mS, nS]) => {
      if (
        (gS.status === "fulfilled" && gS.value.status === 401) ||
        (mS.status === "fulfilled" && mS.value.status === 401)
      ) { sessionStorage.removeItem("token"); onNavigate("login"); return }
      if (gS.status === "fulfilled" && gS.value.ok) {
        gS.value.json().then(newGroups => {
          setGroups(newGroups)
          setGroupsStatus("success")
        })
      } else {
        // Keep existing groups[]; warning derived from groupsStatus in render
        setGroupsStatus("error")
      }
      if (mS.status === "fulfilled" && mS.value.ok) mS.value.json().then(setCurrentUser)
      if (nS.status === "fulfilled" && nS.value.ok) {
        nS.value.json().then((nd: any[]) => {
          setNotifications(nd)
          setUnreadCount(nd.filter(n => !n.is_read).length)
        })
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsVersion])

  // ── Auto-unlock refresh ─────────────────────────────────────────────────
  // Delegate to useCapsuleUnlockRefresh. The hook manages scheduling,
  // backoff, and cleanup. onRefresh clears the vault cache before fetching
  // so stale locked-post data is never served from the in-memory cache.
  const onUnlockRefresh = useCallback(() => {
    vaultCache.current.clear()
    fetchAll()
  }, [fetchAll])
  useCapsuleUnlockRefresh(posts, onUnlockRefresh)

  // ── Mutation handlers ─────────────────────────────────────────────────────
  const handleLike = useCallback(async (postId: string) => {
    const post = postsRef.current.find(p => p.id === postId)
    if (!post) return
    const result = await apiFetch<{ like_count: number }>(
      `/api/posts/${postId}/like`, { method: post.has_liked ? "DELETE" : "POST" }
    )
    if (result.ok) {
      setPosts(prev => {
        const updated = prev.map(p =>
          p.id === postId ? { ...p, has_liked: !p.has_liked, like_count: result.data.like_count } : p
        )
        const c = vaultCache.current.get(activeGroupIdRef.current)
        if (c) c.posts = updated
        return updated
      })
    } else { toast.error(result.error ?? "Could not update like") }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = useCallback(async (postId: string) => {
    const result = await apiFetch(`/api/posts/${postId}`, { method: "DELETE" })
    if (result.ok) {
      setPosts(prev => prev.filter(p => p.id !== postId))
      vaultCache.current.delete(activeGroupIdRef.current)
      toast.success("Post deleted")
    } else { toast.error(result.error ?? "Could not delete post") }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleArchiveToggle = useCallback(async (postId: string, archive: boolean) => {
    const result = await apiFetch<Post>(`/api/posts/${postId}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: archive }),
    })
    if (result.ok) {
      setPosts(prev => {
        const updated = prev.filter(p => p.id !== postId)
        const c = vaultCache.current.get(activeGroupIdRef.current)
        if (c) c.posts = updated
        return updated
      })
    } else {
      const { toast } = await import("sonner")
      toast.error(result.error ?? "Archive action failed")
    }
  }, [])

  const handleCommentCountChange = useCallback((postId: string, delta: number) => {
    setPosts(prev => {
      const updated = prev.map(p =>
        p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count ?? 0) + delta) } : p
      )
      const c = vaultCache.current.get(activeGroupIdRef.current)
      if (c) c.posts = updated
      return updated
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoined = useCallback(async (vaultId: string) => {
    const result = await apiFetch<Group[]>("/api/vaults")
    if (result.ok) setGroups(result.data)
    setActiveGroupId(vaultId)
  }, [])

  const handleVaultCreated = useCallback((g: Group) => {
    setGroups(prev => [...prev, g])
    setActiveGroupId(g.id)
  }, [])

  const vaultOwnerIds = useMemo(
    () => new Set(groups.filter(g => g.user_role === "owner").map(g => g.id)),
    [groups]
  )

  // Memoized: stable reference prevents DesktopSidebar from re-rendering
  // when unrelated state (notifications, search, posts) changes.
  const logout = useCallback(() => {
    sessionStorage.removeItem("token"); onNavigate("login")
  }, [onNavigate])

  // Memoized: currentUser changes only on login/profile-save, not on searches or notifications.
  const initials = useMemo(
    () => currentUser?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "TV",
    [currentUser?.name]
  )

  const activeVault = useMemo(
    () => groups.find(g => g.id === activeGroupId) ?? null,
    [groups, activeGroupId]
  )

  // ── Skeleton ──────────────────────────────────────────────────────────────
  const SkeletonFeed = (
    <div className="flex-1 overflow-hidden" aria-busy="true">
      <span className="sr-only" role="status">Loading memories</span>
      {[0, 1, 2].map(i => (
        <div key={i} className="h-full w-full bg-zinc-900 skeleton-pulse"
             style={{ opacity: 1 - i * 0.25 }} />
      ))}
    </div>
  )

  // ── Empty states ──────────────────────────────────────────────────────────
  // State A — No vaults
  const EmptyStateNoVaults = (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8 py-12">
      <div className="size-20 rounded-full flex items-center justify-center border border-white/[0.06]"
           style={{ background: "oklch(0.14 0.015 260)" }}>
        <Vault className="size-8 text-white/15" aria-hidden />
      </div>
      <div className="space-y-2 max-w-xs">
        <p className="text-white/85 font-semibold text-[18px] tracking-tight">Create your first vault</p>
        <p className="text-white/40 text-sm leading-relaxed">
          Vaults are private spaces where you share memories with the people who matter most.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Empty-state buttons use the same openCreate / openJoin callbacks as
            the header buttons. They set createTriggerRef.current to themselves
            so focus returns correctly even if the header trigger is off-screen. */}
        <Button
          onClick={openCreate}
          className="bg-primary hover:bg-primary/90 text-white rounded-2xl cursor-pointer px-6 h-11 text-sm font-semibold"
        >
          <Plus className="size-4 mr-2" aria-hidden /> Create vault
        </Button>
        <button
          onClick={openJoin}
          className="border border-white/20 text-white/70 hover:text-white hover:bg-white/[0.06] rounded-2xl cursor-pointer px-6 h-11 text-sm font-semibold bg-transparent inline-flex items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <LogIn className="size-4 mr-2" aria-hidden /> Join vault
        </button>
      </div>
    </div>
  )

  // State B — Selected vault has no posts
  const EmptyStateEmptyVault = (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8 py-12">
      <div className="size-20 rounded-full flex items-center justify-center border border-white/[0.06]"
           style={{ background: "oklch(0.14 0.015 260)" }}>
        <Image className="size-8 text-white/15" aria-hidden />
      </div>
      <div className="space-y-2 max-w-xs">
        <p className="text-white/85 font-semibold text-[18px] tracking-tight">No memories yet</p>
        <p className="text-white/40 text-sm leading-relaxed">
          {activeVault?.description
            ? `"${activeVault.description}"`
            : activeVault
              ? `"${activeVault.name}" is ready for its first memory.`
              : "This vault is ready for its first memory."}
        </p>
      </div>
      {/* Contextual guidance cards */}
      <div className="w-full max-w-xs space-y-2 text-left">
        <button
          onClick={() => setIsUploadOpen(true)}
          className="w-full flex items-center gap-3 bg-white/[0.05] hover:bg-white/[0.08] rounded-2xl px-4 py-3
                     text-sm text-white/80 transition-colors cursor-pointer text-left"
        >
          <span className="size-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            📸
          </span>
          <div>
            <div className="font-semibold text-white/90 text-[13px]">Upload your first memory</div>
            <div className="text-white/40 text-xs">Photo, video, or a note</div>
          </div>
        </button>
        <div className="flex items-center gap-3 bg-white/[0.03] rounded-2xl px-4 py-3 text-sm text-white/50">
          <span className="size-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">👥</span>
          <div>
            <div className="font-semibold text-[13px]">Invite family members</div>
            <div className="text-white/30 text-xs">Share the invite code from vault settings</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white/[0.03] rounded-2xl px-4 py-3 text-sm text-white/50">
          <span className="size-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">✨</span>
          <div>
            <div className="font-semibold text-[13px]">Start preserving moments</div>
            <div className="text-white/30 text-xs">Memories last forever when shared here</div>
          </div>
        </div>
      </div>
    </div>
  )

  // State C — All-vault feed, vaults exist but no posts
  const EmptyStateNoPostsAllVaults = (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8 py-12">
      <div className="size-20 rounded-full flex items-center justify-center border border-white/[0.06]"
           style={{ background: "oklch(0.14 0.015 260)" }}>
        <Image className="size-8 text-white/15" aria-hidden />
      </div>
      <div className="space-y-2 max-w-xs">
        <p className="text-white/85 font-semibold text-[18px] tracking-tight">No memories yet</p>
        <p className="text-white/40 text-sm leading-relaxed">
          Invite the people who matter to your vaults and start saving moments together.
        </p>
      </div>
      <Button onClick={() => setIsUploadOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white rounded-2xl cursor-pointer px-6 h-11 text-sm font-semibold">
        <Plus className="size-4 mr-2" aria-hidden /> Share a memory
      </Button>
    </div>
  )

  // State D — Search/filter produces no matches
  const EmptyStateFiltered = (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8 py-12">
      <div className="size-20 rounded-full flex items-center justify-center border border-white/[0.06]"
           style={{ background: "oklch(0.14 0.015 260)" }}>
        <Search className="size-8 text-white/15" aria-hidden />
      </div>
      <div className="space-y-2 max-w-xs">
        <p className="text-white/85 font-semibold text-[18px] tracking-tight">No matching memories</p>
        <p className="text-white/40 text-sm leading-relaxed">
          {debouncedSearch.trim()
            ? `Nothing matched "${debouncedSearch.trim()}". Try a different search or remove the filter.`
            : "No memories match the selected filter."}
        </p>
      </div>
      <button onClick={() => { clearSearch(); setFeedFilter("all") }}
              className="text-primary hover:text-primary/80 text-sm font-semibold cursor-pointer min-h-11 px-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
        Clear filters
      </button>
    </div>
  )

  // State E — Archived view, no archived memories at all
  const EmptyStateArchived = (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8 py-12"
         role="status" aria-live="polite">
      <div className="size-20 rounded-full flex items-center justify-center border border-white/[0.06]"
           style={{ background: "oklch(0.14 0.015 260)" }}>
        <span className="text-3xl" aria-hidden>📦</span>
      </div>
      <div className="space-y-2 max-w-xs">
        <p className="text-white/85 font-semibold text-[18px] tracking-tight">No archived memories</p>
        <p className="text-white/40 text-sm leading-relaxed">
          Memories you archive will appear here. Use the archive action on any memory to move it here.
        </p>
      </div>
      <button
        onClick={() => setShowArchived(false)}
        className="text-primary hover:text-primary/80 text-sm font-semibold cursor-pointer
                   min-h-11 px-4 rounded-xl focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-primary/60"
        aria-label="Return to active memories"
      >
        Back to memories
      </button>
    </div>
  )

  // State F — Archived view, memories exist but search/filter has no matches
  const EmptyStateArchivedFiltered = (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8 py-12"
         role="status" aria-live="polite">
      <div className="size-20 rounded-full flex items-center justify-center border border-white/[0.06]"
           style={{ background: "oklch(0.14 0.015 260)" }}>
        <Search className="size-8 text-white/15" aria-hidden />
      </div>
      <div className="space-y-2 max-w-xs">
        <p className="text-white/85 font-semibold text-[18px] tracking-tight">No matching archived memories</p>
        <p className="text-white/40 text-sm leading-relaxed">
          {debouncedSearch.trim()
            ? `Nothing archived matched "${debouncedSearch.trim()}". Try a different search.`
            : "No archived memories match the selected filter."}
        </p>
      </div>
      <button onClick={() => { clearSearch(); setFeedFilter("all") }}
              className="text-primary hover:text-primary/80 text-sm font-semibold cursor-pointer
                         min-h-11 px-4 rounded-xl focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-primary/60">
        Clear filters
      </button>
    </div>
  )

  // Memoized: the resolved empty state only changes when filter/vault/group
  // status changes — not on every notification update or search keystroke.
  const resolvedEmptyState = useMemo(() => {
    // Archived view: use dedicated archive empty states
    if (showArchived) {
      return hasActiveFilter ? EmptyStateArchivedFiltered : EmptyStateArchived
    }
    if (hasActiveFilter) return EmptyStateFiltered
    // Only show "Create your first vault" when the vault request has definitively
    // succeeded and returned an empty list. If the request failed or is in flight,
    // groups.length === 0 does not mean the user genuinely has no vaults.
    if (groupsStatus === "success" && groups.length === 0) return EmptyStateNoVaults
    if (activeGroupId === "all") return EmptyStateNoPostsAllVaults
    return EmptyStateEmptyVault
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived, hasActiveFilter, groupsStatus, groups.length, activeGroupId, activeVault, openCreate, openJoin, setIsUploadOpen, debouncedSearch])

  // ── Feed error state ─────────────────────────────────────────────────────
  const FeedErrorState = (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8 py-12">
      <div className="size-20 rounded-full flex items-center justify-center border border-white/[0.06]"
           style={{ background: "oklch(0.14 0.015 260)" }}>
        <RefreshCw className="size-8 text-white/15" aria-hidden />
      </div>
      <div className="space-y-2 max-w-xs">
        <p className="text-white/85 font-semibold text-[18px] tracking-tight">Couldn't load memories</p>
        <p className="text-white/40 text-sm leading-relaxed">
          {isOffline
            ? "You're offline. Connect to the internet and try again."
            : "Something went wrong loading your feed. Please try again."}
        </p>
      </div>
      <button
        onClick={() => fetchAll()}
        disabled={isOffline}
        aria-label="Retry loading feed"
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50
                   text-white text-sm font-semibold rounded-2xl cursor-pointer px-6 h-11 transition-colors
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <RefreshCw className="size-4" aria-hidden /> Try again
      </button>
    </div>
  )

  // ── Feed content ──────────────────────────────────────────────────────────
  const feedContent = (
    <>
      {loading || viewMode === null ? SkeletonFeed
      : initialLoadError ? FeedErrorState
      : viewMode === "vaults" ? (
        /* Mobile Vaults view — vault list using existing groups data */
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 pb-4">
          <h2 className="text-white/50 text-xs font-semibold uppercase tracking-wider pb-1">Your vaults</h2>
          {groups.length === 0 && (
            <p className="text-white/30 text-sm pt-4 text-center">No vaults yet. Create or join one above.</p>
          )}
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => { setActiveGroupId(g.id); setViewMode("feed") }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09]
                         transition-colors cursor-pointer text-left"
            >
              <div className="size-10 rounded-full shrink-0 flex items-center justify-center text-sm font-bold"
                   style={{ background: g.accent_color
                     ? `oklch(0.55 0.20 ${g.accent_color === "blue" ? "240" : g.accent_color === "green" ? "150" : g.accent_color === "purple" ? "290" : g.accent_color === "orange" ? "55" : g.accent_color === "rose" ? "10" : "240"} / 0.30)`
                     : "rgba(255,255,255,0.08)" }}>
                {g.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-[15px] font-semibold leading-tight truncate">{g.name}</p>
                <p className="text-white/40 text-[12px] mt-0.5">{g.member_count} {g.member_count === 1 ? "member" : "members"}</p>
              </div>
              <ChevronRight className="size-4 text-white/25 shrink-0" />
            </button>
          ))}
        </div>
      )
      : viewMode === "timeline" ? (
        <TimelineView
          posts={visiblePosts}
          currentUserId={currentUser?.id ?? ""}
          isVaultOwner={vaultOwnerIds.has(activeGroupId)}
          hasActiveFilter={hasActiveFilter}
          onLike={handleLike}
          onDelete={handleDelete}
          onCommentCountChange={handleCommentCountChange}
          onUpload={() => setIsUploadOpen(true)}
        />
      )
      : posts.length === 0 ? resolvedEmptyState
      : visiblePosts.length === 0 ? EmptyStateFiltered
      : (
        <>
          {refreshError && (
            <div role="status" aria-live="polite"
                 className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 text-xs"
                 style={{ background: "rgba(120,40,0,0.45)" }}>
              <span className="text-amber-200/90 leading-snug">
                Couldn't refresh. Showing last loaded memories.
              </span>
              <button onClick={() => fetchAll()} disabled={isOffline}
                      aria-label="Retry refreshing feed"
                      className="shrink-0 text-amber-300 hover:text-amber-100 font-semibold
                                 disabled:opacity-50 cursor-pointer focus-visible:outline-none
                                 focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded">
                Try again
              </button>
            </div>
          )}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-scroll snap-y snap-mandatory"
               style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" }}>
          {hasActiveFilter && (
            <span className="sr-only" role="status" aria-live="polite">
              {visiblePosts.length} {visiblePosts.length === 1 ? "memory" : "memories"} found
            </span>
          )}
          {visiblePosts.map((post, i) => (
            <div key={post.id} ref={el => { postRefs.current[i] = el }}
                 className="h-full w-full flex-shrink-0 px-1.5 py-1.5 lg:px-0 lg:py-0" style={{ scrollSnapAlign: "start" }}>
              <FeedPost
                post={post}
                isActive={i === activeVisibleIndex}
                currentUserId={currentUser?.id}
                isVaultOwner={vaultOwnerIds.has(post.vault_id)}
                muted={muted}
                onMuteChange={setMuted}
                preload={
                  i === activeVisibleIndex ? 'auto'
                  : i === activeVisibleIndex + 1 ? 'metadata'
                  : 'none'
                }
                onLike={handleLike}
                onDelete={handleDelete}
                onCommentCountChange={handleCommentCountChange}
              />
            </div>
          ))}
          </div>
        </>
      )}
    </>
  )

  // ── Vault selector ────────────────────────────────────────────────────────
  // Selection-only: GroupPill items for "All" and each vault. No action buttons.
  const VaultSelector = (
    <div ref={pillStripRef} role="group" aria-label="Vault and view filter"
         className="pill-strip flex gap-1.5 px-4 overflow-x-auto pb-0 lg:gap-1"
         style={{ scrollSnapType: "x proximity" }}>
      <button
        onClick={() => { setShowArchived(v => !v); setRawSearch(""); setDebouncedSearch("") }}
        aria-pressed={showArchived}
        aria-label={showArchived ? "Show active memories" : "Show archived memories"}
        className={cn(
          "shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-colors cursor-pointer border lg:h-7 lg:px-2.5 lg:text-[11px]",
          showArchived
            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
            : "bg-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/10 border-transparent"
        )}
      >
        {showArchived ? "📦 Archived" : "Archive"}
      </button>
      <GroupPill label="All" active={activeGroupId === "all"} onClick={() => setActiveGroupId("all")} />
      {groups.map(g => (
        <GroupPill
          key={g.id} label={g.name}
          active={activeGroupId === g.id}
          onClick={() => setActiveGroupId(g.id)}
          onManage={() => onNavigate("group", g)}
          group={g}
        />
      ))}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  // Derived vault-warning visibility — separate from groupsStatus narrowing
  // so JSX comparisons don't trigger TS "no overlap" errors.
  const showVaultWarning = groupsStatus === "error" && !initialLoadError && !loading
  const retryingGroups   = groupsStatus === "loading"

  return (
    <div className="h-[100dvh] w-full bg-black overflow-hidden flex">

      {/* Desktop sidebar (lg+) */}
      <DesktopSidebar
        currentUser={currentUser}
        groups={groups}
        activeGroupId={activeGroupId}
        notifications={notifications}
        unreadCount={unreadCount}
        onSelectGroup={setActiveGroupId}
        onNavigate={onNavigate}
        onUpload={() => setIsUploadOpen(true)}
        onLogout={logout}
      />

      {/* ── Main feed column ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Offline banner ─────────────────────────────────────────────── */}
        {isOffline && (
          <div
            role="status"
            aria-live="polite"
            className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-amber-300"
            style={{ background: "rgba(120,80,0,0.35)" }}
          >
            <WifiOff className="size-3.5 shrink-0" aria-hidden />
            You're offline — some actions won't work until you reconnect.
          </div>
        )}

        {/* Non-blocking vault warning — shown whenever groupsStatus is "error"
             and the feed is otherwise renderable (posts loaded, no full-page error).
             Visibility is derived entirely from groupsStatus; no separate groupsError
             boolean is needed, preventing the race where hasLoadedFeed was false
             when groups failed during the same initial request as a posts success. */}
        {showVaultWarning && (
          <div
            role="status"
            aria-live="polite"
            className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 text-xs"
            style={{ background: "rgba(100,50,0,0.40)" }}
          >
            <span className="text-amber-200/90 leading-snug flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0 text-amber-400" aria-hidden />
              Vaults couldn't be loaded. Memories are still available.
            </span>
            <button
              onClick={retryGroups}
              disabled={isOffline || retryingGroups}
              aria-label={retryingGroups ? "Retrying vaults…" : "Retry loading vaults"}
              className="shrink-0 text-amber-300 hover:text-amber-100 font-semibold
                         disabled:opacity-50 cursor-pointer focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded"
            >
              {retryingGroups ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MOBILE / TABLET HEADER  (lg:hidden)
            Three rows: brand+user, heading+actions, vault selector.
            Search+filter renders once below both headers. No forms here.
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:hidden flex flex-col shrink-0"
             style={{ background: "rgba(0,0,0,0.90)" }}>

          {/* Row 1: Logo + notification + user */}
          {/* scale=0.60 shrinks the full Logo to ~h-9 effective height, */}
          {/* preserving the exact icon + TIME Vault wordmark + LEGACY SECURED */}
          {/* tagline — identical to the desktop sidebar, just smaller. */}
          <div className="flex items-center justify-between px-4 pt-1.5 pb-0.5">
            <div className="overflow-visible shrink-0" style={{ height: "3.0rem" }}>
              <Logo scale={0.60} />
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell
                triggerRef={mobileNotifBellRef}
                unreadCount={unreadCount}
                onClick={() => {
                  activeNotifTriggerRef.current = mobileNotifBellRef.current
                  setShowNotifPanel(true)
                }}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="cursor-pointer" aria-label={`User menu for ${currentUser?.name ?? "account"}`}>
                    <Avatar className="size-8 ring-1 ring-white/20 hover:ring-white/40 transition-all">
                      <AvatarImage src={currentUser?.avatar} className="object-cover" />
                      <AvatarFallback className="bg-primary/30 text-primary text-xs font-bold">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 border-white/10"
                  style={{ background: "oklch(0.13 0.02 260 / 0.97)", backdropFilter: "blur(20px)" }} align="end">
                  <DropdownMenuLabel className="text-white text-sm">{currentUser?.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem onClick={() => onNavigate("settings")} className="text-white/70 hover:!bg-white/[0.06] cursor-pointer">
                    <Settings className="mr-2 size-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem onClick={logout} className="text-white/70 hover:!bg-white/[0.06] hover:!text-red-400 cursor-pointer">
                    <LogOut className="mr-2 size-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Row 2: Heading — full width, left-aligned */}
          <div className="px-4 pt-0 pb-0">
            <h1 className="text-white font-bold text-xl leading-tight tracking-tight">Your memories</h1>
          </div>
          {/* Row 3: Actions — left-aligned, directly under heading */}
          <div className="flex justify-start gap-2 px-4 pb-1">
            <NewJoinButtons
              showCreateForm={showCreateForm}
              showJoinForm={showJoinForm}
              onOpenCreate={openCreate}
              onOpenJoin={openJoin}
              disabled={isOffline}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            DESKTOP FEED HEADER  (hidden lg:flex)
            Visible at lg+ alongside the sidebar.
            Contains only VaultActionButtons — no forms.
            Vault navigation is provided by DesktopSidebar.
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="hidden lg:flex flex-col shrink-0 border-b border-white/[0.06]"
             style={{ background: "rgba(0,0,0,0.60)" }}>
          <div className="flex items-center justify-between px-6 py-3 gap-4">
            <h1 className="text-white font-bold text-xl">Your memories</h1>
            <div className="flex items-center gap-2">
              <NotificationBell
                triggerRef={desktopNotifBellRef}
                unreadCount={unreadCount}
                onClick={() => {
                  activeNotifTriggerRef.current = desktopNotifBellRef.current
                  setShowNotifPanel(true)
                }}
              />
              <VaultActionButtons
                showCreateForm={showCreateForm}
                showJoinForm={showJoinForm}
                onOpenCreate={openCreate}
                onOpenJoin={openJoin}
                disabled={isOffline}
                viewMode={viewMode}
                onSetViewMode={setViewMode}
              />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SEARCH + MEDIA FILTER — one mounted instance, one id="feed-search",
            one media-filter group. Outside both responsive header trees.
            px-4 lg:px-6 matches the header horizontal padding on each breakpoint.
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="shrink-0 space-y-1 py-1 border-b border-white/[0.04]"
             style={{ background: "rgba(0,0,0,0.82)" }}>
          <div className="px-4 lg:px-6">
            <div className="relative flex items-center">
              <label htmlFor="feed-search" className="sr-only">Search memories</label>
              <Search className="absolute left-3.5 size-4 text-white/40 pointer-events-none" aria-hidden />
              <input
                id="feed-search"
                type="search"
                value={rawSearch}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search memories…"
                className="w-full h-9 bg-white/[0.07] border border-white/[0.12] rounded-xl
                           pl-9 pr-9 text-[16px] text-white/90 placeholder:text-white/35
                           outline-none focus:border-primary/40 transition-colors lg:text-[13px] lg:h-9 lg:rounded-full"
              />
              {rawSearch && (
                <button onClick={clearSearch} aria-label="Clear search"
                        className="absolute right-2 flex items-center justify-center size-6 rounded-full text-white/40 hover:text-white/80 transition-colors cursor-pointer">
                  <XIcon className="size-3" />
                </button>
              )}
            </div>
          </div>
          <div role="group" aria-label="Media type filter"
               className="pill-strip flex gap-1.5 px-4 lg:px-6 overflow-x-auto pb-0 lg:gap-1.5">
            {([
              { value: "all",     label: "All" },
              { value: "image",   label: "Photos" },
              { value: "video",   label: "Videos" },
              { value: "text",    label: "Text" },
              { value: "capsule", label: "Capsules" },
            ] as { value: FeedFilter; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFeedFilter(value)}
                aria-pressed={feedFilter === value}
                className={cn(
                  "px-2.5 min-h-9 inline-flex items-center rounded-full text-sm font-semibold whitespace-nowrap lg:px-3 lg:min-h-8 lg:text-[11px]",
                  "transition-all duration-150 cursor-pointer shrink-0",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40 disabled:cursor-not-allowed",
                  feedFilter === value
                    ? "bg-white/20 text-white"
                    : "bg-white/[0.06] text-white/50 hover:bg-white/[0.12] hover:text-white/80"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SINGLE-MOUNTED FORMS
            These are the ONLY instances of CreateVaultForm and JoinVaultForm
            in the tree. They sit outside both responsive header trees.
            They render null when closed (open={false}).
            Focus restoration targets whichever button set createTriggerRef /
            joinTriggerRef — checked for visibility before focusing.
        ═══════════════════════════════════════════════════════════════════ */}
        {(showCreateForm || showJoinForm) && (
          <div className="shrink-0 px-4 lg:px-6 py-2 border-b border-white/[0.05]"
               style={{ background: "rgba(0,0,0,0.70)" }}>
            <CreateVaultForm
              open={showCreateForm}
              onCreated={handleVaultCreated}
              onClose={closeCreate}
            />
            <JoinVaultForm
              open={showJoinForm}
              onJoined={handleJoined}
              onClose={closeJoin}
            />
          </div>
        )}

        {/* ── Feed content area ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {feedContent}

        </div>

        {/* ── Mobile bottom navigation — shrink-0 flex sibling, NOT fixed ── */}
        <MobileBottomNav
          viewMode={viewMode}
          onSelectFeed={() => { setViewMode("feed"); setActiveGroupId("all") }}
          onSelectTimeline={() => { setViewMode("timeline"); setActiveGroupId("all") }}
          onSelectVaults={() => setViewMode("vaults")}
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenSettings={() => onNavigate("settings")}
          disabled={isOffline}
        />
      </div>

      {/* Notification panel */}
      {showNotifPanel && (
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          onClose={handleCloseNotifications}
          onNotificationsChange={setNotifications}
          onUnreadCountChange={setUnreadCount}
          onNavigateToVault={vaultId => {
            setActiveGroupId(vaultId)
            handleCloseNotifications()
          }}
        />
      )}

      {/* Upload modal */}
      {isUploadOpen && (
        <UploadModal
          groups={groups}
          groupsStatus={groupsStatus}
          onClose={() => setIsUploadOpen(false)}
          onPosted={post => {
            if (activeGroupId === "all" || post.vault_id === activeGroupId) {
              const updated = [post, ...posts]
              setPosts(updated)
              const c = vaultCache.current.get(activeGroupId)
              if (c) c.posts = updated
            } else {
              vaultCache.current.delete(post.vault_id)
            }
            setIsUploadOpen(false)
            toast.success("Shared to " + (groups.find(g => g.id === post.vault_id)?.name ?? "vault"))
          }}
        />
      )}
    </div>
  )
}
