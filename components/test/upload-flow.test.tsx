/**
 * Pass 21 — upload submission payload tests.
 *
 * The UploadModal reads files via FileReader.readAsDataURL and submits JSON
 * (not FormData). These tests assert the actual JSON body sent to apiFetch.
 *
 * Multipart/FormData: the production implementation does NOT use FormData for
 * post uploads — it encodes media as a base64 data URI in the JSON body.
 * Tests verify the base64 data URI is present for image and video uploads.
 *
 * The unlock_at field is a plain YYYY-MM-DD string from <input type="date">,
 * sent as-is to the backend (no local→UTC conversion in the client).
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) =>
    <button {...p}>{children}</button>,
}))
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) =>
    <label htmlFor={htmlFor}>{children}</label>,
}))
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  apiFetch: vi.fn(),
}))

import { UploadModal } from '@/components/upload/upload-modal'
import { apiFetch } from '@/lib/api'
import type { Post } from '@/lib/types'

const mockApiFetch = vi.mocked(apiFetch)

// ── Fixtures ──────────────────────────────────────────────────────────────────
const GROUP = { id: 'v1', name: 'My Vault', member_count: 1,
                created_by: 'u1', user_role: 'owner' as const }

// Mock FileReader so readAsDataURL fires in jsdom.
// The upload modal does: reader.onload = ...; reader.readAsDataURL(file)
// We capture the instance and fire onload via setTimeout so the assignment
// has already happened by the time the callback runs.
function mockFileReader(mimeType: string) {
  const dataUri = `data:${mimeType};base64,AAAA`
  vi.stubGlobal('FileReader', vi.fn().mockImplementation(function(this: any) {
    this.result  = dataUri
    this.onload  = null
    this.onerror = null
    this.readAsDataURL = () => {
      // Defer so the caller can set .onload before we fire it
      setTimeout(() => { if (this.onload) this.onload() }, 0)
    }
  }))
  return dataUri
}

const POSTED_POST: Post = {
  id: 'p1', author_name: 'Alice', author_id: 'u1', author_avatar: '',
  vault_id: 'v1', vault_name: 'My Vault',
  caption: 'hello', media_type: 'text',
  unlock_at: null, is_unlocked: true,
  created_at: new Date().toISOString(),
  posted_at: new Date().toISOString(),
  like_count: 0, comment_count: 0, has_liked: false,
}

const BASE_PROPS = {
  isOpen: true, onClose: vi.fn(), onPosted: vi.fn(),
  groups: [GROUP], groupsStatus: 'success' as const,
}

// Go from the pick step to the compose step by clicking the text option
async function pickText(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /share a text/i }))
}

// Get the submitted JSON body from the most recent apiFetch call
function lastBody(): Record<string, unknown> {
  const calls = mockApiFetch.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  const [, opts] = calls[calls.length - 1]
  return JSON.parse((opts?.body as string) ?? '{}')
}

// ─────────────────────────────────────────────────────────────────────────────
// Text post — baseline
// ─────────────────────────────────────────────────────────────────────────────

describe('UploadModal — text post payload', () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({ ok: true, data: POSTED_POST })
  })

  it('sends correct media_type, caption, and null unlock_at', async () => {
    const user = userEvent.setup()
    render(<UploadModal {...BASE_PROPS} />)
    await pickText(user)

    await user.type(screen.getByPlaceholderText(/what do you want to say/i), 'hello world')
    await user.click(screen.getByRole('button', { name: /share now/i }))

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    const body = lastBody()
    expect(body.media_type).toBe('text')
    expect(body.caption).toBe('hello world')
    expect(body.media_url).toBeNull()
    expect(body.unlock_at).toBeNull()
  })

  it('POSTs to /api/vaults/<id>/posts', async () => {
    const user = userEvent.setup()
    render(<UploadModal {...BASE_PROPS} />)
    await pickText(user)

    await user.type(screen.getByPlaceholderText(/what do you want to say/i), 'test')
    await user.click(screen.getByRole('button', { name: /share now/i }))

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    const [path] = mockApiFetch.mock.calls[0]
    expect(path).toMatch(/\/api\/vaults\/v1\/posts/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Image upload — base64 data URI in JSON body
// ─────────────────────────────────────────────────────────────────────────────

describe('UploadModal — image upload payload', () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({ ok: true, data: POSTED_POST })
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('image file is submitted as base64 data URI in media_url', async () => {
    const expectedUri = mockFileReader('image/jpeg')
    const user = userEvent.setup()
    render(<UploadModal {...BASE_PROPS} />)

    const file = new File([new Uint8Array([0xFF, 0xD8])], 'photo.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText(/select a photo or video/i)
    await user.upload(fileInput, file)

    // Wait for FileReader.onload → setMediaData → setStep("compose")
    await screen.findByPlaceholderText(/say something|what do you want to say/i)

    await user.type(screen.getByPlaceholderText(/say something|what do you want to say/i), 'my photo')
    await user.click(screen.getByRole('button', { name: /share now/i }))

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    const body = lastBody()
    expect(body.media_type).toBe('image')
    expect(body.caption).toBe('my photo')
    expect(body.media_url).toBe(expectedUri)
    expect((body.media_url as string).startsWith('data:image/')).toBe(true)
    expect(body.unlock_at).toBeNull()
  })

  it('image capsule includes unlock_at in payload', async () => {
    const user = userEvent.setup()
    render(<UploadModal {...BASE_PROPS} />)

    mockFileReader('image/jpeg')
    const file = new File([new Uint8Array([0xFF, 0xD8])], 'photo.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText(/select a photo or video/i)
    await user.upload(fileInput, file)

    await screen.findByPlaceholderText(/say something|what do you want to say/i)

    await user.type(screen.getByPlaceholderText(/say something|what do you want to say/i), 'capsule photo')

    // Enable time capsule
    await user.click(screen.getByRole('button', { name: /enable time capsule|time capsule/i }))

    const future = new Date(Date.now() + 8 * 24 * 3600 * 1000)
    const futureISO = future.toISOString().split('T')[0]
    const dateInput = document.getElementById('upload-unlock-date') as HTMLInputElement
    await user.clear(dateInput)
    await user.type(dateInput, futureISO)

    await user.click(screen.getByRole('button', { name: /lock.*schedule|share now/i }))

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    const body = lastBody()
    expect(body.media_type).toBe('image')
    expect(body.unlock_at).toBe(futureISO)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Video upload — base64 data URI in JSON body
// ─────────────────────────────────────────────────────────────────────────────

describe('UploadModal — video upload payload', () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({ ok: true, data: POSTED_POST })
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('video file submitted as base64 data URI with correct media_type', async () => {
    const user = userEvent.setup()
    render(<UploadModal {...BASE_PROPS} />)

    const expectedUri = mockFileReader('video/mp4')
    const file = new File([new Uint8Array([0x00, 0x00, 0x00])], 'clip.mp4', { type: 'video/mp4' })

    const fileInput = screen.getByLabelText(/select a photo or video/i)
    await user.upload(fileInput, file)

    await screen.findByPlaceholderText(/say something|what do you want to say/i)

    await user.type(screen.getByPlaceholderText(/say something|what do you want to say/i), 'my video')
    await user.click(screen.getByRole('button', { name: /share now/i }))

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    const body = lastBody()
    expect(body.media_type).toBe('video')
    expect(body.caption).toBe('my video')
    expect(body.media_url).toBe(expectedUri)
    expect((body.media_url as string).startsWith('data:video/')).toBe(true)
    expect(body.unlock_at).toBeNull()
  })

  it('video capsule includes unlock_at in payload', async () => {
    const user = userEvent.setup()
    render(<UploadModal {...BASE_PROPS} />)

    mockFileReader('video/mp4')
    const file = new File([new Uint8Array([0x00, 0x00, 0x00])], 'clip.mp4', { type: 'video/mp4' })
    const fileInput = screen.getByLabelText(/select a photo or video/i)
    await user.upload(fileInput, file)

    await screen.findByPlaceholderText(/say something|what do you want to say/i)

    await user.type(screen.getByPlaceholderText(/say something|what do you want to say/i), 'capsule video')
    await user.click(screen.getByRole('button', { name: /enable time capsule|time capsule/i }))

    const future = new Date(Date.now() + 8 * 24 * 3600 * 1000)
    const futureISO = future.toISOString().split('T')[0]
    const dateInput = document.getElementById('upload-unlock-date') as HTMLInputElement
    await user.clear(dateInput)
    await user.type(dateInput, futureISO)

    await user.click(screen.getByRole('button', { name: /lock.*schedule|share now/i }))

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    const body = lastBody()
    expect(body.media_type).toBe('video')
    expect(body.unlock_at).toBe(futureISO)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// unlock_at field — date validation
// ─────────────────────────────────────────────────────────────────────────────

describe('UploadModal — unlock_at date field', () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({ ok: true, data: POSTED_POST })
  })

  it('empty unlock field submits null unlock_at', async () => {
    const user = userEvent.setup()
    render(<UploadModal {...BASE_PROPS} />)
    await pickText(user)

    await user.type(screen.getByPlaceholderText(/what do you want to say/i), 'hello')
    // Do NOT enable the capsule toggle — leave unlock date empty
    await user.click(screen.getByRole('button', { name: /share now/i }))

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    expect(lastBody().unlock_at).toBeNull()
  })

  it('future date submitted as YYYY-MM-DD string matching the input value', async () => {
    const user = userEvent.setup()
    render(<UploadModal {...BASE_PROPS} />)
    await pickText(user)

    await user.type(screen.getByPlaceholderText(/what do you want to say/i), 'future')
    await user.click(screen.getByRole('button', { name: /enable time capsule|time capsule/i }))

    const future = new Date(Date.now() + 10 * 24 * 3600 * 1000)
    const futureISO = future.toISOString().split('T')[0]
    const dateInput = document.getElementById('upload-unlock-date') as HTMLInputElement
    await user.clear(dateInput)
    await user.type(dateInput, futureISO)

    await user.click(screen.getByRole('button', { name: /lock.*schedule|share now/i }))

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    // The submitted unlock_at must equal exactly the value the user typed
    expect(lastBody().unlock_at).toBe(futureISO)
  })

  it('past date blocked — no API call, error shown', async () => {
    const user = userEvent.setup()
    render(<UploadModal {...BASE_PROPS} />)
    await pickText(user)

    await user.type(screen.getByPlaceholderText(/what do you want to say/i), 'past')
    await user.click(screen.getByRole('button', { name: /enable time capsule|time capsule/i }))

    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0]
    const dateInput = document.getElementById('upload-unlock-date') as HTMLInputElement
    await user.clear(dateInput)
    await user.type(dateInput, yesterday)

    await user.click(screen.getByRole('button', { name: /lock.*schedule|share now/i }))

    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('capsule enabled but no date — blocked, no API call', async () => {
    const user = userEvent.setup()
    render(<UploadModal {...BASE_PROPS} />)
    await pickText(user)

    await user.type(screen.getByPlaceholderText(/what do you want to say/i), 'no date')
    await user.click(screen.getByRole('button', { name: /enable time capsule|time capsule/i }))
    // Do not fill in a date

    await user.click(screen.getByRole('button', { name: /lock.*schedule|share now/i }))

    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
