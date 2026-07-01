"use client"
import { Toaster, toast } from 'sonner'
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css'; // This is required for the UI to show up
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useEffect, useState, useRef } from "react"
import { 
  Vault, Inbox, PenLine, GitBranch, Plus, Lock, Unlock, Clock, Users, 
  Link as LinkIcon, Upload, ClockIcon, X,Paperclip, FileText
} from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { NavTabs } from "@/components/nav-tabs"
import { MemoryCard } from "@/components/memory-card"
import { StatsCard } from "@/components/stats-card"
import { CreateMemoryModal } from "@/components/create-memory-modal"
import { ViewMemoryModal } from "@/components/view-memory-modal"
import { Input } from "@/components/ui/input"   
import { cn } from "@/lib/utils"
import { FamilyTree, type FamilyMember } from "@/components/family-tree"
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from 'react'


interface DashboardViewProps {}



interface Milestone {
  title: string;
  date: string;
  description: string;
  mediaType: 'audio' | 'video' | 'none';
  mediaContent: string;
  isRecorded: boolean;       
  isRecordingActive: boolean; 
}

export const dynamic = 'force-dynamic'

export type Memory = {
  id: string
  title: string
  content?: string
  release_date: string
  status: "locked" | "released"
  hasImage?: boolean
  hasVideo?: boolean
  hasAudio?: boolean
  recipient?: string
  attachments?: Array<{name: string, content: string}>
  mediaContent?: string
  is_draft?: boolean
}

const tabs = [
  { id: "vault", label: "Vault", icon: Vault },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "roots", label: "Family Members", icon: GitBranch },
]

function DashboardPageInner() {
  const [activeTab, setActiveTab] = useState("vault")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [masterInviteCode, setMasterInviteCode] = useState<string>("");
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([])
  const [incoming, setIncoming] = useState<Memory[]>([])
  const [stats, setStats] = useState({ totalMemories: 0, lockedVaults: 0, released: 0, familyMembers: 0 })
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSpouseId, setSelectedSpouseId] = useState<string>("");

  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels] = useState<{ x: number; y: number } | null>(null) 

  const [cropStyle, setCropStyle] = useState<React.CSSProperties>({});
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  // New Member Form States
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMemberRelationship, setNewMemberRelationship] = useState("");
  const [newMemberDescription, setNewMemberDescription] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [suffix, setSuffix] = useState("");
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [crop, setCrop] = useState<Crop>(); // Combined single declaration[cite: 1]
  const [isCropping, setIsCropping] = useState(false);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [viewingMember, setViewingMember] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const isParentRelationship = newMemberRelationship === 'parent';

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const videoRefsMap = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  const [isVerifying, setIsVerifying] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle');

  const [isEditingMode, setIsEditingMode] = useState(false);
  const [email, setEmail] = useState("");
  const activeVaults = memories.filter((m: any) => !m.is_draft);
  const draftCapsules = memories.filter((m: any) => m.is_draft);
  const router = useRouter();
  const [editingDraft, setEditingDraft] = useState<Memory | null>(null)  // ADD THIS
  const emailDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [viewingMilestone, setViewingMilestone] = useState<any | null>(null);

  const [bioAttachments, setBioAttachments] = useState<{ name: string; type: string; content: string }[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; avatar?: string } | null>(null);


  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const searchParams = useSearchParams()
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
  const [inSharedFamily, setInSharedFamily] = useState(false)
  const [notifRefresh, setNotifRefresh] = useState(0)

useEffect(() => {
  const tab = searchParams.get('tab')
  if (tab === 'inbox') setActiveTab('inbox')
  else if (tab === 'vault') setActiveTab('vault')
  else if (tab === 'roots') setActiveTab('roots')
}, [searchParams])

  const handleJoinFamily = async () => {
  if (joinCode.length < 7) return;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/join-family`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: joinCode }),
    });
    const data = await res.json();
    if (res.ok) {
      setIsJoinModalOpen(false);
      setJoinCode('');
      setJoinError('');
      setInSharedFamily(true)

  // Re-fetch family members so UI updates without a page refresh
  const treeRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/family-members`, { credentials: 'include' });
  if (treeRes.ok) {
    const treeData = await treeRes.json();
    setFamilyMembers(treeData);


    setStats(prev => ({ ...prev, familyMembers: treeData.length }));
    setNotifRefresh(prev => prev + 1)
    toast.success("You've joined the family!", {
      
      action: {
    label: "✕",
    onClick: () => {},
  },
}


    )
  }

    } else {
      setJoinError(data.message || 'Invalid code.');
    }
  } catch {
    setJoinError('Something went wrong.');
  }
};

  useEffect(() => {
  // Check every 10 seconds if any vaults should be released
  const interval = setInterval(() => {
    if (memories.length === 0) return;
    const now = new Date();
    let releasedCount = 0;
    let lockedCount = 0;

    const updatedMemories = memories.map(m => {
  const releaseTime = new Date(m.release_date);
  const isReleased = releaseTime <= now;
  
  if (!m.is_draft) {
    if (isReleased) releasedCount++;
    else lockedCount++;
  }

  return {
    ...m,
    status: isReleased ? ('released' as const) : ('locked' as const)
  };
});

    setMemories(updatedMemories);
    setStats(prev => ({
      ...prev,
      released: releasedCount,
      lockedVaults: lockedCount
    }));
  }, 10000); // Check every 10 seconds

  return () => clearInterval(interval);
}, [memories]);

  const handleDeleteVault = async (id: string) => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/vaults/${id}`, {
      method: "DELETE",
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error("Failed to delete the vault from the database server.");
    }

    setMemories(memories.filter(m => m.id !== id));
    setSelectedMemory(null);
    await fetchMemories(); // ← replaces manual stat 
    setNotifRefresh(prev => prev + 1)
    toast.success("Vault deleted successfully.", {
      action: {
    label: "✕",
    onClick: () => {},
  },

    })

  } catch (error) {
    console.error("Deletion error:", error);
    alert("Could not delete the vault. Check server logs.");
  }
};

  const fetchMemories = async () => {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/memories`, {
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      setMemories(data);
      
      // Recalculate stats from actual data
      const now = new Date();
      let locked = 0, released = 0;
      
      data.forEach((m: any) => {
        if (!m.is_draft) {
          const releaseDate = new Date(m.release_date);
          if (releaseDate > now) locked++;
          else released++;
        }
      });
      
      setStats({
  totalMemories: data.filter((m: any) => !m.is_draft).length,
  lockedVaults: locked,
  released: released,
  familyMembers: stats.familyMembers
});
    }
  } catch (error) {
    console.error("Failed to fetch memories:", error);
  }
};


const handleCreateMemory = async (newMemory: any) => {
  await fetchMemories();
  if (newMemory?.is_draft) return;
  if (newMemory?.has_recipient) {
    setNotifRefresh(prev => prev + 1)
    toast.success("Vault sent successfully.", {

      action: {
    label: "✕",
    onClick: () => {},
  },
    })
  } else {
    setNotifRefresh(prev => prev + 1)
    toast.success("Vault created successfully.", {
      action: {
    label: "✕",
    onClick: () => {},
  },
    })
  }
}

  const verifyEmail = async (email: string) => {
  if (!email || email.trim().length < 1) {
    setEmailStatus('idle');
    return;
  }
  setEmailStatus('loading');
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'include' 
    });
    const data = await res.json();
    setEmailStatus(data.exists ? 'found' : 'not_found');
  } catch (err) {
    setEmailStatus('idle');
  }
};


  useEffect(() => {

    
    const fetchData = async () => {

      
      await fetchMemories();
      const options = { credentials: 'include' as const };
      try {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/heartbeat`, { method: 'POST', ...options }); 

        const [sharedRes, treeRes, meRes, familyStatusRes] = await Promise.all([
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/memories/shared`, options),
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/family-members`, options),
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/me`, options),
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/family-status`, options)
]);

if (meRes.ok) {
  const meData = await meRes.json();
  setCurrentUser({ name: meData.name, email: meData.email, avatar: meData.avatar || null });
}


        // 3. Unpack family tree members
        if (treeRes.ok) {
          const treeData = await treeRes.json();
          setFamilyMembers(treeData); 
        }

        // 4. FIX: Unpack shared incoming memories cleanly right here!
        if (sharedRes.ok) {
          const sharedData = await sharedRes.json();
          setIncoming(sharedData.filter((m: any) => m.status === 'released')); // This populates the Inbox layout perfectly
        }

      } catch (error) {
        console.error("Connection to Flask failed", error);
      }
    };
    fetchData();
  }, []);


  useEffect(() => {
    const fetchMasterCode = async () => {
    };
    fetchMasterCode();
  }, []);

  const handleMemoryClick = async (id: string) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/memories/${id}`, { credentials: 'include' });
  if (res.ok) {
    const data = await res.json();
    console.log("Memory API response:", data); // Log to see all fields
    setSelectedMemory(data);
  }
}

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

// Helper to handle the image loading and initial crop centering[cite: 1]
  // 1. Updated onImageLoad to ensure state is ready
function onImageLoad(img: HTMLImageElement) {
  imgRef.current = img;
  const { width, height } = img;
  
  const initialCrop = centerCrop(
    makeAspectCrop(
      { 
        unit: 'px', // Use px instead of % to ensure the first-time math is stable
        width: Math.min(width, height) * 0.8 // 80% of the smallest dimension
      }, 
      1, 
      width, 
      height
    ),
    width,
    height
  );
  setCrop(initialCrop);
}

// 2. Add a fallback in getCroppedImg to handle the "unmoved" state
const getCroppedImg = async () => {
  const image = imgRef.current;
  // If the user hasn't moved anything, 'crop' might be the initial state from onImageLoad[cite: 7]
  if (!image || !crop || crop.width === 0) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Calculate scales based on the CURRENT rendered size[cite: 7]
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // Final pixel coordinates[cite: 7]
  const drawX = crop.x * scaleX;
  const drawY = crop.y * scaleY;
  const drawWidth = crop.width * scaleX;
  const drawHeight = crop.height * scaleY;

  canvas.width = drawWidth;
  canvas.height = drawHeight;

  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
    0,
    0,
    drawWidth,
    drawHeight
  );

  const base64Image = canvas.toDataURL('image/jpeg', 0.9);
  setProfilePreview(base64Image); 
  setIsCropping(false); 
};

  const handleAttachmentUpload = async (files: FileList | null) => {
  if (!files || files.length === 0) return;
  setIsUploadingAttachment(true);

  const newAttachments = await Promise.all(
    Array.from(files).map((file) => {
      return new Promise<{ name: string; type: string; content: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type, content: reader.result as string });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    })
  );

  setBioAttachments((prev) => [...prev, ...newAttachments]);
  setIsUploadingAttachment(false);
};

const removeAttachment = (index: number) => {
  setBioAttachments((prev) => prev.filter((_, i) => i !== index));
};

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      // CRITICAL: Only set the editor source, NOT the profile preview
      setImageToCrop(reader.result as string);
      setIsCropping(true);
    };
    reader.readAsDataURL(file);
    
    // Reset the input so you can re-select the same file if you cancel
    e.target.value = ''; 
  }
};


  const clearProfilePic = (e: React.MouseEvent) => {
  e.stopPropagation(); // Prevents the file uploader from opening when clicking clear
  setProfilePreview(null);
  setImageToCrop(null);
  setCropStyle({});
};

  const handleCancel = () => {
  // If the user was uploading a brand new photo but hadn't saved it yet,
  // we clear the temporary image source.
  if (!profilePreview) {
    setImageToCrop(null);
  }
  
  // Reset the cropping area for the next time the modal opens
  setCrop(undefined); 
  
  // Close the modal
  setIsCropping(false);
};


  const removeMember = async (id: string) => {
  const confirmed = window.confirm("Are you sure you want to remove this family member? This will also disconnect any descendants.");
  
  if (confirmed) {
    try {
      // 1. Tell the backend to delete the member from the database
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/family-members/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        // 2. Only if the database delete works, update the UI
        setFamilyMembers((prev) => prev.filter((m) => m.id !== id));

        
        // Update stats so the "Family Members" card refreshes
        setStats(prev => ({ ...prev, familyMembers: prev.familyMembers - 1 }));

        // CRITICAL: Close the modal without resetting the tab
        setIsAddMemberModalOpen(false);
        setEditingMember(null);

        
    
      } else {
        alert("Failed to delete from database.");
      }
    } catch (error) {
      console.error("Error deleting member:", error);
      alert("Could not connect to the server to delete.");
    }
  }
};

  const handleViewMember = (id: string) => {
  const member = familyMembers.find(m => m.id === id);
  if (member) {
    setViewingMember(member);
    setIsViewModalOpen(true);
  }
};


  const startNativeRecording = async (index: number) => {
  const type = milestones[index].mediaType;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: true, 
      video: type === 'video' 
    });

    // 1. Tell React we have an active camera stream
    if (type === 'video') {
      setLiveStream(stream);
    }

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      // 2. Clear the live stream when recording stops
      setLiveStream(null); 
      
      const mimeType = type === 'video' ? 'video/webm' : 'audio/webm';
      const blob = new Blob(chunks, { type: mimeType });
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const m = [...milestones];
        m[index].mediaContent = reader.result as string;
        m[index].isRecorded = true;
        m[index].isRecordingActive = false;
        setMilestones(m);
      };
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
  } catch (err) {
    console.error("Camera access denied:", err);
    alert("Please allow camera access.");
  }
};


  const stopAndClearRecording = () => {
  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
    mediaRecorderRef.current.stop();
  }
  // Stop all video tracks
  Object.values(videoRefsMap.current).forEach(videoEl => {
    if (videoEl && videoEl.srcObject) {
      const tracks = (videoEl.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoEl.srcObject = null;
    }
  });
};

  const closeMemberModal = () => {
  setSelectedSpouseId("");
  setIsAddMemberModalOpen(false);
  setEditingMember(null);
  setFirstName("");
  setLastName("");
  setGender("");
  setSuffix("");
  setNewMemberRelationship("");
  setNewMemberDescription("");
  setMilestones([]);
  setTargetParentId(null);
  setProfilePreview(null);
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-card/20">
      <DashboardHeader user={{ name: currentUser?.name || "User", email: currentUser?.email || "", avatar: currentUser?.avatar }} notifRefresh={notifRefresh} />
      <main className="max-w-7xl mx-auto px-6 py-10 w-full">
        <div className="flex justify-between items-center mb-20 w-full">
          <NavTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
          <Button onClick={() => {
  setEditingDraft(null)
  setIsCreateModalOpen(true)
}} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 cursor-pointer">
            <Plus className="size-4 mr-2" /> New Vault
          </Button>
        </div>

        {activeTab === "vault" && (
  <div className="space-y-12 w-full">
    
    {/* --- STEP 1: DEFINE A FIXED 4-COLUMN TRACK FOR STATS --- */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
      <StatsCard title="Total Memories" value={stats.totalMemories} icon={Vault} variant="primary" />
      <StatsCard title="Locked Vaults" value={stats.lockedVaults} icon={Lock} variant="warning" />
      <StatsCard title="Released" value={stats.released} icon={Unlock} variant="success" />
      <StatsCard title="Family Members" value={stats.familyMembers} icon={Users} />
    </div>

    {/* --- STEP 2: USE THE EXACT SAME 4-COLUMN TRACK FOR CONTENT --- */}
{/* --- UPDATED CONTENT ROW WRAPPER --- */}
{/* Swapped items-start for items-stretch to lock both columns to the exact same visual baseline track */}
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6 w-full items-stretch pt-10 border-t border-zinc-900/40 justify-items-center">
  
  {/* TIME-LOCKED VAULTS AREA: Spans across Columns 1 & 2 */}
<section className="lg:col-span-2 flex flex-col items-center space-y-6 w-full h-full">
  <div className="w-full max-w-sm text-left">
    <h2 className="flex items-center gap-2 text-xl font-bold text-white h-7 leading-none">
      <ClockIcon className="text-yellow-500 size-5 shrink-0" />
      <span>Time-Locked Vaults</span>
    </h2>
  </div>
  
  {/* flex-1 flex-col justify-start ensures the contents inside anchor identically to the right column */}
  <div className="w-full max-w-md flex-1 flex flex-col justify-start">
  {activeVaults.length > 0 ? (
    /* Changed max-h-[480px] to max-h-[416px] to force cutoff after the 3rd card */
    <div className="flex flex-col gap-4 w-full max-h-[416px] overflow-y-auto overflow-x-visible pr-2 custom-scrollbar py-1">
      {activeVaults.map((m) => {
        const now = new Date();
        const releaseDate = new Date(m.release_date);
        const calculatedStatus = releaseDate <= now ? ('released' as const) : ('locked' as const);
        
        return (
          <div key={m.id} className="w-full shrink-0">
            <MemoryCard 
              {...m} 
              releaseDate={releaseDate}
              status={calculatedStatus}
              onClick={() => handleMemoryClick(m.id)} 
            />
          </div>
        );
      })}
    </div>
  ) : (
    <div className="w-full rounded-xl border border-dashed border-zinc-800/60 bg-zinc-900/10 p-6 flex items-center justify-center min-h-[240px]">
      <p className="text-zinc-500 text-sm italic">
        No active time-locked vaults found.
      </p>
    </div>
  )}
</div>
</section>

  {/* DRAFT WORKSPACE AREA: Spans across Columns 3 & 4 */}
<section className="lg:col-span-2 flex flex-col items-center space-y-6 w-full h-full">
  <div className="w-full max-w-sm text-left">
    <h2 className="flex items-center gap-2 text-xl font-bold text-white h-7 leading-none">
      <PenLine className="text-blue-500 size-5 shrink-0" />
      <span>Draft Workspace</span>
    </h2>
  </div>
  
  <div className="w-full max-w-md flex-1 flex flex-col justify-start">
  {draftCapsules.length > 0 ? (
    /* Changed max-h-[480px] to max-h-[416px] here as well to match symmetry */
    <div className="flex flex-col gap-4 w-full max-h-[416px] overflow-y-auto overflow-x-visible pr-2 custom-scrollbar py-1">
      {draftCapsules.map((m) => (
        <div key={m.id} className="w-full shrink-0">
          <MemoryCard 
            {...m} 
            is_draft={true}
            releaseDate={new Date(m.release_date)} 
            onClick={() => handleMemoryClick(m.id)} 
          />
        </div>
      ))}
    </div>
  ) : (
    <div className="w-full rounded-xl border border-dashed border-zinc-800/60 bg-zinc-900/10 p-6 flex items-center justify-center min-h-[240px]">
      <p className="text-zinc-500 text-sm italic">
        No drafts currently in progress.
      </p>
    </div>
  )}
</div>
</section>

</div>
  </div>
)}

        {activeTab === "inbox" && (
          <section>
            <h2 className="text-xl font-bold mb-5 flex items-center gap-2"><Inbox className="size-5 text-primary" /> Incoming</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {incoming.map((m) => (
                <MemoryCard key={m.id} {...m} releaseDate={new Date(m.release_date)} onClick={() => handleMemoryClick(m.id)} />
              ))}
            </div>
          </section>
        )}

        {activeTab === "roots" && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
  <h2 className="text-xl font-bold flex items-center gap-2">
    <GitBranch className="size-5 text-primary" /> Family Members
  </h2>

  <div className="flex items-center gap-3">
    <Button
      variant="outline"
      className="rounded-xl !border-blue-500/50 !text-blue-400 !bg-transparent hover:!bg-transparent hover:!text-blue-400 hover:opacity-70 transition-opacity cursor-pointer"
      onClick={async () => {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/get-my-code`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setMasterInviteCode(data.invite_code);
        }
        setIsInviteModalOpen(true);
      }}
    >
      Invite Member
    </Button>

    {inSharedFamily && (
    <Button
      variant="outline"
      className="rounded-xl !border-red-500/40 !text-red-400 !bg-transparent hover:!bg-transparent hover:!text-red-400 hover:opacity-70 transition-opacity cursor-pointer"
      onClick={() => setIsLeaveModalOpen(true)}
    >
      Leave Family
    </Button>
  )}

  </div>
</div>

            {isInviteModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center">
                <div 
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
                  onClick={() => setIsInviteModalOpen(false)} 
                />
                
                <div className="relative bg-zinc-900 w-full max-w-sm p-8 rounded-3xl border border-zinc-800 shadow-2xl text-center m-4 animate-in zoom-in-95 duration-200">
                  <h2 className="text-xl font-bold text-white mb-2">Share Invitation</h2>
                  <p className="text-zinc-400 text-sm mb-6">Give these details to your family member to link your vaults.</p>
                  
                  <div className="space-y-4">

                    <div className="p-4 bg-blue-600/10 rounded-2xl border border-blue-500/30">
                      <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold mb-1">One-Time Invite Code</p>
                      <p className="text-blue-400 font-mono text-3xl font-bold tracking-widest">{masterInviteCode}</p>
                    </div>
                  </div>

                  <Button 
                    className="mt-8 w-full bg-blue-600 hover:bg-blue-700 rounded-xl py-6 cursor-pointer"
                    onClick={() => setIsInviteModalOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}


            {isLeaveModalOpen && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center">
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm"
      onClick={() => setIsLeaveModalOpen(false)}
    />
    <div className="relative bg-zinc-900 w-full max-w-sm p-8 rounded-3xl border border-zinc-800 shadow-2xl text-center m-4 animate-in zoom-in-95 duration-200">
      <h2 className="text-xl font-bold text-white mb-2">Leave Family?</h2>
      <p className="text-zinc-400 text-sm mb-6">
        You'll lose access to all shared family members and their updates. Your own vaults and data will remain intact.
      </p>
      <div className="flex gap-3">
        <Button
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 rounded-xl py-6 cursor-pointer"
          onClick={() => setIsLeaveModalOpen(false)}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 bg-red-600 hover:bg-red-700 rounded-xl py-6 cursor-pointer"
          onClick={async () => {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/leave-family`, {
              method: 'POST',
              credentials: 'include'
            })
            if (res.ok) {
              setIsLeaveModalOpen(false)
              setInSharedFamily(false)
              const treeRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/family-members`, { credentials: 'include' })
              if (treeRes.ok) {
                const treeData = await treeRes.json()
                setFamilyMembers(treeData)
                setStats(prev => ({ ...prev, familyMembers: treeData.length }))
              }
              toast.success("You've left the family.", {
                action: { label: "×", onClick: () => {} }
              })
            }
          }}
        >
          Leave Family
        </Button>
      </div>
    </div>
  </div>
)}
            
            <div className="relative w-full border border-zinc-800 rounded-3xl overflow-hidden bg-zinc-950/50">
  
  <FamilyTree 
              members={familyMembers} 
              onMemberView={handleViewMember}
              onAddMember={(memberId?: string) => {
                setIsEditingMode(false);
                setEditingMember(null); // Clear out the editing member state completely
                
                // Clear out ALL local form field variables so they don't leak into the new form
                setFirstName("");
                setLastName("");
                setSuffix("");
                setNewMemberDescription("");
                setNewMemberRelationship(familyMembers.length === 0 ? "Root" : "Relative");
                setGender("");
                setProfilePreview(null);
                setMilestones([]);
                
                // RESET THE NEW EMAIL STATE HERE
                setEmail(""); 
                setEmailStatus('idle');

                setTargetParentId(memberId || null);
                setIsAddMemberModalOpen(true);
              }}
              onEdit={(member: any) => {
                setIsEditingMode(true);
                setEditingMember(member);
                const memberImage = member.photo || null;
                
                // Load existing data into form states
                setFirstName(member.firstName || member.name.split(' ')[0] || ""); 
                setLastName(member.lastName || member.name.split(' ')[1] || "");
                const incomingGender = member.gender || member.Gender || "";
                setGender(incomingGender.toLowerCase());
                setSuffix(member.suffix || "");
                setNewMemberDescription(member.description || "");
                setBioAttachments(member.bioAttachments || []);
                setNewMemberRelationship(member.relationship);
                setMilestones(member.milestones ? JSON.parse(JSON.stringify(member.milestones)) : []);
                
                // Set the preview and optionally trigger the crop window immediately
                setProfilePreview(memberImage); 
                // setIsCropping(!!memberImage); // Uncomment if you want crop to open on edit click
                
                // POPULATE THE NEW EMAIL STATE HERE
                const currentEmail = member.linkedAccount || member.email || "";
                setEmail(currentEmail);

                // Trigger the visual email validation badge immediately if an email exists
                if (currentEmail) {
                  verifyEmail(currentEmail);
                } else {
                  setEmailStatus('idle');
                }

                setTargetParentId(member.parentId || null);
                setIsAddMemberModalOpen(true);
              }}
              onRemove={removeMember}
              onJoin={() => setIsJoinModalOpen(true)}
          />

</div>
            
            <div className="mt-6 p-4 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/10">
              <p className="text-sm text-zinc-500 text-center">
                Manage your trustees and family connections to ensure your vaults reach the right people.
              </p>
            </div>
          </section>
        )}

        <Dialog open={isCropping} onOpenChange={setIsCropping}>
          {/* Set max-width to 95vw and remove padding (p-0) to allow the image to hit the edges */}
          <DialogContent className="sm:max-w-[95vw] md:max-w-[1100px] bg-zinc-900 border-zinc-800 p-0 overflow-hidden flex flex-col h-[90vh]">
            <DialogHeader className="p-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md z-10">
              <DialogTitle className="text-white text-lg">Adjust Profile Picture</DialogTitle>
            </DialogHeader>
            
            {/* The main container must be flex and centered */}
            <div className="flex-1 overflow-hidden bg-black flex items-center justify-center p-6">
              {imageToCrop && (
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  aspect={1}
                  circularCrop
                >
                  <img
                    ref={imgRef}
                    src={imageToCrop || ""} // ALWAYS use the original source here
                    alt="Source"
                    onLoad={(e) => onImageLoad(e.currentTarget)}
                    className="max-w-full h-auto block mx-auto"
                  />
                </ReactCrop>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 bg-zinc-900 border-t border-zinc-800 z-10">
              <Button
  onClick={handleCancel}
  className="border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 px-6 py-2 rounded-lg transition-all duration-200"
>
  Cancel
</Button>
              <Button 
                type="button"
                className="bg-blue-600 hover:bg-blue-700 px-8 rounded-xl font-bold"
                onClick={getCroppedImg} 
              >
                Save Selection
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>

      <CreateMemoryModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSubmit={handleCreateMemory}
        editingDraft={editingDraft}
      />

      <ViewMemoryModal 
        open={!!selectedMemory} 
        onOpenChange={(open) => !open && setSelectedMemory(null)} 
        memory={selectedMemory ? { 
          ...selectedMemory, 
          releaseDate: new Date(selectedMemory.release_date),
          is_draft: (selectedMemory as any).is_draft // <-- Add this property mapping rule
        } : null} 
        onDelete={handleDeleteVault}
        onEdit={(memory: any) => {
          // Open create modal with draft data
          setEditingDraft(memory)
          setIsCreateModalOpen(true)
          setSelectedMemory(null)
        }}
      />
        
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 w-full max-w-2xl p-10 rounded-3xl border border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <button
        onClick={closeMemberModal}
        className="absolute right-7 py-3 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <X className="h-4 w-4 text-white" />
        <span className="sr-only">Close</span>
      </button>
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
  {isEditingMode ? "Edit Family Member" : "Add Member"}
</h2>
<p className="text-zinc-400 mb-8 text-sm">
  {isEditingMode ? "Update their details and legacy info" : "Add a new family member to your secure network."}
</p>
            
            <div className="space-y-6 mb-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar text-left">
              {/* 1. Use only ONE hidden input that calls onFileChange */}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.xls,.pptx" 
                onChange={onFileChange} 
              />
                            
              {/* 2. Automatic Circle Fit Profile Picture */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="group relative mx-auto size-32 overflow-hidden rounded-full border-2 border-dashed border-zinc-700 bg-zinc-800/20 hover:bg-zinc-800/40 hover:border-blue-500/50 cursor-pointer transition-all flex items-center justify-center"
              >
                {profilePreview ? (
                  <>
                    <img 
                      src={profilePreview} 
                      className="h-full w-full object-cover" 
                      alt="Profile" 
                    />
                    {/* Overlay: Upload icon instead of a second pencil to avoid redundancy */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className="p-2.5 bg-blue-600 rounded-full hover:bg-blue-500 transition-colors">
                          <Upload className="size-4 text-white" />
                        </div>
                        <span className="text-[9px] text-blue-100 font-bold uppercase tracking-tight">Upload</span>
                      </div>

                      <div 
                        onClick={clearProfilePic}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className="p-2.5 bg-red-600 rounded-full hover:bg-red-500 transition-colors">
                          <Plus className="size-4 text-white rotate-45" />
                        </div>
                        <span className="text-[9px] text-red-100 font-bold uppercase tracking-tight">Clear</span>
                      </div>
                    </div>onChange={(e: any) => setNewMemberDescription(e.target.value)}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 px-4 text-center">
                    <Upload className="size-5 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider group-hover:text-zinc-300">
                      Profile Photo
                    </span>
                  </div>
                )}
              </div>



              <div className="grid grid-cols-3 gap-4 mb-4 text-left">
  <div className="space-y-2 mt-2">
    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">First Name <span className="text-red-500">*</span></label>
    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-zinc-800 border-zinc-700" />
  </div>
  <div className="space-y-2 mt-2">
    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Last Name</label>
    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-zinc-800 border-zinc-700" />
  </div>
  <div className="space-y-2 mt-2">
    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Suffix</label>
    <Input placeholder="Jr, Sr, III" value={suffix} onChange={(e) => setSuffix(e.target.value)} className="bg-zinc-800 border-zinc-700" />
  </div>
</div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">About / Description</label>
                
                <div className="relative">
                  <textarea 
                    placeholder="Briefly describe their role or personality..." 
                    value={newMemberDescription}
                    onChange={(e) => setNewMemberDescription(e.target.value)}
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 pb-12 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-none"
                  />
                  
                  <label className="absolute bottom-3 right-3 cursor-pointer size-8 flex items-center justify-center rounded-full hover:bg-zinc-700/50 transition-colors">
                    <Paperclip className="size-4 text-zinc-300" />
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleAttachmentUpload(e.target.files)}
                    />
                  </label>
                </div>

                {bioAttachments.length > 0 && (
  <div className="flex flex-wrap gap-2 pt-2">
    {bioAttachments.map((file, idx) => {
      const isImage = file.type?.startsWith("image/");

      return (
        <div
          key={idx}
          className="group relative flex items-center gap-2 bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800/80 text-zinc-300 text-xs pl-2 pr-8 py-1.5 rounded-lg transition-all max-w-[220px]"
        >
          <div
            onClick={() => {
              if (isImage) {
                setPreviewImage(file.content);
              } else {
                const link = document.createElement('a');
                link.href = file.content;
                link.download = file.name || 'attachment';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
            }}
            className="flex items-center gap-2 truncate hover:text-primary transition-colors cursor-pointer"
            title="Click to view file"
          >
            {isImage ? (
              <div className="size-6 rounded bg-zinc-950 overflow-hidden border border-zinc-800 shrink-0">
                <img
                  src={file.content}
                  alt="preview"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
            ) : (
              <div className="size-6 rounded bg-zinc-950 flex items-center justify-center border border-zinc-800 shrink-0 text-zinc-500 group-hover:text-primary transition-colors">
                <FileText className="size-3.5" />
              </div>
            )}
            <span className="truncate font-medium text-[11px]">{file.name}</span>
          </div>

          <button
            type="button"
            onClick={() => removeAttachment(idx)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-red-400 font-bold transition-colors cursor-pointer text-sm p-0.5"
            title="Remove attachment"
          >
            &times;
          </button>
        </div>
      );
    })}
  </div>
)}
              </div>

              

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Link Account</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-blue-500 transition-colors">
                    <LinkIcon className="size-4" />
                  </div>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    
                    className={cn(
                      "bg-zinc-800/50 border-zinc-700/50 rounded-xl pl-11 py-6 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all text-white",
                      emailStatus === 'found' && "border-emerald-500/50 ring-emerald-500/10",
                      emailStatus === 'not_found' && "border-amber-500/50"
                    )}
                    value={email}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmail(val);
                        setEmailStatus('idle');
                        if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
                        emailDebounceRef.current = setTimeout(() => {
                          verifyEmail(val);
                        }, 1000);
                    }}
                  />
                </div>
                
                {/* These clear the remaining red-line errors */}
                {emailStatus === 'found' && (
                  <p className="text-[10px] text-emerald-500 ml-1 font-medium mt-1">
                    ✓ TimeVault account found.
                  </p>
                )}
                {emailStatus === 'not_found' && (
                  <p className="text-[10px] text-amber-500 ml-1 font-medium mt-1 italic">
                    No account found. We'll send an invite.
                  </p>
                )}
              </div>

              <div className="pt-6 border-t border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Significant Milestones</label>
                  <Button 
                    size="sm" 
                    className="text-amber-500 hover:text-amber-600 bg-transparent hover:bg-transparent p-0 h-auto cursor-pointer" 
                    onClick={() => setMilestones([...milestones, { title: "", 
                                      date: "", 
                                      description: "", 
                                      mediaType: 'none', 
                                      mediaContent: "",
                                      isRecorded: false,      
                                      isRecordingActive: false  }])}
                  >
                    <Plus className="size-3 mr-1" /> Add Milestone
                  </Button>
                </div>

                <div className="space-y-3">
                  {milestones.length > 0 && 
                    milestones.map((milestone, index) => (
                    <div key={index} className="p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 space-y-4">
  <div className="flex gap-3 items-center">
    <input
  placeholder="Milestone Title *"
  value={milestone.title}
  onChange={(e) => { const m = [...milestones]; m[index].title = e.target.value; setMilestones(m); }}
  className={`w-full bg-zinc-900/50 border rounded-xl px-4 py-3 text-sm text-zinc-200 font-normal placeholder:text-zinc-500 focus:outline-none focus:ring-1 transition-all ${
    !milestone.title.trim() 
      ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20' 
      : 'border-zinc-700/50 focus:border-primary/50 focus:ring-primary/20'
  }`}
/>
    <Button 
  className="cursor-pointer bg-transparent text-red-400 hover:bg-red-500/15 hover:text-red-500 rounded-lg transition-all" 
  onClick={() => removeMilestone(index)}
>
  <Plus className="rotate-45 size-4" />
</Button>
  </div>


  <input
  type="date"
  value={milestone.date || ''}
  onChange={(e) => { const m = [...milestones]; m[index].date = e.target.value; setMilestones(m); }}
  className="cursor-pointer w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 font-normal placeholder:text-zinc-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
/>

  {/* Milestone Description Box */}
  <textarea
  placeholder="Describe this milestone..."
  value={milestone.description}
  onChange={(e) => { const m = [...milestones]; m[index].description = e.target.value; setMilestones(m); }}
  className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 font-normal placeholder:text-zinc-500 min-h-[80px] focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
/>

  {/* Enhance Milestone Row */}
  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Enhance Milestone</span>
    <div className="flex items-center gap-2">
      <Button 
        variant="ghost" size="sm"
        className={cn("h-8 rounded-lg text-xs", "cursor-pointer", milestone.mediaType === 'audio' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400')}
        onClick={() => { const m = [...milestones]; m[index].mediaType = 'audio'; m[index].mediaContent = ''; m[index].isRecorded = false; setMilestones(m); }}
      >🎙️ Audio</Button>
      <Button 
        variant="ghost" size="sm"
        className={cn("h-8 rounded-lg text-xs", "cursor-pointer", milestone.mediaType === 'video' ? 'bg-purple-500/20 text-purple-400' : 'text-zinc-400')}
        onClick={() => { const m = [...milestones]; m[index].mediaType = 'video'; m[index].mediaContent = ''; m[index].isRecorded = false; setMilestones(m); }}
      >🎥 Video</Button>
    </div>
  </div>

  {/* Capsule Row & Recording Logic */}
  {milestone.mediaType !== 'none' && (
  <div className="mt-4 space-y-3">
    
    {/* 1. Live Video Preview (Only shows while actively recording video) */}
    {milestone.isRecordingActive && milestone.mediaType === 'video' && (
      <div className="relative mb-3 rounded-2xl overflow-hidden bg-black aspect-video border border-red-500/50">
        <video
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover scale-x"
          ref={(el) => {
          if (el && liveStream) {
            el.srcObject = liveStream;
          }
        }}
        />
        <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 px-2 py-1 rounded-lg border border-white/10">
          <div className="size-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[10px] text-white font-bold uppercase tracking-widest">Live Feed</span>
        </div>
      </div>
    )}

    {/* 2. Playback Preview (Shows only AFTER recording is stopped & saved) */}
    {milestone.isRecorded && !milestone.isRecordingActive && (
      <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 animate-in fade-in">
        <p className="text-[10px] font-bold text-zinc-500 mb-2 uppercase">{milestone.mediaType} Preview</p>
        {milestone.mediaType === 'video' ? (
          <video src={milestone.mediaContent} controls className="w-full rounded-lg aspect-video object-cover bg-black" />
        ) : (
          <audio src={milestone.mediaContent} controls className="w-full h-8 opacity-80" />
        )}
      </div>
    )}

    {/* 3. The Control Capsule (Manages Record, Stop, and Clear) */}
    <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800">
      <div className="flex flex-col ml-2">
        <span className="text-sm font-medium text-white capitalize">{milestone.mediaType} Capsule</span>
        <div className="flex items-center gap-2">
          <div className={cn(
            "size-1.5 rounded-full",
            milestone.isRecordingActive ? "bg-red-500 animate-pulse" : milestone.isRecorded ? "bg-green-500" : "bg-zinc-600"
          )} />
          <p className="text-[10px] text-zinc-500 uppercase tracking-tight">
            {milestone.isRecordingActive ? "Recording..." : milestone.isRecorded ? "Captured" : "Ready"}
          </p>
        </div>
      </div>

      {/* Button Logic */}
      <div className="flex items-center gap-2">
        {milestone.isRecordingActive ? (
          // Shows when currently recording
          <Button
            size="sm"
            className="cursor-pointer h-7 text-[10px] bg-red-600 hover:bg-red-700 text-white border border-red-500 rounded-xl px-4"
            onClick={() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
              }
            }}
          >
            Stop Recording
          </Button>
        ) : (
          // Shows when NOT recording
          <>
            {milestone.isRecorded && (
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer !bg-transparent !hover:bg-transparent text-white !hover:opacity-80 h-7 text-[10px] text-zinc-400  hover:bg-red-500/10 rounded-xl px-3"
                onClick={() => {
                  const m = [...milestones];
                  m[index].mediaContent = '';
                  m[index].isRecorded = false;
                  setMilestones(m);
                }}
              >
                Clear
              </Button>
            )}
            <Button
              size="sm"
              className="bg-transparent hover:bg-transparent text-white !hover:opacity-80 h-7 text-[10px] bg-red-500/10 text-red-400 border cursor-pointer border-red-500/20 rounded-xl px-4"
              onClick={() => {
                const m = [...milestones];
                m[index].isRecordingActive = true;
                setMilestones(m);
                startNativeRecording(index); // This triggers your function from earlier
              }}
            >
              {milestone.isRecorded ? "Re-record" : "Record Now"}
            </Button>
          </>
        )}
      </div>
    </div>

  </div>
)}

                    </div>
                  ))}
                </div>
              </div>
              <div className='space-y-6 mb-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar text-right'>

<div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-zinc-800/50">
  
  {/* Left Side: Remove Member (Only shows when editing) */}
  <div>
    {/* Only show the Remove button if we are actually EDITING an existing person */}
      {isEditingMode && (
        <Button
  onClick={async () => {
    if (!editingMember?.id) return;
    if (confirm(`Are you sure you want to remove ${firstName}?`)) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/family-members/${editingMember.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (res.ok) {
          setFamilyMembers(prev => prev.filter(m => m.id !== editingMember.id));
          setIsAddMemberModalOpen(false);
          setEditingMember(null);
        }
      } catch (error) {
        console.error("Delete failed:", error);
      }
    }
  }}
  className="bg-red-600/90 hover:bg-red-700 text-white border border-red-500/50 transition-all duration-200 px-6 py-2 hover:opacity-90 cursor-pointer"
>
  Remove Member
</Button>
      )}
  </div>
    

  {/* 2. RIGHT SIDE: Grouped Cancel and Save buttons */}
  <div className="flex flex-row items-center gap-3">
        <Button
  onClick={() => {
  setIsAddMemberModalOpen(false);
  setEditingMember(null);
  setMilestones([]);

}}
  className="cursor-pointer border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 px-6 py-2 rounded-lg transition-all duration-200"
>
  Cancel
</Button>

    <Button
      disabled={!firstName.trim() || milestones.some(m => !m.title.trim())}
      className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2"
      onClick={async () => {
                  const fullName = [firstName, lastName, suffix].filter(Boolean).join(" ");
                  
                  const memberData = {
                    id: isEditingMode ? editingMember?.id : undefined,
                    firstName,
                    lastName,
                    suffix,
                    name: fullName,
                    gender,
                    photo: profilePreview,
                    relationship: familyMembers.length === 0 ? "Root" : newMemberRelationship,
                    description: newMemberDescription,
                    bioAttachments: bioAttachments,
                    milestones: milestones,
                    email: email,
                    parentId: isParentRelationship ? null :
                              (newMemberRelationship === 'child') ? targetParentId : 
                              (newMemberRelationship === 'sibling') ? (familyMembers.find(m => m.id === targetParentId)?.parentId || null) : 
                              null,
                  };

                  try {
                    // Dynamically alter target endpoint and method based on mode
                    const url = isEditingMode 
                      ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/family-members/${editingMember.id}`
                      : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/family-members`;
                      
                    const method = isEditingMode ? 'PUT' : 'POST';

                    const res = await fetch(url, {
                      method: method,
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(memberData),
                      credentials: 'include'
                    });

                    if (res.ok) {
                      
                      const savedMember = await res.json();

                    // This replaces the old setFamilyMembers array syntax
                    setFamilyMembers((prev) => {
                      if (isEditingMode) {
                        return prev.map((m) => (m.id === editingMember?.id ? savedMember : m));
                      } else {
                        return [...prev, savedMember];
                      }
                    });
                      

                      // 3. Update your dashboard stats card count
                      if (!isEditingMode) {
                        setStats(prev => ({ ...prev, familyMembers: prev.familyMembers + 1 }));
                      }

                      // 4. Manually close the modal and reset the form fields
                      // This keeps you on the "Roots" tab instead of redirecting.
                      setIsAddMemberModalOpen(false);
                      setEditingMember(null);
                      setFirstName("");
                      setLastName("");
                      
                      // IF ADDING A PARENT: We must update the OLD member to point to the NEW parent
                      if (isParentRelationship && targetParentId) {
                        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/family-members/${targetParentId}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ parentId: savedMember.id }), // Set ssss's parent to aaaa's new ID
                          credentials: 'include'
                        });
                      }
                      
                      // 2. MANUAL RESET (Instead of calling closeMemberModal)
                      setIsAddMemberModalOpen(false); // Just close the window
                      setEditingMember(null);         // Clear the selection
                                        }
                                        
                  } catch (error) {
                    console.error("Failed to link parent:", error);
                  }
}}
              >
                
                {isEditingMode ? "Save Changes" : "Add Member"}
              </Button>
              </div>
            </div>
          </div> 
        </div> 
        </div>
        </div>
      
      )}
                      
      {isJoinModalOpen && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-zinc-900 w-full max-w-sm p-8 rounded-3xl border border-zinc-800 shadow-2xl animate-in zoom-in-95">
      <h2 className="text-xl font-bold text-white mb-2 text-center">Enter Invite Code</h2>
      <p className="text-zinc-400 mb-6 text-sm text-center">
        Enter the secure code shared by your family member.
      </p>
      <Input
        placeholder="XXX-XXX"
        value={joinCode}
        onChange={e => {
          setJoinError('');
          setJoinCode(e.target.value.toUpperCase().slice(0, 12));
        }}
        className="bg-zinc-800/50 border-zinc-700 rounded-xl text-center text-lg tracking-widest mb-2"
      />
      {joinError && <p className="text-red-400 text-xs text-center mb-4">{joinError}</p>}
      {!joinError && <div className="mb-4" />}
      <div className="flex gap-3">
        <button
          onClick={() => { setIsJoinModalOpen(false); setJoinCode(''); setJoinError(''); }}
          className="flex-1 py-2 px-4 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all text-sm font-medium cursor-pointer"
        >
          Cancel
        </button>
        <Button
          className="flex-1 bg-primary hover:bg-primary/90 cursor-pointer disabled:opacity-50"
          disabled={joinCode.length < 6}
          onClick={handleJoinFamily}
        >
          Verify Code
        </Button>
      </div>
    </div>
  </div>
)}

      {isViewModalOpen && viewingMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="relative bg-zinc-900 w-full max-w-xl rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            
            {/* Close X button */}
  <button
  onClick={() => setIsViewModalOpen(false)}
  className="absolute right-3 top-4 z-10 rounded-sm size-8 opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
>
  <X className="h-5 w-5 text-white" />
  <span className="sr-only">Close</span>
</button>


            <div className="px-8 pb-8 pt-8 overflow-y-auto flex-1">
  {/* Profile Pic */}
<div className="flex justify-center">
  <div className="size-24 rounded-2xl border-zinc-900 overflow-hidden bg-zinc-800 shadow-xl mb-3">
    <img
      src={viewingMember.photo || "/default-avatar.png"}
      className="h-full w-full object-cover"
      alt="Profile"
    />
  </div>
</div>

              {/* Content */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white leading-tight text-center">
                    {[viewingMember.firstName, viewingMember.lastName, viewingMember.suffix].filter(Boolean).join(" ")}
                  </h2>
                  <p className="text-blue-400 font-medium text-sm uppercase tracking-wider">
                    {viewingMember.relationship}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Biography</p>
                  <div className="p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800/50">
                    <p className="text-zinc-300 text-sm leading-relaxed">
                      {viewingMember.description || "The story of this family member remains unwritten."}
                    </p>
                  </div>

                  {/* Attachments - Read Only */}
                {viewingMember.bioAttachments && viewingMember.bioAttachments.length > 0 && (
                  <div className="space-y-2 pt-4">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Attachments</p>
                    <div className="flex flex-wrap gap-2">
                      {viewingMember.bioAttachments.map((file: any, idx: number) => {
                        const isImage = file.type?.startsWith("image/");

                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              if (isImage) {
                                setPreviewImage(file.content);
                              } else {
                                const link = document.createElement('a');
                                link.href = file.content;
                                link.download = file.name || 'attachment';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }
                            }}
                            className="group flex items-center gap-2 bg-zinc-800/30 hover:bg-zinc-800/60 border border-zinc-800/50 text-zinc-300 text-xs pl-2 pr-3 py-1.5 rounded-lg transition-all max-w-[220px] cursor-pointer"
                            title="Click to view file"
                          >
                            {isImage ? (
                              <div className="size-6 rounded bg-zinc-950 overflow-hidden border border-zinc-800 shrink-0">
                                <img
                                  src={file.content}
                                  alt="preview"
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                />
                              </div>
                            ) : (
                              <div className="size-6 rounded bg-zinc-950 flex items-center justify-center border border-zinc-800 shrink-0 text-zinc-500 group-hover:text-primary transition-colors">
                                <FileText className="size-3.5" />
                              </div>
                            )}
                            <span className="truncate font-medium text-[11px] group-hover:text-primary transition-colors">
                              {file.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                </div>

                {/* Milestones - Read Only */}
{viewingMember.milestones && viewingMember.milestones.length > 0 && (
  <div className="space-y-1">
    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Significant Milestones</p>
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-primary via-primary/50 to-primary/10" />

      {[...viewingMember.milestones]
        .sort((a: any, b: any) => {
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        })
        .map((m: any, idx: number) => (
          <div key={idx} className="relative mb-4 last:mb-0">
            {/* Dot */}
            <div className="absolute -left-6 top-5 size-3.5 rounded-full bg-primary border-2 border-zinc-900 shadow-[0_0_8px_rgba(74,158,255,0.5)]" />

            <div className="p-3 bg-zinc-800/30 rounded-xl border border-zinc-800/50 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-white truncate">{m.title}</h4>
                {m.date && (
                  <span className="text-[11px] text-zinc-500 font-medium shrink-0">
                    {new Date(m.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              {m.description && (
                <p className="text-sm text-zinc-400 line-clamp-1">{m.description}</p>
              )}
              <button
                onClick={() => setViewingMilestone(m)}
                className="cursor-pointer text-xs font-medium text-primary hover:text-primary/80 transition-colors pt-1"
              >
                View milestone →
              </button>
            </div>
          </div>
        ))}
    </div>
  </div>
)}

{/* Milestone Detail Modal */}
{viewingMilestone && (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
    <div className="bg-zinc-900 w-full max-w-lg rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col relative">
      <button
        onClick={() => setViewingMilestone(null)}
        className="absolute right-4 top-4 z-10 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
      >
        <X className="h-5 w-5 text-white" />
        <span className="sr-only">Close</span>
      </button>

      <div className="px-8 py-8 overflow-y-auto flex-1 space-y-4">
        <div>
          <h3 className="text-xl font-bold text-white leading-tight pr-8">{viewingMilestone.title}</h3>
          {viewingMilestone.date && (
            <p className="text-xs text-zinc-500 font-medium mt-1">
              {new Date(viewingMilestone.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}
        </div>

        {viewingMilestone.description && (
          <p className="text-sm text-zinc-300 leading-relaxed">{viewingMilestone.description}</p>
        )}

        {viewingMilestone.mediaContent && viewingMilestone.mediaType === 'video' && (
          <video src={viewingMilestone.mediaContent} controls className="w-full rounded-lg aspect-video object-cover bg-black" />
        )}
        {viewingMilestone.mediaContent && viewingMilestone.mediaType === 'audio' && (
          <audio src={viewingMilestone.mediaContent} controls className="w-full" />
        )}
      </div>
    </div>
  </div>
)}

                <Button 
                  className="cursor-pointer w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl py-6 border border-zinc-700"
                  onClick={() => setIsViewModalOpen(false)}
                >
                  Close Profile
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div 
          className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4" 
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Preview" className="w-full h-full object-contain rounded-lg" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 text-white text-2xl cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}


      <Toaster 
  theme="dark" 
  position="bottom-right"
  toastOptions={{
    classNames: {
      actionButton: '!bg-transparent !border-0 !shadow-none !text-zinc-400 hover:!text-white !text-base !font-normal !p-0 !min-w-0 !rounded-none'
    }
  }}
/>
    </div> 
  ) 
}
  


export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageInner />
    </Suspense>
  )
}