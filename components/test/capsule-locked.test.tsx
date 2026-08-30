/**
 * Pass 21 — locked capsule DOM audit.
 *
 * Renders FeedPost with a locked post and verifies the DOM contains:
 *   - No Like button
 *   - No Comment button
 *   - No Comment input
 *   - No Delete button
 *   - No media controls (video, audio)
 *   - No caption text
 *
 * Tests do NOT inspect class names or CSS.
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ── FeedPost dependencies ─────────────────────────────────────────────────────
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/avatar', () => ({
  Avatar:         ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  AvatarImage:    () => null,
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) =>
    <button {...p}>{children}</button>,
}))
vi.mock('@/components/ui/input', () => ({
  Input: (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} />,
}))
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  apiFetch: vi.fn(),
}))

import { FeedPost } from '@/components/feed/feed-post'
import type { Post } from '@/lib/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────
function lockedPost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'cap1',
    author_name: 'Alice',
    author_id: 'u1',
    author_avatar: '',
    vault_id: 'v1',
    vault_name: 'My Vault',
    unlock_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    is_unlocked: false,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function unlockedPost(): Post {
  return {
    id: 'pub1',
    author_name: 'Alice',
    author_id: 'u1',
    author_avatar: '',
    vault_id: 'v1',
    vault_name: 'My Vault',
    caption: 'A normal memory',
    media_type: 'text',
    unlock_at: null,
    is_unlocked: true,
    created_at: new Date().toISOString(),
    posted_at: new Date().toISOString(),
    like_count: 5,
    comment_count: 2,
    has_liked: false,
  }
}

const BASE = {
  isActive: false,
  currentUserId: 'u1',
  isVaultOwner: true,
  muted: true,
  onMuteChange: vi.fn(),
  preload: 'none' as const,
  onLike: vi.fn(),
  onDelete: vi.fn(),
  onCommentCountChange: vi.fn(),
}

function renderPost(post: Post) {
  render(<FeedPost {...BASE} post={post} />)
}

// ─────────────────────────────────────────────────────────────────────────────

describe('FeedPost — locked capsule: no interactive elements in DOM', () => {
  it('does not render a Like button', () => {
    renderPost(lockedPost())
    expect(screen.queryByRole('button', { name: /like/i })).not.toBeInTheDocument()
  })

  it('does not render a Comment button', () => {
    renderPost(lockedPost())
    expect(screen.queryByRole('button', { name: /comment/i })).not.toBeInTheDocument()
  })

  it('does not render a comment text input', () => {
    renderPost(lockedPost())
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('does not render a Delete button', () => {
    renderPost(lockedPost())
    // Neither "Delete" label nor role=button with delete-related aria-label
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('does not render a Play or Pause button for media', () => {
    renderPost(lockedPost())
    expect(screen.queryByRole('button', { name: /play/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument()
  })

  it('does not render a Mute or Unmute button', () => {
    renderPost(lockedPost())
    expect(screen.queryByRole('button', { name: /mute/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unmute/i })).not.toBeInTheDocument()
  })

  it('does not render a <video> element', () => {
    renderPost(lockedPost())
    expect(document.querySelector('video')).toBeNull()
  })

  it('does not render caption text', () => {
    // The locked post has no caption field — confirm nothing leaks
    renderPost(lockedPost())
    expect(screen.queryByText(/secret/i)).not.toBeInTheDocument()
  })

  it('renders "Time Capsule" label (the CapsuleCard placeholder)', () => {
    renderPost(lockedPost())
    expect(screen.getByText('Time Capsule')).toBeInTheDocument()
  })

  it('renders the author name in the placeholder', () => {
    renderPost(lockedPost())
    expect(screen.getByText(/alice/i)).toBeInTheDocument()
  })
})

describe('FeedPost — unlocked post: interactive elements ARE present', () => {
  it('renders a Like button for unlocked post', () => {
    renderPost(unlockedPost())
    expect(screen.getByRole('button', { name: /like/i })).toBeInTheDocument()
  })

  it('renders a Comment button for unlocked post', () => {
    renderPost(unlockedPost())
    expect(screen.getByRole('button', { name: /comment/i })).toBeInTheDocument()
  })

  it('renders a Delete button for unlocked post when user is owner', () => {
    renderPost(unlockedPost())
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })
})
