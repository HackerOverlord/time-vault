"use client"

import { useState } from "react"
import { Plus, X, Check } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import type { Group } from "@/lib/types"

interface CreateGroupPillProps {
  onCreated: (g: Group) => void
}

export function CreateGroupPill({ onCreated }: CreateGroupPillProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)

  const create = async () => {
    if (!name.trim()) {
      toast.error("Vault name is required")
      return
    }
    setLoading(true)
    const result = await apiFetch<Group>("/api/vaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (result.ok) {
      onCreated(result.data)
      setName("")
      setOpen(false)
      toast.success(`"${result.data.name}" created`)
    } else {
      toast.error(result.error ?? "Failed to create vault")
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-white/70 hover:bg-white/20 hover:text-white whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 shrink-0"
      >
        <Plus className="size-3" /> New vault
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
        placeholder="Vault name…"
        className="bg-transparent text-white text-xs outline-none w-28 placeholder:text-zinc-500"
      />
      <button onClick={create} disabled={loading} className="text-primary hover:text-primary/80 cursor-pointer disabled:opacity-50">
        <Check className="size-3.5" />
      </button>
      <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer">
        <X className="size-3.5" />
      </button>
    </div>
  )
}
