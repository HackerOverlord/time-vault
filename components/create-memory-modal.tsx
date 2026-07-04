"use client"

import { useState, useEffect, useRef } from "react"
import { FileText, Mic, Video, Calendar, Mail, Eye, EyeOff, Users, Upload, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { StorytellingSection } from "./storytelling-section" // Adjust the path if necessary
import { ScrollArea } from "@/components/ui/scroll-area"
import { release } from "os"
import type { Memory } from "@/app/dashboard/page"  // Adjust path if needed

interface CreateMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Add this line below to fix the red squiggly error
  onSubmit: (formData: any) => Promise<void>; 
  editingDraft?: Memory | null
}


export function CreateMemoryModal({ open, onOpenChange, onSubmit, editingDraft }: CreateMemoryModalProps) {

  const handleClose = () => {
  setFormData({
    title: "",
    content: "",
    format: "text",
    releaseDate: "",
    visibility: "private",
    shareWithEmail: "",
    attachments: [],
    isDraft: false,
    mediaContent: ""
  });
  onOpenChange(false);
};

  const dateTimeInputRef = useRef<HTMLInputElement>(null)

  const [previewImage, setPreviewImage] = useState<string | null>(null)


  const [formData, setFormData] = useState({
    title: "",
    content: "",
    format: "text",
    releaseDate: "",
    visibility: "private",
    shareWithEmail: "",
    attachments: [] as File[],
    isDraft: false,
    mediaContent: ""
  })

  useEffect(() => {
  if (editingDraft) {
    setFormData({
      title: editingDraft.title || "",
      content: editingDraft.content || "",
      format: "",
      releaseDate: editingDraft.release_date || "",
      visibility: "private",
      shareWithEmail: editingDraft.recipient || "",  
      attachments: (editingDraft.attachments as any) || [], 
      isDraft: true,
      mediaContent: editingDraft.mediaContent || "",  
    })
  }
}, [editingDraft])

useEffect(() => {
  if (open && !editingDraft) {
    setFormData({
      title: "",
      content: "",
      format: "text",
      releaseDate: "",
      visibility: "private",
      shareWithEmail: "",
      attachments: [],
      isDraft: false,
      mediaContent: ""
    });
  }
}, [open, editingDraft]);


    const [fetchedFamilyMembers, setFetchedFamilyMembers] = useState<any[]>([])
    const seenEmails = new Set<string>()
    const linkedMembers = fetchedFamilyMembers.filter(member => {
      // Look exclusively for accounts verified by our updated backend
      const accountEmail = member.linkedAccount;
      if (!accountEmail || typeof accountEmail !== 'string' || accountEmail.trim() === "") {
        return false;
      }
      
      const cleanEmail = accountEmail.trim().toLowerCase();
      if (seenEmails.has(cleanEmail)) {
        return false; // Skips duplicates completely
      }
      
      seenEmails.add(cleanEmail);
      return true;
    })

  useEffect(() => {
    if (open) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/family-members`, { 
  headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
})
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setFetchedFamilyMembers(data)
          }
        })
        .catch((err: any) => console.error("Error loading relatives:", err))
    }
  }, [open])


  const handleRecordingComplete = (base64String: string) => {
  setFormData(prev => ({
    ...prev,
    mediaContent: base64String
  }));
};
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newFiles]
      }))
      
      // === THE FIX: Reset the input target's value ===
      e.target.value = "" 
    }
  }

  // Removes a file if they click the X button
  const removeFile = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, idx) => idx !== indexToRemove)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("formData before payload:", formData);

    

    try {
      // If it's a draft, generate a valid current ISO timestamp placeholder string
      // so datetime.fromisoformat() doesn't throw a ValueError on the backend
      const fallbackIsoString = new Date().toISOString().slice(0, 16);

// Convert attachments to base64 first, THEN send
const attachmentPromises: Promise<string>[] = [];
if (formData.attachments && formData.attachments.length > 0) {
  for (const file of formData.attachments) {
    // Check if it's a draft attachment (already base64)
    if ((file as any).content) {
      attachmentPromises.push(
        Promise.resolve((file as any).content)
      );
    } else if (file instanceof File) {
      // New file, convert to base64
      attachmentPromises.push(
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
        })
      );
    }
  }
}

const attachmentsBase64 = await Promise.all(attachmentPromises);

const payload = {
  title: formData.title,
  content: formData.content,
  releaseDate: formData.isDraft ? fallbackIsoString : formData.releaseDate,
  is_draft: formData.isDraft,
  visibility: formData.visibility,
  recipient: formData.shareWithEmail,
  mediaContent: formData.mediaContent,
  attachments: formData.attachments.map((file, idx) => ({
    name: file.name,
    data: attachmentsBase64[idx]
  })),
};


const endpoint = editingDraft 
  ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/memories/${editingDraft.id}` 
  : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/memories`;

const method = editingDraft ? 'PUT' : 'POST';

const response = await fetch(endpoint, {
  method: method,
  headers: { 
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionStorage.getItem('token')}`
  },
  body: JSON.stringify(payload),
});


        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const newMemory = await response.json();
console.log("Backend response:", newMemory);
await onSubmit(newMemory);

  
        onOpenChange(false);
              
            } catch (error) {
              console.error("Failed to create vault entry:", error);
            }
          };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[95vh] flex flex-col bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader><DialogTitle className="text-xl font-bold">{editingDraft ? 'Edit Time Vault' : 'Create Time Vault'}</DialogTitle></DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <form id="memory-form" onSubmit={handleSubmit} className="p-6 space-y-6 pb-12">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-zinc-100">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="bg-input/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content" className="text-sm font-semibold text-zinc-100">Content</Label>
              <div className="relative bg-input/50 border border-zinc-800 rounded-xl focus-within:ring-1 focus-within:ring-primary/40 focus-within:border-primary transition-all">
                <Textarea 
                  id="content" 
                  value={formData.content} 
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })} 
                  className="min-h-[150px] bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none w-full p-4 pb-12 text-zinc-100 placeholder:text-zinc-600"
                  placeholder="Write your legacy story, message, or journal entry here..."
                />
                
                {/* Minimal Attachment Action Corner Bar */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  {/* Outer label handles click forwarding, but rejects tracking premature hover interactions */}
                  <label className="pointer-events-none relative block select-none">
                    <div className="p-2 bg-transparent text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 rounded-lg transition-colors duration-150 cursor-pointer pointer-events-auto">
                      <Paperclip className="size-4" />
                    </div>
                    <input 
                      type="file" 
                      multiple 
                      className="hidden" 
                      onChange={handleFileChange}
                      accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.xls,.pptx"
                    />
                  </label>
                </div>
              </div>

              {/* Minimal Attached File Badges List */}
              {formData.attachments && formData.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {formData.attachments.map((file: File, idx: number) => {
                    const isImage = (file as any).content 
                      ? (file as any).content.startsWith('data:image/')
                      : file.type?.startsWith("image/");
                    // Creates a secure temporary local blob URL for instant previewing
                    const fileUrl = (file as any).content || URL.createObjectURL(file);

                    return (
                      <div 
                        key={idx} 
                        className="group relative flex items-center gap-2 bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800/80 text-zinc-300 text-xs pl-2 pr-8 py-1.5 rounded-lg transition-all max-w-[220px]"
                      >
                        {/* Interactive Preview Action Trigger */}
                            <div
                              onClick={() => {
                                if (isImage) {
                                  setPreviewImage(fileUrl);
                                } else {
                                  // Download PDF/documents
                                  const link = document.createElement('a');
                                  link.href = fileUrl;
                                  link.download = (file as any).name || file.name || 'attachment';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  // Clean up object URL if it was created
                                  if (fileUrl.startsWith('blob:')) {
                                    setTimeout(() => URL.revokeObjectURL(fileUrl), 100);
                                  }
                                }
                              }}
                              className="flex items-center gap-2 truncate hover:text-primary transition-colors cursor-pointer"
                              title="Click to view file"
                              >
                          {isImage ? (
                            <div className="size-6 rounded bg-zinc-950 overflow-hidden border border-zinc-800 shrink-0">
                              <img 
                                src={fileUrl} 
                                alt="preview" 
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                onLoad={() => {
                                  // Clean up object URLs to keep client runtime memory performant
                                  setTimeout(() => URL.revokeObjectURL(fileUrl), 5000);
                                }}
                              />
                            </div>
                          ) : (
                            <div className="size-6 rounded bg-zinc-950 flex items-center justify-center border border-zinc-800 shrink-0 text-zinc-500 group-hover:text-primary transition-colors">
                              <FileText className="size-3.5" />
                            </div>
                          )}
                          <span className="truncate font-medium text-[11px]">{file.name}</span>
                        </div>

                        {/* Detached Remove Button Overlay */}
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
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

              <div className="mt-4">
                <StorytellingSection onRecordingComplete={handleRecordingComplete} />
              </div>
            </div>

            {/* Updated Release Date & Draft Section */}
            <div className="space-y-2">
              <div className="flex flex-row items-end gap-4 w-full">
                
                {/* Date Input Column takes up all available remaining width */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Calendar className="h-4 w-4" />
                    <Label className="text-sm font-semibold text-zinc-100">
                      Release Date & Time
                      {!formData.isDraft && <span className="text-red-500">*</span>}
                    </Label>
                  </div>
                  
                  <div 
                    className={cn("relative cursor-pointer transition-opacity", formData.isDraft && "opacity-40 pointer-events-none")}
                    onClick={() => {
                      if (!formData.isDraft && dateTimeInputRef.current) {
                        try {
                          dateTimeInputRef.current.showPicker();
                        } catch (err) {
                          console.error("Browser does not support showPicker:", err);
                        }
                      }
                    }}
                  >
                    <Input
                      id="releaseDateTime"
                      ref={dateTimeInputRef}
                      type="datetime-local"
                      value={formData.isDraft ? "" : formData.releaseDate}
                      onChange={(e) => {
                        setFormData({ ...formData, releaseDate: e.target.value });
                        dateTimeInputRef.current?.blur();
                      }}
                      className="bg-zinc-950/40 border-zinc-800/80 rounded-xl h-11 text-zinc-100 [color-scheme:dark] w-full focus:ring-2 focus:ring-primary cursor-pointer select-none"
                      required={!formData.isDraft} 
                      disabled={formData.isDraft}
                    />
                  </div>
                </div>

                {/* Save as Draft Checkbox Column pinned perfectly beside it */}
                <div className="flex items-center h-11 shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={formData.isDraft}
                      onChange={(e) => setFormData({ ...formData, isDraft: e.target.checked })}
                      className="size-4 rounded border-zinc-800 bg-zinc-950/40 text-primary focus:ring-0 focus:ring-offset-0 accent-primary cursor-pointer transition-all"
                    />
                    <span className="text-xs text-zinc-400 group-hover:text-zinc-300 font-bold tracking-wider uppercase whitespace-nowrap">
                      Save as Draft
                    </span>
                  </label>
                </div>

              </div>
            </div>



            <div className="space-y-2">
                <Label className="text-sm font-semibold text-zinc-100">
                  <Users className="size-4" /> Choose Linked Family Member To Share With
                  {!formData.isDraft && <span className="text-red-400"> *</span>}
                </Label>
                <div className="relative">
                  <select
                    value={formData.shareWithEmail}
                    onChange={(e) => setFormData({ ...formData, shareWithEmail: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-zinc-900 text-zinc-500">Select a linked account...</option>
                    
                    {linkedMembers && linkedMembers
                      .filter((member) => {
                        const accountEmail = member.linkedAccount || member.email;
                        // Keeps only options that have an email string and aren't blank placeholders
                        return accountEmail && accountEmail.trim() !== "";
                      })
                      .map((member) => {
                        const accountEmail = member.linkedAccount || member.email;
                        return (
                          <option key={member.id} value={accountEmail} className="bg-zinc-900 text-zinc-100">
                            {member.name} ({accountEmail})
                          </option>
                        );
                      })
                    }
                  </select>
                </div>

                {!formData.isDraft && !formData.shareWithEmail && (
                  <p className="text-xs text-red-400">Required when not saving as draft</p>
                )}

                {/* Optional notification indicator if tree doesn't have anyone linked yet */}
                {!fetchedFamilyMembers || fetchedFamilyMembers.filter(m => m.linkedAccount || m.email).length === 0 ? (
                  <p className="text-[11px] text-amber-500/80 mt-1.5 leading-normal">
                    ⚠️ No family members have linked accounts yet. Link an account to enable sharing via the Family Members section.
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-500 mt-2.5 leading-normal">
                    Don't see a family member? Perhaps they haven't been linked properly. To link an account, visit the <span className="text-zinc-400 font-medium">Family Members</span> section.
                  </p>
                )}
              </div>
          </form>
        </div>
        
        {/* FOOTER: Pinned outside ScrollArea so it never scrolls away */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/50 bg-card/50">
          <Button 
  onClick={handleClose}
  className="px-6 py-2 cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 transition-all duration-200 rounded-md"
>
  Cancel
</Button>
          <Button 
            form="memory-form" 
            type="submit" 
            disabled={
                !formData.title.trim() || 
                (!formData.isDraft && (!formData.releaseDate || !formData.shareWithEmail))
              }
            className="bg-primary hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
          >
            Create Vault
          </Button>
        </div>
        
        {previewImage && (
  <div 
    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" 
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

      </DialogContent>
    </Dialog>
  )
}