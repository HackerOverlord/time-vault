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

export default function App() {
  const [screen, setScreen] = useState<Screen | null>(null)
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)

  // Determine initial screen from token presence
  useEffect(() => {
    setScreen(sessionStorage.getItem("token") ? "feed" : "login")
  }, [])

  const navigate = (s: Screen, group?: Group) => {
    if (group) setActiveGroup(group)
    setScreen(s)
  }

  // Avoid rendering before the auth check resolves
  if (!screen) return null

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {screen === "login"    && <LoginScreen    onNavigate={navigate} />}
      {screen === "register" && <RegisterScreen onNavigate={navigate} />}
      {screen === "feed"     && <FeedScreen     onNavigate={navigate} />}
      {screen === "settings" && <SettingsScreen onNavigate={navigate} />}
      {screen === "group"    && <GroupScreen    onNavigate={navigate} group={activeGroup!} />}

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
