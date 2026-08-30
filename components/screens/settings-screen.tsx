"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { ArrowLeft, Camera, Upload, Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { API, ah, jsonH } from "@/lib/api"
import type { Screen } from "@/lib/navigation"

// ── Focus trap helper ─────────────────────────────────────────────────────────
const FOCUSABLE =
  'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

function useFocusTrap(
  ref: React.RefObject<HTMLDivElement | null>,
  active: boolean,
  onEscape: () => void,
) {
  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return

    // Lock background scroll while dialog is open
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"

    // Move focus into the dialog on open
    const first = el.querySelector<HTMLElement>(FOCUSABLE)
    const rafId = requestAnimationFrame(() => first?.focus())

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onEscape(); return }
      if (e.key !== "Tab" || !ref.current) return
      const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(n => !n.closest("[aria-hidden]"))
      if (nodes.length === 0) return
      const f = nodes[0], l = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus() }
      else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus() }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("keydown", onKey)
      // Restore scroll on close/unmount — only one dialog can be open at a time
      document.body.style.overflow = prev
    }
  }, [active, ref, onEscape])
}

interface SettingsScreenProps {
  onNavigate: (s: Screen) => void
}

export function SettingsScreen({ onNavigate }: SettingsScreenProps) {
  const [tab, setTab]                   = useState<"profile"|"security"|"notifications">("profile")
  const [firstName, setFirstName]       = useState("")
  const [lastName, setLastName]         = useState("")
  const [email, setEmail]               = useState("")
  const [avatar, setAvatar]             = useState<string | null>(null)
  const [imageToCrop, setImageToCrop]   = useState<string | null>(null)
  const [isCropping, setIsCropping]     = useState(false)
  const [crop, setCrop]                 = useState<Crop>()
  const imgRef  = useRef<HTMLImageElement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving]             = useState(false)
  const [saveMsg, setSaveMsg]           = useState("")
  const [saveMsgType, setSaveMsgType]   = useState<"ok"|"err">("ok")
  const [curPwd, setCurPwd]             = useState("")
  const [newPwd, setNewPwd]             = useState("")
  const [confPwd, setConfPwd]           = useState("")
  const [pwdMsg, setPwdMsg]             = useState("")
  const [pwdErr, setPwdErr]             = useState("")
  const [savingPwd, setSavingPwd]       = useState(false)
  const [deleteOpen, setDeleteOpen]     = useState(false)
  const [deletePwd, setDeletePwd]       = useState("")
  const [deleteErr, setDeleteErr]       = useState("")
  const [deleting, setDeleting]         = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])

  // Focus restore refs for modals
  const deleteOpenTriggerRef = useRef<HTMLButtonElement | null>(null)
  const deleteModalRef       = useRef<HTMLDivElement>(null)
  const cropModalRef         = useRef<HTMLDivElement>(null)

  // Static prefix for dialog title IDs — unique enough for a single-instance component
  const titleId = "settings"

  // ── Close modal handlers ────────────────────────────────────────────────────
  const closeDelete = useCallback(() => {
    setDeleteOpen(false)
    setDeletePwd("")
    setDeleteErr("")
    requestAnimationFrame(() => deleteOpenTriggerRef.current?.focus())
  }, [])

  const closeCrop = useCallback(() => {
    setIsCropping(false)
    setImageToCrop(null)
  }, [])

  useFocusTrap(deleteModalRef, deleteOpen, closeDelete)
  useFocusTrap(cropModalRef,   isCropping, closeCrop)

  // ── Data fetching ───────────────────────────────────────────────────────────
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

  // ── Avatar crop ─────────────────────────────────────────────────────────────
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
        height,
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
    canvas.width  = crop.width * sx
    canvas.height = crop.height * sy
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(image, crop.x * sx, crop.y * sy, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
    setAvatar(canvas.toDataURL("image/jpeg", 0.9))
    setIsCropping(false)
  }

  // ── Profile save ────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/me`, {
        method: "PUT",
        headers: jsonH(),
        body: JSON.stringify({ firstName, lastName, avatar }),
      })
      if (res.ok) {
        setSaveMsgType("ok")
        setSaveMsg("Saved!")
        setTimeout(() => setSaveMsg(""), 3000)
      } else {
        setSaveMsgType("err")
        setSaveMsg("Save failed. Please try again.")
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Password change ─────────────────────────────────────────────────────────
  const changePwd = async () => {
    setPwdErr(""); setPwdMsg("")
    if (newPwd !== confPwd) { setPwdErr("Passwords don't match"); return }
    if (newPwd.length < 8)  { setPwdErr("Min 8 characters"); return }
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

  // ── Delete account ──────────────────────────────────────────────────────────
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

  // ── Notifications ───────────────────────────────────────────────────────────
  const markAllRead = async () => {
    await fetch(`${API}/api/notifications/read-all`, { method: "POST", headers: ah() })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-zinc-800 bg-background/80 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-5 h-16 flex items-center gap-4">
          <button
            onClick={() => onNavigate("feed")}
            aria-label="Back to feed"
            className="flex items-center gap-2 min-h-11 text-zinc-400 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" aria-hidden />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="h-4 w-px bg-zinc-800" aria-hidden />
          <h1 className="text-white font-bold text-sm">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8">

        {/* Tab nav */}
        <div
          role="tablist"
          aria-label="Settings sections"
          className="flex gap-1 bg-zinc-900 rounded-xl p-1 mb-8 border border-zinc-800"
          onKeyDown={e => {
            const tabs = ["profile", "security", "notifications"] as const
            const cur = tabs.indexOf(tab)
            let next = cur
            if (e.key === "ArrowRight") { e.preventDefault(); next = (cur + 1) % tabs.length }
            else if (e.key === "ArrowLeft") { e.preventDefault(); next = (cur - 1 + tabs.length) % tabs.length }
            else if (e.key === "Home")       { e.preventDefault(); next = 0 }
            else if (e.key === "End")        { e.preventDefault(); next = tabs.length - 1 }
            else return
            setTab(tabs[next])
            // Move focus to the newly selected tab button
            const el = document.getElementById(`settings-tab-${tabs[next]}`)
            el?.focus()
          }}
        >
          {(["profile", "security", "notifications"] as const).map(id => (
            <button
              key={id}
              id={`settings-tab-${id}`}
              role="tab"
              aria-selected={tab === id}
              aria-controls={`settings-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer capitalize",
                tab === id ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        <div
          id="settings-panel-profile"
          role="tabpanel"
          aria-labelledby="settings-tab-profile"
          hidden={tab !== "profile"}
        >
          {tab === "profile" && (
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 space-y-6">
              <h2 className="text-white font-bold text-lg">Profile</h2>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/*"
                aria-label="Upload avatar image"
                onChange={onFileChange}
              />

              {/* Avatar — real button for accessibility */}
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Change avatar"
                  className="group relative size-24 rounded-full overflow-hidden border-2 border-dashed border-zinc-700
                             bg-zinc-800/30 hover:border-primary/50 cursor-pointer transition-all flex items-center justify-center"
                >
                  {avatar ? (
                    <img src={avatar} className="h-full w-full object-cover" alt="Current avatar" />
                  ) : (
                    <Camera className="size-6 text-zinc-500 group-hover:text-primary transition-colors" aria-hidden />
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
                    <Upload className="size-5 text-white" />
                  </div>
                </button>
                <p className="text-xs text-zinc-500" aria-hidden>Click to change avatar</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {([
                  ["First name", firstName, setFirstName, "settings-first-name"] as const,
                  ["Last name",  lastName,  setLastName,  "settings-last-name"]  as const,
                ]).map(([label, val, set, id]) => (
                  <div key={id} className="space-y-1.5">
                    <Label htmlFor={id} className="text-zinc-400 text-sm">{label}</Label>
                    <Input
                      id={id}
                      value={val}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="settings-email" className="text-zinc-400 text-sm">Email</Label>
                <Input
                  id="settings-email"
                  value={email}
                  disabled
                  aria-describedby="settings-email-note"
                  className="bg-zinc-800/50 border-zinc-800 text-zinc-500 h-12 rounded-xl cursor-not-allowed"
                />
                <p id="settings-email-note" className="text-zinc-600 text-xs">Email cannot be changed</p>
              </div>

              {/* Status announced to screen readers */}
              {saveMsg && (
                <p
                  role="status"
                  aria-live="polite"
                  className={saveMsgType === "ok" ? "text-green-400 text-sm" : "text-red-400 text-sm"}
                >
                  {saveMsg}
                </p>
              )}

              <Button
                onClick={saveProfile}
                disabled={saving}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          )}
        </div>

        {/* Security tab */}
        <div
          id="settings-panel-security"
          role="tabpanel"
          aria-labelledby="settings-tab-security"
          hidden={tab !== "security"}
        >
          {tab === "security" && (
            <div className="space-y-5">
              <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 space-y-5">
                <h2 className="text-white font-bold text-lg">Change Password</h2>
                {([
                  ["Current password",    curPwd,  setCurPwd,  "settings-cur-pwd"]  as const,
                  ["New password",        newPwd,  setNewPwd,  "settings-new-pwd"]  as const,
                  ["Confirm new password",confPwd, setConfPwd, "settings-conf-pwd"] as const,
                ]).map(([label, val, set, id]) => (
                  <div key={id} className="space-y-1.5">
                    <Label htmlFor={id} className="text-zinc-400 text-sm">{label}</Label>
                    <Input
                      id={id}
                      type="password"
                      value={val}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl"
                    />
                  </div>
                ))}
                {pwdErr && <p role="alert" className="text-red-400 text-sm">{pwdErr}</p>}
                {pwdMsg && <p role="status" aria-live="polite" className="text-green-400 text-sm">{pwdMsg}</p>}
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
                <p className="text-zinc-500 text-sm" id="delete-account-desc">
                  Permanently delete your account and all data. Cannot be undone.
                </p>
                <button
                  ref={deleteOpenTriggerRef}
                  onClick={() => setDeleteOpen(true)}
                  aria-describedby="delete-account-desc"
                  className="bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-xl h-11 px-6 cursor-pointer"
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notifications tab */}
        <div
          id="settings-panel-notifications"
          role="tabpanel"
          aria-labelledby="settings-tab-notifications"
          hidden={tab !== "notifications"}
        >
          {tab === "notifications" && (
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">Notifications</h2>
                {notifications.some(n => !n.is_read) && (
                  <button
                    onClick={markAllRead}
                    className="text-sm text-primary hover:text-primary/80 cursor-pointer min-h-11 px-2 inline-flex items-center"
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
                    <div className="mt-0.5 p-2 rounded-lg bg-zinc-800 shrink-0" aria-hidden>
                      <Bell className="size-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm leading-snug", n.is_read ? "text-zinc-400" : "text-white font-medium")}>
                        {n.message}
                      </p>
                      <p className="text-[11px] text-zinc-600 mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="size-2 rounded-full bg-primary mt-2 shrink-0" aria-label="Unread" />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete account dialog ───────────────────────────────────────────── */}
      {deleteOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${titleId}-delete`}
            className="bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-800 shadow-2xl p-8 space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <h3 id={`${titleId}-delete`} className="text-white font-bold text-xl">Delete Account</h3>
            <p className="text-zinc-400 text-sm">
              This permanently deletes your account, posts, and vault memberships.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="delete-pwd-input" className="text-zinc-400 text-sm">Your password</Label>
              <Input
                id="delete-pwd-input"
                type="password"
                placeholder="Enter your password to confirm"
                value={deletePwd}
                onChange={e => { setDeletePwd(e.target.value); setDeleteErr("") }}
                className="bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl"
              />
            </div>
            {deleteErr && <p role="alert" className="text-red-400 text-sm">{deleteErr}</p>}
            <div className="flex gap-3">
              <Button
                onClick={closeDelete}
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

      {/* ── Avatar crop dialog ─────────────────────────────────────────────── */}
      {isCropping && imageToCrop && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div
            ref={cropModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${titleId}-crop`}
            className="bg-zinc-900 w-full max-w-lg rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
              <h3 id={`${titleId}-crop`} className="text-white font-bold">Crop Avatar</h3>
              <button
                onClick={closeCrop}
                aria-label="Close crop dialog"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-zinc-950 flex-1 overflow-auto">
              <ReactCrop crop={crop} onChange={c => setCrop(c)} aspect={1} circularCrop>
                <img
                  src={imageToCrop}
                  onLoad={e => onImageLoad(e.currentTarget)}
                  className="max-h-[380px] object-contain"
                  alt="Image to crop"
                />
              </ReactCrop>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-zinc-800 shrink-0">
              <Button
                onClick={closeCrop}
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
