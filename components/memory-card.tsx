"use client"

import { useState, useEffect } from "react"
import { Lock, Unlock, Clock, Image, Video, Mic, ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MemoryCardProps {
  id: string
  title: string
  releaseDate: Date
  status: "locked" | "released"
  is_draft?: boolean
  hasImage?: boolean
  hasVideo?: boolean
  hasAudio?: boolean
  sender?: string
  recipient?: string
  onClick?: () => void
}

function getTimeRemaining(targetDate: Date) {
  const now = new Date().getTime()
  const target = targetDate.getTime()
  const diff = target - now

  if (diff <= 0) return null

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds }
}

export function MemoryCard({
  id,
  title,
  releaseDate,
  status,
  is_draft = false,
  hasImage,
  hasVideo,
  hasAudio,
  sender,
  recipient,
  onClick,
}: MemoryCardProps) {
  // 1. Hook state declared first
  const [timeLeft, setTimeLeft] = useState(getTimeRemaining(releaseDate))

  // 2. Side effect manages the background countdown loop safely
  useEffect(() => {
    if (is_draft) return

    const timer = setInterval(() => {
      const remaining = getTimeRemaining(releaseDate)
      setTimeLeft(remaining)
      
      // FIXED HERE: Changed 'timeRemaining' to 'remaining' to match the variable above
      if (!remaining) {
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [releaseDate, is_draft])

  // 3. Conditional boolean configuration safely sitting below the hooks
  const isLocked = status === "locked" && !is_draft && timeLeft !== null

  return (
    <Card
      onClick={onClick}
      className={cn(
        "group relative overflow-visible rounded-lg transition-all duration-300 hover:translate-y-[-2px] bg-zinc-900/40 backdrop-blur-md border-zinc-800/80 hover:border-zinc-700/80 hover:bg-zinc-800/30 cursor-pointer",
        isLocked ? "hover:shadow-[0_0_20px_rgba(234,179,8,0.03)]" : "hover:shadow-[0_0_20px_rgba(34,197,94,0.03)]"
      )}
    >
      {/* Visual Accent glow tracks */}
      <div
        className={cn(
          "absolute left-0 top-1 bottom-1 w-[3px] rounded-l-lg transition-all duration-300",
          is_draft 
            ? "bg-zinc-600" 
            : isLocked 
              ? "bg-yellow-500" 
              : "bg-green-500"
        )}
      />

      <div className="p-5 pl-6 flex items-center justify-between gap-4">
  {/* Left: Title + meta */}
  <div className="flex flex-col justify-between flex-1 min-w-0 min-h-[50px]">
    <div className="flex items-center gap-2">
      <h3 className="font-semibold text-sm text-zinc-100 tracking-tight group-hover:text-white transition-colors truncate">
        {title}
      </h3>
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] px-2 py-0.5 font-medium tracking-wide uppercase border-0 rounded-md shrink-0",
          is_draft
            ? "bg-zinc-800/60 text-zinc-400"
            : isLocked
              ? "bg-yellow-500/10 text-yellow-500"
              : "bg-green-500/10 text-green-500"
        )}
      >
        {is_draft ? "Draft" : status}
      </Badge>
    </div>

    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-auto">
  {!is_draft && (
    <span className="flex items-center gap-1">
      <Clock className="size-3 shrink-0" />
      {releaseDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}
    </span>
  )}

  
  {sender && (
  <>
    <span className="text-zinc-700">·</span>
    
    <span className="inline-flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/40 rounded-full px-2.5 py-0.5">
      <span className="size-1.5 rounded-full bg-primary/70 shrink-0" />
      <span className="text-zinc-300 font-medium text-[11px] ">{sender}</span>
    </span>
  </>
)}
</div>
  </div>

  {/* Right: countdown + media + view */}
  <div className="flex items-center gap-4 shrink-0">
    {!is_draft && isLocked && timeLeft && (
      <div className="flex items-center gap-2 bg-zinc-950/40 px-3 py-1.5 rounded-xl border border-zinc-800/60">
        <TimeUnit value={timeLeft.days} label="d" />
        <span className="text-zinc-700 font-bold">:</span>
        <TimeUnit value={timeLeft.hours} label="h" />
        <span className="text-zinc-700 font-bold">:</span>
        <TimeUnit value={timeLeft.minutes} label="m" />
        <span className="text-zinc-700 font-bold">:</span>
        <TimeUnit value={timeLeft.seconds} label="s" />
      </div>
    )}

    <div className="flex items-center gap-1">
      {hasImage && (
  <div className="size-7 rounded-md bg-secondary flex items-center justify-center border border-zinc-700/50">
    <Image className="size-3.5 text-muted-foreground" />
  </div>
)}
{hasVideo && (
  <div className="size-7 rounded-md bg-secondary flex items-center justify-center border border-zinc-700/50">
    <Video className="size-3.5 text-muted-foreground" />
  </div>
)}
{hasAudio && (
  <div className="size-7 rounded-md bg-secondary flex items-center justify-center border border-zinc-700/50">
    <Mic className="size-3.5 text-muted-foreground" />
  </div>
)}
    </div>

    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-primary transition-colors cursor-pointer outline-none bg-transparent border-0 p-0"
    >
      <span>View</span>
      <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
    </button>
  </div>
</div>
    </Card>
  )
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold text-foreground font-mono tabular-nums">
        {value.toString().padStart(2, "0")}
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  )
}
