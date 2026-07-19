"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { ArrowLeft, Check, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import type { Screen } from "@/lib/navigation"
import type { Group, VaultMember } from "@/lib/types"

interface GroupScreenProps {
  onNavigate: (s: Screen) => void
  group: Group
}

export function GroupScreen({ onNavigate, group }: GroupScreenProps) {
  const [members, setMembers]   = useState<VaultMember[]>([])
  const [copied, setCopied]     = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)

      const [membersResult, meResult] = await Promise.all([
        apiFetch<VaultMember[]>(`/api/vaults/${group.id}/members`),
        apiFetch<{ id: string }>("/api/me"),
      ])

      if (cancelled) return

      if (membersResult.ok) {
        setMembers(membersResult.data)
      } else {
        toast.error("Could not load members")
      }

      if (meResult.ok) {
        setCurrentUserId(String(meResult.data.id))
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [group.id])

  // Invite code: already on the vault prop for owners; undefined for members.
  // Backend returns raw 6-char code; display as XXX-XXX.
  const rawCode     = group.invite_code ?? ""
  const displayCode = rawCode.length === 6
    ? `${rawCode.slice(0, 3)}-${rawCode.slice(3)}`
    : rawCode

  const copyCode = () => {
    navigator.clipboard.writeText(displayCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const removeMember = async (userId: string) => {
    if (!confirm("Remove this member?")) return
    const result = await apiFetch(`/api/vaults/${group.id}/members/${userId}`, {
      method: "DELETE",
    })
    if (result.ok) {
      setMembers(prev => prev.filter(m => m.user_id !== userId))
    } else {
      toast.error(result.error ?? "Could not remove member")
    }
  }

  // Correct role check: backend uses "owner", not "admin"
  const isOwner = members.find(m => m.user_id === currentUserId)?.role === "owner"

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

        {/* Invite code — owners only */}
        {rawCode && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-4">
            <h2 className="text-white font-bold">Invite people</h2>
            <p className="text-zinc-500 text-sm">
              Share this code to add someone to this vault.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-zinc-800 rounded-xl px-4 py-3 font-mono text-lg tracking-widest text-white font-bold text-center">
                {displayCode}
              </div>
              <Button
                onClick={copyCode}
                className={cn(
                  "rounded-xl h-12 px-5 cursor-pointer transition-all",
                  copied
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-primary hover:bg-primary/90"
                )}
              >
                {copied ? <Check className="size-4" /> : "Copy"}
              </Button>
            </div>
          </div>
        )}

        {/* Members */}
        <div className="space-y-3">
          <h2 className="text-white font-bold">
            Members ({loading ? "…" : members.length})
          </h2>

          {loading && (
            <div className="text-zinc-500 text-sm text-center py-6">Loading…</div>
          )}

          {!loading && members.map(m => (
            <div
              key={m.user_id}
              className="flex items-center gap-3 bg-zinc-900 rounded-xl p-4 border border-zinc-800"
            >
              <Avatar className="size-9">
                <AvatarImage src={m.avatar ?? undefined} className="object-cover" />
                <AvatarFallback className="bg-zinc-700 text-white text-xs font-bold">
                  {m.name[0]}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{m.name}</p>
              </div>

              {m.role === "owner" && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  Owner
                </span>
              )}

              {isOwner && m.user_id !== currentUserId && (
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
