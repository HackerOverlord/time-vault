"use client"
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mail, User, Shield, Bell, ArrowLeft, X } from 'lucide-react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
// Add to imports
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'



export const dynamic = 'force-dynamic'

function AccountSettingsInner() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Avatar crop state
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)



  // Add inside component, after existing useState declarations
const searchParams = useSearchParams()
const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile')
const [notifications, setNotifications] = useState<any[]>([])

useEffect(() => {
  if (activeTab === 'notifications') {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications`, { credentials: 'include' })
      .then(r => r.json())
      .then(setNotifications)
  }
}, [activeTab])


const handleChangePassword = async () => {
  setPasswordError('')
  setPasswordMsg('')
  if (newPassword !== confirmPassword) {
    setPasswordError('New passwords do not match.')
    return
  }
  if (newPassword.length < 8) {
    setPasswordError('Password must be at least 8 characters.')
    return
  }
  setSavingPassword(true)
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/change-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    })
    const data = await res.json()
    if (res.ok) {
      setPasswordMsg('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMsg(''), 3000)
    } else {
      setPasswordError(data.error)
    }
  } finally {
    setSavingPassword(false)
  }
}

const handleDeleteAccount = async () => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/delete-account`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: deletePassword })
  })
  const data = await res.json()
  if (res.ok) {
    router.push('/login')
  } else {
    setDeleteError(data.error)
  }
}


const markRead = async (id: number) => {
  await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications/read/${id}`, {
    method: 'POST', credentials: 'include'
  })
  setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
}

const markAllRead = async () => {
  await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications/read-all`, {
    method: 'POST', credentials: 'include'
  })
  setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
}

const getNotificationLink = (type: string) => {
  switch (type) {
    case 'vault_received': return '/dashboard?tab=inbox'
    case 'vault_sent':
    case 'vault_deleted': return '/dashboard?tab=vault'
    case 'member_added':
    case 'family_joined':
    case 'member_joined': return '/dashboard?tab=roots'
    default: return '/dashboard'
  }
}

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/me`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        setEmail(data.email || '');
        if (data.avatar) setProfilePreview(data.avatar);
      });
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  function onImageLoad(img: HTMLImageElement) {
    imgRef.current = img;
    const { width, height } = img;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: 'px', width: Math.min(width, height) * 0.8 }, 1, width, height),
      width,
      height
    );
    setCrop(initialCrop);
  }

  const getCroppedImg = async () => {
    const image = imgRef.current;
    if (!image || !crop || crop.width === 0) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const drawX = crop.x * scaleX;
    const drawY = crop.y * scaleY;
    const drawWidth = crop.width * scaleX;
    const drawHeight = crop.height * scaleY;

    canvas.width = drawWidth;
    canvas.height = drawHeight;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight, 0, 0, drawWidth, drawHeight);

    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    setProfilePreview(base64Image);
    setIsCropping(false);
  };

  const handleCropCancel = () => {
    setImageToCrop(null);
    setCrop(undefined);
    setIsCropping(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/me`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, avatar: profilePreview }),
      });
      if (res.ok) {
        setSaveMsg('Saved!');
        setTimeout(() => setSaveMsg(''), 3000);
      }
      else setSaveMsg('Failed to save.');
    } catch {
      setSaveMsg('Error saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="mb-10 pl-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-medium mb-6 group"
        >
          <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Link>
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Account Settings</h1>
        <p className="text-zinc-500 mt-2 text-lg">
          Manage your TimeVault profile, security, and notification preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 items-start">
        {/* Sidebar */}
        <aside className="space-y-1">
          <nav className="flex flex-col space-y-2">
            <button
              onClick={() => setActiveTab('profile')}
              className={`cursor-pointer flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium group ${activeTab === 'profile' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              <User className="size-4 group-hover:scale-110 transition-transform" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`cursor-pointer flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium group ${activeTab === 'security' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              <Shield className="size-4 group-hover:scale-110 transition-transform" />
              Security
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`cursor-pointer flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium group ${activeTab === 'notifications' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              <Bell className="size-4 group-hover:scale-110 transition-transform" />
              Notifications
            </button>
          </nav>
        </aside>

        {/* Main Card */}
        <div className="lg:col-span-3 space-y-8">
          {activeTab === 'profile' && (
          <div className="rounded-[2rem] border border-white/5 bg-[#0D0D0D]/50 p-10 backdrop-blur-md shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-8">Public Profile</h3>

            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row items-center gap-8 mb-10">
              <div className="relative group" onClick={() => fileInputRef.current?.click()}>
                <div className="size-32 rounded-full bg-gradient-to-tr from-[#1a1a1a] to-[#2a2a2a] border border-white/10 flex items-center justify-center text-4xl font-bold text-white shadow-2xl overflow-hidden cursor-pointer">
                  {profilePreview ? (
                    <img src={profilePreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="group-hover:opacity-20 transition-opacity">
                      {`${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <div className="absolute inset-0 size-32 rounded-full bg-primary/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-[2px] cursor-pointer">
                  <Camera className="size-8 text-white" />
                </div>
              </div>
              <div className="text-center sm:text-left space-y-3">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer bg-primary hover:bg-primary/80 text-white font-bold px-6 h-10 rounded-lg transition-all active:scale-95 shadow-lg shadow-primary/20"
                >
                  CHANGE AVATAR
                </Button>
                <p className="text-xs text-zinc-500 font-medium tracking-wider uppercase">
                  JPG, GIF or PNG. Max size of 2MB.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            <Separator className="my-10 bg-white/5" />

            {/* Form Fields */}
            <div className="space-y-8 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="first-name" className="text-sm font-semibold text-zinc-400 ml-1">First Name</Label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                    <Input
                      id="first-name"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="bg-[#050505] border-white/10 pl-11 h-14 rounded-xl focus:ring-1 focus:ring-primary focus:border-primary text-white transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="last-name" className="text-sm font-semibold text-zinc-400 ml-1">Last Name</Label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                    <Input
                      id="last-name"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className="bg-[#050505] border-white/10 pl-11 h-14 rounded-xl focus:ring-1 focus:ring-primary focus:border-primary text-white transition-all"
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-zinc-600 italic ml-1 -mt-4">This is how your name will appear in the vault and to family members.</p>

              <div className="space-y-3">
                <Label htmlFor="email" className="text-sm font-semibold text-zinc-400 ml-1">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-700" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    readOnly
                    className="bg-[#050505] border-white/10 pl-11 h-14 rounded-xl text-white cursor-not-allowed select-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="cursor-pointer bg-primary hover:bg-primary/90 text-white font-bold px-10 h-12 rounded-xl shadow-xl shadow-primary/10 transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <span className="text-sm text-zinc-400 w-16">
          {saveMsg || ''}
        </span>
      </div>
         </div>
          )}

          {activeTab === 'security' && (
  <div className="space-y-6">
    {/* Change Password */}
    <div className="rounded-[2rem] border border-white/5 bg-[#0D0D0D]/50 p-10 backdrop-blur-md shadow-2xl">
      <h3 className="text-2xl font-bold text-white mb-8">Change Password</h3>
      <div className="space-y-4 max-w-2xl">
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-zinc-400 ml-1">Current Password</Label>
          <div className="relative">
            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-600" />
            <Input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="bg-[#050505] border-white/10 pl-11 h-14 rounded-xl text-white"
            />
          </div>
        </div>
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-zinc-400 ml-1">New Password</Label>
          <div className="relative">
            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-600" />
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="bg-[#050505] border-white/10 pl-11 h-14 rounded-xl text-white"
            />
          </div>
        </div>
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-zinc-400 ml-1">Confirm New Password</Label>
          <div className="relative">
            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-600" />
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="bg-[#050505] border-white/10 pl-11 h-14 rounded-xl text-white"
            />
          </div>
        </div>
        {passwordError && <p className="text-sm text-red-400 ml-1">{passwordError}</p>}
        {passwordMsg && <p className="text-sm text-green-400 ml-1">{passwordMsg}</p>}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleChangePassword}
            disabled={savingPassword}
            className="cursor-pointer bg-primary hover:bg-primary/90 text-white font-bold px-10 h-12 rounded-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {savingPassword ? 'Updating...' : 'Update Password'}
          </Button>
        </div>
      </div>
    </div>

    {/* Danger Zone */}
    <div className="rounded-[2rem] border border-red-500/20 bg-[#0D0D0D]/50 p-10 backdrop-blur-md shadow-2xl">
      <h3 className="text-2xl font-bold text-red-400 mb-2">Danger Zone</h3>
      <p className="text-zinc-500 text-sm mb-6">Permanently delete your account and all associated data. This cannot be undone.</p>
      <Button
        onClick={() => setIsDeleteModalOpen(true)}
        className="cursor-pointer bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-xl px-6 h-11 transition-all"
      >
        Delete Account
      </Button>
    </div>
  </div>
)}

          {activeTab === 'notifications' && (
            <div className="rounded-[2rem] border border-white/5 bg-[#0D0D0D]/50 p-10 backdrop-blur-md shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-white">Notifications</h3>
                {notifications.some(n => !n.is_read) && (
                  <button
                    onClick={markAllRead}
                    className="cursor-pointer text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-20">You're all caught up.</p>
              ) : (
                <div className="space-y-2">
                  {notifications.map((n: any) => (
                    <div
                      key={n.id}
                      onClick={async () => {
                        if (!n.is_read) await markRead(n.id)
                        setTimeout(() => router.push(getNotificationLink(n.type)), 100)
                      }}
                      className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer
  hover:scale-[1.01] hover:shadow-lg active:scale-[0.99]
  ${n.is_read ? 'bg-zinc-900/40 border-zinc-800/50 hover:bg-zinc-900/70 hover:border-zinc-700' : 'bg-zinc-800/60 border-zinc-700 hover:bg-zinc-800/90 hover:border-zinc-600'}`}
                    >
                      <div className="mt-0.5 p-2 rounded-lg bg-zinc-800 shrink-0">
                        <Bell className="size-4 text-blue-400" />
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
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      
      {isDeleteModalOpen && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
    <div className="bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-800 shadow-2xl p-8">
      <h3 className="text-xl font-bold text-white mb-2">Delete Account</h3>
      <p className="text-zinc-400 text-sm mb-6">
        This will permanently delete your account, all vaults, and family data. Enter your password to confirm.
      </p>
      <div className="relative mb-4">
        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-600" />
        <Input
          type="password"
          placeholder="Enter your password"
          value={deletePassword}
          onChange={e => { setDeletePassword(e.target.value); setDeleteError('') }}
          className="bg-[#050505] border-white/10 pl-11 h-14 rounded-xl text-white"
        />
      </div>
      {deleteError && <p className="text-sm text-red-400 mb-4">{deleteError}</p>}
      <div className="flex gap-3">
        <Button
          onClick={() => { setIsDeleteModalOpen(false); setDeletePassword(''); setDeleteError('') }}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-12"
        >
          Cancel
        </Button>
        <Button
          onClick={handleDeleteAccount}
          disabled={!deletePassword}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 disabled:opacity-50"
        >
          Delete Forever
        </Button>
      </div>
    </div>
  </div>
)}


      {/* Crop Modal */}
      {isCropping && imageToCrop && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 w-full max-w-lg rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="text-white font-bold text-lg">Crop Avatar</h3>
              <button onClick={handleCropCancel} className="text-zinc-400 hover:text-white transition-colors">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-zinc-950">
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                aspect={1}
                circularCrop
              >
                <img
                  src={imageToCrop}
                  onLoad={e => onImageLoad(e.currentTarget)}
                  className="max-h-[400px] object-contain"
                  alt="Crop preview"
                />
              </ReactCrop>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-zinc-800">
              <Button
                onClick={handleCropCancel}
                className="cursor-pointer flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={getCroppedImg}
                className="cursor-pointer flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl"
              >
                Apply Crop
              </Button>
            </div>
          </div>
        </div>
      )}

    
    </div>
  );


}


export default function AccountSettings() {
  return (
    <Suspense fallback={null}>
      <AccountSettingsInner />
    </Suspense>
  )
}