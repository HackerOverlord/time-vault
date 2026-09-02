"use client"

import { useState, useEffect } from "react"
import { Toaster } from "sonner"
import type { Screen } from "@/lib/navigation"
import type { Group } from "@/lib/types"
import { LoginScreen }    from "@/components/screens/login-screen"
import { RegisterScreen } from "@/components/screens/register-screen"
import { FeedScreen }     from "@/components/screens/feed-screen"
import { GroupScreen }    from "@/components/screens/group-screen"
import { SettingsScreen } from "@/components/screens/settings-screen"
import { ClaimScreen }    from "@/components/screens/claim-screen"
import { InviteScreen }   from "@/components/screens/invite-screen"

export default function App() {
  const [screen, setScreen] = useState<Screen | null>(null)
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)
  const [claimToken,  setClaimToken]  = useState<string | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  // Increments on vault mutations so FeedScreen re-fetches groups without remounting.
  const [groupsVersion, setGroupsVersion] = useState(0)

  // Determine initial screen from URL params, then auth token.
  // Canonical claim URL: /?screen=claim&token=<token>
  // The token is stored in component state so it survives within-session navigation
  // but is not persisted to sessionStorage (security: single-use, expires).
  useEffect(() => {
    // /invite/<token> path support — redirect to SPA-safe ?screen=invite&token=X
    // A real /invite/[token] Next.js route (not yet created) would 404 on Vercel.
    // Normalise any direct-path links to the query-param form which the SPA handles.
    const inviteMatch = window.location.pathname.match(/^\/invite\/([A-Za-z0-9_-]{20,})$/)
    if (inviteMatch) {
      const tok = inviteMatch[1]
      // Rewrite to SPA-safe URL so refresh works too
      window.history.replaceState({}, "", `/?screen=invite&token=${tok}`)
      setInviteToken(tok)
      setScreen(sessionStorage.getItem("token") ? "invite" : "login")
      return
    }
    const params = new URLSearchParams(window.location.search)
    const urlScreen = params.get("screen")
    const urlToken  = params.get("token")
    if (urlScreen === "claim" && urlToken) {
      setClaimToken(urlToken)
      setScreen("claim")
      window.history.replaceState({}, "", window.location.pathname)
      return
    }
    if (urlScreen === "invite" && urlToken) {
      setInviteToken(urlToken)
      setScreen(sessionStorage.getItem("token") ? "invite" : "login")
      return
    }
    setScreen(sessionStorage.getItem("token") ? "feed" : "login")
  }, [])

  const navigate = (s: Screen, group?: Group) => {
    // After login, redirect to pending invite if one exists
    if ((s === "feed") && inviteToken) {
      setScreen("invite")
      return
    }
    if (group) setActiveGroup(group)
    setScreen(s)
  }

  // Called by GroupScreen when the vault is renamed.
  const handleGroupRenamed = (id: string, newName: string) => {
    setActiveGroup(prev => prev && prev.id === id ? { ...prev, name: newName } : prev)
    setGroupsVersion(v => v + 1)
  }

  // Called by GroupScreen after a leave or delete.
  const handleGroupLeft = (_id: string) => {
    setActiveGroup(null)
    setGroupsVersion(v => v + 1)
  }

  // Avoid rendering before the auth check resolves
  if (!screen) return null

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {screen === "login"    && <LoginScreen    onNavigate={navigate} />}
      {screen === "register" && <RegisterScreen onNavigate={navigate} />}
      {screen === "feed"     && <FeedScreen     groupsVersion={groupsVersion} onNavigate={navigate} />}
      {screen === "settings" && <SettingsScreen onNavigate={navigate} />}
      {screen === "invite"    && inviteToken && (
        <InviteScreen token={inviteToken} onNavigate={s => {
          setInviteToken(null)
          navigate(s as Screen)
        }} />
      )}
      {screen === "claim"     && claimToken && (
        <ClaimScreen token={claimToken} onNavigate={s => {
          setClaimToken(null)
          navigate(s as "login" | "feed")
        }} />
      )}
      {screen === "claim"    && !claimToken && (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-white/40 text-sm">Missing claim token in URL.</p>
        </div>
      )}
      {screen === "group"    && activeGroup && (
        <GroupScreen
          onNavigate={navigate}
          group={activeGroup}
          onGroupRenamed={handleGroupRenamed}
          onGroupLeft={handleGroupLeft}
        />
      )}

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          classNames: {
            actionButton: "!bg-transparent !border-0 !text-zinc-400 hover:!text-white !p-0",
          },
        }}
      />
    </div>
  )
}
