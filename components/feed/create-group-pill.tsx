"use client"

import { useState } from "react"
import { Plus, X, Check } from "lucide-react"
import { toast } from "sonner"
import { API, jsonH } from "@/lib/api"
import type { Group } from "@/lib/types"

interface CreateGroupPillProps {
  onCreated: (g: Group) => void
}

export function CreateGroupPill({ onCreated }: CreateGroupPillProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)

  const create = async () => {
    if (!name.trim()) return
    setLoading(true)
    const res = await fetch(`${API}/api/groups`, {
      method: "POST",
      headers: jsonH(),
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const g = await res.json()
      onCreated(g)
      setName("")
      setOpen(false)
      toast.success(`"${g.name}" created`)
    } else {
      toast.error("Failed to create group")
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-white/70 hover:bg-white/20 hover:text-white whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 shrink-0"
      >
        <Plus className="size-3" /> New group
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 shrink-0 bg-zinc-900 rounded-full px-3 py-1.5 border border-zinc-700">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === "Enter" && create()}
        placeholder="Group name…"
        className="bg-transparent text-white text-xs outline-none w-28 placeholder:text-zinc-500"
      />
      <button onClick={create} disabled={loading} className="text-primary hover:text-primary/80 cursor-pointer">
        <Check className="size-3.5" />
      </button>
      <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer">
        <X className="size-3.5" />
      </button>
    </div>
  )
}
