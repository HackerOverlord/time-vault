/**
 * Pass 21 — CreateVaultForm tests (replaces the Pass 16 version).
 * Tests both the original normal-vault behavior and the new child-vault fields.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, apiFetch: vi.fn() }
})

import { CreateVaultForm } from '@/components/feed/create-vault-form'
import { apiFetch } from '@/lib/api'
import type { Group } from '@/lib/types'

const mockApiFetch = vi.mocked(apiFetch)

const VAULT: Group = {
  id: 'v1', name: 'Test Vault', member_count: 1,
  created_by: 'u1', user_role: 'owner',
}

function renderForm(props = {}) {
  const onCreated = vi.fn()
  const onClose   = vi.fn()
  render(<CreateVaultForm open onCreated={onCreated} onClose={onClose} {...props} />)
  return { onCreated, onClose }
}

// ── Normal vault behavior (preserved from Pass 16) ────────────────────────────

describe('CreateVaultForm — normal vault (Family Vault)', () => {
  it('renders null when open=false', () => {
    const { container } = render(
      <CreateVaultForm open={false} onCreated={vi.fn()} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('Family Vault is selected by default', () => {
    renderForm()
    const familyRadio = screen.getByRole('radio', { name: /family vault/i })
    expect(familyRadio).toBeChecked()
  })

  it('child email field is hidden initially', () => {
    renderForm()
    expect(screen.queryByLabelText(/child.*email/i)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/child.*email/i)).not.toBeInTheDocument()
  })

  it('calls onCreated and onClose on successful submission', async () => {
    mockApiFetch.mockResolvedValue({ ok: true, data: VAULT })
    const user = userEvent.setup()
    const { onCreated, onClose } = renderForm()
    await user.type(screen.getByLabelText(/vault name/i), 'My Vault')
    await user.click(screen.getByRole('button', { name: /confirm create vault/i }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(VAULT))
    expect(onClose).toHaveBeenCalled()
  })

  it('normal vault sends name without child_email', async () => {
    mockApiFetch.mockResolvedValue({ ok: true, data: VAULT })
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText(/vault name/i), 'Family')
    await user.click(screen.getByRole('button', { name: /confirm create vault/i }))
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    const [, opts] = mockApiFetch.mock.calls[0]
    const body = JSON.parse((opts?.body as string) ?? '{}')
    expect(body.vault_type).toBe('normal')
    expect(body.child_email).toBeUndefined()
  })

  it('shows error after API failure', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 500, error: 'Already exists' })
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText(/vault name/i), 'Test')
    await user.click(screen.getByRole('button', { name: /confirm create vault/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Already exists')
  })

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderForm()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('validates empty vault name without calling API', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: /confirm create vault/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(mockApiFetch).not.toHaveBeenCalled()
  })
})

// ── Child vault behavior (Pass 21) ────────────────────────────────────────────

describe('CreateVaultForm — child vault', () => {
  it('selecting Child Vault shows the child email field', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('radio', { name: /child vault/i }))
    expect(screen.getByPlaceholderText(/child.*email/i)).toBeInTheDocument()
  })

  it('child email field is required — blocks submission without it', async () => {
    mockApiFetch.mockResolvedValue({ ok: true, data: VAULT })
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('radio', { name: /child vault/i }))
    await user.type(screen.getByLabelText(/vault name/i), 'Kids Vault')
    await user.click(screen.getByRole('button', { name: /confirm create vault/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('sends correct request body for child vault', async () => {
    mockApiFetch.mockResolvedValue({ ok: true, data: VAULT })
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('radio', { name: /child vault/i }))
    await user.type(screen.getByLabelText(/vault name/i), 'Alice Vault')
    await user.type(screen.getByPlaceholderText(/child.*email/i), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: /confirm create vault/i }))
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    const [, opts] = mockApiFetch.mock.calls[0]
    const body = JSON.parse((opts?.body as string) ?? '{}')
    expect(body.vault_type).toBe('child')
    expect(body.child_email).toBe('alice@example.com')
    expect(body.name).toBe('Alice Vault')
  })

  it('switching back to Family Vault hides email field', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('radio', { name: /child vault/i }))
    expect(screen.getByPlaceholderText(/child.*email/i)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /family vault/i }))
    expect(screen.queryByPlaceholderText(/child.*email/i)).not.toBeInTheDocument()
  })

  it('switching back to Family Vault omits child_email from request', async () => {
    mockApiFetch.mockResolvedValue({ ok: true, data: VAULT })
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('radio', { name: /child vault/i }))
    await user.type(screen.getByPlaceholderText(/child.*email/i), 'alice@example.com')
    await user.click(screen.getByRole('radio', { name: /family vault/i }))
    await user.type(screen.getByLabelText(/vault name/i), 'Back to Normal')
    await user.click(screen.getByRole('button', { name: /confirm create vault/i }))
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    const [, opts] = mockApiFetch.mock.calls[0]
    const body = JSON.parse((opts?.body as string) ?? '{}')
    expect(body.vault_type).toBe('normal')
    expect(body.child_email).toBeUndefined()
  })
})
