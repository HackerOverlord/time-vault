"use client"

import { useState, useRef, useEffect } from "react"
import { Check, X as XIcon, AlertCircle, Link2, Hash } from "lucide-react"
import { apiFetch } from "@/lib/api"
import type { Group } from "@/lib/types"

interface JoinVaultFormProps {
  open: boolean
  onJoined: (vaultId: string, vaultName: string) => Promise<void>
  onClose: () => void
}

/**
 * JoinVaultForm — accepts either:
 *   A. A shareable invite link  (…/invite/<token>)   → joined via token API
 *   B. A legacy 6-char invite code                   → joined via code API
 *
 * The input auto-detects which type was pasted/typed.
 */
export function JoinVaultForm({ open, onJoined, onClose }: JoinVaultFormProps) {
  const [value,   setValue]   = useState("")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(""); setError(null); setLoading(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  /** Extract token from a full invite URL, or return null if it looks like a code.
   * Handles:
   *   https://…/?screen=invite&token=<token>  (primary SPA share format)
   *   https://…/invite/<token>                (path form, redirected to above)
   *   <token>                                  (raw token, 20+ URL-safe chars)
   *   XXXXXX                                   (legacy 6-char invite code)
   */
  const parseInput = (raw: string): { type: "token" | "code"; value: string } | null => {
    const trimmed = raw.trim()
    // Try to parse as a URL first (catches both share formats)
    try {
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://x.com${trimmed.startsWith("/") ? trimmed : ""}`)
      // ?screen=invite&token=X (primary format)
      const tok = url.searchParams.get("token")
      if (tok && url.searchParams.get("screen") === "invite" && /^[A-Za-z0-9_-]{20,}$/.test(tok))
        return { type: "token", value: tok }
      // /invite/<token> path form
      const pathMatch = url.pathname.match(/\/invite\/([A-Za-z0-9_-]{20,})$/)
      if (pathMatch) return { type: "token", value: pathMatch[1] }
    } catch { /* not a URL */ }
    // Raw token (≥20 URL-safe chars)
    if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return { type: "token", value: trimmed }
    // Legacy 6-char code
    const code = trimmed.replace(/-/g, "").replace(/ /g, "").toUpperCase()
    if (/^[A-Z0-9]{6}$/.test(code)) return { type: "code", value: code }
    return null
  }

  const join = async () => {
    if (!value.trim()) { setError("Enter an invite link or code"); return }
    const parsed = parseInput(value)
    if (!parsed) { setError("Not a valid invite link or 6-character code"); return }
    setError(null); setLoading(true)
    let result
    if (parsed.type === "token") {
      result = await apiFetch<{ vault: { id: string; name: string }; already_member: boolean }>(
        `/api/invites/${parsed.value}/join`,
        { method: "POST" }
      )
    } else {
      result = await apiFetch<{ vault: { id: string; name: string } }>(
        "/api/vaults/join",
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite_code: parsed.value }) }
      )
    }
    setLoading(false)
    if (result.ok) {
      const { id, name } = result.data.vault
      onClose()
      await onJoined(id, name)
    } else {
      setError(result.error ?? "Could not join vault. Check the link or code and try again.")
    }
  }

  const isLink = value.trim().length > 6

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-2xl px-3 py-2 w-fit min-w-[280px]">
        {isLink
          ? <Link2 className="size-3.5 text-zinc-500 shrink-0" aria-hidden />
          : <Hash  className="size-3.5 text-zinc-500 shrink-0" aria-hidden />}
        <label htmlFor="join-vault-input" className="sr-only">Invite link or code</label>
        <input
          ref={inputRef}
          id="join-vault-input"
          value={value}
          onChange={e => { setValue(e.target.value); setError(null) }}
          onKeyDown={e => { if (e.key === "Enter") join() }}
          placeholder="Invite link or code…"
          disabled={loading}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "join-vault-error" : undefined}
          className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-zinc-500 min-w-0 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={join}
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
      </div>
      {error && (
        <p id="join-vault-error" role="alert"
           className="flex items-center gap-1.5 text-xs text-red-400 pl-1">
          <AlertCircle className="size-3 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
