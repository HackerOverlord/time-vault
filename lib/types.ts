export interface Group {
  id: string
  name: string
  member_count: number
  created_by: string
  invite_code?: string
}

export interface GroupMember {
  id: string
  user_id: string
  name: string
  email: string
  avatar?: string
  role: "admin" | "member"
}

export interface Post {
  id: string
  author_name: string
  author_avatar?: string
  author_id: string
  group_id: string
  group_name: string
  caption: string
  media_type: "video" | "image" | "text"
  media_url?: string
  unlock_at: string | null
  is_locked: boolean
  created_at: string
  like_count: number
  comment_count: number
  has_liked: boolean
  recipient_ids: string[]
}

export interface Comment {
  id: string
  author_name: string
  author_avatar?: string
  body: string
  created_at: string
}
