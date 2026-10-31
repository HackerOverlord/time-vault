"use client"

import { useState } from "react"
import QRCode from "qrcode"
import { ShieldCheck, Shield, Smartphone, Mail, Copy, Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"

export type MfaMethod = "email" | "totp"
export interface MfaState {
  enabled: boolean
  method: MfaMethod | null
  codesLeft: number
}

type Step =
  | "idle"       // on/off summary, or the two method choices when off
  | "email"      // waiting for the emailed code
  | "app"        // QR code + first app code
  | "codes"      // showing new recovery codes (once)
  | "disable"    // password to turn off
  | "regen"      // password to make new recovery codes

const primary = "bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl cursor-pointer disabled:opacity-50"
const secondary = "bg-zinc-800 hover:bg-zinc-700 text-white h-12 rounded-xl cursor-pointer disabled:opacity-50"
const field = "bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl"

/**
 * 2-step verification: an emailed code, or an authenticator app (with
 * recovery codes). Used in Settings → Security and in the one-time prompt
 * after sign-up (`bare` drops the card frame there).
 */
export function TwoStepCard({ state, onChange, onFinished, bare = false }: {
  state: MfaState
  onChange: (s: MfaState) => void
  /** Called once set-up is fully done (after codes are saved, for the app). */
  onFinished?: () => void
  bare?: boolean
}) {
  const { enabled, method, codesLeft } = state
  const [step, setStep]         = useState<Step>("idle")
  const [code, setCode]         = useState("")
  const [password, setPassword] = useState("")
  const [hint, setHint]         = useState("")
  const [secret, setSecret]     = useState("")
  const [qr, setQr]             = useState("")
  const [codes, setCodes]       = useState<string[]>([])
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)

  const post = <T,>(path: string, body?: object) =>
    apiFetch<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })

  const reset = () => {
    setStep("idle"); setCode(""); setPassword(""); setError(null)
    setSecret(""); setQr(""); setCodes([]); setSaved(false)
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await fn() } finally { setBusy(false) }
  }

  // ── Email ──────────────────────────────────────────────────────────────
  const sendEmailCode = () => run(async () => {
    const r = await post<{ email_hint: string }>("/api/mfa/enable")
    if (r.ok) { setHint(r.data.email_hint); setCode(""); setStep("email") }
    else setError(r.error)
  })

  const confirmEmail = () => run(async () => {
    const r = await post("/api/mfa/enable/confirm", { code })
    if (!r.ok) { setError(r.error); return }
    onChange({ enabled: true, method: "email", codesLeft: 0 })
    reset()
    toast.success("2-step verification is on")
    onFinished?.()
  })

  // ── Authenticator app ──────────────────────────────────────────────────
  const startApp = () => run(async () => {
    const r = await post<{ secret: string; otpauth_uri: string }>("/api/mfa/totp/setup")
    if (!r.ok) { setError(r.error); return }
    setSecret(r.data.secret)
    setCode("")
    setStep("app")
    try {
      setQr(await QRCode.toDataURL(r.data.otpauth_uri, { margin: 1, width: 220 }))
    } catch { setQr("") }       // the typed key below still works
  })

  const confirmApp = () => run(async () => {
    const r = await post<{ recovery_codes: string[] }>("/api/mfa/totp/confirm", { code })
    if (!r.ok) { setError(r.error); return }
    onChange({ enabled: true, method: "totp", codesLeft: r.data.recovery_codes.length })
    setCodes(r.data.recovery_codes); setSaved(false); setStep("codes")
    toast.success("Authenticator app is on")
  })

  // ── Off / new recovery codes ───────────────────────────────────────────
  const disable = () => run(async () => {
    const r = await post("/api/mfa/disable", { password })
    if (!r.ok) { setError(r.error); return }
    onChange({ enabled: false, method: null, codesLeft: 0 })
    reset()
    toast.success("2-step verification is off")
  })

  const regenerate = () => run(async () => {
    const r = await post<{ recovery_codes: string[] }>("/api/mfa/recovery-codes", { password })
    if (!r.ok) { setError(r.error); return }
    onChange({ ...state, codesLeft: r.data.recovery_codes.length })
    setPassword(""); setCodes(r.data.recovery_codes); setSaved(false); setStep("codes")
  })

  const codesText = () =>
    `Time Vault recovery codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`

  const copyCodes = async () => {
    try { await navigator.clipboard.writeText(codesText()); setSaved(true); toast.success("Copied") }
    catch { toast.error("Couldn't copy. Write them down instead.") }
  }

  const downloadCodes = () => {
    const url = URL.createObjectURL(new Blob([codesText()], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url; a.download = "time-vault-recovery-codes.txt"
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setSaved(true)
  }

  const summary = !enabled
    ? "Off. Add a second step after your password, so a stolen password isn't enough."
    : method === "totp"
      ? `On, with an authenticator app. ${codesLeft} recovery code${codesLeft === 1 ? "" : "s"} left.`
      : "On. Signing in needs your password and a code we email you."

  const codeInput = (id: string, onEnter: () => void) => (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      value={code}
      onChange={e => setCode(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter" && code) onEnter() }}
      className={cn(field, "tracking-[0.4em] text-center text-lg")}
    />
  )

  const passwordInput = (label: string, onEnter: () => void) => (
    <div className="space-y-2">
      <Label htmlFor="two-step-password" className="text-zinc-400 text-sm">{label}</Label>
      <Input
        id="two-step-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && password) onEnter() }}
        className={field}
      />
    </div>
  )

  const cancelAnd = (label: string, onClick: () => void, disabled: boolean) => (
    <div className="flex gap-2">
      <Button onClick={reset} disabled={busy} className={cn("flex-1", secondary)}>Cancel</Button>
      <Button onClick={onClick} disabled={busy || disabled} className={cn("flex-1", primary)}>
        {busy ? "Checking…" : label}
      </Button>
    </div>
  )

  return (
    <section
      aria-labelledby="two-step-title"
      className={cn("space-y-4", !bare && "bg-zinc-900 rounded-2xl border border-zinc-800 p-8")}
    >
      {!bare && (
        <div className="flex items-start gap-3">
          {enabled
            ? <ShieldCheck className="size-6 text-green-400 shrink-0" aria-hidden />
            : <Shield className="size-6 text-zinc-500 shrink-0" aria-hidden />}
          <div>
            <h2 id="two-step-title" className="text-white font-bold text-lg">2-step verification</h2>
            <p className="text-zinc-400 text-sm mt-1">{summary}</p>
          </div>
        </div>
      )}

      {/* Off: choose a method */}
      {step === "idle" && !enabled && (
        <div className="space-y-2">
          <button type="button" onClick={startApp} disabled={busy}
            className="w-full text-left flex items-start gap-3 rounded-xl border border-primary/60 bg-primary/10 hover:bg-primary/20 p-4 cursor-pointer disabled:opacity-50">
            <Smartphone className="size-5 text-primary shrink-0 mt-0.5" aria-hidden />
            <span>
              <span className="block text-white font-semibold">
                Authenticator app <span className="text-primary text-xs font-medium ml-1">Recommended</span>
              </span>
              <span className="block text-zinc-400 text-sm">
                Google Authenticator, Authy, 1Password… Works offline. Strongest option.
              </span>
            </span>
          </button>
          <button type="button" onClick={sendEmailCode} disabled={busy}
            className="w-full text-left flex items-start gap-3 rounded-xl border border-zinc-700 hover:bg-zinc-800 p-4 cursor-pointer disabled:opacity-50">
            <Mail className="size-5 text-zinc-400 shrink-0 mt-0.5" aria-hidden />
            <span>
              <span className="block text-white font-semibold">Email me a code</span>
              <span className="block text-zinc-400 text-sm">Simpler. We email a 6-digit code each time you sign in.</span>
            </span>
          </button>
          {busy && <p className="text-zinc-500 text-sm">One moment…</p>}
        </div>
      )}

      {/* On */}
      {step === "idle" && enabled && (
        <div className="flex flex-col sm:flex-row gap-2">
          {method === "totp" && (
            <Button onClick={() => { setPassword(""); setError(null); setStep("regen") }}
              className={cn("flex-1", secondary)}>
              New recovery codes
            </Button>
          )}
          <Button onClick={() => { setPassword(""); setError(null); setStep("disable") }}
            className={cn("flex-1", secondary)}>
            Turn off
          </Button>
        </div>
      )}
      {step === "idle" && enabled && method === "totp" && codesLeft <= 2 && (
        <p className="text-amber-400 text-sm">
          You&apos;re running low on recovery codes. Make new ones so you can still get in if you lose your phone.
        </p>
      )}

      {/* Email code */}
      {step === "email" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="two-step-code" className="text-zinc-400 text-sm">
              Enter the 6-digit code sent to {hint}
            </Label>
            {codeInput("two-step-code", confirmEmail)}
          </div>
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          {cancelAnd("Confirm", confirmEmail, !code)}
          <button type="button" onClick={sendEmailCode} disabled={busy}
            className="text-primary text-sm hover:underline cursor-pointer disabled:opacity-50">
            Send a new code
          </button>
        </>
      )}

      {/* Authenticator set-up */}
      {step === "app" && (
        <>
          <ol className="text-zinc-300 text-sm space-y-1 list-decimal pl-5">
            <li>Open your authenticator app and add a new account.</li>
            <li>Scan this QR code (or type the key below).</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <div className="flex justify-center">
            {qr
              ? <img src={qr} alt="QR code for your authenticator app" width={220} height={220}
                  className="rounded-xl bg-white p-2" />
              : <div className="size-[220px] rounded-xl bg-zinc-800 animate-pulse" aria-hidden />}
          </div>
          <div className="space-y-1">
            <p className="text-zinc-500 text-xs">Can&apos;t scan? Enter this key instead:</p>
            <div className="flex items-center gap-2">
              <code data-testid="totp-secret"
                className="flex-1 break-all rounded-lg bg-zinc-800 px-3 py-2 text-white text-sm font-mono tracking-wider">
                {secret.match(/.{1,4}/g)?.join(" ")}
              </code>
              <button type="button" aria-label="Copy key"
                onClick={() => navigator.clipboard?.writeText(secret).then(() => toast.success("Key copied"), () => {})}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer">
                <Copy className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="two-step-app-code" className="text-zinc-400 text-sm">Code from the app</Label>
            {codeInput("two-step-app-code", confirmApp)}
          </div>
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          {cancelAnd("Confirm", confirmApp, !code)}
        </>
      )}

      {/* Recovery codes (shown once) */}
      {step === "codes" && (
        <>
          <div>
            <h3 className="text-white font-semibold">Save your recovery codes</h3>
            <p className="text-zinc-400 text-sm mt-1">
              If you lose your phone, each of these gets you in once. We won&apos;t show them again.
            </p>
          </div>
          <ul data-testid="recovery-codes"
            className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-800 p-4 font-mono text-white text-sm">
            {codes.map(c => <li key={c} className="text-center">{c}</li>)}
          </ul>
          <div className="flex gap-2">
            <Button onClick={copyCodes} className={cn("flex-1", secondary)}>
              <Copy className="size-4 mr-1" aria-hidden /> Copy
            </Button>
            <Button onClick={downloadCodes} className={cn("flex-1", secondary)}>
              <Download className="size-4 mr-1" aria-hidden /> Download
            </Button>
          </div>
          <label className="flex items-center gap-2 text-zinc-300 text-sm cursor-pointer">
            <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)}
              className="size-4 accent-[hsl(var(--primary))]" />
            I&apos;ve saved these codes somewhere safe
          </label>
          <Button onClick={() => { reset(); onFinished?.() }} disabled={!saved} className={cn("w-full", primary)}>
            Done
          </Button>
        </>
      )}

      {step === "disable" && (
        <>
          {passwordInput("Enter your password to turn it off", disable)}
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          {cancelAnd("Turn off", disable, !password)}
        </>
      )}

      {step === "regen" && (
        <>
          {passwordInput("Enter your password. Your old recovery codes will stop working.", regenerate)}
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          {cancelAnd("Make new codes", regenerate, !password)}
        </>
      )}

      {step === "idle" && error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
    </section>
  )
}

/** Reads the 2FA fields from a /api/me response. */
export function mfaStateFromMe(d: {
  mfaEnabled?: boolean; mfaMethod?: string | null; recoveryCodesLeft?: number
}): MfaState {
  return {
    enabled: !!d.mfaEnabled,
    method: d.mfaMethod === "totp" ? "totp" : d.mfaMethod === "email" ? "email" : null,
    codesLeft: d.recoveryCodesLeft ?? 0,
  }
}
