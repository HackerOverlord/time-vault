"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { Plus, Bell, Settings, LogOut, Video } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import { API, ah, apiFetch } from "@/lib/api"
import type { Screen } from "@/lib/navigation"
import type { Post, Group } from "@/lib/types"
import { GroupPill } from "@/components/feed/group-pill"
import { CreateGroupPill } from "@/components/feed/create-group-pill"
import { JoinVaultPill } from "@/components/feed/join-vault-pill"
import { FeedPost } from "@/components/feed/feed-post"
import { UploadModal } from "@/components/upload/upload-modal"

interface FeedScreenProps {
  onNavigate: (s: Screen, g?: Group) => void
}

export function FeedScreen({ onNavigate }: FeedScreenProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeGroupId, setActiveGroupId] = useState<string>("all")
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const postRefs   = useRef<(HTMLDivElement | null)[]>([])
  const scrollRef   = useRef<HTMLDivElement | null>(null)
  // Tracks in-flight like requests to prevent duplicate submissions on rapid taps.
  const likingIds = useRef(new Set<string>())

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setCurrentIndex(0)
    scrollRef.current?.scrollTo({ top: 0 })
    const h = { headers: ah() }
    const groupParam = activeGroupId === "all" ? "" : `?vault_id=${activeGroupId}`
    const [postsRes, groupsRes, meRes, notifRes] = await Promise.all([
      fetch(`${API}/api/posts${groupParam}`, h),
      fetch(`${API}/api/vaults`, h),
      fetch(`${API}/api/me`, h),
      fetch(`${API}/api/notifications`, h),
    ])
    // If any core request returns 401 the token is expired or invalid.
    // Clear the stored token and redirect to login immediately.
    if ([postsRes, groupsRes, meRes].some(r => r.status === 401)) {
      sessionStorage.removeItem("token")
      onNavigate("login")
      return
    }
    if (postsRes.ok) {
      setPosts(await postsRes.json())
      // Mark vault as seen when entering a vault-scoped feed.
      // Fire-and-forget: failure is silent — only affects unread_count badge.
      if (activeGroupId !== "all") {
        apiFetch(`/api/vaults/${activeGroupId}/seen`, { method: "POST" })
      }
    }
    if (groupsRes.ok) setGroups(await groupsRes.json())
    else toast.error("Could not load your vaults")
    if (meRes.ok) setCurrentUser(await meRes.json())
    if (notifRes.ok) {
      const nd = await notifRes.json()
      setNotifications(nd)
      setUnreadCount(nd.filter((n: any) => !n.is_read).length)
    }
    setLoading(false)
  }, [activeGroupId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Track which post is snapped into view
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = postRefs.current.findIndex(r => r === entry.target)
            if (idx !== -1) setCurrentIndex(idx)
          }
        })
      },
      { threshold: 0.6 }
    )
    postRefs.current.forEach(r => r && obs.observe(r))
    return () => obs.disconnect()
  }, [posts])

  const handleLike = async (postId: string) => {
    if (likingIds.current.has(postId)) return
    const post = posts.find(p => p.id === postId)
    if (!post) return
    likingIds.current.add(postId)
    const result = await apiFetch<{ like_count: number }>(
      `/api/posts/${postId}/like`,
      { method: post.has_liked ? "DELETE" : "POST" }
    )
    if (result.ok) {
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, has_liked: !p.has_liked, like_count: result.data.like_count }
            : p
        )
      )
    } else {
      toast.error(result.error ?? "Could not update like")
    }
    likingIds.current.delete(postId)
  }

  const handleDelete = async (postId: string) => {
    const result = await apiFetch(`/api/posts/${postId}`, { method: "DELETE" })
    if (result.ok) {
      setPosts(prev => prev.filter(p => p.id !== postId))
      toast.success("Post deleted")
    } else {
      toast.error(result.error ?? "Could not delete post")
    }
  }

  const handleCommentCountChange = (postId: string, delta: number) => {
    setPosts(prev =>
      prev.map(p =>
        p.id === postId
          ? { ...p, comment_count: Math.max(0, p.comment_count + delta) }
          : p
      )
    )
  }

  // Refresh vault list after joining, then switch to the new vault.
  const handleJoined = async (vaultId: string, vaultName: string) => {
    const result = await apiFetch<Group[]>("/api/vaults")
    if (result.ok) {
      setGroups(result.data)
    }
    setActiveGroupId(vaultId)
  }

  // Set of vault IDs where the current user is owner.
  // Derived from groups state so vault owners can delete any post in their vault.
  const vaultOwnerIds = useMemo(
    () => new Set(groups.filter(g => g.user_role === "owner").map(g => g.id)),
    [groups]
  )

  const logout = () => {
    sessionStorage.removeItem("token")
    onNavigate("login")
  }

  const markAllRead = async () => {
    await fetch(`${API}/api/notifications/read-all`, { method: "POST", headers: ah() })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const initials =
    currentUser?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "TV"

  return (
    <div className="h-screen w-full bg-black overflow-hidden flex flex-col relative">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-4 pb-2 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="pointer-events-auto"><Logo /></div>
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Notification bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Notifications" className="relative p-3 text-white/70 hover:text-white transition-colors cursor-pointer">
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 bg-zinc-900 border-zinc-800" align="end">
              <DropdownMenuLabel className="flex items-center justify-between text-white">
                Notifications
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-primary hover:text-primary/80 cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-6">All caught up</p>
                ) : (
                  notifications.slice(0, 8).map(n => (
                    <DropdownMenuItem
                      key={n.id}
                      className={cn("flex flex-col items-start gap-0.5 px-4 py-3", !n.is_read && "bg-zinc-800/50")}
                    >
                      <span className={cn("text-xs leading-snug", !n.is_read ? "text-white font-medium" : "text-zinc-400")}>
                        {n.message}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Avatar / user menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer">
                <Avatar className="size-8 ring-1 ring-white/20 hover:ring-white/50 transition-all">
                  <AvatarImage src={currentUser?.avatar} className="object-cover" />
                  <AvatarFallback className="bg-primary text-white text-xs font-bold">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 bg-zinc-900 border-zinc-800" align="end">
              <DropdownMenuLabel className="text-white text-sm">{currentUser?.name}</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                onClick={() => onNavigate("settings")}
                className="text-zinc-300 hover:!bg-zinc-800 cursor-pointer"
              >
                <Settings className="mr-2 size-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                onClick={logout}
                className="text-zinc-300 hover:!bg-zinc-800 hover:!text-red-400 cursor-pointer"
              >
                <LogOut className="mr-2 size-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Group filter pills */}
      <div className="absolute top-16 left-0 right-0 z-40 pointer-events-none">
        <div
          className="flex gap-2 px-4 overflow-x-auto pb-1 pointer-events-auto"
          style={{ scrollbarWidth: "none" }}
        >
          <GroupPill
            label="All"
            active={activeGroupId === "all"}
            onClick={() => setActiveGroupId("all")}
          />
          {groups.map(g => (
            <GroupPill
              key={g.id}
              label={g.name}
              active={activeGroupId === g.id}
              onClick={() => setActiveGroupId(g.id)}
              onManage={() => onNavigate("group", g)}
            />
          ))}
          <CreateGroupPill onCreated={g => { setGroups(prev => [...prev, g]); setActiveGroupId(g.id) }} />
          <JoinVaultPill onJoined={handleJoined} />
        </div>
      </div>

      {/* Feed content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
          <div className="size-16 rounded-full bg-zinc-900 flex items-center justify-center">
            <Video className="size-7 text-zinc-600" />
          </div>
          <div>
            <p className="text-white font-semibold">Nothing here yet</p>
            <p className="text-zinc-500 text-sm mt-1">
              {activeGroupId === "all"
                ? "Create a vault and share your first memory."
                : "No posts in this vault yet. Be the first to share something."}
            </p>
          </div>
          <Button
            onClick={() => setIsUploadOpen(true)}
            className="bg-primary hover:bg-primary/90 rounded-xl cursor-pointer"
          >
            <Plus className="size-4 mr-2" /> Share something
          </Button>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory"
          style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" }}
        >
          {posts.map((post, i) => (
            <div
              key={post.id}
              ref={el => { postRefs.current[i] = el }}
              className="h-screen w-full flex-shrink-0"
              style={{ scrollSnapAlign: "start" }}
            >
              <FeedPost
                post={post}
                isActive={i === currentIndex}
                currentUserId={currentUser?.id}
                isVaultOwner={vaultOwnerIds.has(post.vault_id)}
                onLike={() => handleLike(post.id)}
                onDelete={() => handleDelete(post.id)}
                onCommentCountChange={(delta) => handleCommentCountChange(post.id, delta)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Upload FAB */}
      <button
        onClick={() => setIsUploadOpen(true)}
        className="absolute bottom-8 right-5 z-50 size-14 rounded-full bg-primary shadow-lg shadow-primary/30
                   flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95 cursor-pointer"
      >
        <Plus className="size-6 text-white" />
      </button>

      {isUploadOpen && (
        <UploadModal
          groups={groups}
          onClose={() => setIsUploadOpen(false)}
          onPosted={post => {
            // Only insert into feed if it matches the active filter.
            if (activeGroupId === "all" || post.vault_id === activeGroupId) {
              setPosts(prev => [post, ...prev])
            }
            setIsUploadOpen(false)
            toast.success("Posted!")
          }}
        />
      )}
    </div>
  )
}
