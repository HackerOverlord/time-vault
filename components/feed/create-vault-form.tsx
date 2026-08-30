"use client"

import { useState, useRef, useEffect } from "react"
import { Check, X as XIcon } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import type { Group } from "@/lib/types"

interface CreateVaultFormProps {
  open: boolean
  onCreated: (g: Group) => void
  onClose: () => void
}

/**
 * Controlled inline form for creating a new vault.
 * Single-mounted by the parent (FeedScreen) — the `open` prop gates rendering.
 * Focus is managed by the parent via trigger-ref tracking.
 */
export function CreateVaultForm({ open, onCreated, onClose }: CreateVaultFormProps) {
  const [name, setName]       = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input whenever the form opens
  useEffect(() => {
    if (open) {
      setName("")
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  const create = async () => {
    const trimmed = name.trim()
    if (!trimmed) { toast.error("Vault name is required"); return }
    setLoading(true)
    const result = await apiFetch<Group>("/api/vaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
    setLoading(false)
    if (result.ok) {
      onCreated(result.data)
      toast.success(`"${result.data.name}" created`)
      onClose()
    } else {
      toast.error(result.error ?? "Failed to create vault")
    }
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); create() }}
      className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-2xl px-3 py-2 w-fit"
      aria-label="Create new vault"
    >
      <label htmlFor="create-vault-name-input" className="sr-only">Vault name</label>
      <input
        ref={inputRef}
        id="create-vault-name-input"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Vault name…"
        maxLength={50}
        className="bg-transparent text-white text-sm outline-none w-36 placeholder:text-zinc-500 min-w-0"
      />
      <button
        type="submit"
        disabled={loading}
        aria-label="Confirm create vault"
        className="text-primary hover:text-primary/80 cursor-pointer disabled:opacity-50 flex items-center justify-center size-7 shrink-0"
      >
        <Check className="size-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cancel create vault"
        className="text-zinc-500 hover:text-white cursor-pointer flex items-center justify-center size-7 shrink-0"
      >
        <XIcon className="size-4" />
      </button>
    </form>
  )
}
