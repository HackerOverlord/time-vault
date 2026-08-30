import type { Post } from "@/lib/types"

/**
 * The set of media-type filter values understood by the feed.
 * "capsule" is not a media_type — it is identified by unlock_at !== null,
 * meaning the post was originally a time capsule (now unlocked).
 */
export type FeedFilter = "all" | "image" | "video" | "text" | "capsule"

/**
 * Pure, independently testable post filter.
 *
 * - Normalises the query once (trim + lowercase).
 * - Empty or whitespace-only query matches everything.
 * - Searches caption (case-insensitive substring) and vault_name.
 * - Applies media-type or capsule filter.
 * - Never mutates the source array.
 * - Handles missing / null captions safely.
 */
export function filterPosts(
  posts: Post[],
  rawQuery: string,
  filter: FeedFilter,
): Post[] {
  const q = rawQuery.trim().toLowerCase()

  return posts.filter(post => {
    // ── Media / type filter ───────────────────────────────────────────────
    if (filter === "image")   { if (post.media_type !== "image")   return false }
    if (filter === "video")   { if (post.media_type !== "video")   return false }
    if (filter === "text")    { if (post.media_type !== "text")    return false }
    // A "capsule" post is any unlocked post that had a non-null unlock_at.
    if (filter === "capsule") { if (!post.unlock_at)               return false }

    // ── Search query ──────────────────────────────────────────────────────
    if (q !== "") {
      const caption = (post.caption ?? "").toLowerCase()
      const vault   = (post.vault_name ?? "").toLowerCase()
      if (!caption.includes(q) && !vault.includes(q)) return false
    }

    return true
  })
}
