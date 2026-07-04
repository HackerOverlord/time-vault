"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Lock, Bell, Settings, LogOut } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DashboardHeaderProps {
  user?: {
    name: string
    email: string
    avatar?: string
  }

  notifRefresh?: number
}

export function DashboardHeader({ user, notifRefresh }: DashboardHeaderProps) {
  const router = useRouter()
  const initials = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "TV"
  const [notifications, setNotifications] = useState<any[]>([])
const [unreadCount, setUnreadCount] = useState(0)

const fetchNotifications = async () => {
  const token = localStorage.getItem('token')
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (res.ok) {
    const data = await res.json()
    setNotifications(data)
    setUnreadCount(data.filter((n: any) => !n.is_read).length)
  }
}

const handleLogout = () => {
  localStorage.removeItem('token')
  router.push('/login')
}

const getNotificationLink = (type: string) => {
  switch (type) {
    case 'vault_received': return '/dashboard?tab=inbox'
    case 'vault_sent':
    case 'vault_deleted': return '/dashboard?tab=vault'
    default: return '/dashboard'
  }
}

const markRead = async (id: number) => {
  const token = localStorage.getItem('token')
  await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications/read/${id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  setUnreadCount(prev => Math.max(0, prev - 1))
}

const markAllRead = async () => {
  const token = localStorage.getItem('token')
  await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications/read-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  setUnreadCount(0)
}

useEffect(() => {
  fetchNotifications()
  const interval = setInterval(fetchNotifications, 30000)
  return () => clearInterval(interval)
}, [notifRefresh])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg">
      <div className="w-full flex h-16 items-center justify-between px-9 md:pr-14">        
        {/* Logo */}
        <Logo />

        {/* User Section */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
            <DropdownMenu onOpenChange={(open) => open && fetchNotifications()}>
              <DropdownMenuTrigger asChild>
                <button className="relative cursor-pointer p-2 rounded-md text-zinc-400 hover:text-white transition-colors outline-none">
                  <Bell className="size-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80" align="end">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="cursor-pointer text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-6">No notifications yet</p>
                  ) : (
                    notifications.slice(0, 5).map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        onClick={async () => {
                          await markRead(n.id)
                          setTimeout(() => router.push(getNotificationLink(n.type)), 100)
                        }}
                        className={`flex flex-col items-start gap-1 px-4 py-3 cursor-pointer hover:!bg-zinc-800 focus:!bg-zinc-800 ${!n.is_read ? 'bg-zinc-800/50' : ''}`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          {!n.is_read && <span className="size-1.5 rounded-full bg-blue-400 shrink-0" />}
                          <span className={`text-xs leading-snug ${!n.is_read ? 'text-white font-medium' : 'text-zinc-400'}`}>
                            {n.message}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-600 pl-3.5">
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => router.push('/dashboard/settings?tab=notifications')}
                      className="text-xs text-blue-400 text-center justify-center cursor-pointer hover:!bg-zinc-800"
                    >
                      View all notifications →
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hover:bg-transparent">
    <Avatar className="size-9 ring-1 ring-white/10 hover:ring-white/30 transition-all duration-300 cursor-pointer hover:scale-105">
      <AvatarImage src={user?.avatar} alt={user?.name} className="object-cover" />
      <AvatarFallback className="bg-gradient-to-br from-primary to-chart-5 text-primary-foreground font-semibold cursor-pointer">
        {initials}
      </AvatarFallback>
    </Avatar>
  </Button>
</DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.name || "Guest User"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || "guest@timevault.app"}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => router.push('/dashboard/settings')} 
                className="cursor-pointer hover:!bg-zinc-800 focus:!bg-zinc-800"
              >
                <Settings className="mr-2 size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
                <DropdownMenuItem 
  onClick={handleLogout}
  className="cursor-pointer hover:!bg-zinc-800 focus:!bg-zinc-800 text-white hover:!text-red-500 focus:!text-red-500 transition-colors"
>
  <LogOut className="mr-2 size-4" />
  Log out
</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}



