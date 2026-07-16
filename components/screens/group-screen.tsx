"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { ArrowLeft, Check, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { API, ah, jsonH } from "@/lib/api"
import type { Screen } from "@/lib/navigation"
import type { Group, GroupMember } from "@/lib/types"

interface GroupScreenProps {
  onNavigate: (s: Screen) => void
  group: Group
}

export function GroupScreen({ onNavigate, group }: GroupScreenProps) {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [inviteCode, setInviteCode] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [joinError, setJoinError] = useState("")
  const [copied, setCopied] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const h = { headers: ah() }
    Promise.all([
      fetch(`${API}/api/groups/${group.id}/members`, h),
      fetch(`${API}/api/groups/${group.id}/invite-code`, h),
      fetch(`${API}/api/me`, h),
    ]).then(async ([mRes, iRes, meRes]) => {
      if (mRes.ok) setMembers(await mRes.json())
      if (iRes.ok) { const d = await iRes.json(); setInviteCode(d.invite_code) }
      if (meRes.ok) setCurrentUser(await meRes.json())
    })
  }, [group.id])

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const joinGroup = async () => {
    if (!joinCode.trim()) return
    const res = await fetch(`${API}/api/groups/join`, {
      method: "POST",
      headers: jsonH(),
      body: JSON.stringify({ invite_code: joinCode }),
    })
    if (res.ok) {
      const d = await res.json()
      setMembers(d.members)
      setJoinCode("")
      toast.success("Joined!")
    } else {
      const d = await res.json()
      setJoinError(d.error || "Invalid code")
    }
  }

  const removeMember = async (userId: string) => {
    if (!confirm("Remove this member?")) return
    const res = await fetch(`${API}/api/groups/${group.id}/members/${userId}`, {
      method: "DELETE",
      headers: ah(),
    })
    if (res.ok) setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  const isAdmin = members.find(m => m.user_id === currentUser?.id)?.role === "admin"

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-zinc-800 bg-background/80 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center gap-4">
          <button
            onClick={() => onNavigate("feed")}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="h-4 w-px bg-zinc-800" />
          <h1 className="text-white font-bold text-sm truncate">{group.name}</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-8 space-y-6">
        {/* Invite code */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-4">
          <h2 className="text-white font-bold">Invite people</h2>
          <p className="text-zinc-500 text-sm">Share this code to add someone to this group.</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-zinc-800 rounded-xl px-4 py-3 font-mono text-lg tracking-widest text-white font-bold text-center">
              {inviteCode || "—"}
            </div>
            <Button
              onClick={copyCode}
              className={cn(
                "rounded-xl h-12 px-5 cursor-pointer transition-all",
                copied ? "bg-green-600 hover:bg-green-700" : "bg-primary hover:bg-primary/90"
              )}
            >
              {copied ? <Check className="size-4" /> : "Copy"}
            </Button>
          </div>
        </div>

        {/* Join a group */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-4">
          <h2 className="text-white font-bold">Join a group</h2>
          <p className="text-zinc-500 text-sm">Have a code from someone else?</p>
          <div className="flex gap-3">
            <Input
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError("") }}
              placeholder="Invite code"
              className="bg-zinc-800 border-zinc-700 text-white rounded-xl h-12 font-mono tracking-widest text-center"
            />
            <Button
              onClick={joinGroup}
              className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-5 cursor-pointer"
            >
              Join
            </Button>
          </div>
          {joinError && <p className="text-red-400 text-xs">{joinError}</p>}
        </div>

        {/* Members */}
        <div className="space-y-3">
          <h2 className="text-white font-bold">Members ({members.length})</h2>
          {members.map(m => (
            <div key={m.user_id} className="flex items-center gap-3 bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <Avatar className="size-9">
                <AvatarImage src={m.avatar} className="object-cover" />
                <AvatarFallback className="bg-zinc-700 text-white text-xs font-bold">{m.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{m.name}</p>
                <p className="text-zinc-500 text-xs truncate">{m.email}</p>
              </div>
              {m.role === "admin" && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  Admin
                </span>
              )}
              {isAdmin && m.user_id !== currentUser?.id && (
                <button
                  onClick={() => removeMember(m.user_id)}
                  className="text-zinc-600 hover:text-red-400 transition-colors cursor-pointer p-1"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
