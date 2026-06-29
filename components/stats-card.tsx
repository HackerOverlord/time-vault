"use client"

import { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    label: string
  }
  variant?: "default" | "primary" | "success" | "warning"
}

export function StatsCard({ title, value, icon: Icon, trend, variant = "default" }: StatsCardProps) {
  const variants = {
    default: {
      icon: "bg-secondary text-muted-foreground",
      glow: "",
    },
    primary: {
      icon: "bg-primary/10 text-primary",
      glow: "shadow-[0_0_30px_rgba(74,158,255,0.1)]",
    },
    success: {
      icon: "bg-success/10 text-success",
      glow: "shadow-[0_0_30px_rgba(16,185,129,0.1)]",
    },
    warning: {
      icon: "bg-warning/10 text-warning",
      glow: "shadow-[0_0_30px_rgba(245,158,11,0.1)]",
    },
  }

  const style = variants[variant]

  return (
    <Card className={cn(
      "relative overflow-hidden p-5 bg-card/60 backdrop-blur-sm border-border/50 transition-all hover:bg-card/80",
      style.glow
    )}>
      {/* Background gradient */}
      <div className={cn(
        "absolute inset-0 opacity-[0.03]",
        variant === "primary" && "bg-gradient-to-br from-primary to-transparent",
        variant === "success" && "bg-gradient-to-br from-success to-transparent",
        variant === "warning" && "bg-gradient-to-br from-warning to-transparent"
      )} />

      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {trend && (
            <p className={cn(
              "text-xs font-medium",
              trend.value >= 0 ? "text-success" : "text-destructive"
            )}>
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", style.icon)}>
          <Icon className="size-6" />
        </div>
      </div>
    </Card>
  )
}
