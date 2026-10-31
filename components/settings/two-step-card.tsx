"use client"

import { useState } from "react"
import { ShieldCheck, Shield } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"

/**
 * Settings → Security: turn 2-step verification (emailed 6-digit code at
 * sign-in) on or off. Turning on is confirmed with a code; turning off
 * requires the password.
 */
export function TwoStepCard({ enabled, onChange }: { enabled: boolean; onChange: (on: boolean) => void }) {
  const [step, setStep]       = useState<"idle" | "code" | "disable">("idle")
  const [code, setCode]       = useState("")
  const [password, setPassword] = useState("")
  const [hint, setHint]       = useState("")
  const [error, setError]     = useState<string | null>(null)
  const [busy, setBusy]       = useState(false)

  const post = <T,>(path: string, body?: object) =>
    apiFetch<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })

  const reset = () => { setStep("idle"); setCode(""); setPassword(""); setError(null) }

  const sendCode = async () => {
    setBusy(true); setError(null)
    const r = await post<{ email_hint: string }>("/api/mfa/enable")
    setBusy(false)
    if (r.ok) { setHint(r.data.email_hint); setStep("code") }
    else setError(r.error)
  }

  const confirm = async () => {
    setBusy(true); setError(null)
    const r = await post("/api/mfa/enable/confirm", { code })
    setBusy(false)
    if (r.ok) { onChange(true); reset(); toast.success("2-step verification is on") }
    else setError(r.error)
  }

  const disable = async () => {
    setBusy(true); setError(null)
    const r = await post("/api/mfa/disable", { password })
    setBusy(false)
    if (r.ok) { onChange(false); reset(); toast.success("2-step verification is off") }
    else setError(r.error)
  }

  return (
    <section aria-labelledby="two-step-title" className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 space-y-4">
      <div className="flex items-start gap-3">
        {enabled
          ? <ShieldCheck className="size-6 text-green-400 shrink-0" aria-hidden />
          : <Shield className="size-6 text-zinc-500 shrink-0" aria-hidden />}
        <div>
          <h2 id="two-step-title" className="text-white font-bold text-lg">2-step verification</h2>
          <p className="text-zinc-400 text-sm mt-1">
            {enabled
              ? "On. Signing in needs your password and a code we email you."
              : "Off. Add a second step: after your password, enter a code we email you."}
          </p>
        </div>
      </div>

      {step === "code" && (
        <div className="space-y-2">
          <Label htmlFor="two-step-code" className="text-zinc-400 text-sm">
            Enter the 6-digit code sent to {hint}
          </Label>
          <Input
            id="two-step-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && code) confirm() }}
            className="bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl tracking-[0.4em] text-center text-lg"
          />
        </div>
      )}

      {step === "disable" && (
        <div className="space-y-2">
          <Label htmlFor="two-step-password" className="text-zinc-400 text-sm">
            Enter your password to turn it off
          </Label>
          <Input
            id="two-step-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && password) disable() }}
            className="bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl"
          />
        </div>
      )}

      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-2">
        {step === "idle" && !enabled && (
          <Button onClick={sendCode} disabled={busy}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl cursor-pointer disabled:opacity-50">
            {busy ? "Sending code…" : "Turn on"}
          </Button>
        )}
        {step === "idle" && enabled && (
          <Button onClick={() => setStep("disable")}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white h-12 rounded-xl cursor-pointer">
            Turn off
          </Button>
        )}
        {step !== "idle" && (
          <>
            <Button onClick={reset} disabled={busy}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white h-12 rounded-xl cursor-pointer">
              Cancel
            </Button>
            <Button
              onClick={step === "code" ? confirm : disable}
              disabled={busy || (step === "code" ? !code : !password)}
              className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl cursor-pointer disabled:opacity-50">
              {busy ? "Checking…" : step === "code" ? "Confirm" : "Turn off"}
            </Button>
          </>
        )}
      </div>
      {step === "code" && (
        <button type="button" onClick={sendCode} disabled={busy}
          className="text-primary text-sm hover:underline cursor-pointer disabled:opacity-50">
          Send a new code
        </button>
      )}
    </section>
  )
}
