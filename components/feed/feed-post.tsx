"use client"

import { useState, useRef, useEffect } from "react"
import { Heart, MessageCircle, Trash2, Lock, Play, Pause, Volume2, VolumeX, Send, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { API, ah, jsonH } from "@/lib/api"
import type { Post, Comment } from "@/lib/types"

interface FeedPostProps {
  post: Post
  isActive: boolean
  currentUserId?: string
  onLike: () => void
  onDelete: () => void
}

export function FeedPost({ post, isActive, currentUserId, onLike, onDelete }: FeedPostProps) {
  const [muted, setMuted] = useState(true)
  const [playing, setPlaying] = useState(true)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState("")
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoRef.current) return
    if (isActive && playing) videoRef.current.play().catch(() => {})
    else videoRef.current.pause()
  }, [isActive, playing])

  const loadComments = async () => {
    if (commentsLoaded) return
    const res = await fetch(`${API}/api/posts/${post.id}/comments`, { headers: ah() })
    if (res.ok) { setComments(await res.json()); setCommentsLoaded(true) }
  }

  const submitComment = async () => {
    if (!commentText.trim()) return
    const res = await fetch(`${API}/api/posts/${post.id}/comments`, {
      method: "POST", headers: jsonH(), body: JSON.stringify({ body: commentText }),
    })
    if (res.ok) { const comment = await res.json(); setComments(prev => [...prev, comment]); setCommentText("") }
  }

  if (post.is_locked) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-950 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
        <div className="relative text-center px-8 space-y-4">
          <div className="size-16 rounded-full bg-zinc-800/80 flex items-center justify-center mx-auto border border-zinc-700">
            <Lock className="size-7 text-zinc-400" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">Time-locked</p>
            <p className="text-zinc-400 text-sm mt-1">
              Unlocks{" "}
              {post.unlock_at
                ? new Date(post.unlock_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "soon"}
            </p>
          </div>
          <p className="text-zinc-500 text-xs">
            From {post.author_name} · {post.group_name}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full relative overflow-hidden bg-black">
      {post.media_type === "video" && post.media_url && (
        <video
          ref={videoRef}
          src={post.media_url}
          loop
          muted={muted}
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          onClick={() => setPlaying(p => !p)}
        />
      )}
      {post.media_type === "image" && post.media_url && (
        <img src={post.media_url} alt="Post" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {post.media_type === "text" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 px-10">
          <p className="text-white text-2xl font-bold text-center leading-snug">{post.caption}</p>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />

      {post.media_type === "video" && (
        <>
          <button
            onClick={() => setPlaying(p => !p)}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-14 rounded-full bg-black/30
                       flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
          >
            {playing
              ? <Pause className="size-6 text-white" />
              : <Play className="size-6 text-white ml-0.5" />}
          </button>
          <button
            onClick={() => setMuted(m => !m)}
            className="absolute top-20 right-4 p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        </>
      )}

      {/* Post info overlay */}
      <div className="absolute bottom-0 left-0 right-16 p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Avatar className="size-8 ring-1 ring-white/30">
            <AvatarImage src={post.author_avatar} className="object-cover" />
            <AvatarFallback className="bg-primary text-white text-xs font-bold">
              {post.author_name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white text-sm font-semibold">{post.author_name}</p>
            <p className="text-white/50 text-xs">{post.group_name}</p>
          </div>
        </div>
        {post.media_type !== "text" && post.caption && (
          <p className="text-white text-sm leading-relaxed">{post.caption}</p>
        )}
        <p className="text-white/40 text-xs">
          {new Date(post.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Action bar */}
      <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5">
        <button onClick={onLike} className="flex flex-col items-center gap-1 cursor-pointer group">
          <Heart
            className={cn(
              "size-6 text-white/80 group-hover:text-white transition-colors",
              post.has_liked && "fill-red-500 text-red-500"
            )}
          />
          {post.like_count > 0 && (
            <span className="text-white/70 text-xs font-medium">{post.like_count}</span>
          )}
        </button>
        <button
          onClick={() => { setShowComments(true); loadComments() }}
          className="flex flex-col items-center gap-1 cursor-pointer group"
        >
          <MessageCircle className="size-6 text-white/80 group-hover:text-white transition-colors" />
          {post.comment_count > 0 && (
            <span className="text-white/70 text-xs font-medium">{post.comment_count}</span>
          )}
        </button>
        {post.author_id === currentUserId && (
          <button
            onClick={() => confirm("Delete this post?") && onDelete()}
            className="cursor-pointer group"
          >
            <Trash2 className="size-5 text-white/50 group-hover:text-red-400 transition-colors" />
          </button>
        )}
      </div>

      {/* Comment drawer */}
      {showComments && (
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-zinc-900/95 backdrop-blur-md rounded-t-3xl flex flex-col border-t border-zinc-800">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <h3 className="text-white font-semibold text-sm">Comments</h3>
            <button
              onClick={() => setShowComments(false)}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
            {comments.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-8">No comments yet.</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <Avatar className="size-7 shrink-0">
                    <AvatarImage src={c.author_avatar} className="object-cover" />
                    <AvatarFallback className="bg-zinc-700 text-white text-xs">
                      {c.author_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-white text-xs font-semibold">{c.author_name}</p>
                    <p className="text-zinc-300 text-sm">{c.body}</p>
                    <p className="text-zinc-600 text-[10px] mt-0.5">
                      {new Date(c.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="px-5 pb-6 pt-3 border-t border-zinc-800 flex gap-3">
            <Input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitComment()}
              placeholder="Add a comment…"
              className="flex-1 bg-zinc-800 border-zinc-700 text-white rounded-xl h-10"
            />
            <Button
              onClick={submitComment}
              size="sm"
              className="bg-primary hover:bg-primary/90 rounded-xl h-10 px-4 cursor-pointer"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
