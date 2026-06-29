"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {Logo } from "@/components/logo"

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: "", password: "" })
  const [isLoading, setIsLoading] = useState(false)

  // FIX: Explicitly type the event to clear the red lines
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      })

      if (response.ok) {
        // Use router for a smoother client-side transition
        router.push('/dashboard')
      } else {
        alert("Invalid credentials")
      }
    } catch (err) {
      console.error("Login error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    /* Center the login card vertically and horizontally */
    <main className="min-h-screen w-full flex flex-col items-center justify-center bg-background px-4">
      
      {/* TimeVault Logo Section to match Register Page */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 scale-110">
        {/* Replace this div with your <Logo /> component if you have one */}
        <div className="pt-12 pb-8 flex justify-center w-full">
           <Logo/>
        </div>
      </div>
    <Card className="w-full max-w-[400px] border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight text-center">
          TimeVault Access
        </CardTitle>
        <p className="text-sm text-muted-foreground text-center">
          Enter your email to unlock your memories
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-zinc-400">Email</label>
            <Input 
              id="email" 
              type="email" 
              placeholder="you@example.com"
              required 
              className="bg-input/50 mt-2"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-zinc-400">Password</label>
            <Input 
              id="password" 
              type="password" 
              placeholder="••••••••"
              required 
              className="bg-input/50 mt-2"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full bg-primary shadow-lg shadow-primary/20 cursor-pointer">
            {isLoading ? "Unlocking..." : "Sign In"}
          </Button>

          <p className="text-center text-sm text-zinc-500 mt-4">
  Don't have an account?{" "}
  <button type="button" onClick={() => router.push('/register')} className="text-primary hover:underline cursor-pointer">
    Create one
  </button>
</p>
        </form>
      </CardContent>
    </Card>
    </main>
  )
}