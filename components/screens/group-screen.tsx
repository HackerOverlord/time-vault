"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import {
  ArrowLeft, Check, X, RefreshCw, Pencil, Trash2,
  LogOut, Users, Loader2, AlertTriangle, Copy,
  Camera, ImageIcon, Upload, Palette, Info,
  UserPlus, Star, Mail, Clock, BadgeCheck,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ACCENT_OPTIONS, accentButton, accentGradient, accentRing, vaultInitials } from "@/lib/vaultAccent"
import type { VaultAccentColor } from "@/lib/types"
import { apiFetch } from "@/lib/api"
import type { Screen } from "@/lib/navigation"
import type { Group, VaultMember } from "@/lib/types"
import {
  canEditVault, canManageMembers, canInviteMembers,
  canDeleteVault, canLeaveVault, canRemoveMember,
  currentMember,
} from "@/lib/vaultPermissions"

// ─── Props ────────────────────────────────────────────────────────────────────

interface GroupScreenProps {
  onNavigate: (s: Screen) => void
  group: Group
  /** Called when vault name is changed so the parent can update its Group list. */
  onGroupRenamed?: (id: string, newName: string) => void
  /** Called when vault is deleted or left so parent can remove it. */
  onGroupLeft?: (id: string) => void
}

// ─── Focus trap (shared with modal dialogs) ───────────────────────────────────

const FOCUSABLE =
  'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>, active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onEscape(); return }
      if (e.key !== "Tab" || !ref.current) return
      const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => !el.closest("[aria-hidden]"))
      if (nodes.length === 0) return
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, ref, onEscape])
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  /** For delete-vault: require the user to type the vault name before confirming. */
  confirmText?: string
  confirmPlaceholder?: string
  onConfirm: (typed?: string) => void
  onCancel: () => void
  busy?: boolean
}

function ConfirmDialog({
  title, description, confirmLabel, danger, confirmText,
  confirmPlaceholder, onConfirm, onCancel, busy,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("")
  const dialogRef  = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const titleId    = "confirm-dialog"

  useEffect(() => {
    const id = requestAnimationFrame(() => confirmRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  useFocusTrap(dialogRef, true, onCancel)

  const isValid = confirmText ? typed === confirmText : true

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={onCancel} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          {danger && <AlertTriangle className="size-5 text-red-400 shrink-0 mt-0.5" />}
          <div>
            <h2 id={titleId} className="text-white font-bold text-[15px]">{title}</h2>
            <p className="text-zinc-400 text-sm mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        {confirmText && (
          <div className="space-y-1.5">
            <p className="text-zinc-500 text-xs">
              Type <span className="text-white font-mono">"{confirmText}"</span> to confirm
            </p>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={confirmPlaceholder ?? confirmText}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white
                         placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50"
            />
          </div>
        )}

        <div className="flex gap-2.5 pt-1">
          <Button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-11 cursor-pointer"
          >
            Cancel
          </Button>
          <button
            ref={confirmRef}
            onClick={() => onConfirm(typed || undefined)}
            disabled={busy || !isValid}
            className={cn(
              "flex-1 rounded-xl h-11 cursor-pointer font-semibold disabled:opacity-50 flex items-center justify-center",
              danger
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-primary hover:bg-primary/90 text-white"
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── RenameDialog ─────────────────────────────────────────────────────────────

interface RenameDialogProps {
  currentName: string
  onConfirm: (newName: string) => void
  onCancel: () => void
  busy?: boolean
}

function RenameDialog({ currentName, onConfirm, onCancel, busy }: RenameDialogProps) {
  const [name, setName] = useState(currentName)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const titleId   = "rename-dialog"

  useEffect(() => {
    const id = requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select() })
    return () => cancelAnimationFrame(id)
  }, [])

  useFocusTrap(dialogRef, true, onCancel)

  const trimmed = name.trim()
  const isValid = trimmed.length > 0 && trimmed.length <= 50 && trimmed !== currentName

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={onCancel} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl p-6 space-y-4"
      >
        <h2 id={titleId} className="text-white font-bold text-[15px]">Rename vault</h2>

        <div className="space-y-1.5">
          <input
            ref={inputRef}
            type="text"
            value={name}
            maxLength={50}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && isValid && !busy) onConfirm(trimmed) }}
            placeholder="Vault name"
            aria-label="New vault name"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white
                       placeholder:text-zinc-600 focus:outline-none focus:border-primary/50"
          />
          <p className="text-zinc-600 text-xs text-right">{name.length}/50</p>
        </div>

        <div className="flex gap-2.5 pt-1">
          <Button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-11 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(trimmed)}
            disabled={busy || !isValid}
            className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl h-11 cursor-pointer font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Rename"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Relative join date ───────────────────────────────────────────────────────

function joinedLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "Joined today"
  if (days === 1) return "Joined yesterday"
  if (days < 30)  return `Joined ${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `Joined ${months}mo ago`
  return `Joined ${Math.floor(months / 12)}y ago`
}

// ─── GroupScreen ──────────────────────────────────────────────────────────────

export function GroupScreen({
  onNavigate, group, onGroupRenamed, onGroupLeft,
}: GroupScreenProps) {
  const [members,       setMembers]       = useState<VaultMember[]>([])
  const [membersError,  setMembersError]  = useState<string | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [vaultName,     setVaultName]     = useState(group.name)
  const [inviteCode,    setInviteCode]    = useState(group.invite_code ?? "")
  const [description,   setDescription]   = useState(group.description ?? "")
  const [accentColor,   setAccentColor]   = useState<VaultAccentColor | null>(group.accent_color ?? null)
  const [coverUrl,      setCoverUrl]      = useState<string | null>(group.cover_url ?? null)

  // Cover image editing state
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteResult, setInviteResult] = useState<"idle" | "sent" | "error">("idle")
  const [coverUploading,  setCoverUploading]  = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  // Description editing state
  const [editingDesc,  setEditingDesc]  = useState(false)
  const [descDraft,    setDescDraft]    = useState(group.description ?? "")
  const [savingDesc,   setSavingDesc]   = useState(false)

  // Accent color saving state
  const [savingAccent, setSavingAccent] = useState(false)

  // Busy flags for individual actions
  const [removing,    setRemoving]    = useState<string | null>(null)  // user_id being removed
  const [regenerating, setRegenerating] = useState(false)
  const [leaving,     setLeaving]     = useState(false)

  // Dialog state
  const [showRename,       setShowRename]       = useState(false)
  const [renameBusy,       setRenameBusy]       = useState(false)
  const [showDelete,       setShowDelete]       = useState(false)
  const [deleteBusy,       setDeleteBusy]       = useState(false)
  const [showLeave,        setShowLeave]        = useState(false)
  const [removeTarget,     setRemoveTarget]     = useState<VaultMember | null>(null)
  const [removeBusy,       setRemoveBusy]       = useState(false)
  const [copied,           setCopied]           = useState(false)

  // Focus restore: track which button opened the current dialog
  const dialogTriggerRef = useRef<HTMLButtonElement | null>(null)

  const closeDialog = useCallback(() => {
    setShowRename(false)
    setShowDelete(false)
    setShowLeave(false)
    setRemoveTarget(null)
    requestAnimationFrame(() => dialogTriggerRef.current?.focus())
  }, [])

  // ── Load members + current user ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMembersError(null)

    Promise.all([
      apiFetch<VaultMember[]>(`/api/vaults/${group.id}/members`),
      apiFetch<{ id: string }>("/api/me"),
    ]).then(([membersResult, meResult]) => {
      if (cancelled) return
      if (membersResult.ok) {
        setMembers(membersResult.data)
      } else {
        const status = (membersResult as any).status
        if (status === 401) { onNavigate("login"); return }
        setMembersError(membersResult.error ?? "Could not load members")
      }
      if (meResult.ok) setCurrentUserId(String(meResult.data.id))
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [group.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived permissions ────────────────────────────────────────────────────
  const me   = currentMember(members, currentUserId)
  const role = (me?.role ?? null) as "owner" | "member" | null

  const displayCode = inviteCode.length === 6
    ? `${inviteCode.slice(0, 3)}-${inviteCode.slice(3)}`
    : inviteCode

  // ── Upload vault cover image (FormData — no base64) ─────────────────────
  // Sends binary multipart/form-data to POST /api/vaults/<id>/cover.
  // The previous cover is preserved in state if the upload fails.
  const handleCoverUpload = async (file: File) => {
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Cover must be a JPEG, PNG, or WebP image")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Cover image must be under 5 MB")
      return
    }
    if (coverUploading) return          // prevent duplicate uploads
    setCoverUploading(true)
    try {
      const form = new FormData()
      form.append("cover", file)
      const result = await apiFetch<{ cover_url: string }>(
        `/api/vaults/${group.id}/cover`,
        { method: "POST", body: form }
      )
      if (result.ok) {
        setCoverUrl(result.data.cover_url)
        toast.success("Cover updated")
      } else {
        // Previous cover preserved — do not call setCoverUrl
        toast.error(result.error ?? "Failed to update cover")
      }
    } finally {
      setCoverUploading(false)
    }
  }

  // ── Remove vault cover ────────────────────────────────────────────────────
  const handleRemoveCover = async () => {
    const prev = coverUrl
    setCoverUrl(null)
    const result = await apiFetch(
      `/api/vaults/${group.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_url: null }),
      }
    )
    if (!result.ok) {
      setCoverUrl(prev)   // restore on failure
      toast.error(result.error ?? "Could not remove cover")
    }
  }

  // ── Save description ─────────────────────────────────────────────────────
  const saveDescription = async () => {
    const trimmed = descDraft.trim()
    setSavingDesc(true)
    const result = await apiFetch<{ description: string }>(
      `/api/vaults/${group.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed }),
      }
    )
    setSavingDesc(false)
    if (result.ok) {
      setDescription(trimmed)
      setEditingDesc(false)
      toast.success("Description saved")
    } else {
      toast.error(result.error ?? "Failed to save description")
    }
  }

  // ── Save accent color ─────────────────────────────────────────────────────
  const saveAccentColor = async (color: VaultAccentColor) => {
    setAccentColor(color)
    setSavingAccent(true)
    const result = await apiFetch(
      `/api/vaults/${group.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accent_color: color }),
      }
    )
    setSavingAccent(false)
    if (!result.ok) {
      toast.error("Could not save color preference")
    }
  }

  // ── Send child claim invite ─────────────────────────────────────────────────
  const sendClaimInvite = async () => {
    setSendingInvite(true); setInviteResult("idle")
    const r = await apiFetch(`/api/vaults/${group.id}/claim-invite`,
      { method: "POST", headers: { "Content-Type": "application/json" } })
    setSendingInvite(false)
    if (r.ok) { setInviteResult("sent"); toast.success("Invitation sent") }
    else { setInviteResult("error"); toast.error(r.error ?? "Failed to send") }
  }

  // ── Copy invite code ───────────────────────────────────────────────────────
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(displayCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available — show the code so they can copy manually
      toast.error("Could not copy. Code: " + displayCode)
    }
  }

  // ── Regenerate invite code ─────────────────────────────────────────────────
  const regenerateCode = async () => {
    if (regenerating) return
    setRegenerating(true)
    const result = await apiFetch<{ invite_code: string }>(
      `/api/vaults/${group.id}/invite/regenerate`,
      { method: "POST" }
    )
    setRegenerating(false)
    if (result.ok) {
      setInviteCode(result.data.invite_code)
      toast.success("New invite code generated")
    } else {
      toast.error(result.error ?? "Could not regenerate code")
    }
  }

  // ── Rename vault ───────────────────────────────────────────────────────────
  const handleRename = async (newName: string) => {
    setRenameBusy(true)
    const result = await apiFetch<{ name: string }>(
      `/api/vaults/${group.id}`,
      {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: newName }),
      }
    )
    setRenameBusy(false)
    if (result.ok) {
      setVaultName(result.data.name)
      onGroupRenamed?.(group.id, result.data.name)
      toast.success("Vault renamed")
      closeDialog()
    } else {
      toast.error(result.error ?? "Could not rename vault")
    }
  }

  // ── Delete vault ───────────────────────────────────────────────────────────
  const handleDelete = async (typed?: string) => {
    if (typed !== vaultName) {
      toast.error("Name doesn't match")
      return
    }
    setDeleteBusy(true)
    const result = await apiFetch(
      `/api/vaults/${group.id}`,
      {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ confirm_name: typed }),
      }
    )
    setDeleteBusy(false)
    if (result.ok) {
      toast.success(`"${vaultName}" deleted`)
      onGroupLeft?.(group.id)
      onNavigate("feed")
    } else {
      toast.error(result.error ?? "Could not delete vault")
    }
  }

  // ── Leave vault ────────────────────────────────────────────────────────────
  const handleLeave = async () => {
    setLeaving(true)
    setRemoveBusy(true)
    const result = await apiFetch(
      `/api/vaults/${group.id}/leave`,
      { method: "DELETE" }
    )
    setLeaving(false)
    setRemoveBusy(false)
    if (result.ok) {
      toast.success(`Left "${vaultName}"`)
      onGroupLeft?.(group.id)
      onNavigate("feed")
    } else {
      toast.error(result.error ?? "Could not leave vault")
    }
  }

  // ── Remove member ──────────────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoveBusy(true)
    const result = await apiFetch(
      `/api/vaults/${group.id}/members/${removeTarget.user_id}`,
      { method: "DELETE" }
    )
    setRemoveBusy(false)
    if (result.ok) {
      setMembers(prev => prev.filter(m => m.user_id !== removeTarget.user_id))
      toast.success(`${removeTarget.name} removed`)
      closeDialog()
    } else {
      toast.error(result.error ?? "Could not remove member")
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const initials = vaultInitials(vaultName)
  const btnClass = accentButton(accentColor)
  const gradClass = accentGradient(accentColor)

  return (
    <div className="min-h-screen bg-background">

      {/* ── Sticky nav bar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 border-b border-zinc-800 bg-background/80 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-5 h-14 flex items-center gap-3">
          <button
            onClick={() => onNavigate("feed")}
            aria-label="Back to feed"
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors cursor-pointer group min-h-11"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="h-4 w-px bg-zinc-800" aria-hidden />
          <h1 className="text-white font-semibold text-sm truncate flex-1">{vaultName}</h1>
          {canEditVault(role) && (
            <button
              onClick={e => { dialogTriggerRef.current = e.currentTarget; setShowRename(true) }}
              aria-label="Rename vault"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500
                         hover:text-white transition-colors cursor-pointer"
            >
              <Pencil className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Vault identity header ────────────────────────────────────────── */}
      <div className="relative">
        <div className="h-48 sm:h-56 w-full relative">
          {coverUrl ? (
            <img src={coverUrl} alt="" aria-hidden className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className={cn("w-full h-full bg-gradient-to-br", gradClass)} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          {canEditVault(role) && (
            <>
              <div className="absolute inset-0 pointer-events-none">
                <div className="max-w-lg mx-auto h-full px-5 relative">
                  <div className="absolute top-3 right-5 flex items-center gap-2 pointer-events-auto">
                    {coverUrl && !coverUploading && (
                      <button onClick={handleRemoveCover} aria-label="Remove cover image"
                        className="flex items-center gap-1.5 bg-black/40 hover:bg-red-900/60 text-white text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors backdrop-blur-sm">
                        <X className="size-3" /> Remove
                      </button>
                    )}
                    <button onClick={() => coverInputRef.current?.click()} disabled={coverUploading}
                      aria-label={coverUrl ? "Change cover image" : "Upload cover image"}
                      className="flex items-center gap-1.5 bg-black/40 hover:bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors disabled:opacity-50 backdrop-blur-sm">
                      {coverUploading ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
                      {coverUploading ? "Uploading…" : coverUrl ? "Change cover" : "Add cover"}
                    </button>
                  </div>
                </div>
              </div>
              <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                className="sr-only" aria-label="Upload vault cover image"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleCoverUpload(file)
                  e.target.value = ""
                }} />
            </>
          )}
          <div className="absolute inset-0 pointer-events-none">
            <div className="max-w-lg mx-auto h-full px-5 relative">
              <div className="absolute bottom-4 left-5 flex items-end gap-4 pointer-events-auto">
                <div
                  className={cn(
                    "size-20 rounded-2xl border-4 border-background shrink-0 overflow-hidden",
                    "flex items-center justify-center bg-gradient-to-br shadow-lg",
                    gradClass
                  )}
                  role="img" aria-label={`${vaultName} vault avatar`}
                >
                  {coverUrl
                    ? <img src={coverUrl} alt="" aria-hidden className="w-full h-full object-cover" loading="lazy" />
                    : <span className="text-white font-bold text-2xl select-none" aria-hidden>{initials}</span>}
                </div>
                <div className="min-w-0 pb-1">
                  <h2 className="text-white font-bold text-xl leading-tight truncate drop-shadow">
                    {vaultName}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white/70 text-sm flex items-center gap-1">
                      <Users className="size-3.5" aria-hidden />
                      {loading ? "…" : `${members.length} member${members.length !== 1 ? "s" : ""}`}
                    </span>
                    {role === "owner" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-400/10 rounded-full px-2 py-0.5">
                        <Star className="size-2.5" aria-hidden /> Owner
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Settings content column */}
        <div className="max-w-lg mx-auto px-5 pt-6">

          {/* Description */}
          <div className="pb-5 border-b border-zinc-800/60">
            {editingDesc ? (
              <div className="space-y-2">
                <textarea
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  maxLength={160}
                  rows={2}
                  placeholder="What is this vault for? (optional)"
                  aria-label="Vault description"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white
                             placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveDescription}
                    disabled={savingDesc}
                    aria-label="Save description"
                    className={cn("flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full text-white cursor-pointer disabled:opacity-50 transition-colors", btnClass)}
                  >
                    {savingDesc ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingDesc(false); setDescDraft(description) }}
                    aria-label="Cancel editing description"
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full text-zinc-400 hover:text-white cursor-pointer bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  >
                    <X className="size-3" /> Cancel
                  </button>
                  <span className="text-zinc-600 text-xs ml-auto">{descDraft.length}/160</span>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 group/desc">
                {description ? (
                  <p className="text-zinc-400 text-sm leading-relaxed flex-1">{description}</p>
                ) : canEditVault(role) ? (
                  <p className="text-zinc-600 text-sm italic flex-1">Add a description…</p>
                ) : null}
                {canEditVault(role) && (
                  <button
                    onClick={() => { setDescDraft(description); setEditingDesc(true) }}
                    aria-label={description ? "Edit description" : "Add description"}
                    className="opacity-0 group-hover/desc:opacity-100 focus:opacity-100 flex items-center justify-center size-7 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer shrink-0"
                  >
                    <Pencil className="size-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Accent color picker — owners only */}
          {canEditVault(role) && (
            <div className="py-4 border-b border-zinc-800/60">
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                  <Palette className="size-3.5" aria-hidden /> Vault color
                </span>
                {savingAccent && <Loader2 className="size-3 animate-spin text-zinc-500" />}
              </div>
              <div className="flex gap-2.5 mt-2.5" role="group" aria-label="Choose vault accent color">
                {ACCENT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => saveAccentColor(opt.value)}
                    aria-label={opt.label}
                    aria-pressed={accentColor === opt.value}
                    className={cn(
                      "size-7 rounded-full cursor-pointer transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                      opt.swatch,
                      accentColor === opt.value && "ring-2 ring-offset-2 ring-offset-background ring-white"
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6 pb-6">
                    {/* ── Invite code section — owners only ──────────────────────────── */}
        {canInviteMembers(role) && inviteCode && (
          <section aria-label="Invite code" className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-4">
            <h2 className="text-white font-bold">Invite people</h2>
            <p className="text-zinc-500 text-sm">
              Share this code with someone to add them to this vault.
              Regenerating the code immediately invalidates the old one.
            </p>

            {/* Code display + copy */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-zinc-800 rounded-xl px-4 py-3 font-mono text-lg tracking-widest text-white font-bold text-center select-all">
                {displayCode}
              </div>
              <button
                onClick={copyCode}
                aria-label={copied ? "Copied" : "Copy invite code"}
                className={cn(
                  "flex min-h-11 min-w-11 items-center justify-center rounded-xl px-4 cursor-pointer transition-all font-semibold text-sm text-white",
                  copied ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary hover:bg-primary/90"
                )}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </div>

            {/* Regenerate */}
            <button
              onClick={regenerateCode}
              disabled={regenerating}
              aria-label="Generate new invite code"
              className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs transition-colors
                         cursor-pointer disabled:opacity-50 min-h-11"
            >
              <RefreshCw className={cn("size-3.5", regenerating && "animate-spin")} />
              {regenerating ? "Generating…" : "Generate new code"}
            </button>
          </section>
        )}

        {/* ── Child vault status ─────────────────────────────────────────── */}
        {group.vault_type === "child" && (
          <section aria-label="Child vault status"
            className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              {group.claimed_at
                ? <BadgeCheck className="size-4 text-emerald-400" aria-hidden />
                : <Clock className="size-4 text-amber-400" aria-hidden />}
              {group.claimed_at ? "Claimed" : "Waiting to be claimed"}
            </h3>
            {group.claimed_at && group.claimed_by ? (
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {group.claimed_by.avatar
                    ? <img src={group.claimed_by.avatar} alt="" className="w-full h-full object-cover" />
                    : <span className="text-white text-xs font-bold">
                        {group.claimed_by.display_name?.[0]?.toUpperCase()}
                      </span>}
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{group.claimed_by.display_name}</p>
                  <p className="text-zinc-400 text-xs">
                    Claimed {new Date(group.claimed_at).toLocaleDateString(undefined,
                      { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-zinc-400 text-sm">
                  Invitation will be sent to{" "}
                  <strong className="text-white/80">{group.child_email ?? "the child"}</strong>.
                </p>
                {role === "owner" && (
                  <button onClick={sendClaimInvite} disabled={sendingInvite}
                    aria-label={inviteResult === "sent" ? "Invitation sent" : "Send claim invitation"}
                    className={cn(
                      "flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl",
                      "cursor-pointer transition-colors disabled:opacity-50",
                      inviteResult === "sent" ? "bg-emerald-900/40 text-emerald-400"
                        : inviteResult === "error" ? "bg-red-900/40 text-red-400"
                        : "bg-primary/20 hover:bg-primary/30 text-primary"
                    )}>
                    {sendingInvite ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                    {sendingInvite ? "Sending…" : inviteResult === "sent" ? "Invitation sent!"
                      : inviteResult === "error" ? "Retry" : "Send invitation"}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Members section ─────────────────────────────────────────────── */}
        <section aria-label="Members">
          <h2 className="text-white font-bold mb-3">
            Members{!loading && ` (${members.length})`}
            {loading && <span className="text-zinc-600 font-normal ml-1">…</span>}
          </h2>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-10 text-zinc-500 gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">Loading members…</span>
            </div>
          )}

          {/* Error */}
          {!loading && membersError && (
            <div className="text-center py-8 space-y-2">
              <p className="text-red-400 text-sm">{membersError}</p>
              <button
                onClick={() => { setMembersError(null); setLoading(true) }}
                className="text-zinc-500 hover:text-white text-xs underline cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !membersError && members.length === 0 && (
            <div className="text-center py-8">
              <Users className="size-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No members found.</p>
            </div>
          )}

          {/* Member list */}
          {!loading && !membersError && members.length > 0 && (
            <ul role="list" className="space-y-2" aria-label="Vault members">
              {members.map(m => {
                const isMe = m.user_id === currentUserId
                const canRemove = canRemoveMember(role, m, currentUserId)
                return (
                  <li
                    key={m.user_id}
                    className="flex items-center gap-3 bg-zinc-900 rounded-xl p-4 border border-zinc-800"
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage src={m.avatar ?? undefined} className="object-cover" />
                      <AvatarFallback className="bg-zinc-700 text-white text-xs font-bold">
                        {m.name[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-white text-sm font-medium truncate">{m.name}</p>
                        {isMe && (
                          <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-600 text-[11px] mt-0.5">{joinedLabel(m.joined_at)}</p>
                    </div>

                    {m.role === "owner" && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 shrink-0">
                        Owner
                      </span>
                    )}

                    {canRemove && (
                      <button
                        onClick={e => {
                          dialogTriggerRef.current = e.currentTarget
                          setRemoveTarget(m)
                        }}
                        disabled={removing === m.user_id}
                        aria-label={`Remove ${m.name} from vault`}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-full shrink-0
                                   text-zinc-600 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {removing === m.user_id
                          ? <Loader2 className="size-4 animate-spin" />
                          : <X className="size-4" />
                        }
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ── Danger zone ─────────────────────────────────────────────────── */}
        <section
          aria-label="Danger zone"
          className="border border-zinc-800 rounded-2xl p-5 space-y-3"
        >
          <h2 className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">
            Danger zone
          </h2>

          {/* Leave vault — members only */}
          {canLeaveVault(role) && (
            <button
              onClick={e => {
                dialogTriggerRef.current = e.currentTarget
                setShowLeave(true)
              }}
              disabled={leaving}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-800
                         text-zinc-400 hover:text-red-400 hover:border-red-900/40 hover:bg-red-950/20
                         transition-all cursor-pointer text-sm disabled:opacity-50 min-h-11"
            >
              <LogOut className="size-4 shrink-0" />
              Leave vault
            </button>
          )}

          {/* Delete vault — owners only */}
          {canDeleteVault(role) && (
            <button
              onClick={e => {
                dialogTriggerRef.current = e.currentTarget
                setShowDelete(true)
              }}
              disabled={deleteBusy}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-800
                         text-zinc-400 hover:text-red-400 hover:border-red-900/40 hover:bg-red-950/20
                         transition-all cursor-pointer text-sm disabled:opacity-50 min-h-11"
            >
              <Trash2 className="size-4 shrink-0" />
              Delete vault
            </button>
          )}

          {/* Read-only notes for unsupported actions */}
          <p className="text-zinc-700 text-[11px] leading-relaxed">
            Role changes and vault archiving are not supported.
            {role === "owner" && " To transfer ownership, remove yourself and add a new owner."}
          </p>
        </section>

          </div>
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {showRename && (
        <RenameDialog
          currentName={vaultName}
          onConfirm={handleRename}
          onCancel={closeDialog}
          busy={renameBusy}
        />
      )}

      {showDelete && (
        <ConfirmDialog
          title="Delete vault"
          description={`This permanently deletes "${vaultName}" and all its memories. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          confirmText={vaultName}
          confirmPlaceholder="Vault name"
          onConfirm={handleDelete}
          onCancel={closeDialog}
          busy={deleteBusy}
        />
      )}

      {showLeave && (
        <ConfirmDialog
          title="Leave vault"
          description={`You will no longer have access to "${vaultName}" or its memories.`}
          confirmLabel="Leave"
          danger
          onConfirm={handleLeave}
          onCancel={closeDialog}
          busy={removeBusy}
        />
      )}

      {removeTarget && (
        <ConfirmDialog
          title={`Remove ${removeTarget.name}?`}
          description={`${removeTarget.name} will lose access to "${vaultName}" and all its memories.`}
          confirmLabel="Remove"
          danger
          onConfirm={handleRemove}
          onCancel={closeDialog}
          busy={removeBusy}
        />
      )}
    </div>
  )
}
