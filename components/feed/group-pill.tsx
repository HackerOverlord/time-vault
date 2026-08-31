"use client"

import { Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { accentGradient, vaultInitials } from "@/lib/vaultAccent"
import type { Group } from "@/lib/types"

interface GroupPillProps {
  label: string
  active: boolean
  onClick: () => void
  onManage?: () => void
  // Optional vault identity for avatar preview (Pass 18)
  group?: Pick<Group, "cover_url" | "accent_color" | "name">
}

export function GroupPill({ label, active, onClick, onManage, group }: GroupPillProps) {
  const gradClass = accentGradient(group?.accent_color)
  const initials  = group ? vaultInitials(group.name) : ""

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={cn(
          "px-4 min-h-9 inline-flex items-center gap-1.5 rounded-full text-sm font-semibold whitespace-nowrap lg:px-2.5 lg:min-h-8 lg:text-[11px]",
          "transition-all duration-200 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
          active
            ? "bg-white text-black shadow-sm"
            : "bg-white/[0.08] text-white/60 hover:bg-white/[0.14] hover:text-white/90 backdrop-blur-sm"
        )}
      >
        {/* Vault mini avatar — only for named vaults, not the "All" pill */}
        {group && (
          <span
            className={cn(
              "size-4 rounded-full overflow-hidden flex items-center justify-center shrink-0",
              "bg-gradient-to-br",
              gradClass,
            )}
            aria-hidden
          >
            {group.cover_url ? (
              <img
                src={group.cover_url}
                alt=""
                aria-hidden
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-white text-[7px] font-bold leading-none select-none">
                {initials.slice(0, 1)}
              </span>
            )}
          </span>
        )}
        {label}
      </button>
      {onManage && active && (
        <button
          onClick={onManage}
          aria-label={`Manage ${label}`}
          className="flex min-h-11 min-w-11 items-center justify-center text-white/40 hover:text-white/80 transition-colors duration-150 cursor-pointer
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-full"
        >
          <Settings className="size-3" />
        </button>
      )}
    </div>
  )
}
