"use client"

// Imported the Trash2 icon for the delete action
import { Lock, Unlock, Calendar, Image, Video, Mic, User, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface Memory {
  id: string
  title: string
  content?: string
  description?: string
  mediaContent?: string
  releaseDate: Date
  status: "locked" | "released"
  is_draft?: boolean
  hasImage?: boolean
  hasVideo?: boolean
  hasAudio?: boolean
  attachments?: Array<{name: string, content: string}>
  recipient?: string
  createdBy?: string
}

interface ViewMemoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memory: Memory | null
  onDelete?: (id: string) => void // Callback passing the unique ID back up to your parent state tracker
  onEdit?: (memory: Memory) => void
}

export function ViewMemoryModal({ open, onOpenChange, memory, onDelete, onEdit }: ViewMemoryModalProps) {
  
  if (!memory) return null

  // Drafts are always accessible to the creator
  const isDraft = !!memory.is_draft
  const now = new Date();
  const releaseDate = new Date(memory.releaseDate);
  const isLocked = releaseDate > now && !isDraft;

  const [viewingImage, setViewingImage] = useState<string | null>(null)


  const handleDeleteClick = () => {
    if (confirm(`Are you sure you want to permanently delete "${memory.title}"?`)) {
      if (onDelete) {
        onDelete(memory.id)
        onOpenChange(false) // Auto-dismiss the modal view window cleanly on success
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
      onOpenAutoFocus={(e) => e.preventDefault()}
      className="sm:max-w-[600px] bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader className="pb-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-foreground mb-2">
                {memory.title}
              </DialogTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1.5 text-xs font-semibold uppercase tracking-wide",
                    isDraft
                      ? "border-zinc-700 bg-zinc-800/40 text-zinc-400"
                      : isLocked 
                        ? "border-warning/30 bg-warning/10 text-warning" 
                        : "border-success/30 bg-success/10 text-success"
                  )}
                >
                  {isDraft ? (
                    <>
                      <span className="size-1.5 rounded-full bg-zinc-500 animate-pulse" />
                      Workspace Draft
                    </>
                  ) : isLocked ? (
                    <>
                      <Lock className="size-3" /> LOCKED
                    </>
                  ) : (
                    <>
                      <Unlock className="size-3" /> RELEASED
                    </>
                  )}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" />
                  {isDraft 
                    ? "No release date set" 
                    : memory.releaseDate.toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                  }
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-6 pr-4">
          <>
            
            {/* Always show content */}
{memory.content && (
  <div className="space-y-2 mb-8">
    <p className="text-sm font-medium text-muted-foreground">
      {isDraft ? "Draft Content Workspace" : "Content"}
    </p>
    <p className="text-foreground leading-relaxed">{memory.content}</p>
  </div>
)}

{/* Attachments Section */}
{memory.attachments && memory.attachments.length > 0 && (
  <div className="space-y-3">
    <p className="text-sm font-medium text-muted-foreground">Attachments</p>

    {memory.attachments.map((att, idx) => {
      const isImage = att.content && att.content.startsWith('data:image/');
      
      const handleAttachmentClick = () => {
  console.log('Clicked attachment:', att.name);
  console.log('Content starts with:', att.content?.substring(0, 30));
  console.log('Is image?', isImage);
  
  if (isImage) {
    console.log('Opening image modal');
    setViewingImage(att.content);
  } else if (att.content && att.content.startsWith('data:')) {
    console.log('Downloading file');
    // Download non-image attachments (PDFs, etc)
    const arr = att.content.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(arr[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    const blob = new Blob([u8arr], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = att.name || 'attachment';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } else {
    console.log('No action for this attachment');
  }
};
      
      return (
        <div
          key={idx}
          onClick={handleAttachmentClick}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 w-fit transition-all cursor-pointer opacity-100 hover:opacity-80 ${
            isImage 
              ? 'bg-secondary/50' 
              : 'bg-secondary/30'
          }`}
        >
          {isImage ? (
            <img src={att.content} alt="Thumbnail" className="w-8 h-8 rounded object-cover" />
          ) : (
            <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-xs">
              📄
            </div>
          )}
          <span className="text-sm text-foreground">{att.name || "Attachment"}</span>
        </div>
      );
    })}
  </div>
)}

{/* Recordings Section */}
{(memory.hasVideo || memory.hasAudio || memory.mediaContent) && (
  <div className="space-y-3">
    <p className="text-sm font-medium text-muted-foreground">Recordings</p>

    {/* Recording Badges */}
    {(memory.hasVideo || memory.hasAudio) && (
      <div className="flex items-center gap-3 flex-wrap">
        {memory.hasVideo && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border/50">
            <Video className="size-4 text-chart-5" />
            <span className="text-sm">Video</span>
          </div>
        )}
        {memory.hasAudio && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border/50">
            <Mic className="size-4 text-success" />
            <span className="text-sm">Audio</span>
          </div>
        )}
      </div>
    )}

  </div>
)}
            {/* Creator info */}
            {memory.createdBy && (
              <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                <User className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Created by {memory.createdBy}</span>
              </div>
            )}

            {/* Video/Audio Player */}
            {memory.mediaContent && (
              <div className="mb-4">
                {memory.hasVideo ? (
                  <video src={memory.mediaContent} controls className="w-full rounded-lg" />
                ) : memory.hasAudio ? (
                  <audio src={memory.mediaContent} controls className="w-full" />
                ) : null}
              </div>
            )}

            {/* Description if different from content */}
            {memory.description && memory.description !== memory.content && (
              <div className="space-y-2 mb-4">
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="text-foreground">{memory.description}</p>
              </div>
            )}

            {isLocked && (
              <div className="mb-3 p-4 bg-warning/10 border border-warning/30 rounded-lg">
                <p className="text-sm text-warning text-center">
                  This vault unlocks on{" "}
                  <span className="font-semibold">
                    {memory.releaseDate.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
              </div>
            )}
            
          </>
        </div>

        {/* Image Viewer Modal */}
        {viewingImage && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingImage(null)}>
            <div className="relative max-w-3xl max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
              <img src={viewingImage} alt="Full view" className="w-full h-full object-contain rounded-lg" />
              <button
                onClick={() => setViewingImage(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 text-2xl cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}


        {/* --- RESTRUCTURED TWO-BUTTON ACTIONS FOOTER --- */}
<div className="flex items-center justify-between pt-4 border-t border-border/50">
  
  {/* LEFT ACTION: DESTRUCTIVE DELETE VAULT */}
  <div>
    <Button 
  onClick={handleDeleteClick}
  className="bg-red-600/90 hover:bg-red-700 text-white border border-red-500/50 gap-2 transition-all duration-200 px-4 py-2 hover:opacity-90 cursor-pointer"
>
  <Trash2 className="size-4" />
  Delete Vault
</Button>
  </div>

  {/* RIGHT ACTIONS: EDIT (drafts only) + CLOSE */}
  <div className="flex items-center gap-3">
    {isDraft && (
      <Button 
        className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 cursor-pointer" 
        onClick={() => {
          if (onEdit && memory) {
            onEdit(memory)
            onOpenChange(false)
          }
        }}
      >
        Edit Draft
      </Button>
    )}
    <Button 
      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-6 cursor-pointer" 
      onClick={() => onOpenChange(false)}
    >
      Close
    </Button>
  </div>

</div>
      </DialogContent>
    </Dialog>
  )
}