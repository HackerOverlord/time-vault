"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, X, Clock, Image, Video, Type, Check } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { API, ah, jsonH } from "@/lib/api"
import type { Group, GroupMember, Post } from "@/lib/types"

interface UploadModalProps {
  groups: Group[]
  onClose: () => void
  onPosted: (p: Post) => void
}

export function UploadModal({ groups, onClose, onPosted }: UploadModalProps) {
  const [step, setStep] = useState<"pick" | "compose">("pick")
  const [mediaType, setMediaType] = useState<"video" | "image" | "text">("video")
  const [mediaData, setMediaData] = useState<string | null>(null)
  const [caption, setCaption] = useState("")
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? "")
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [unlockDate, setUnlockDate] = useState("")
  const [isTimeCapsule, setIsTimeCapsule] = useState(false)
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!selectedGroupId) return
    fetch(`${API}/api/groups/${selectedGroupId}/members`, { headers: ah() })
      .then(r => r.json())
      .then(data => {
        setGroupMembers(data)
        setSelectedMemberIds(data.map((m: GroupMember) => m.user_id))
      })
  }, [selectedGroupId])

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      toast.error("Video or image files only")
      return
    }
    setMediaType(file.type.startsWith("video/") ? "video" : "image")
    const reader = new FileReader()
    reader.onload = () => { setMediaData(reader.result as string); setStep("compose") }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const post = async () => {
    if (!selectedGroupId) { toast.error("Select a group"); return }
    if (mediaType !== "text" && !mediaData) { toast.error("Add media first"); return }
    if (mediaType === "text" && !caption.trim()) { toast.error("Write something"); return }
    setPosting(true)
    try {
      const res = await fetch(`${API}/api/posts`, {
        method: "POST",
        headers: jsonH(),
        body: JSON.stringify({
          group_id: selectedGroupId,
          caption,
          media_type: mediaType,
          media_url: mediaType !== "text" ? mediaData : null,
          recipient_ids: selectedMemberIds,
          unlock_at: isTimeCapsule && unlockDate ? unlockDate : null,
        }),
      })
      if (res.ok) onPosted(await res.json())
      else toast.error("Failed to post")
    } finally { setPosting(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-zinc-800 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-800">
          <h2 className="text-white font-bold text-lg">New Post</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Step 1 — pick media type */}
          {step === "pick" && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm">What are you sharing?</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { type: "video" as const, icon: Video, label: "Video" },
                  { type: "image" as const, icon: Image, label: "Photo" },
                  { type: "text"  as const, icon: Type,  label: "Text"  },
                ]).map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => {
                      setMediaType(type)
                      if (type === "text") { setMediaData(null); setStep("compose") }
                      else fileRef.current?.click()
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 py-5 rounded-2xl border transition-all cursor-pointer",
                      mediaType === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-zinc-800 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600 hover:text-white"
                    )}
                  >
                    <Icon className="size-6" />
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                ))}
              </div>
              <input ref={fileRef} type="file" className="hidden" accept="video/*,image/*" onChange={onFile} />
            </div>
          )}

          {/* Step 2 — compose */}
          {step === "compose" && (
            <div className="space-y-5">
              {mediaData && mediaType === "video" && (
                <video src={mediaData} controls className="w-full rounded-2xl max-h-48 object-cover bg-black" />
              )}
              {mediaData && mediaType === "image" && (
                <img src={mediaData} className="w-full rounded-2xl max-h-48 object-cover" alt="Preview" />
              )}

              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-xs uppercase tracking-widest font-bold">
                  {mediaType === "text" ? "Your message" : "Caption"}
                </Label>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder={mediaType === "text" ? "What do you want to say?" : "Say something…"}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white
                             placeholder:text-zinc-500 focus:outline-none focus:border-primary/50 resize-none min-h-[80px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Group</Label>
                {groups.length === 0 ? (
                  <p className="text-zinc-500 text-sm">Create a group first.</p>
                ) : (
                  <select
                    value={selectedGroupId}
                    onChange={e => setSelectedGroupId(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 cursor-pointer"
                  >
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
              </div>

              {groupMembers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Visible to</Label>
                  <div className="flex flex-wrap gap-2">
                    {groupMembers.map(m => (
                      <button
                        key={m.user_id}
                        onClick={() =>
                          setSelectedMemberIds(prev =>
                            prev.includes(m.user_id)
                              ? prev.filter(id => id !== m.user_id)
                              : [...prev, m.user_id]
                          )
                        }
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                          selectedMemberIds.includes(m.user_id)
                            ? "bg-primary/20 border-primary/50 text-primary"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        )}
                      >
                        <Avatar className="size-4">
                          <AvatarImage src={m.avatar} className="object-cover" />
                          <AvatarFallback className="text-[8px] bg-zinc-600 text-white">{m.name[0]}</AvatarFallback>
                        </Avatar>
                        {m.name.split(" ")[0]}
                        {selectedMemberIds.includes(m.user_id) && <Check className="size-3" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time capsule toggle */}
              <button
                onClick={() => setIsTimeCapsule(t => !t)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer",
                  isTimeCapsule ? "border-primary/50 bg-primary/10" : "border-zinc-800 bg-zinc-800/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <Clock className={cn("size-4", isTimeCapsule ? "text-primary" : "text-zinc-500")} />
                  <div className="text-left">
                    <p className={cn("text-sm font-semibold", isTimeCapsule ? "text-white" : "text-zinc-400")}>
                      Time Capsule
                    </p>
                    <p className="text-[11px] text-zinc-500">Hide until a future date</p>
                  </div>
                </div>
                <div
                  className={cn(
                    "size-5 rounded-full border-2 flex items-center justify-center transition-all",
                    isTimeCapsule ? "border-primary bg-primary" : "border-zinc-600"
                  )}
                >
                  {isTimeCapsule && <Check className="size-3 text-white" />}
                </div>
              </button>

              {isTimeCapsule && (
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Unlock date</Label>
                  <input
                    type="date"
                    value={unlockDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={e => setUnlockDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 cursor-pointer"
                  />
                </div>
              )}

              {mediaType !== "text" && (
                <button
                  onClick={() => { setStep("pick"); setMediaData(null) }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  ← Change media
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-zinc-800">
          {step === "pick" ? (
            <Button
              onClick={onClose}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-12 cursor-pointer"
            >
              Cancel
            </Button>
          ) : (
            <Button
              onClick={post}
              disabled={posting || groups.length === 0}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-12 cursor-pointer disabled:opacity-50"
            >
              {posting ? "Posting…" : isTimeCapsule ? "🔒 Lock & Schedule" : "Share Now"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
