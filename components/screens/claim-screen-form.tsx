"use client"

import { useState, useRef, useEffect } from "react"
import { Check, X as XIcon, AlertCircle } from "lucide-react"
import { apiFetch } from "@/lib/api"
import type { Group } from "@/lib/types"

interface CreateVaultFormProps {
  open: boolean
  onCreated: (g: Group) => void
  onClose: () => void
}

/**
 * Controlled inline form for creating a new vault.
 * Pass 21: supports both "normal" and "child" vault types.
 * When "child" is selected, a required child_email field is shown.
 *
 * Single-mounted by the parent (FeedScreen) — the `open` prop gates rendering.
 * Displays an inline error on failure; allows retry without losing input.
 */
export function CreateVaultForm({ open, onCreated, onClose }: CreateVaultFormProps) {
  const [name,       setName]       = useState("")
  const [vaultType,  setVaultType]  = useState<"normal" | "child">("normal")
  const [childEmail, setChildEmail] = useState("")
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName("");  setVaultType("normal")
      setChildEmail(""); setError(null); setLoading(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  const create = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError("Vault name is required"); return }
    if (vaultType === "child" && !childEmail.trim()) {
      setError("Child email is required for a child vault"); return
    }
    setError(null)
    setLoading(true)
    const body: Record<string, string> = { name: trimmed, vault_type: vaultType }
    if (vaultType === "child") body.child_email = childEmail.trim()
    const result = await apiFetch<Group>("/api/vaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (result.ok) {
      onCreated(result.data)
      onClose()
    } else {
      setError(result.error ?? "Failed to create vault. Try again.")
    }
  }

  return (
    <div className="space-y-3 bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 w-72">
      {/* Vault type selector */}
      <fieldset>
        <legend className="sr-only">Vault type</legend>
        <div className="flex gap-3" role="group" aria-label="Vault type">
          {(["normal", "child"] as const).map(type => (
            <label key={type} className="flex items-center gap-2 cursor-pointer text-sm text-white/80 select-none">
              <input
                type="radio"
                name="vault-type"
                value={type}
                checked={vaultType === type}
                onChange={() => { setVaultType(type); setError(null) }}
                disabled={loading}
                className="accent-primary"
              />
              {type === "normal" ? "Family Vault" : "Child Vault"}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Vault name */}
      <div>
        <label htmlFor="create-vault-name-input" className="sr-only">Vault name</label>
        <input
          ref={inputRef}
          id="create-vault-name-input"
          value={name}
          onChange={e => { setName(e.target.value); setError(null) }}
          onKeyDown={e => { if (e.key === "Enter") create() }}
          placeholder="Vault name…"
          maxLength={50}
          disabled={loading}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "create-vault-error" : undefined}
          className="w-full bg-transparent border border-zinc-700 rounded-xl px-3 py-2
                     text-white text-sm outline-none placeholder:text-zinc-500
                     focus:border-primary/50 disabled:opacity-60"
        />
      </div>

      {/* Child email — only shown for child vault type */}
      {vaultType === "child" && (
        <div>
          <label htmlFor="create-vault-child-email" className="sr-only">Child email</label>
          <input
            id="create-vault-child-email"
            type="email"
            value={childEmail}
            onChange={e => { setChildEmail(e.target.value); setError(null) }}
            onKeyDown={e => { if (e.key === "Enter") create() }}
            placeholder="Child's email address…"
            disabled={loading}
            aria-invalid={error ? "true" : undefined}
            className="w-full bg-transparent border border-zinc-700 rounded-xl px-3 py-2
                       text-white text-sm outline-none placeholder:text-zinc-500
                       focus:border-primary/50 disabled:opacity-60"
          />
          <p className="text-zinc-500 text-xs mt-1 pl-1">
            They'll use this email to claim the vault later.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Cancel create vault"
          className="text-zinc-500 hover:text-white cursor-pointer flex items-center justify-center
                     size-8 rounded-full hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <XIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={create}
          disabled={loading}
          aria-label={loading ? "Creating vault…" : "Confirm create vault"}
          className="text-primary hover:text-primary/80 cursor-pointer disabled:opacity-50
                     flex items-center justify-center size-8 rounded-full hover:bg-zinc-800 transition-colors"
        >
          <Check className="size-4" />
        </button>
      </div>

      {error && (
        <p id="create-vault-error" role="alert"
           className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="size-3 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
