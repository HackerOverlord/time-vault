"use client"

import { useState } from "react"
import { LogIn, X, Check } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"

// Local response type — only the fields the join endpoint actually returns.
// `created_by` is intentionally absent; the parent refreshes GET /api/vaults
// after a successful join to obtain the full Group object.
type JoinResponse = {
  vault: { id: string; name: string }
  message: string
}

interface JoinVaultPillProps {
  /** Called with the joined vault's id so the parent can refresh groups[] and switch filter. */
  onJoined: (vaultId: string, vaultName: string) => Promise<void>
}

export function JoinVaultPill({ onJoined }: JoinVaultPillProps) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)

  const join = async () => {
    if (!code.trim()) {
      toast.error("Enter an invite code")
      return
    }
    setLoading(true)
    const result = await apiFetch<JoinResponse>("/api/vaults/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: code }),
    })
    if (result.ok) {
      const { id, name } = result.data.vault
      setCode("")
      setOpen(false)
      await onJoined(id, name)
      toast.success(`Joined "${name}"!`)
    } else {
      toast.error(result.error ?? "Could not join vault")
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-white/70 hover:bg-white/20 hover:text-white whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 shrink-0"
      >
        <LogIn className="size-3" /> Join vault
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 shrink-0 bg-zinc-900 rounded-full px-3 py-1.5 border border-zinc-700">
      <input
        autoFocus
        value={code}
        onChange={e => setCode(e.target.value.replace(/-/g, "").toUpperCase())}
        onKeyDown={e => e.key === "Enter" && join()}
        placeholder="Invite code…"
        maxLength={6}
        className="bg-transparent text-white text-xs outline-none w-32 placeholder:text-zinc-500 font-mono tracking-widest"
      />
      <button
        onClick={join}
        disabled={loading}
        className="text-primary hover:text-primary/80 cursor-pointer disabled:opacity-50"
      >
        <Check className="size-3.5" />
      </button>
      <button
        onClick={() => { setOpen(false); setCode("") }}
        className="text-zinc-500 hover:text-white cursor-pointer"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
