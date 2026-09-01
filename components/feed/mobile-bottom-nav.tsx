"use client"

import { cn } from "@/lib/utils"
import { Folder, LayoutList, Plus, History, Settings } from "lucide-react"

/**
 * MobileBottomNav — fixed bottom nav for mobile/tablet only (lg:hidden).
 *
 * Destinations:
 *   Vaults   → sets activeGroupId to "all" and navigates to feed
 *   Feed     → sets viewMode to "feed"
 *   +        → opens upload modal (primary action)
 *   Timeline → sets viewMode to "timeline"
 *   Settings → navigates to settings screen
 *
 * No new screens are invented. All actions map to existing functionality.
 */

interface MobileBottomNavProps {
  viewMode: "feed" | "timeline" | null
  onSelectFeed:     () => void
  onSelectTimeline: () => void
  onSelectVaults:   () => void
  onOpenUpload:     () => void
  onOpenSettings:   () => void
  disabled?: boolean
}

export function MobileBottomNav({
  viewMode,
  onSelectFeed,
  onSelectTimeline,
  onSelectVaults,
  onOpenUpload,
  onOpenSettings,
  disabled = false,
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        "lg:hidden shrink-0 w-full",
        "flex items-center justify-around",
        "border-t border-white/[0.07]",
      )}
      style={{
        background: "oklch(0.10 0.02 260 / 0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        height: "calc(4rem + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Vaults */}
      <button
        onClick={onSelectVaults}
        disabled={disabled}
        aria-label="Vaults"
        className={cn(
          "flex flex-col items-center gap-0.5 flex-1 py-2 min-h-11 justify-center",
          "transition-colors cursor-pointer disabled:opacity-40",
          "text-white/40 hover:text-white/80",
        )}
      >
        <Folder className="size-5" aria-hidden />
        <span className="text-[10px] font-medium">Vaults</span>
      </button>

      {/* Feed */}
      <button
        onClick={onSelectFeed}
        disabled={disabled}
        aria-label="Feed"
        aria-pressed={viewMode === "feed"}
        className={cn(
          "flex flex-col items-center gap-0.5 flex-1 py-2 min-h-11 justify-center",
          "transition-colors cursor-pointer disabled:opacity-40",
          viewMode === "feed" ? "text-primary" : "text-white/40 hover:text-white/80",
        )}
      >
        <LayoutList className="size-5" aria-hidden />
        <span className="text-[10px] font-medium">Feed</span>
      </button>

      {/* Upload — primary centered action */}
      <div className="flex-1 flex items-center justify-center">
        <button
          onClick={onOpenUpload}
          disabled={disabled}
          aria-label="Share a memory"
          className={cn(
            "size-12 rounded-full bg-primary shadow-lg shadow-primary/30",
            "flex items-center justify-center",
            "transition-all active:scale-95 cursor-pointer disabled:opacity-40",
            "hover:bg-primary/90",
          )}
        >
          <Plus className="size-6 text-white" aria-hidden />
        </button>
      </div>

      {/* Timeline view */}
      <button
        onClick={onSelectTimeline}
        disabled={disabled}
        aria-label="Timeline"
        aria-pressed={viewMode === "timeline"}
        className={cn(
          "flex flex-col items-center gap-0.5 flex-1 py-2 min-h-11 justify-center",
          "transition-colors cursor-pointer disabled:opacity-40",
          viewMode === "timeline" ? "text-primary" : "text-white/40 hover:text-white/80",
        )}
      >
        <History className="size-5" aria-hidden />
        <span className="text-[10px] font-medium">Timeline</span>
      </button>

      {/* Settings */}
      <button
        onClick={onOpenSettings}
        disabled={disabled}
        aria-label="Settings"
        className={cn(
          "flex flex-col items-center gap-0.5 flex-1 py-2 min-h-11 justify-center",
          "transition-colors cursor-pointer disabled:opacity-40",
          "text-white/40 hover:text-white/80",
        )}
      >
        <Settings className="size-5" aria-hidden />
        <span className="text-[10px] font-medium">Settings</span>
      </button>
    </nav>
  )
}
