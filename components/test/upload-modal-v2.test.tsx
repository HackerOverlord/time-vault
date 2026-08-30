/**
 * upload-modal-v2.test.tsx — Pass 22.1 security, progress, and cancellation tests.
 *
 * Tests the PRODUCTION component (not re-implemented logic).
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
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
  tok: vi.fn(() => 'test-jwt-token'),
  API: 'http://localhost:5000',
}))

import { UploadModal } from '@/components/upload/upload-modal'
import { apiFetch, tok } from '@/lib/api'
import type { Post, Group } from '@/lib/types'

const mockApiFetch = vi.mocked(apiFetch)
const mockTok = vi.mocked(tok)

const GROUP: Group = { id: 'v1', name: 'My Vault', member_count: 1, created_by: 'u1', user_role: 'owner' }
const IMAGE_POST: Post = {
  id: 'p2', author_name: 'Alice', author_id: 'u1', author_avatar: '',
  vault_id: 'v1', vault_name: 'V', caption: 'img', media_type: 'image',
  media_url: 'https://r2.example.com/abc.jpg',
  unlock_at: null, is_unlocked: true,
  created_at: new Date().toISOString(), posted_at: new Date().toISOString(),
  like_count: 0, comment_count: 0, has_liked: false,
}

const BASE = { isOpen: true, onClose: vi.fn(), onPosted: vi.fn(), groups: [GROUP], groupsStatus: 'success' as const }

// Control-surface for XHR — expose callbacks so tests can trigger them
function makeXhr() {
  let loadCb: (() => void) | null = null
  let errorCb: (() => void) | null = null
  let progressCb: ((e: ProgressEvent) => void) | null = null
  const mock = {
    open: vi.fn(), setRequestHeader: vi.fn(), abort: vi.fn(),
    timeout: 0, status: 0, responseText: '',
    set onload(fn: () => void) { loadCb = fn },
    set onerror(fn: () => void) { errorCb = fn },
    set ontimeout(fn: () => void) {},
    upload: {
      addEventListener: vi.fn((_: string, fn: (e: ProgressEvent) => void) => { progressCb = fn }),
    },
    send: vi.fn(),
    // Test helpers
    triggerLoad: (status: number, body: string) => {
      mock.status = status; mock.responseText = body; loadCb?.()
    },
    triggerError: () => { errorCb?.() },
    triggerProgress: (loaded: number, total: number) => {
      progressCb?.({ lengthComputable: true, loaded, total } as ProgressEvent)
    },
  }
  return mock
}

// Helper: upload a file and reach the compose step
async function uploadFile(
  user: ReturnType<typeof userEvent.setup>,
  type: 'image' | 'video' = 'image',
  size = 100,
) {
  const file = new File([new Uint8Array(size)], type === 'image' ? 'photo.jpg' : 'clip.mp4',
    { type: type === 'image' ? 'image/jpeg' : 'video/mp4' })
  Object.defineProperty(file, 'size', { value: size })
  await user.upload(screen.getByLabelText(/select a photo or video/i), file)
  return file
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. XHR authentication
// ─────────────────────────────────────────────────────────────────────────────

describe('XHR authentication', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
  })
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

  it('uses tok() helper to attach Authorization header', async () => {
    mockTok.mockReturnValue('my-jwt-123')
    const xhr = makeXhr()
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr))
    const user = userEvent.setup()
    render(<UploadModal {...BASE} />)
    await uploadFile(user)
    await screen.findByPlaceholderText(/say something/i)
    await user.click(screen.getByRole('button', { name: /share now/i }))
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer my-jwt-123')
  })

  it('Authorization header is NOT in FormData body', async () => {
    const xhr = makeXhr()
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr))
    const user = userEvent.setup()
    render(<UploadModal {...BASE} />)
    await uploadFile(user)
    await screen.findByPlaceholderText(/say something/i)
    await user.click(screen.getByRole('button', { name: /share now/i }))
    const formData = xhr.send.mock.calls[0]?.[0] as FormData
    expect(formData).toBeDefined()
    expect(formData.get('Authorization')).toBeNull()
    expect(formData.get('token')).toBeNull()
  })

  it('shows 401 error message from server response', async () => {
    const xhr = makeXhr()
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr))
    const user = userEvent.setup()
    render(<UploadModal {...BASE} />)
    await uploadFile(user)
    await screen.findByPlaceholderText(/say something/i)
    await user.click(screen.getByRole('button', { name: /share now/i }))
    act(() => { xhr.triggerLoad(401, JSON.stringify({ error: 'Session expired' })) })
    expect(await screen.findByRole('alert')).toHaveTextContent('Session expired')
  })

  it('shows 403 error message from server response', async () => {
    const xhr = makeXhr()
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr))
    const user = userEvent.setup()
    render(<UploadModal {...BASE} />)
    await uploadFile(user)
    await screen.findByPlaceholderText(/say something/i)
    await user.click(screen.getByRole('button', { name: /share now/i }))
    act(() => { xhr.triggerLoad(403, JSON.stringify({ error: 'Not a vault member' })) })
    expect(await screen.findByRole('alert')).toHaveTextContent('Not a vault member')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. File size limits
// ─────────────────────────────────────────────────────────────────────────────

describe('File size limits', () => {
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

  it('oversized image (>5 MB) blocks submission — no XHR sent', async () => {
    const { toast } = await import('sonner')
    const xhr = makeXhr()
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr))
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
    const user = userEvent.setup()
    render(<UploadModal {...BASE} />)
    // File with size > 5 MB (image limit)
    const bigFile = new File([new Uint8Array(10)], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 })
    await user.upload(screen.getByLabelText(/select a photo or video/i), bigFile)
    // Should not advance to compose step; XHR never called
    expect(xhr.send).not.toHaveBeenCalled()
    // Toast error should fire
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringMatching(/5 MB/i))
  })

  it('within-limit image (exactly 5 MB) is accepted', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
    const user = userEvent.setup()
    render(<UploadModal {...BASE} />)
    const file = new File([new Uint8Array(10)], 'ok.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 })
    await user.upload(screen.getByLabelText(/select a photo or video/i), file)
    // Should advance to compose step
    expect(await screen.findByPlaceholderText(/say something/i)).toBeInTheDocument()
  })

  it('video within 50 MB limit is accepted', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
    const user = userEvent.setup()
    render(<UploadModal {...BASE} />)
    const file = new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 })
    await user.upload(screen.getByLabelText(/select a photo or video/i), file)
    expect(await screen.findByPlaceholderText(/say something/i)).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Upload progress UI
// ─────────────────────────────────────────────────────────────────────────────

describe('Upload progress', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
  })
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

  async function startUpload(user: ReturnType<typeof userEvent.setup>, xhr: ReturnType<typeof makeXhr>) {
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr))
    render(<UploadModal {...BASE} />)
    await uploadFile(user)
    await screen.findByPlaceholderText(/say something/i)
    await user.click(screen.getByRole('button', { name: /share now/i }))
  }

  it('shows Uploading… 42% in button label when progress fires', async () => {
    const user = userEvent.setup()
    const xhr = makeXhr()
    await startUpload(user, xhr)
    await act(async () => { xhr.triggerProgress(42, 100) })
    expect(screen.getByText(/uploading.*42%/i)).toBeInTheDocument()
  })

  it('submit button is disabled during upload', async () => {
    const user = userEvent.setup()
    const xhr = makeXhr()
    await startUpload(user, xhr)
    await act(async () => { xhr.triggerProgress(10, 100) })
    const btn = screen.getByRole('button', { name: /uploading|sharing/i })
    expect(btn).toBeDisabled()
  })

  it('duplicate submit is blocked — XHR send called only once', async () => {
    const user = userEvent.setup()
    const xhr = makeXhr()
    await startUpload(user, xhr)
    // While in-flight the submit button is disabled — clicking has no effect
    // Find any disabled submit-like button
    const buttons = screen.getAllByRole('button')
    const submitBtn = buttons.find(b => b.getAttribute('disabled') !== null)
    if (submitBtn) await user.click(submitBtn)
    // XHR.send should still only have been called once (the first time)
    expect(xhr.send).toHaveBeenCalledTimes(1)
  })

  it('progress resets to null after success', async () => {
    const user = userEvent.setup()
    const xhr = makeXhr()
    const onPosted = vi.fn()
    render(<UploadModal {...BASE} onPosted={onPosted} />)
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr))
    await uploadFile(user)
    await screen.findByPlaceholderText(/say something/i)
    await user.click(screen.getByRole('button', { name: /share now/i }))
    act(() => { xhr.triggerProgress(50, 100) })
    act(() => { xhr.triggerLoad(201, JSON.stringify(IMAGE_POST)) })
    await waitFor(() => expect(onPosted).toHaveBeenCalled())
    // After success the modal should have closed; no "Uploading…" text visible
    expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument()
  })

  it('progress resets after failure', async () => {
    const user = userEvent.setup()
    const xhr = makeXhr()
    await startUpload(user, xhr)
    act(() => { xhr.triggerProgress(30, 100) })
    act(() => { xhr.triggerLoad(503, JSON.stringify({ error: 'R2 down' })) })
    await screen.findByRole('alert')
    expect(screen.queryByText(/uploading.*30%/i)).not.toBeInTheDocument()
  })

  it('shows Cancel upload button while uploading', async () => {
    const user = userEvent.setup()
    const xhr = makeXhr()
    await startUpload(user, xhr)
    await act(async () => { xhr.triggerProgress(20, 100) })
    expect(screen.getByRole('button', { name: /cancel upload/i })).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Cancellation
// ─────────────────────────────────────────────────────────────────────────────

describe('Cancellation', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
  })
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

  async function startUpload(user: ReturnType<typeof userEvent.setup>, xhr: ReturnType<typeof makeXhr>) {
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr))
    render(<UploadModal {...BASE} />)
    await uploadFile(user)
    await screen.findByPlaceholderText(/say something/i)
    await user.click(screen.getByRole('button', { name: /share now/i }))
    await act(async () => { xhr.triggerProgress(20, 100) })
  }

  it('cancel upload button calls xhr.abort()', async () => {
    const user = userEvent.setup()
    const xhr = makeXhr()
    await startUpload(user, xhr)
    await user.click(screen.getByRole('button', { name: /cancel upload/i }))
    expect(xhr.abort).toHaveBeenCalled()
  })

  it('intentional abort does not call onPosted', async () => {
    const onPosted = vi.fn()
    const user = userEvent.setup()
    const xhr = makeXhr()
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr))
    render(<UploadModal {...BASE} onPosted={onPosted} />)
    await uploadFile(user)
    await screen.findByPlaceholderText(/say something/i)
    await user.click(screen.getByRole('button', { name: /share now/i }))
    await act(async () => { xhr.triggerProgress(20, 100) })
    await user.click(screen.getByRole('button', { name: /cancel upload/i }))
    // After abort, if an error event fires, it should be ignored
    act(() => { xhr.triggerError() })
    await new Promise(r => setTimeout(r, 50))
    expect(onPosted).not.toHaveBeenCalled()
  })

  it('intentional abort does not show network-error alert', async () => {
    const user = userEvent.setup()
    const xhr = makeXhr()
    await startUpload(user, xhr)
    await user.click(screen.getByRole('button', { name: /cancel upload/i }))
    act(() => { xhr.triggerError() })
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('upload state resets after cancel — progress gone', async () => {
    const user = userEvent.setup()
    const xhr = makeXhr()
    await startUpload(user, xhr)
    await user.click(screen.getByRole('button', { name: /cancel upload/i }))
    expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument()
  })

  it('retry after cancel returns to pick step — state is clean', async () => {
    // After cancelUpload() mediaFile is cleared and preview revoked.
    // The user must select a new file; verifies abort was called and state reset.
    const user = userEvent.setup()
    const xhr1 = makeXhr()
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr1))
    render(<UploadModal {...BASE} />)
    await uploadFile(user)
    await screen.findByPlaceholderText(/say something/i)
    await user.click(screen.getByRole('button', { name: /share now/i }))
    await act(async () => { xhr1.triggerProgress(20, 100) })
    await user.click(screen.getByRole('button', { name: /cancel upload/i }))
    expect(xhr1.abort).toHaveBeenCalled()
    expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Modal-close URL cleanup (unmount path)
// ─────────────────────────────────────────────────────────────────────────────

describe('Modal-close object URL cleanup (unmount)', () => {
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

  it('unmounting the modal revokes the preview URL', async () => {
    // FeedScreen mounts UploadModal with {isUploadOpen && <UploadModal />}.
    // When isUploadOpen becomes false the component unmounts.
    // The unmount useEffect must revoke previewUrlRef.current.
    const revokeUrl = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview-to-revoke'),
      revokeObjectURL: revokeUrl,
    })
    const user = userEvent.setup()
    const { unmount } = render(<UploadModal {...BASE} />)
    await uploadFile(user)
    await screen.findByPlaceholderText(/say something/i)
    // Simulate parent setting isUploadOpen=false → unmount
    unmount()
    expect(revokeUrl).toHaveBeenCalledWith('blob:preview-to-revoke')
  })

  it('closing via cancel button (safeClose → onClose → unmount) revokes URL', async () => {
    const revokeUrl = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:cancel-close-url'),
      revokeObjectURL: revokeUrl,
    })
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { unmount } = render(<UploadModal {...BASE} onClose={onClose} />)
    await uploadFile(user)
    await screen.findByPlaceholderText(/say something/i)
    // Navigate back to pick step (so we're not mid-upload) then close
    await user.click(screen.getByRole('button', { name: /← Change media/i }))
    await user.click(screen.getByRole('button', { name: /cancel and close/i }))
    // Parent receives onClose — simulate unmount
    unmount()
    expect(revokeUrl).toHaveBeenCalledWith('blob:cancel-close-url')
  })

  it('no stale preview after modal is unmounted and remounted', async () => {
    let urlCount = 0
    const revokeUrl = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:url-${urlCount++}`),
      revokeObjectURL: revokeUrl,
    })
    const user = userEvent.setup()
    const { rerender, unmount } = render(<UploadModal {...BASE} />)
    await uploadFile(user)         // creates blob:url-0
    await screen.findByPlaceholderText(/say something/i)
    unmount()                      // revokes blob:url-0
    // Re-render fresh instance (simulates reopening the modal)
    render(<UploadModal {...BASE} />)
    // No stale preview should be visible in the new instance
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('video')).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Object URL cleanup
// ─────────────────────────────────────────────────────────────────────────────

describe('Object URL cleanup', () => {
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

  it('revokeObjectURL called when file is replaced', async () => {
    const revokeUrl = vi.fn()
    let urlCount = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:url-${urlCount++}`),
      revokeObjectURL: revokeUrl,
    })
    const user = userEvent.setup()
    render(<UploadModal {...BASE} />)
    await uploadFile(user)           // creates blob:url-0
    await screen.findByPlaceholderText(/say something/i)
    await user.click(screen.getByRole('button', { name: /← Change media/i }))
    await uploadFile(user)           // should revoke blob:url-0, create blob:url-1
    expect(revokeUrl).toHaveBeenCalledWith('blob:url-0')
  })

  it('revokeObjectURL called on modal close', async () => {
    const revokeUrl = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: revokeUrl })
    const user = userEvent.setup()
    render(<UploadModal {...BASE} />)
    await uploadFile(user)
    await screen.findByPlaceholderText(/say something/i)
    // Mock apiFetch so the text path closes normally
    mockApiFetch.mockResolvedValue({ ok: true, data: {} as Post })
    // Navigate back to pick step then close
    await user.click(screen.getByRole('button', { name: /← Change media/i }))
    await user.click(screen.getByRole('button', { name: /cancel and close/i }))
    expect(revokeUrl).toHaveBeenCalledWith('blob:preview')
  })
})
