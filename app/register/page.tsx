"use client"

import { useState } from "react"
// REMOVED: useRouter is no longer needed since we aren't changing URL paths
import { User, Mail, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Logo } from "@/components/logo"

// 1. Define the props interface directly inside this file
interface RegisterViewProps {
  onNavigate: (screen: 'login' | 'register' | 'dashboard') => void
}

// 2. Accept the onNavigate prop here
export default function RegisterPage({ onNavigate }: RegisterViewProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "", 
    password: ""
  })

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const response = await fetch('http://localhost:5000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        password: formData.password,
      }),
    })

    if (response.ok) {
      // 3. FIX: State-driven navigation to dashboard instead of router.push
      onNavigate('dashboard')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-[#0a0a0a] p-4 pt-20">
      <div className="mb-20 animate-in fade-in zoom-in duration-1000">
        <Logo />
      </div>

      <Card className="w-full max-w-lg border-border/50 bg-card/95 backdrop-blur-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Secure Your Legacy</CardTitle>
          <CardDescription>Setup your account to begin securing your digital memories.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium text-zinc-400">First Name</label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                  className="bg-input/50 mt-2"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium text-zinc-400">Last Name</label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={e => setFormData({...formData, lastName: e.target.value})}
                  className="bg-input/50 mt-2"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-zinc-400">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="bg-input/50 mt-2"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-zinc-400">Master Password</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className="bg-input/50 mt-2"
                required
              />
            </div>

            <Button type="submit" className="cursor-pointer w-full bg-primary">Create Secure Vault</Button>

            <p className="text-center text-sm text-zinc-500 mt-4">
              Already have an account?{" "}
              {/* 4. FIX: Use onNavigate to switch back to the login view instantly */}
              <button 
                type="button" 
                onClick={() => onNavigate('login')} 
                className="text-primary hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
