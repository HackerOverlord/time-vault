import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('react-image-crop/dist/ReactCrop.css', () => ({}))
vi.mock('react-image-crop', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled} {...p}>{children}</button>
  ),
}))
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, apiFetch: vi.fn() }
})

import { UploadModal } from '@/components/upload/upload-modal'
import { apiFetch } from '@/lib/api'
import { GROUP } from './helpers'

const mockApiFetch = vi.mocked(apiFetch)

const baseProps = {
  groups: [GROUP()],
  groupsStatus: 'success' as const,
  onClose: vi.fn(),
  onPosted: vi.fn(),
}

/** Advance modal from pick step to compose step by clicking "Share a text" */
async function goToComposeStep() {
  const user = userEvent.setup()
  const textBtn = screen.getByRole('button', { name: /share a text/i })
  await user.click(textBtn)
  return user
}

// ── Vault status messages (rendered on compose step) ─────────────────────────
describe('UploadModal — vault status messages', () => {
  it('shows "Create a vault first" when groupsStatus=success and zero vaults', async () => {
    render(<UploadModal {...baseProps} groups={[]} groupsStatus="success" />)
    await goToComposeStep()
    expect(screen.getByText(/create a vault first/i)).toBeInTheDocument()
  })

  it('shows loading message when groupsStatus=loading and zero vaults', async () => {
    render(<UploadModal {...baseProps} groups={[]} groupsStatus="loading" />)
    await goToComposeStep()
    expect(screen.getByText(/loading vaults/i)).toBeInTheDocument()
  })

  it('shows loading message when groupsStatus=idle and zero vaults', async () => {
    render(<UploadModal {...baseProps} groups={[]} groupsStatus="idle" />)
    await goToComposeStep()
    expect(screen.getByText(/loading vaults/i)).toBeInTheDocument()
  })

  it('shows error message when groupsStatus=error and zero vaults', async () => {
    render(<UploadModal {...baseProps} groups={[]} groupsStatus="error" />)
    await goToComposeStep()
    expect(screen.getByText(/vault information couldn't be loaded/i)).toBeInTheDocument()
  })

  it('does not show "Create a vault first" when groupsStatus=error', async () => {
    render(<UploadModal {...baseProps} groups={[]} groupsStatus="error" />)
    await goToComposeStep()
    expect(screen.queryByText(/create a vault first/i)).not.toBeInTheDocument()
  })

  it('shows vault selector when groups loaded successfully', async () => {
    render(<UploadModal {...baseProps} />)
    await goToComposeStep()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('My Vault')).toBeInTheDocument()
  })
})

// ── Submit disabled without valid vault ───────────────────────────────────────
describe('UploadModal — share button state', () => {
  it('disables Share Now when no vault selected (zero groups, success)', async () => {
    render(<UploadModal {...baseProps} groups={[]} groupsStatus="success" />)
    await goToComposeStep()
    const shareBtn = screen.getByRole('button', { name: /share now/i })
    expect(shareBtn).toBeDisabled()
  })
})

// ── Upload failure and retry ──────────────────────────────────────────────────
describe('UploadModal — upload failure and retry', () => {
  it('shows inline error after post failure', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 500, error: 'Server error' })
    render(<UploadModal {...baseProps} />)
    const user = await goToComposeStep()

    await user.type(screen.getByPlaceholderText(/what do you want to say/i), 'A memory')
    await user.click(screen.getByRole('button', { name: /share now/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
  })

  it('changes button label to "Try again" after failure', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 500, error: 'Failed' })
    render(<UploadModal {...baseProps} />)
    const user = await goToComposeStep()

    await user.type(screen.getByPlaceholderText(/what do you want to say/i), 'A memory')
    await user.click(screen.getByRole('button', { name: /share now/i }))
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('allows retry after failure — second attempt can succeed', async () => {
    const onPosted = vi.fn()
    const postedPost = {
      id: 'p1', vault_id: 'v1', author_id: 'u1', author_name: 'Alice',
      caption: 'A memory', media_type: 'text' as const, like_count: 0, comment_count: 0,
      has_liked: false, is_unlocked: true, unlock_at: null, vault_name: 'My Vault',
      created_at: new Date().toISOString(),
    }
    mockApiFetch
      .mockResolvedValueOnce({ ok: false, status: 500, error: 'Temporary error' })
      .mockResolvedValueOnce({ ok: true, data: postedPost })

    render(<UploadModal {...baseProps} onPosted={onPosted} />)
    const user = await goToComposeStep()

    await user.type(screen.getByPlaceholderText(/what do you want to say/i), 'A memory')

    // First attempt fails
    await user.click(screen.getByRole('button', { name: /share now/i }))
    const retryBtn = await screen.findByRole('button', { name: /try again/i })

    // Second attempt succeeds
    await user.click(retryBtn)
    await waitFor(() => expect(onPosted).toHaveBeenCalledWith(postedPost))
  })

  it('preserves caption after failure', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 500, error: 'Error' })
    render(<UploadModal {...baseProps} />)
    const user = await goToComposeStep()

    const captionInput = screen.getByPlaceholderText(/what do you want to say/i)
    await user.type(captionInput, 'My memory')
    await user.click(screen.getByRole('button', { name: /share now/i }))
    await screen.findByRole('alert')

    expect(screen.getByPlaceholderText(/what do you want to say/i)).toHaveValue('My memory')
  })

  it('clears caption only after success, not after failure', async () => {
    const onPosted = vi.fn()
    const postedPost = {
      id: 'p1', vault_id: 'v1', author_id: 'u1', author_name: 'Alice',
      caption: 'My memory', media_type: 'text' as const, like_count: 0, comment_count: 0,
      has_liked: false, is_unlocked: true, unlock_at: null, vault_name: 'My Vault',
      created_at: new Date().toISOString(),
    }
    mockApiFetch
      .mockResolvedValueOnce({ ok: false, status: 500, error: 'Temporary error' })
      .mockResolvedValueOnce({ ok: true, data: postedPost })

    render(<UploadModal {...baseProps} onPosted={onPosted} />)
    const user = await goToComposeStep()

    // 1. Enter a caption
    const captionInput = screen.getByPlaceholderText(/what do you want to say/i)
    await user.type(captionInput, 'My memory')
    expect(captionInput).toHaveValue('My memory')

    // 2. First upload fails
    await user.click(screen.getByRole('button', { name: /share now/i }))

    // 3. Caption remains after failure
    await screen.findByRole('alert')
    expect(captionInput).toHaveValue('My memory')

    // 4. Button changes to "Try again"
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()

    // 5. Second upload succeeds
    await user.click(screen.getByRole('button', { name: /try again/i }))

    // 6. onPosted is called with the post data
    await waitFor(() => expect(onPosted).toHaveBeenCalledWith(postedPost))

    // 7. Error is cleared after success (alert gone)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
