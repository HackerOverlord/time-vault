"use client"

import { Plus, Edit2, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FamilyMemberCardProps {
  id: string
  name: string
  relationship: string
  birthYear?: number
  photo?: string
  generation?: number
  onView?: () => void
  onEdit?: () => void
  onAddRelative?: () => void
  onRemove?: () => void;
}

export function FamilyMemberCard({
  id,
  name,
  relationship,
  birthYear,
  photo,
  generation = 0,
  onView,
  onEdit,
  onAddRelative,
  onRemove
}: FamilyMemberCardProps) {
  const age = birthYear ? new Date().getFullYear() - birthYear : null
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()

  const generationStyles = {
    0: "border-yellow-400/60 shadow-[0_0_30px_rgba(250,204,21,0.15)]",
    1: "border-primary/60",
    2: "border-primary/40 scale-95",
    3: "border-primary/30 scale-90",
  }

  return (
    <div
      className={cn(
        "group relative p-5 rounded-3xl cursor-pointer transition-all duration-300",
        "bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-sm",
        "border-2 hover:border-primary hover:-translate-y-1",
        "shadow-lg hover:shadow-xl hover:shadow-primary/10",
        generationStyles[generation as keyof typeof generationStyles] || generationStyles[1]
      )}
      onClick={onView}
    >
      {/* Avatar */}
      <Avatar className={cn(
        "size-16 mx-auto mb-4 ring-2 ring-offset-2 ring-offset-card transition-all",
        generation === 0 
          ? "ring-yellow-400/50" 
          : "ring-primary/30 group-hover:ring-primary/60"
      )}>
        <AvatarImage src={photo} alt={name} />
        <AvatarFallback className={cn(
          "text-lg font-bold",
          generation === 0 
            ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-yellow-950" 
            : "bg-gradient-to-br from-primary to-chart-5 text-primary-foreground"
        )}>
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="text-center space-y-1">
        <h4 className="font-semibold text-foreground text-sm leading-tight">
          {name}
        </h4>
        {age && (
          <p className="text-[11px] text-muted-foreground/70">
            Age: {age}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 px-2.5 text-xs bg-success/10 hover:bg-success/20 text-success border-0 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            onEdit?.()
          }}
        >
          <Edit2 className="size-3 mr-1" />
          Edit
        </Button>
      </div>

      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 to-chart-5/10 opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl" />
          {onRemove && (
        <button 
          onClick={(e) => {
            e.stopPropagation(); 
            onRemove();
          }}
          className="absolute top-2 right-2 p-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-colors cursor-pointer"
        >
          <Trash2 className="size-3" />
        </button>
      )}
    </div>

    
  )
}
