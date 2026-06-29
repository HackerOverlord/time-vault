"use client"

import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface Tab {
  id: string
  label: string
  icon: LucideIcon
  badge?: number
}

interface NavTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function NavTabs({ tabs, activeTab, onTabChange }: NavTabsProps) {
  return (
    <nav className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50 backdrop-blur-sm border border-border/50">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const Icon = tab.icon

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
              isActive
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  "absolute -top-1 -right-1 size-5 flex items-center justify-center rounded-full text-[10px] font-bold",
                  isActive
                    ? "bg-primary-foreground text-primary"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {tab.badge > 9 ? "9+" : tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
