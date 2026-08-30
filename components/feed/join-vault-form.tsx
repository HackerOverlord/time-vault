"use client"

import { useState, useRef, useEffect } from "react"
import { Check, X as XIcon, AlertCircle } from "lucide-react"
import { apiFetch } from "@/lib/api"

interface JoinVaultFormProps {
  open: boolean
  onJoined: (vaultId: string, vaultName: string) => Promise<void>
  onClose: () => void
}

/**
 * Controlled inline form for joining a vault via invite code.
 * Single-mounted by the parent (FeedScreen) — the `open` prop gates rendering.
 * Displays an inline error message on failure; allows retry without losing the code.
 */
export function JoinVaultForm({ open, onJoined, onClose }: JoinVaultFormProps) {
  const [code,    setCode]    = useState("")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setCode("")
      setError(null)
      setLoading(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  const join = async () => {
    if (!code.trim()) { setError("Enter an invite code"); return }
    setError(null)
    setLoading(true)
    const result = await apiFetch<{ vault: { id: string; name: string }; message: string }>(
      "/api/vaults/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: code }),
      }
    )
    setLoading(false)
    if (result.ok) {
      const { id, name } = result.data.vault
      onClose()
      await onJoined(id, name)
    } else {
      // Keep the code visible so the user can correct and retry
      setError(result.error ?? "Could not join vault. Check the code and try again.")
    }
  }

  return (
    <div className="space-y-1.5">
      <form
        onSubmit={e => { e.preventDefault(); join() }}
        className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-2xl px-3 py-2 w-fit"
        aria-label="Join vault with invite code"
      >
        <label htmlFor="join-vault-code-input" className="sr-only">Invite code</label>
        <input
          ref={inputRef}
          id="join-vault-code-input"
          value={code}
          onChange={e => { setCode(e.target.value.replace(/-/g, "").toUpperCase()); setError(null) }}
          placeholder="Invite code…"
          maxLength={7}
          disabled={loading}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "join-vault-error" : undefined}
          className="bg-transparent text-white text-sm outline-none w-28 placeholder:text-zinc-500 font-mono tracking-widest min-w-0 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading}
          aria-label={loading ? "Joining vault…" : "Confirm join vault"}
          className="text-primary hover:text-primary/80 cursor-pointer disabled:opacity-50 flex items-center justify-center size-7 shrink-0"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Cancel join vault"
          className="text-zinc-500 hover:text-white cursor-pointer flex items-center justify-center size-7 shrink-0 disabled:opacity-50"
        >
          <XIcon className="size-4" />
        </button>
      </form>
      {error && (
        <p
          id="join-vault-error"
          role="alert"
          className="flex items-center gap-1.5 text-xs text-red-400 pl-1"
        >
          <AlertCircle className="size-3 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
