"use client"

/**
 * ClaimScreen — Pass 21
 *
 * Displays the child vault claim flow for a given token.
 * States: loading → valid (show form) → success | expired | invalid | already-claimed
 *
 * Accessible: semantic headings, labelled inputs, status regions.
 */

import React, { useState, useEffect } from "react"
import { Lock, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { apiFetch } from "@/lib/api"

interface ClaimScreenProps {
  /** The raw claim token extracted from the URL. */
  token: string
  onNavigate: (screen: "login" | "feed") => void
}

type ClaimState =
  | { status: "loading" }
  | { status: "valid";   vaultName: string; createdBy: string; expiresAt: string }
  | { status: "success"; vaultName: string }
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "already_claimed" }

export function ClaimScreen({ token, onNavigate }: ClaimScreenProps) {
  const [state,       setState]       = useState<ClaimState>({ status: "loading" })
  const [displayName, setDisplayName] = useState("")
  const [password,    setPassword]    = useState("")
  const [submitting,  setSubmitting]  = useState(false)
  const [formError,   setFormError]   = useState<string | null>(null)

  // Validate the token by peeking at it via a GET endpoint
  // (we call claim with the token to get vault info, using a dry-run approach
  //  by sending a dedicated info endpoint — which we simulate by calling
  //  a lightweight lookup: POST /api/claim-vault?peek=1 or use a GET variant)
  // For simplicity we use the claim endpoint with peek mode implied by
  // missing password/display_name to get vault info.
  useEffect(() => {
    let cancelled = false
    const fetchInfo = async () => {
      // GET /api/claim-info?token=... — lightweight token validation
      const r = await apiFetch<{
        vault_name: string; created_by: string; expires_at: string
      }>(`/api/claim-info?token=${encodeURIComponent(token)}`, { method: "GET" })

      if (cancelled) return
      if (r.ok) {
        setState({
          status: "valid",
          vaultName: r.data.vault_name,
          createdBy: r.data.created_by,
          expiresAt: r.data.expires_at,
        })
      } else if (r.status === 410) {
        // 410 = expired or already used
        const msg = r.error ?? ""
        if (msg.toLowerCase().includes("already")) setState({ status: "already_claimed" })
        else setState({ status: "expired" })
      } else if (r.status === 409) {
        setState({ status: "already_claimed" })
      } else {
        setState({ status: "invalid" })
      }
    }
    fetchInfo()
    return () => { cancelled = true }
  }, [token])

  const handleClaim = async () => {
    if (!displayName.trim()) { setFormError("Display name is required"); return }
    if (!password || password.length < 8) { setFormError("Password must be at least 8 characters"); return }
    setFormError(null)
    setSubmitting(true)

    const result = await apiFetch<{ claimed: boolean; access_token?: string }>(
      "/api/claim-vault",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, display_name: displayName.trim(), password }),
      }
    )
    setSubmitting(false)

    if (result.ok) {
      if (result.data.access_token) {
        sessionStorage.setItem("token", result.data.access_token)
      }
      setState({ status: "success", vaultName: (state as Extract<ClaimState, { status: "valid" }>).vaultName })
    } else if (result.status === 410) {
      setState({ status: "expired" })
    } else if (result.status === 409) {
      setState({ status: "already_claimed" })
    } else {
      setFormError(result.error ?? "Failed to claim vault. Please try again.")
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (state.status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-white/40 animate-pulse">Validating invitation…</p>
      </div>
    )
  }

  if (state.status === "invalid") {
    return (
      <StatusCard icon={<AlertCircle className="size-10 text-red-400" />} heading="Invalid invitation">
        <p className="text-white/50 text-sm text-center">
          This invitation link is not valid. It may have been mistyped or removed.
        </p>
        <button onClick={() => onNavigate("login")}
          className="mt-4 text-sm text-primary hover:underline cursor-pointer">
          Go to sign in
        </button>
      </StatusCard>
    )
  }

  if (state.status === "expired") {
    return (
      <StatusCard icon={<Clock className="size-10 text-amber-400" />} heading="Token expired">
        <p className="text-white/50 text-sm text-center">
          This invitation has expired. Ask the vault owner to send a new one.
        </p>
        <button onClick={() => onNavigate("login")}
          className="mt-4 text-sm text-primary hover:underline cursor-pointer">
          Go to sign in
        </button>
      </StatusCard>
    )
  }

  if (state.status === "already_claimed") {
    return (
      <StatusCard icon={<CheckCircle className="size-10 text-emerald-400" />} heading="Already claimed">
        <p className="text-white/50 text-sm text-center">
          This vault has already been claimed. Sign in to access it.
        </p>
        <button onClick={() => onNavigate("login")}
          className="mt-4 text-sm text-primary hover:underline cursor-pointer">
          Sign in
        </button>
      </StatusCard>
    )
  }

  if (state.status === "success") {
    return (
      <StatusCard icon={<CheckCircle className="size-10 text-emerald-400" />}
                  heading="Vault claimed!">
        <p className="text-white/60 text-sm text-center">
          You now have access to <strong className="text-white">{state.vaultName}</strong>.
        </p>
        <button
          onClick={() => onNavigate("feed")}
          className="mt-4 bg-primary hover:bg-primary/90 text-white text-sm font-semibold
                     rounded-2xl px-6 h-10 cursor-pointer transition-colors"
        >
          Open your vault
        </button>
      </StatusCard>
    )
  }

  // ── Valid token — show claim form ──────────────────────────────────────────
  const { vaultName, createdBy, expiresAt } = state
  const expiryDisplay = new Date(expiresAt).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  })

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="size-16 rounded-full bg-white/[0.06] flex items-center justify-center">
            <Lock className="size-7 text-white/50" aria-hidden />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-white font-bold text-2xl">Claim your vault</h1>
            <p className="text-white/50 text-sm">
              <strong className="text-white/80">{createdBy}</strong> created{" "}
              <strong className="text-white/80">{vaultName}</strong> for you
            </p>
            <p className="text-white/30 text-xs">Invitation expires {expiryDisplay}</p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={e => { e.preventDefault(); handleClaim() }}
          className="space-y-3"
          aria-label="Claim vault form"
        >
          <div>
            <label htmlFor="claim-display-name" className="text-xs text-white/50 uppercase tracking-widest font-semibold block mb-1.5">
              Your name
            </label>
            <input
              id="claim-display-name"
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setFormError(null) }}
              placeholder="How should we call you?"
              disabled={submitting}
              required
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3
                         text-sm text-white placeholder:text-zinc-600
                         focus:outline-none focus:border-primary/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="claim-password" className="text-xs text-white/50 uppercase tracking-widest font-semibold block mb-1.5">
              Create password
            </label>
            <input
              id="claim-password"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setFormError(null) }}
              placeholder="At least 8 characters"
              disabled={submitting}
              required
              minLength={8}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3
                         text-sm text-white placeholder:text-zinc-600
                         focus:outline-none focus:border-primary/50 disabled:opacity-50"
            />
          </div>

          {formError && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="size-3 shrink-0" aria-hidden />
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white
                       font-semibold text-sm rounded-2xl h-12 cursor-pointer transition-colors"
          >
            {submitting ? "Claiming…" : "Claim vault"}
          </button>
        </form>

        <p className="text-center text-white/30 text-xs">
          Already have an account?{" "}
          <button onClick={() => onNavigate("login")}
            className="text-primary hover:underline cursor-pointer">
            Sign in instead
          </button>
        </p>
      </div>
    </div>
  )
}

/** Reusable status card layout. */
function StatusCard({
  icon, heading, children,
}: { icon: React.ReactNode; heading: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 max-w-xs text-center">
        {icon}
        <h1 className="text-white font-bold text-xl">{heading}</h1>
        {children}
      </div>
    </div>
  )
}
