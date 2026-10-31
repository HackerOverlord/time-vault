"use client"

import { useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { TwoStepCard, mfaStateFromMe, type MfaState } from "@/components/settings/two-step-card"

interface Me {
  mfaEnabled?: boolean
  mfaMethod?: string | null
  mfaPromptDismissed?: boolean
  recoveryCodesLeft?: number
}

/**
 * One-time "Protect your memories" prompt, shown on the feed to anyone who
 * hasn't turned on 2-step verification and hasn't said "Maybe later".
 * "Maybe later" is remembered on the server, so it never comes back.
 * Settings → Security always has the same options.
 */
export function TwoStepPrompt() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MfaState>({ enabled: false, method: null, codesLeft: 0 })

  useEffect(() => {
    let alive = true
    apiFetch<Me>("/api/me").then(r => {
      if (!alive || !r.ok) return
      setState(mfaStateFromMe(r.data))
      if (!r.data.mfaEnabled && !r.data.mfaPromptDismissed) setOpen(true)
    })
    return () => { alive = false }
  }, [])

  const close = () => {
    setOpen(false)
    // Fire and forget: worst case they see it once more next time.
    apiFetch("/api/me/mfa-prompt/dismiss", { method: "POST" }).catch(() => {})
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="two-step-prompt-title"
        className="relative w-full sm:max-w-md max-h-[100dvh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-7 text-primary shrink-0" aria-hidden />
          <div>
            <h2 id="two-step-prompt-title" className="text-white font-bold text-xl">Protect your memories</h2>
            <p className="text-zinc-400 text-sm mt-1">
              Turn on 2-step verification so a stolen password isn&apos;t enough to get into your account.
            </p>
          </div>
        </div>

        <TwoStepCard bare state={state} onChange={setState} onFinished={close} />

        {!state.enabled && (
          <button
            type="button"
            onClick={close}
            className="w-full text-center text-zinc-400 hover:text-white text-sm min-h-11 cursor-pointer"
          >
            Maybe later
          </button>
        )}
        <p className="text-zinc-600 text-xs text-center">You can change this anytime in Settings → Security.</p>
      </div>
    </div>
  )
}
