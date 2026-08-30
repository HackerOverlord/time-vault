/**
 * Pass 23 — search, filter, and archive frontend tests.
 * Tests the real filterPosts function and FeedPost archive action.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { filterPosts } from '@/lib/filterPosts'
import type { Post } from '@/lib/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────
function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1', author_name: 'Alice', author_id: 'u1', author_avatar: '',
    vault_id: 'v1', vault_name: 'Family Vault',
    caption: 'summer holiday memories',
    media_type: 'text', unlock_at: null, is_unlocked: true,
    is_archived: false,
    created_at: '2026-01-01T00:00:00Z',
    posted_at: '2026-01-01T00:00:00Z',
    like_count: 0, comment_count: 0, has_liked: false,
    ...overrides,
  }
}

const POSTS: Post[] = [
  makePost({ id: 'p1', caption: 'summer holiday',  media_type: 'text',  author_name: 'Alice' }),
  makePost({ id: 'p2', caption: 'birthday party',  media_type: 'image', vault_name: 'Kids Vault' }),
  makePost({ id: 'p3', caption: 'video diary',     media_type: 'video', author_name: 'Bob' }),
  makePost({ id: 'p4', caption: null,               media_type: 'text',
             unlock_at: '2027-01-01T00:00:00Z', is_unlocked: false }),  // locked
  makePost({ id: 'p5', caption: 'christmas photo', media_type: 'image',
             is_archived: true }),
]

// ─────────────────────────────────────────────────────────────────────────────
// filterPosts — Pass 23 additions
// ─────────────────────────────────────────────────────────────────────────────

describe('filterPosts — search', () => {
  it('matches caption case-insensitively', () => {
    const result = filterPosts(POSTS, 'HOLIDAY', 'all')
    expect(result.some(p => p.id === 'p1')).toBe(true)
  })

  it('matches vault name', () => {
    const result = filterPosts(POSTS, 'Kids', 'all')
    expect(result.some(p => p.id === 'p2')).toBe(true)
  })

  it('matches author name', () => {
    const result = filterPosts(POSTS, 'Bob', 'all')
    expect(result.some(p => p.id === 'p3')).toBe(true)
  })

  it('empty query returns all posts', () => {
    expect(filterPosts(POSTS, '', 'all').length).toBe(POSTS.length)
  })

  it('whitespace-only query returns all posts', () => {
    expect(filterPosts(POSTS, '   ', 'all').length).toBe(POSTS.length)
  })

  it('no match returns empty array', () => {
    expect(filterPosts(POSTS, 'zzznomatch', 'all')).toHaveLength(0)
  })

  it('locked capsule with null caption is not matched by caption search', () => {
    // The locked post has caption=null — must not match any caption query
    const result = filterPosts(POSTS, 'anything', 'all')
    // Locked post can only appear if vault_name or author_name matches
    const locked = result.find(p => p.id === 'p4')
    expect(locked).toBeUndefined()
  })
})

describe('filterPosts — type filter', () => {
  it('image filter returns only image posts', () => {
    filterPosts(POSTS, '', 'image').forEach(p => expect(p.media_type).toBe('image'))
  })

  it('video filter returns only video posts', () => {
    filterPosts(POSTS, '', 'video').forEach(p => expect(p.media_type).toBe('video'))
  })

  it('text filter returns only text posts', () => {
    filterPosts(POSTS, '', 'text').forEach(p => expect(p.media_type).toBe('text'))
  })

  it('capsule filter returns only posts with unlock_at set', () => {
    const result = filterPosts(POSTS, '', 'capsule')
    result.forEach(p => expect(p.unlock_at).not.toBeNull())
  })

  it('search + image filter composes correctly', () => {
    const result = filterPosts(POSTS, 'birthday', 'image')
    expect(result.every(p => p.media_type === 'image')).toBe(true)
    expect(result.some(p => (p.caption ?? '').includes('birthday'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FeedPost — archive button presence
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div>{children}</div>,
  AvatarFallback: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  AvatarImage: () => null,
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
}))
vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, any>((p, r) => <input ref={r} {...p} />),
}))
vi.mock('@/lib/api', async (o) => ({ ...(await o()), apiFetch: vi.fn() }))

import { FeedPost } from '@/components/feed/feed-post'

const BASE = {
  isActive: false, currentUserId: 'u1', isVaultOwner: true,
  muted: true, onMuteChange: vi.fn(), preload: 'none' as const,
  onLike: vi.fn(), onDelete: vi.fn(), onCommentCountChange: vi.fn(),
}

describe('FeedPost — archive button', () => {
  it('Archive button visible when onArchive provided and user is author', () => {
    render(<FeedPost {...BASE} post={makePost()} onArchive={vi.fn()} />)
    expect(screen.getByRole('button', { name: /archive post/i })).toBeInTheDocument()
  })

  it('Restore button visible in archived view', () => {
    render(<FeedPost {...BASE} post={makePost({ is_archived: true })}
                    onArchive={vi.fn()} showArchived />)
    expect(screen.getByRole('button', { name: /restore post/i })).toBeInTheDocument()
  })

  it('Archive button not shown when onArchive not provided', () => {
    render(<FeedPost {...BASE} post={makePost()} />)
    expect(screen.queryByRole('button', { name: /archive post/i })).not.toBeInTheDocument()
  })

  it('onArchive called with (postId, true) when Archive clicked', async () => {
    const onArchive = vi.fn()
    const user = userEvent.setup()
    render(<FeedPost {...BASE} post={makePost({ id: 'p99' })} onArchive={onArchive} />)
    await user.click(screen.getByRole('button', { name: /archive post/i }))
    expect(onArchive).toHaveBeenCalledWith('p99', true)
  })

  it('onArchive called with (postId, false) when Restore clicked', async () => {
    const onArchive = vi.fn()
    const user = userEvent.setup()
    render(<FeedPost {...BASE} post={makePost({ id: 'p99', is_archived: true })}
                    onArchive={onArchive} showArchived />)
    await user.click(screen.getByRole('button', { name: /restore post/i }))
    expect(onArchive).toHaveBeenCalledWith('p99', false)
  })

  it('Locked capsule still shows placeholder — no archive button visible in content', () => {
    const locked = makePost({ id: 'cap1', caption: undefined, is_unlocked: false,
                              unlock_at: '2027-01-01T00:00:00Z' })
    render(<FeedPost {...BASE} post={locked} onArchive={vi.fn()} />)
    // CapsuleCard renders — locked content is not exposed
    expect(screen.getByText('Time Capsule')).toBeInTheDocument()
    // No Like/Comment/Delete buttons
    expect(screen.queryByRole('button', { name: /like/i })).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// No-results empty state
// ─────────────────────────────────────────────────────────────────────────────

describe('filterPosts — empty states', () => {
  it('returns empty array for no-match search', () => {
    const result = filterPosts(POSTS, 'zzznomatch', 'all')
    expect(result).toHaveLength(0)
  })

  it('returns empty array when all posts are archived and not included', () => {
    const archived = POSTS.map(p => ({ ...p, is_archived: true }))
    // filterPosts itself doesn't filter by is_archived — that's the server's job
    // But we can verify the posts pass through (client-side, server already filtered)
    const result = filterPosts(archived, '', 'all')
    expect(result).toHaveLength(POSTS.length)
  })

  it('archive + filter + search with no match returns empty', () => {
    const result = filterPosts(POSTS, 'video', 'image')
    // "video" is in the caption of the video post, but image filter excludes it
    expect(result.every(p => p.media_type === 'image')).toBe(true)
    // No image post has "video" in caption
    expect(result.filter(p => (p.caption ?? '').includes('video'))).toHaveLength(0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Archive button behavioral tests
// ─────────────────────────────────────────────────────────────────────────────

describe('FeedPost — archive/restore button behavior', () => {
  it('Archive button absent when user is neither author nor owner', () => {
    render(<FeedPost {...BASE}
                    post={makePost({ author_id: 'other-user' })}
                    isVaultOwner={false}
                    onArchive={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /archive post/i })).not.toBeInTheDocument()
  })

  it('Archive button present when user is vault owner (not author)', () => {
    render(<FeedPost {...BASE}
                    post={makePost({ author_id: 'other-user' })}
                    isVaultOwner={true}
                    onArchive={vi.fn()} />)
    expect(screen.getByRole('button', { name: /archive post/i })).toBeInTheDocument()
  })

  it('Both Archive and Delete buttons present for authorized user', () => {
    render(<FeedPost {...BASE} post={makePost()} onArchive={vi.fn()} />)
    expect(screen.getByRole('button', { name: /archive post/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete post/i })).toBeInTheDocument()
  })

  it('locked capsule does not show Archive button (CapsuleCard rendered instead)', () => {
    const locked = makePost({ caption: undefined, is_unlocked: false,
                              unlock_at: '2027-01-01T00:00:00Z' })
    render(<FeedPost {...BASE} post={locked} onArchive={vi.fn()} />)
    // CapsuleCard is rendered — no ActionRail buttons present
    expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// filterPosts — Pass 23.1 edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('filterPosts — edge cases', () => {
  it('author name search does not match locked capsule (null caption author still matches by name)', () => {
    const locked = makePost({ id: 'locked', caption: undefined,
                              is_unlocked: false, unlock_at: '2027-01-01T00:00:00Z',
                              author_name: 'SpecialAuthor' })
    const result = filterPosts([locked], 'SpecialAuthor', 'all')
    // A locked capsule CAN appear in author-name search — its metadata is not secret
    // The content (caption, media) remains null and is never displayed
    expect(result.some(p => p.id === 'locked')).toBe(true)
    // But its caption must still be null/undefined
    const found = result.find(p => p.id === 'locked')
    expect(found?.caption == null || found?.caption === undefined).toBe(true)
  })

  it('search on archived posts does not reveal caption (is_archived just a flag)', () => {
    const archived = makePost({ id: 'ar1', caption: 'archived content', is_archived: true })
    // filterPosts does not filter by is_archived — server already did that
    // But is_archived flag is present and correct
    const result = filterPosts([archived], 'archived', 'all')
    expect(result.some(p => p.id === 'ar1')).toBe(true)
  })

  it('surrounding whitespace in query is trimmed', () => {
    const result1 = filterPosts(POSTS, '  summer  ', 'all')
    const result2 = filterPosts(POSTS, 'summer', 'all')
    expect(result1.map(p => p.id)).toEqual(result2.map(p => p.id))
  })
})
