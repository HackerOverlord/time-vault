/**
 * Upload submission payload tests.
 *
 * Text posts go through apiFetch as JSON. Photo and video posts are sent as
 * multipart/form-data via XMLHttpRequest (for upload progress); the backend
 * streams the file to R2. These tests assert what is actually sent.
 *
 * unlock_at is a plain YYYY-MM-DD string from <input type="date">; the client
 * also sends tz_offset_minutes so the API can judge "tomorrow" in local time.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
// Camera/recorder need real devices; stand-ins expose the "choose a file" path.
vi.mock('@/components/upload/photo-capture', () => ({
  PhotoCapture: ({ onSwitchToFile }: { onSwitchToFile: () => void }) =>
    <button onClick={onSwitchToFile}>Choose photo file</button>,
}))
vi.mock('@/components/upload/video-recorder', () => ({
  VideoRecorder: ({ onSwitchToFile }: { onSwitchToFile: () => void }) =>
    <button onClick={onSwitchToFile}>Choose video file</button>,
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
    expect(body.media_url).toBeUndefined()   // text posts carry no media
    expect(body.unlock_at).toBeNull()
    expect(typeof body.tz_offset_minutes).toBe('number')
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
// Photo / video upload — multipart FormData via XMLHttpRequest
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal XHR stand-in that records what was sent and can complete the upload. */
function stubXhr() {
  const xhr = {
    open: vi.fn(), setRequestHeader: vi.fn(), abort: vi.fn(), send: vi.fn(),
    timeout: 0, status: 0, responseText: '',
    onload: null as null | (() => void),
    onerror: null as null | (() => void),
    ontimeout: null as null | (() => void),
    upload: { addEventListener: vi.fn() },
  }
  vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr))
  return xhr
}

function sentForm(xhr: ReturnType<typeof stubXhr>): FormData {
  expect(xhr.send).toHaveBeenCalled()
  return xhr.send.mock.calls[0][0] as FormData
}

async function chooseFile(user: ReturnType<typeof userEvent.setup>, kind: 'image' | 'video') {
  const file = kind === 'image'
    ? new File([new Uint8Array([0xFF, 0xD8, 0xFF])], 'photo.jpg', { type: 'image/jpeg' })
    : new File([new Uint8Array([0x00, 0x00, 0x00])], 'clip.mp4', { type: 'video/mp4' })
  // Real path: pick Photo/Video, then "choose a file" instead of the camera.
  await user.click(screen.getByRole('button', { name: kind === 'image' ? /share a photo/i : /share a video/i }))
  await user.click(screen.getByRole('button', { name: kind === 'image' ? /choose photo file/i : /choose video file/i }))
  await user.upload(screen.getByLabelText(/select a photo or video/i), file)
  await screen.findByPlaceholderText(/say something/i)
  return file
}

async function setCapsuleDate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /enable time capsule|time capsule/i }))
  const d = new Date(); d.setDate(d.getDate() + 8)
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dateInput = document.getElementById('upload-unlock-date') as HTMLInputElement
  await user.clear(dateInput)
  await user.type(dateInput, iso)
  return iso
}

for (const kind of ['image', 'video'] as const) {
  describe(`UploadModal — ${kind} upload payload`, () => {
    beforeEach(() => {
      vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() })
    })
    afterEach(() => { vi.unstubAllGlobals() })

    it(`sends the ${kind} file itself (not base64) to /api/vaults/<id>/posts`, async () => {
      const xhr = stubXhr()
      const user = userEvent.setup()
      render(<UploadModal {...BASE_PROPS} />)
      const file = await chooseFile(user, kind)

      await user.type(screen.getByPlaceholderText(/say something/i), `my ${kind}`)
      await user.click(screen.getByRole('button', { name: /share now/i }))

      expect(xhr.open).toHaveBeenCalledWith('POST', expect.stringMatching(/\/api\/vaults\/v1\/posts$/))
      const form = sentForm(xhr)
      expect(form.get('media')).toBe(file)
      expect(form.get('media_type')).toBe(kind)
      expect(form.get('caption')).toBe(`my ${kind}`)
      expect(form.get('unlock_at')).toBeNull()
      expect(form.get('media_url')).toBeNull()     // no base64 blob in the body
    })

    it(`${kind} capsule includes unlock_at and tz_offset_minutes`, async () => {
      const xhr = stubXhr()
      const user = userEvent.setup()
      render(<UploadModal {...BASE_PROPS} />)
      await chooseFile(user, kind)
      await user.type(screen.getByPlaceholderText(/say something/i), `capsule ${kind}`)
      const iso = await setCapsuleDate(user)

      await user.click(screen.getByRole('button', { name: /lock.*schedule|share now/i }))

      const form = sentForm(xhr)
      expect(form.get('media_type')).toBe(kind)
      expect(form.get('unlock_at')).toBe(iso)
      expect(form.get('tz_offset_minutes')).toBe(String(new Date().getTimezoneOffset()))
    })
  })
}

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
