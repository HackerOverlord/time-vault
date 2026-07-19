export interface Group {
  id: string
  name: string
  member_count: number
  created_by: string
  invite_code?: string
  user_role: "owner" | "member"
}

export interface GroupMember {
  id: string
  user_id: string
  name: string
  email: string
  avatar?: string
  role: "admin" | "member"
}

// Canonical V1 member shape returned by GET /api/vaults/<id>/members
export interface VaultMember {
  user_id: string
  name: string
  avatar: string | null
  role: "owner" | "member"
  joined_at: string
}

export interface Post {
  id: string
  author_name: string
  author_avatar?: string
  author_id: string
  vault_id: string
  vault_name: string
  caption: string
  media_type: "video" | "image" | "text"
  media_url?: string
  unlock_at: string | null
  is_unlocked: boolean
  created_at: string
  like_count: number
  comment_count: number
  has_liked: boolean
}

export interface Comment {
  id: string
  author_id: string
  author_name: string
  author_avatar?: string
  body: string
  created_at: string
}
