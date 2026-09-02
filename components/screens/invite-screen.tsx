"use client"

import { useState, useEffect } from "react"
import { apiFetch } from "@/lib/api"
import type { Group } from "@/lib/types"
import type { Screen } from "@/lib/navigation"
import { Logo } from "@/components/logo"
import { Check, X, Users, AlertCircle, Loader2 } from "lucide-react"

interface InviteScreenProps {
  token:      string
  onNavigate: (s: Screen) => void
}

interface InviteInfo {
  vault_id:       string
  vault_name:     string
  vault_cover:    string | null
  accent_color:   string | null
  inviter_name:   string
  already_member: boolean
}

/**
 * InviteScreen — shown when the user opens a shareable invite link.
 *
 * States:
 *   loading   — resolving the invite token
 *   invalid   — token not found / expired / revoked
 *   already   — already a member of the vault
 *   confirm   — show join confirmation UI
 *   joining   — POST in progress
 *   joined    — success
 */
export function InviteScreen({ token, onNavigate }: InviteScreenProps) {
  const [state,  setState]  = useState<"loading" | "invalid" | "already" | "confirm" | "joining" | "joined">("loading")
  const [info,   setInfo]   = useState<InviteInfo | null>(null)
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const resolve = async () => {
      const res = await apiFetch<InviteInfo>(`/api/invites/${token}`)
      if (cancelled) return
      if (res.ok) {
        setInfo(res.data)
        setState(res.data.already_member ? "already" : "confirm")
      } else {
        setError(res.error ?? "This invite link is invalid or no longer active.")
        setState("invalid")
      }
    }
    resolve()
    return () => { cancelled = true }
  }, [token])

  const handleJoin = async () => {
    if (!info) return
    setState("joining")
    const res = await apiFetch<{ vault: Group; already_member: boolean }>(
      `/api/invites/${token}/join`,
      { method: "POST" }
    )
    if (res.ok) {
      setState("joined")
      setTimeout(() => onNavigate("feed"), 1400)
    } else {
      setError(res.error ?? "Could not join vault. Please try again.")
      setState("confirm")
    }
  }

  // ── Accent colour → CSS var ────────────────────────────────────────────────
  const accentMap: Record<string, string> = {
    blue:   "oklch(0.62 0.21 255)",
    green:  "oklch(0.65 0.18 150)",
    purple: "oklch(0.60 0.22 290)",
    orange: "oklch(0.68 0.19 55)",
    rose:   "oklch(0.62 0.22 10)",
    slate:  "oklch(0.55 0.04 245)",
  }
  const accent = accentMap[info?.accent_color ?? ""] ?? accentMap.blue

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-10">
      {/* Logo */}
      <div className="mb-10">
        <Logo scale={0.70} />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6 shadow-2xl">

        {/* Loading */}
        {state === "loading" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <Loader2 className="size-8 text-primary animate-spin" />
            <p className="text-white/50 text-sm">Resolving invite…</p>
          </div>
        )}

        {/* Invalid */}
        {state === "invalid" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="size-14 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="size-7 text-red-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Invalid invite</h1>
              <p className="text-white/50 text-sm mt-1.5">
                {error ?? "This invite link is invalid or no longer active."}
              </p>
            </div>
            <button
              onClick={() => onNavigate("feed")}
              className="mt-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white/70
                         bg-white/[0.07] hover:bg-white/[0.12] transition-colors cursor-pointer"
            >
              Back to Feed
            </button>
          </div>
        )}

        {/* Already a member */}
        {state === "already" && info && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            {info.vault_cover ? (
              <img src={info.vault_cover} alt="" className="size-16 rounded-2xl object-cover" />
            ) : (
              <div className="size-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white"
                   style={{ background: accent + "33" }}>
                {info.vault_name[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-white font-bold text-xl">{info.vault_name}</h1>
              <p className="text-white/50 text-sm mt-1">You're already a member.</p>
            </div>
            <button
              onClick={() => onNavigate("feed")}
              className="px-6 py-2.5 rounded-full text-sm font-semibold text-white cursor-pointer transition-colors"
              style={{ background: accent }}
            >
              Open vault
            </button>
          </div>
        )}

        {/* Confirm join */}
        {(state === "confirm" || state === "joining") && info && (
          <div className="flex flex-col items-center gap-5 text-center">
            {/* Vault avatar */}
            {info.vault_cover ? (
              <img src={info.vault_cover} alt="" className="size-20 rounded-2xl object-cover shadow-lg" />
            ) : (
              <div className="size-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-lg"
                   style={{ background: accent + "44" }}>
                {info.vault_name[0]?.toUpperCase()}
              </div>
            )}

            <div>
              <p className="text-white/50 text-sm mb-1">You've been invited</p>
              <h1 className="text-white font-bold text-2xl leading-tight">{info.vault_name}</h1>
              <p className="text-white/40 text-sm mt-1.5 flex items-center justify-center gap-1.5">
                <Users className="size-3.5" aria-hidden />
                Invited by {info.inviter_name}
              </p>
            </div>

            {error && (
              <p className="text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handleJoin}
                disabled={state === "joining"}
                className="w-full py-3 rounded-2xl text-white font-semibold text-[15px]
                           transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: accent }}
              >
                {state === "joining"
                  ? <><Loader2 className="size-4 animate-spin" /> Joining…</>
                  : "Join vault"}
              </button>
              <button
                onClick={() => onNavigate("feed")}
                disabled={state === "joining"}
                className="w-full py-3 rounded-2xl text-white/50 font-semibold text-[15px]
                           hover:text-white/80 hover:bg-white/[0.05] transition-all cursor-pointer disabled:opacity-40"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {/* Joined success */}
        {state === "joined" && info && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="size-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Check className="size-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Joined!</h1>
              <p className="text-white/50 text-sm mt-1">Welcome to {info.vault_name}.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
