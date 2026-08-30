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

export default function App() {
  const [screen, setScreen] = useState<Screen | null>(null)
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)
  const [claimToken, setClaimToken] = useState<string | null>(null)
  // Increments on vault mutations so FeedScreen re-fetches groups without remounting.
  const [groupsVersion, setGroupsVersion] = useState(0)

  // Determine initial screen from URL params, then auth token.
  // Canonical claim URL: /?screen=claim&token=<token>
  // The token is stored in component state so it survives within-session navigation
  // but is not persisted to sessionStorage (security: single-use, expires).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlScreen = params.get("screen")
    const urlToken  = params.get("token")
    if (urlScreen === "claim" && urlToken) {
      setClaimToken(urlToken)
      setScreen("claim")
      // Clean the token from the URL bar without adding a history entry
      window.history.replaceState({}, "", window.location.pathname)
      return
    }
    setScreen(sessionStorage.getItem("token") ? "feed" : "login")
  }, [])

  const navigate = (s: Screen, group?: Group) => {
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
