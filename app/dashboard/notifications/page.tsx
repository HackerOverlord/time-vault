"use client"
import { useEffect, useState } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Bell, Vault, Inbox, Trash2 } from "lucide-react"

const iconMap: Record<string, any> = {
  vault_sent: Vault,
  vault_received: Inbox,
  vault_deleted: Trash2,
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/me`, { credentials: 'include' })
      .then(r => r.json()).then(setUser)
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications`, { credentials: 'include' })
      .then(r => r.json()).then(data => {
        setNotifications(data)
        // mark all read on page visit
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications/read-all`, {
          method: 'POST', credentials: 'include'
        })
      })
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Bell className="size-5 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
        </div>

        {notifications.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-20">You're all caught up.</p>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => {
              const Icon = iconMap[n.type] || Bell
              return (
                <div key={n.id}
                  className={`flex items-start gap-4 p-4 rounded-xl border transition-colors
                    ${n.is_read ? 'bg-zinc-900/40 border-zinc-800/50' : 'bg-zinc-800/60 border-zinc-700'}`}
                >
                  <div className="mt-0.5 p-2 rounded-lg bg-zinc-800 shrink-0">
                    <Icon className="size-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${n.is_read ? 'text-zinc-400' : 'text-white font-medium'}`}>
                      {n.message}
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.is_read && <span className="size-2 rounded-full bg-blue-400 mt-2 shrink-0" />}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}