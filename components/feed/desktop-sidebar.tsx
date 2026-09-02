"use client"

import React from "react"
import { Plus, Settings, LogOut } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import type { Group } from "@/lib/types"
import type { Screen } from "@/lib/navigation"
import type { Notification } from "@/lib/types"

interface DesktopSidebarProps {
  currentUser: any
  groups: Group[]
  activeGroupId: string
  notifications: Notification[]
  unreadCount: number
  onSelectGroup: (id: string) => void
  onNavigate: (s: Screen, g?: Group) => void
  onUpload: () => void
  onLogout: () => void
}

export function DesktopSidebar({
  currentUser, groups, activeGroupId, notifications, unreadCount,
  onSelectGroup, onNavigate, onUpload, onLogout,
}: DesktopSidebarProps) {
  const initials =
    currentUser?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "TV"

  return (
    <aside
      className="hidden lg:flex flex-col h-screen w-72 min-w-72 max-w-72 shrink-0 grow-0 basis-72 border-r border-white/[0.06]"
      style={{ background: "oklch(0.11 0.02 260)" }}
    >
      {/* App identity */}
      <div className="px-6 pt-7 pb-3 min-w-0">
        {/* Logo wrapper: w-full + overflow-visible ensures the SVG wordmark
            fills the available sidebar width without clipping on the right. */}
        <div className="w-full overflow-visible">
          <Logo />
        </div>
        <p className="text-white/25 text-[11px] tracking-widest uppercase mt-10 font-medium">
          Private Memory Theatre
        </p>
      </div>

      {/* Vault list */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5 py-1">
        {/* All vaults */}
        <button
          onClick={() => onSelectGroup("all")}
          aria-current={activeGroupId === "all" ? "true" : undefined}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer group",
            activeGroupId === "all"
              ? "bg-white/[0.08] text-white"
              : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
          )}
        >
          <div className={cn(
            "size-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
            activeGroupId === "all" ? "bg-white/15" : "bg-white/[0.06] group-hover:bg-white/10"
          )}>
            <span className="text-xs font-bold">∞</span>
          </div>
          <div className="min-w-0">
            <p className={cn("text-sm font-medium truncate leading-tight",
              activeGroupId === "all" ? "text-white" : "text-white/70")}>
              All memories
            </p>
            <p className="text-[11px] text-white/30 truncate mt-0.5">
              {groups.length} {groups.length === 1 ? "vault" : "vaults"}
            </p>
          </div>
        </button>

        {groups.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-white/30 text-xs leading-relaxed">
              No vaults yet.{" "}
              <span className="text-white/50">Create or join one below.</span>
            </p>
          </div>
        )}

        {groups.length > 0 && (
          <div className="pt-3 pb-1 px-4">
            <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest">
              Your Vaults
            </p>
          </div>
        )}

        {groups.map(g => {
          const isActive = activeGroupId === g.id
          const initial  = g.name[0]?.toUpperCase() ?? "V"
          return (
            <button
              key={g.id}
              onClick={() => onSelectGroup(g.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer group",
                "transition-colors duration-150 rounded-xl relative",
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-white/45 hover:bg-white/[0.04] hover:text-white/75"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" aria-hidden />
              )}
              <div className={cn(
                "size-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors duration-150",
                isActive ? "bg-primary/25 text-primary" : "bg-white/[0.05] group-hover:bg-white/[0.09]"
              )}>
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-[13px] font-medium truncate leading-tight",
                  isActive ? "text-white" : "text-white/65")}>
                  {g.name}
                </p>
                <p className="text-[11px] text-white/25 truncate mt-0.5">
                  {g.member_count} {g.member_count === 1 ? "person" : "people"}
                </p>
              </div>
              {isActive && (
                <button
                  onClick={e => { e.stopPropagation(); onNavigate("group", g) }}
                  aria-label={`Manage ${g.name}`}
                  className="p-1.5 text-white/20 hover:text-white/60 transition-colors duration-150 cursor-pointer shrink-0
                             focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-md"
                >
                  <Settings className="size-3.5" />
                </button>
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-4 pb-6 pt-3 border-t border-white/[0.05] space-y-1">

        {/* Settings */}
        <button
          onClick={() => onNavigate("settings")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:bg-white/[0.05] hover:text-white/80 transition-all cursor-pointer"
        >
          <div className="size-8 flex items-center justify-center">
            <Settings className="size-4" />
          </div>
          <span className="text-sm font-medium text-white/60">Settings</span>
        </button>

        {/* Upload */}
        <button
          onClick={onUpload}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary transition-all cursor-pointer mt-2"
        >
          <div className="size-8 flex items-center justify-center">
            <Plus className="size-4" />
          </div>
          <span className="text-sm font-semibold">Share a memory</span>
        </button>

        {/* User identity — avatar is the DropdownMenu trigger (matches mobile pattern).
             Name is plain text outside all Radix components so it never collapses. */}
        <div className="flex items-center gap-3 px-3 py-3 mt-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer shrink-0" aria-label={`User menu for ${currentUser?.name ?? "account"}`}>
                <Avatar className="size-8 ring-1 ring-white/10 hover:ring-white/30 transition-all">
                  <AvatarImage src={currentUser?.avatar} className="object-cover" />
                  <AvatarFallback className="bg-primary/30 text-primary text-xs font-bold">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-44 border-white/10"
              style={{ background: "oklch(0.14 0.02 260 / 0.97)", backdropFilter: "blur(20px)" }}
              side="right"
              align="end"
            >
              <DropdownMenuLabel className="text-white/50 text-xs font-normal">{currentUser?.name}</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={() => onNavigate("settings")}
                className="text-white/70 hover:!bg-white/[0.06] cursor-pointer"
              >
                <Settings className="mr-2 size-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={onLogout}
                className="text-white/70 hover:!bg-white/[0.06] hover:!text-red-400 cursor-pointer"
              >
                <LogOut className="mr-2 size-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Name outside Radix — never affected by trigger lifecycle */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/80 leading-tight truncate">{currentUser?.name}</p>
            <p className="text-[11px] text-white/30">View profile</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
