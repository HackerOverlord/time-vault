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
            <Label className="text-zinc-400 text-sm">Email</Label>
            <Input
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
            <Label className="text-zinc-400 text-sm">Password</Label>
            <Input
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
            className="text-primary hover:underline cursor-pointer"
          >
            Create one
          </button>
        </p>
      </div>
    </main>
  )
}
