"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { API } from "@/lib/api"
import type { Screen } from "@/lib/navigation"

interface LoginScreenProps {
  onNavigate: (s: Screen) => void
}

export function LoginScreen({ onNavigate }: LoginScreenProps) {
  const [form, setForm] = useState({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  // Set when the account has 2-step verification: we then ask for the code.
  const [mfa, setMfa] = useState<{ token: string; hint: string; method: "email" | "totp" } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const d = await res.json()
        if (d.mfa_required) {
          setMfa({ token: d.mfa_token, hint: d.email_hint ?? "your email",
                   method: d.method === "totp" ? "totp" : "email" })
          return
        }
        sessionStorage.setItem("token", d.token)
        onNavigate("feed")
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? "Invalid credentials")
      }
    } finally {
      setLoading(false)
    }
  }

  if (mfa) {
    return (
      <CodeStep
        mfaToken={mfa.token}
        hint={mfa.hint}
        method={mfa.method}
        onToken={t => setMfa(m => (m ? { ...m, token: t } : m))}
        onSuccess={(token, left) => {
          sessionStorage.setItem("token", token)
          if (typeof left === "number") {
            toast.warning(left === 0
              ? "That was your last recovery code. Make new ones in Settings → Security."
              : `Recovery code used. ${left} left.`)
          }
          onNavigate("feed")
        }}
        onBack={() => { setMfa(null); setForm(f => ({ ...f, password: "" })) }}
      />
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-10"><Logo /></div>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-zinc-500 text-sm mt-1">Sign in to your private vault</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-email" className="text-zinc-400 text-sm">Email</Label>
            <Input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="bg-zinc-900 border-zinc-800 text-white h-12 rounded-xl"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password" className="text-zinc-400 text-sm">Password</Label>
              <button
                type="button"
                onClick={() => onNavigate("forgot")}
                className="text-primary text-sm hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <Input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="bg-zinc-900 border-zinc-800 text-white h-12 rounded-xl"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold cursor-pointer"
          >
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
        <p className="text-center text-sm text-zinc-500">
          No account?{" "}
          <button
            onClick={() => onNavigate("register")}
            className="text-primary hover:underline cursor-pointer min-h-11 inline-flex items-center"
          >
            Create one
          </button>
        </p>
      </div>
    </main>
  )
}

// ── Second step: emailed code, or authenticator app / recovery code ───────────

function CodeStep({ mfaToken, hint, method, onToken, onSuccess, onBack }: {
  mfaToken: string
  hint: string
  method: "email" | "totp"
  onToken: (t: string) => void
  onSuccess: (token: string, recoveryCodesLeft?: number) => void
  onBack: () => void
}) {
  const isApp = method === "totp"
  const [useRecovery, setUseRecovery] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const call = (path: string, body: object) =>
    fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const { ok, d } = await call("/api/login/mfa", { mfa_token: mfaToken, code })
      if (ok) onSuccess(d.token, d.recovery_codes_left)
      else setError(d.error ?? "That code didn't work.")
    } catch { setError("No connection. Check your network.") }
    finally { setBusy(false) }
  }

  const resend = async () => {
    setBusy(true); setError(null)
    try {
      const { ok, d } = await call("/api/login/mfa/resend", { mfa_token: mfaToken })
      if (ok) { onToken(d.mfa_token); setCode(""); toast.success("New code sent") }
      else setError(d.error ?? "Couldn't send a new code.")
    } catch { setError("No connection. Check your network.") }
    finally { setBusy(false) }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-10"><Logo /></div>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">
            {!isApp ? "Check your email" : useRecovery ? "Use a recovery code" : "Enter your app code"}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {!isApp
              ? `We sent a 6-digit code to ${hint}`
              : useRecovery
                ? "Type one of the recovery codes you saved. Each works once."
                : "Open your authenticator app and type the 6-digit code for Time Vault."}
          </p>
        </div>
        <form onSubmit={verify} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-code" className="text-zinc-400 text-sm">
              {useRecovery ? "Recovery code" : "Sign-in code"}
            </Label>
            <Input
              key={useRecovery ? "recovery" : "code"}
              id="login-code"
              inputMode={useRecovery ? "text" : "numeric"}
              autoComplete={useRecovery ? "off" : "one-time-code"}
              autoCapitalize="none"
              autoFocus
              required
              maxLength={useRecovery ? 14 : 7}
              placeholder={useRecovery ? "xxxxx-xxxxx" : undefined}
              value={code}
              onChange={e => setCode(e.target.value)}
              className={`bg-zinc-900 border-zinc-800 text-white h-12 rounded-xl text-center text-lg ${useRecovery ? "tracking-widest" : "tracking-[0.4em]"}`}
            />
          </div>
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          <Button type="submit" disabled={busy || !code}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold cursor-pointer">
            {busy ? "Checking…" : "Verify"}
          </Button>
        </form>
        <div className="flex justify-between text-sm">
          <button type="button" onClick={onBack} className="text-zinc-500 hover:text-white cursor-pointer min-h-11">
            Back
          </button>
          {isApp ? (
            <button type="button" onClick={() => { setUseRecovery(r => !r); setCode(""); setError(null) }}
              className="text-primary hover:underline cursor-pointer min-h-11">
              {useRecovery ? "Use app code instead" : "Use a recovery code"}
            </button>
          ) : (
            <button type="button" onClick={resend} disabled={busy}
              className="text-primary hover:underline cursor-pointer disabled:opacity-50 min-h-11">
              Send a new code
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
