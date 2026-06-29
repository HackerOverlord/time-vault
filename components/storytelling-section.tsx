"use client"

import { useState, useEffect, useRef } from "react"
import { Mic, Video, Sparkles, RefreshCw, Upload, RefreshCw as RedoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const storyPrompts = [
  "Tell me about your grandmother...",
  "What's your favorite childhood memory?",
  "Describe a moment that changed your life...",
  "What advice would you give your younger self?",
  "Tell me about your first love...",
  "What are you most proud of?",
  "Describe your perfect day...",
  "What makes you truly happy?",
  "Tell me about a time you overcame fear...",
  "What legacy do you want to leave behind?",
]

interface StorytellingSectionProps {
  // Added mandatory prop for parent communication[cite: 5]
  onRecordingComplete: (base64: string) => void;
  onStartRecording?: (type: "audio" | "video") => void;
}

export function StorytellingSection({ onRecordingComplete }: StorytellingSectionProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState(storyPrompts[0]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [recordingType, setRecordingType] = useState<'audio' | 'video' | null>(null);
  
  // Added to remember format for the preview player[cite: 5]
  const [lastRecordedType, setLastRecordedType] = useState<'audio' | 'video' | null>(null);
  
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith('video/') ? 'video' : 'audio';
      setLastRecordedType(type);
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        onRecordingComplete(reader.result as string);
      };
      
      const url = URL.createObjectURL(file);
      setRecordedUrl(url);
    }
  };

  const startRecording = async (type: 'audio' | 'video') => {
    setRecordedUrl(null); // Reset preview on new attempt
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });

      setRecordingType(type);
      setIsRecording(true);
      
      if (type === 'video') {
        setTimeout(() => {
          if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
        }, 100);
      }
      
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { 
          type: type === 'video' ? 'video/webm' : 'audio/webm' 
        });
        
        setLastRecordedType(type); 
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          onRecordingComplete(reader.result as string);
        };
      };

      recorder.start();
    } catch (err: any) {
      setRecordingType(null);
      setIsRecording(false);
      alert("Please allow camera/mic access.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
      streamRef.current?.getTracks().forEach(track => track.stop()); 
      setIsRecording(false);
      setRecordingType(null); 
    }
  };

  const refreshPrompt = () => {
    setIsAnimating(true);
    const currentIndex = storyPrompts.indexOf(currentPrompt);
    const nextIndex = (currentIndex + 1) % storyPrompts.length;
    setTimeout(() => {
      setCurrentPrompt(storyPrompts[nextIndex]);
      setIsAnimating(false);
    }, 300);
  };

  return (
    <div className="relative overflow-hidden p-4 rounded-xl border border-border/50 bg-secondary/10 mt-8">
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Storytelling Engine</h2>
        </div>

        <div className="mb-4 min-h-[60px] flex items-center justify-between gap-4">
          <p className={cn(
            "text-lg font-medium text-primary italic leading-tight transition-all duration-300",
            isAnimating && "opacity-0 translate-y-1"
          )}>
            &ldquo;{currentPrompt}&rdquo;
          </p>
          <Button 
          type="button" 
          variant="ghost"
          size="icon" 
          onClick={refreshPrompt}
          className="group cursor-pointer rounded-full !bg-transparent !hover:bg-transparent transition-all duration-200"
        >
          <RefreshCw 
            className={cn(
              "size-5 transition-colors group-hover:text-sky-500", 
              isAnimating && "animate-spin"
            )} 
          />
        </Button>
        </div>

        {/* PREVIEW SECTION[cite: 5] */}
        {recordedUrl && !isRecording && (
          <div className="mb-6 p-4 rounded-xl border border-zinc-800 bg-zinc-950/50 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <div className="size-2 rounded-full bg-primary" />
                Recording Preview
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setRecordedUrl(null); setLastRecordedType(null); }}
                className="h-8 text-[11px] hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <RedoIcon className="size-3 mr-2" /> Discard & Retake
              </Button>
            </div>
            {lastRecordedType === 'video' ? (
              <video src={recordedUrl} controls className="w-full rounded-lg border border-zinc-800" style={{ maxHeight: '400px', objectFit: 'contain' }} />
            ) : (
              <audio src={recordedUrl} controls className="w-full h-10 mt-1" />
            )}
          </div>
        )}

        {/* LIVE RECORDING BADGE */}
        {recordingType && (
          <div className="mb-6 w-full flex items-center justify-center">
            {recordingType === 'video' ? (
              <div className="relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
                <video 
  ref={videoPreviewRef} 
  autoPlay 
  muted 
  playsInline 
  className="w-full h-auto block"
  onLoadedMetadata={(e) => {
    const video = e.currentTarget;
    video.style.aspectRatio = `${1920} / ${1080}`;
  }}
/>
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full">
                  <div className="size-2 rounded-full bg-white animate-pulse" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Live Video</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 rounded-full border border-zinc-700/50 backdrop-blur-sm animate-in fade-in zoom-in">
                <div className="size-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                <span className="text-sm font-medium text-zinc-200">Recording Audio...</span>
              </div>
            )}
          </div>
        )}

        {/* BUTTONS[cite: 7] */}
        <div className="flex flex-row items-center gap-3 w-full mt-4">
          <button 
            type="button" 
            disabled={recordingType === 'video'}
            onClick={() => recordingType === 'audio' ? stopRecording() : startRecording('audio')}
            className={cn(
              "flex-1 py-3 px-4 border border-dashed rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer",
              recordingType === 'audio' ? "border-red-500 bg-red-500/10" : "border-zinc-700 hover:border-primary hover:bg-primary/5",
              recordingType === 'video' && "opacity-20 grayscale"
            )}
          >
            <Mic className={cn("size-4", recordingType === 'audio' && "text-red-500 animate-pulse")} />
            <span className="text-sm font-medium cursor-pointer">{recordingType === 'audio' ? "Stop" : "Record Audio"}</span>
          </button>

          <button 
            type="button" 
            disabled={recordingType === 'audio'}
            onClick={() => recordingType === 'video' ? stopRecording() : startRecording('video')}
            className={cn(
              "flex-1 cursor-pointer py-3 px-4 border border-dashed rounded-xl flex items-center justify-center gap-2 transition-all",
              recordingType === 'video' ? "border-red-500 bg-red-500/10" : "border-zinc-700 hover:border-primary hover:bg-primary/5",
              recordingType === 'audio' && "opacity-20 grayscale"
            )}
          >
            <Video className={cn("size-4", recordingType === 'video' && "text-red-500 animate-pulse")} />
            <span className="text-sm font-medium">{recordingType === 'video' ? "Stop" : "Record Video"}</span>
          </button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-zinc-950 px-2 text-zinc-500">or</span></div>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className=" items-center cursor-pointer w-fit mx-auto  flex items-center justify-center gap-2.5 text-xs font-medium text-zinc-400 hover:text-primary transition-all"
        >
          <Upload className="size-3.5" /> Upload an existing recording
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept="audio/*,video/*" onChange={handleFileUpload} />
      </div>
    </div>
  )
}