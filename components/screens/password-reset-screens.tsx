"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { API } from "@/lib/api"
import type { Screen } from "@/lib/navigation"

interface NavProps {
  onNavigate: (s: Screen) => void
}

const inputClass = "bg-zinc-900 border-zinc-800 text-white h-12 rounded-xl"
const buttonClass = "w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold cursor-pointer"

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-10"><Logo /></div>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-zinc-500 text-sm mt-1">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  )
}

function BackToSignIn({ onNavigate }: NavProps) {
  return (
    <p className="text-center text-sm text-zinc-500">
      <button
        type="button"
        onClick={() => onNavigate("login")}
        className="text-primary hover:underline cursor-pointer min-h-11 inline-flex items-center"
      >
        Back to sign in
      </button>
    </p>
  )
}

// ── Step 1: ask for the email ────────────────────────────────────────────────

export function ForgotPasswordScreen({ onNavigate }: NavProps) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setSent(true)
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? "Something went wrong. Try again.")
      }
    } catch {
      toast.error("No connection. Check your network.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <Shell title="Check your email" subtitle="">
        <p className="text-zinc-400 text-sm text-center leading-relaxed">
          If an account exists for <span className="text-white">{email}</span>, we&apos;ve sent a
          link to reset your password. It expires in 30 minutes. Check your spam folder if
          you don&apos;t see it.
        </p>
        <BackToSignIn onNavigate={onNavigate} />
      </Shell>
    )
  }

  return (
    <Shell title="Forgot password?" subtitle="We'll email you a link to reset it">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email" className="text-zinc-400 text-sm">Email</Label>
          <Input
            id="forgot-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClass}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading} className={buttonClass}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <BackToSignIn onNavigate={onNavigate} />
    </Shell>
  )
}

// ── Step 2: set a new password from the emailed link ─────────────────────────

export function ResetPasswordScreen({ token, onNavigate }: NavProps & { token: string }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        sessionStorage.removeItem("token")
        toast.success("Password updated. Sign in with your new password.")
        onNavigate("login")
      } else {
        setError(d.error ?? "Something went wrong. Try again.")
      }
    } catch {
      setError("No connection. Check your network.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Shell title="Set a new password" subtitle="At least 8 characters">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reset-password" className="text-zinc-400 text-sm">New password</Label>
          <Input
            id="reset-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reset-confirm" className="text-zinc-400 text-sm">Confirm new password</Label>
          <Input
            id="reset-confirm"
            type="password"
            required
            autoComplete="new-password"
            className={inputClass}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
          />
        </div>
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        <Button type="submit" disabled={loading} className={buttonClass}>
          {loading ? "Saving…" : "Update password"}
        </Button>
      </form>
      {error && (
        <p className="text-center text-sm text-zinc-500">
          <button
            type="button"
            onClick={() => onNavigate("forgot")}
            className="text-primary hover:underline cursor-pointer"
          >
            Request a new link
          </button>
        </p>
      )}
      <BackToSignIn onNavigate={onNavigate} />
    </Shell>
  )
}
