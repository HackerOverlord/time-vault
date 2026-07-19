"use client"

import { useState, useEffect, useRef } from "react"
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { ArrowLeft, Camera, Upload, Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { API, ah, jsonH } from "@/lib/api"
import type { Screen } from "@/lib/navigation"

interface SettingsScreenProps {
  onNavigate: (s: Screen) => void
}

export function SettingsScreen({ onNavigate }: SettingsScreenProps) {
  const [tab, setTab] = useState("profile")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [avatar, setAvatar] = useState<string | null>(null)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [isCropping, setIsCropping] = useState(false)
  const [crop, setCrop] = useState<Crop>()
  const imgRef = useRef<HTMLImageElement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [curPwd, setCurPwd] = useState("")
  const [newPwd, setNewPwd] = useState("")
  const [confPwd, setConfPwd] = useState("")
  const [pwdMsg, setPwdMsg] = useState("")
  const [pwdErr, setPwdErr] = useState("")
  const [savingPwd, setSavingPwd] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePwd, setDeletePwd] = useState("")
  const [deleteErr, setDeleteErr] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    fetch(`${API}/api/me`, { headers: ah() })
      .then(r => r.json())
      .then(d => {
        const parts = (d.name || "").split(" ")
        setFirstName(parts[0] || "")
        setLastName(parts.slice(1).join(" ") || "")
        setEmail(d.email || "")
        if (d.avatar) setAvatar(d.avatar)
      })
  }, [])

  useEffect(() => {
    if (tab !== "notifications") return
    fetch(`${API}/api/notifications`, { headers: ah() }).then(r => r.json()).then(setNotifications)
  }, [tab])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => { setImageToCrop(r.result as string); setIsCropping(true) }
    r.readAsDataURL(file)
    e.target.value = ""
  }

  function onImageLoad(img: HTMLImageElement) {
    imgRef.current = img
    const { width, height } = img
    setCrop(
      centerCrop(
        makeAspectCrop({ unit: "px", width: Math.min(width, height) * 0.8 }, 1, width, height),
        width,
        height
      )
    )
  }

  const getCropped = async () => {
    const image = imgRef.current
    if (!image || !crop || crop.width === 0) return
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    const sx = image.naturalWidth / image.width
    const sy = image.naturalHeight / image.height
    canvas.width = crop.width * sx
    canvas.height = crop.height * sy
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(image, crop.x * sx, crop.y * sy, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
    setAvatar(canvas.toDataURL("image/jpeg", 0.9))
    setIsCropping(false)
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/me`, {
        method: "PUT",
        headers: jsonH(),
        body: JSON.stringify({ firstName, lastName, avatar }),
      })
      if (res.ok) {
        setSaveMsg("Saved!")
        setTimeout(() => setSaveMsg(""), 3000)
      } else {
        setSaveMsg("Save failed. Please try again.")
      }
    } finally {
      setSaving(false)
    }
  }

  const changePwd = async () => {
    setPwdErr(""); setPwdMsg("")
    if (newPwd !== confPwd) { setPwdErr("Passwords don't match"); return }
    if (newPwd.length < 8) { setPwdErr("Min 8 characters"); return }
    setSavingPwd(true)
    try {
      const res = await fetch(`${API}/api/change-password`, {
        method: "POST",
        headers: jsonH(),
        body: JSON.stringify({ current_password: curPwd, new_password: newPwd }),
      })
      const d = await res.json()
      if (res.ok) {
        setPwdMsg("Password updated!")
        setCurPwd(""); setNewPwd(""); setConfPwd("")
      } else {
        setPwdErr(d.error)
      }
    } finally {
      setSavingPwd(false)
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`${API}/api/delete-account`, {
        method: "DELETE",
        headers: jsonH(),
        body: JSON.stringify({ password: deletePwd }),
      })
      if (res.ok) {
        sessionStorage.removeItem("token")
        onNavigate("login")
      } else {
        const d = await res.json().catch(() => ({}))
        setDeleteErr(d.error ?? "Deletion failed. Please try again.")
      }
    } finally {
      setDeleting(false)
    }
  }

  const markAllRead = async () => {
    await fetch(`${API}/api/notifications/read-all`, { method: "POST", headers: ah() })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-zinc-800 bg-background/80 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-5 h-16 flex items-center gap-4">
          <button
            onClick={() => onNavigate("feed")}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="h-4 w-px bg-zinc-800" />
          <h1 className="text-white font-bold text-sm">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Tab nav */}
        <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 mb-8 border border-zinc-800">
          {([["profile", "Profile"], ["security", "Security"], ["notifications", "Notifications"]] as const).map(
            ([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer",
                  tab === id ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {label}
              </button>
            )
          )}
        </div>

        {/* Profile tab */}
        {tab === "profile" && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 space-y-6">
            <h2 className="text-white font-bold text-lg">Profile</h2>
            <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={onFileChange} />
            <div className="flex flex-col items-center gap-3">
              <div
                onClick={() => fileRef.current?.click()}
                className="group relative size-24 rounded-full overflow-hidden border-2 border-dashed border-zinc-700 bg-zinc-800/30 hover:border-primary/50 cursor-pointer transition-all flex items-center justify-center"
              >
                {avatar ? (
                  <img src={avatar} className="h-full w-full object-cover" alt="Avatar" />
                ) : (
                  <Camera className="size-6 text-zinc-500 group-hover:text-primary transition-colors" />
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="size-5 text-white" />
                </div>
              </div>
              <p className="text-xs text-zinc-500">Click to change avatar</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {([["First name", firstName, setFirstName], ["Last name", lastName, setLastName]] as const).map(
                ([label, val, set]) => (
                  <div key={label} className="space-y-1.5">
                    <Label className="text-zinc-400 text-sm">{label}</Label>
                    <Input
                      value={val}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl"
                    />
                  </div>
                )
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-sm">Email</Label>
              <Input
                value={email}
                disabled
                className="bg-zinc-800/50 border-zinc-800 text-zinc-500 h-12 rounded-xl cursor-not-allowed"
              />
            </div>
            {saveMsg && <p className="text-green-400 text-sm">{saveMsg}</p>}
            <Button
              onClick={saveProfile}
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}

        {/* Security tab */}
        {tab === "security" && (
          <div className="space-y-5">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 space-y-5">
              <h2 className="text-white font-bold text-lg">Change Password</h2>
              {([
                ["Current password", curPwd, setCurPwd],
                ["New password", newPwd, setNewPwd],
                ["Confirm new password", confPwd, setConfPwd],
              ] as const).map(([label, val, set]) => (
                <div key={label} className="space-y-1.5">
                  <Label className="text-zinc-400 text-sm">{label}</Label>
                  <Input
                    type="password"
                    value={val}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl"
                  />
                </div>
              ))}
              {pwdErr && <p className="text-red-400 text-sm">{pwdErr}</p>}
              {pwdMsg && <p className="text-green-400 text-sm">{pwdMsg}</p>}
              <Button
                onClick={changePwd}
                disabled={savingPwd}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {savingPwd ? "Updating…" : "Update Password"}
              </Button>
            </div>
            <div className="bg-zinc-900 rounded-2xl border border-red-500/20 p-8 space-y-4">
              <h2 className="text-red-400 font-bold text-lg">Danger Zone</h2>
              <p className="text-zinc-500 text-sm">Permanently delete your account and all data. Cannot be undone.</p>
              <Button
                onClick={() => setDeleteOpen(true)}
                className="bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-xl h-11 px-6 cursor-pointer"
              >
                Delete Account
              </Button>
            </div>
          </div>
        )}

        {/* Notifications tab */}
        {tab === "notifications" && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Notifications</h2>
              {notifications.some(n => !n.is_read) && (
                <button
                  onClick={markAllRead}
                  className="text-sm text-primary hover:text-primary/80 cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-12">All caught up.</p>
            ) : (
              notifications.map((n: any) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border transition-colors",
                    n.is_read ? "bg-zinc-800/30 border-zinc-800" : "bg-zinc-800/60 border-zinc-700"
                  )}
                >
                  <div className="mt-0.5 p-2 rounded-lg bg-zinc-800 shrink-0">
                    <Bell className="size-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-snug", n.is_read ? "text-zinc-400" : "text-white font-medium")}>
                      {n.message}
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {!n.is_read && <span className="size-2 rounded-full bg-primary mt-2 shrink-0" />}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Delete account modal */}
      {deleteOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-800 shadow-2xl p-8 space-y-5">
            <h3 className="text-white font-bold text-xl">Delete Account</h3>
            <p className="text-zinc-400 text-sm">
              This permanently deletes your account, posts, and vault memberships.
            </p>
            <Input
              type="password"
              placeholder="Your password"
              value={deletePwd}
              onChange={e => { setDeletePwd(e.target.value); setDeleteErr("") }}
              className="bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl"
            />
            {deleteErr && <p className="text-red-400 text-sm">{deleteErr}</p>}
            <div className="flex gap-3">
              <Button
                onClick={() => { setDeleteOpen(false); setDeletePwd(""); setDeleteErr("") }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-12 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={deleteAccount}
                disabled={!deletePwd || deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 cursor-pointer disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete Forever"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar crop modal */}
      {isCropping && imageToCrop && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 w-full max-w-lg rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="text-white font-bold">Crop Avatar</h3>
              <button
                onClick={() => { setIsCropping(false); setImageToCrop(null) }}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-zinc-950">
              <ReactCrop crop={crop} onChange={c => setCrop(c)} aspect={1} circularCrop>
                <img
                  src={imageToCrop}
                  onLoad={e => onImageLoad(e.currentTarget)}
                  className="max-h-[380px] object-contain"
                  alt="Crop"
                />
              </ReactCrop>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-zinc-800">
              <Button
                onClick={() => { setIsCropping(false); setImageToCrop(null) }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={getCropped}
                className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl cursor-pointer"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
