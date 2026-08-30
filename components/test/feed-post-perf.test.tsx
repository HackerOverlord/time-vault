/**
 * Pass 17 behavioral tests — image loading attributes and video playback.
 * Tests what the browser API surface sees, not internal React state.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mocks required by FeedPost ─────────────────────────────────────────────
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/avatar', () => ({
  Avatar:         ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  AvatarImage:    () => null,
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled} {...p}>{children}</button>
  ),
}))
vi.mock('@/components/ui/input', () => ({
  Input: (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} />,
}))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, apiFetch: vi.fn() }
})

import { FeedPost } from '@/components/feed/feed-post'
import type { Post } from '@/lib/types'

// ── Fixtures ───────────────────────────────────────────────────────────────
const IMAGE_POST = (overrides: Partial<Post> = {}): Post => ({
  id: 'p1',
  author_id: 'u1',
  author_name: 'Alice',
  author_avatar: '',
  vault_id: 'v1',
  vault_name: 'My Vault',
  caption: 'Test caption',
  media_type: 'image',
  media_url: 'https://example.com/photo.jpg',
  unlock_at: null,
  is_unlocked: true,
  created_at: new Date().toISOString(),
  like_count: 0,
  comment_count: 0,
  has_liked: false,
  ...overrides,
})

const VIDEO_POST = (overrides: Partial<Post> = {}): Post => ({
  ...IMAGE_POST(),
  id: 'p2',
  media_type: 'video',
  media_url: 'https://example.com/video.mp4',
  ...overrides,
})

const TEXT_POST = (): Post => ({
  ...IMAGE_POST(),
  id: 'p3',
  media_type: 'text',
  media_url: undefined,
})

const BASE_PROPS = {
  currentUserId: 'u1',
  isVaultOwner: false,
  muted: true,
  onMuteChange: vi.fn(),
  onLike: vi.fn(),
  onDelete: vi.fn(),
  onCommentCountChange: vi.fn(),
}

const renderPost = (post: Post, isActive: boolean, preload: "auto" | "metadata" | "none" = "none") =>
  render(<FeedPost {...BASE_PROPS} post={post} isActive={isActive} preload={preload} />)

// ─────────────────────────────────────────────────────────────────────────────
describe('FeedPost — image loading attributes', () => {
  it('active image post uses eager loading', () => {
    renderPost(IMAGE_POST(), true, 'auto')
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('loading', 'eager')
  })

  it('active image post has high fetch priority', () => {
    renderPost(IMAGE_POST(), true, 'auto')
    const img = screen.getByRole('img')
    // fetchPriority is reflected as the attribute fetchpriority in the DOM
    expect(img).toHaveAttribute('fetchpriority', 'high')
  })

  it('inactive image post uses lazy loading', () => {
    renderPost(IMAGE_POST(), false, 'none')
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('inactive image post does not have high fetch priority', () => {
    renderPost(IMAGE_POST(), false, 'none')
    const img = screen.getByRole('img')
    expect(img).not.toHaveAttribute('fetchpriority', 'high')
  })

  it('image has accessible alt text derived from post data', () => {
    renderPost(IMAGE_POST({ caption: 'Sunset over the lake' }), true, 'auto')
    expect(screen.getByAltText('Sunset over the lake')).toBeInTheDocument()
  })

  it('image falls back to author/vault alt text when caption is absent', () => {
    renderPost(IMAGE_POST({ caption: undefined }), true, 'auto')
    const img = screen.getByRole('img')
    expect(img.getAttribute('alt')).toMatch(/alice/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('FeedPost — video playback behavior', () => {
  // jsdom does not implement HTMLMediaElement.play/pause natively.
  // The setup.ts file mocks them globally as vi.fn().
  // We verify that the component calls the correct browser API,
  // not that media actually plays.

  it('inactive video is paused (play is not called)', async () => {
    renderPost(VIDEO_POST(), false, 'none')
    const video = document.querySelector('video') as HTMLVideoElement
    // play() should not have been called for an inactive post
    await waitFor(() => {
      expect(video.play).not.toHaveBeenCalled()
    })
  })

  it('active video calls play() when reduced motion is not set', async () => {
    // Ensure matchMedia reports no reduced motion preference
    ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
      matches: false,   // prefers-reduced-motion: no preference
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    renderPost(VIDEO_POST(), true, 'auto')
    const video = document.querySelector('video') as HTMLVideoElement

    await waitFor(() => {
      expect(video.play).toHaveBeenCalled()
    })
  })

  it('active video does not autoplay when reduced motion is set', async () => {
    // matchMedia reports prefers-reduced-motion: reduce
    ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
      matches: query.includes('reduced-motion'),  // true for reduced-motion query
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    renderPost(VIDEO_POST(), true, 'auto')
    const video = document.querySelector('video') as HTMLVideoElement

    // Give effects time to run
    await act(async () => {})

    // play() may have been attempted but pause() should have also been called,
    // resulting in the video being paused.
    // Since reducedMotion suppresses shouldPlay, pause() is called instead.
    expect(video.pause).toHaveBeenCalled()
  })

  it('text post does not render a video element', () => {
    renderPost(TEXT_POST(), true, 'auto')
    expect(document.querySelector('video')).toBeNull()
  })
})
