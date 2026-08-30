// Accent color palette — stored as a CSS variable name for simplicity.
// The backend stores this as a string field on the Vault model.
export type VaultAccentColor = "blue" | "green" | "purple" | "orange" | "rose" | "slate"

export interface Group {
  id: string
  name: string
  member_count: number
  created_by: string
  invite_code?: string
  user_role: "owner" | "member"
  // Optional vault identity fields (Pass 18)
  cover_url?: string | null
  description?: string | null
  accent_color?: VaultAccentColor | null
  // Pass 21: child vault fields
  vault_type?: "normal" | "child"
  child_email?: string | null
  claimed_at?: string | null
  claimed_by_user_id?: string | null
  claimed_by?: { id: string; display_name: string; avatar: string | null } | null
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

/**
 * A Post returned by GET /api/posts.
 *
 * When is_unlocked is false the server returns a strict minimum payload.
 * Fields marked optional below are absent from locked payloads.
 * Always check is_unlocked before reading optional fields.
 */
export interface Post {
  id: string
  author_name: string
  author_avatar?: string
  author_id: string
  vault_id: string
  vault_name: string
  created_at: string
  unlock_at: string | null
  is_unlocked: boolean
  // Archive state — present on both locked and unlocked posts
  is_archived?: boolean
  // Present only when is_unlocked is true
  caption?: string | null
  media_type?: "video" | "image" | "text"
  media_url?: string
  posted_at?: string | null
  like_count?: number
  comment_count?: number
  has_liked?: boolean
}

export interface Comment {
  id: string
  author_id: string
  author_name: string
  author_avatar?: string
  body: string
  created_at: string
}

export type NotificationType =
  | "comment_received"
  | "member_joined"
  | "member_left"
  | "member_added"
  | "member_removed"
  | "capsule_unlocked"
  | "new_post"
  | "post_liked"
  | "vault_sent"
  | "vault_received"
  | "vault_deleted"
  | "vault_claimed"
  | "claim_invite_created"
  | "family_joined"
  | "family_left"
  | (string & {})   // forward-compat: unknown types degrade gracefully

export interface Notification {
  id: string
  type: NotificationType
  message: string
  is_read: boolean
  created_at: string
  vault_id?: string | null
}
