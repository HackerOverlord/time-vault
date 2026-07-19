"use client"

import { Settings } from "lucide-react"
import { cn } from "@/lib/utils"

interface GroupPillProps {
  label: string
  active: boolean
  onClick: () => void
  onManage?: () => void
}

export function GroupPill({ label, active, onClick, onManage }: GroupPillProps) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={onClick}
        className={cn(
          "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
          active ? "bg-white text-black" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
        )}
      >
        {label}
      </button>
      {onManage && active && (
        <button
          onClick={onManage}
          aria-label={`Manage ${label}`}
          className="p-2 text-white/50 hover:text-white transition-colors cursor-pointer"
        >
          <Settings className="size-3" />
        </button>
      )}
    </div>
  )
}
