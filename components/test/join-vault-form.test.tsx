import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, apiFetch: vi.fn() }
})

import { JoinVaultForm } from '@/components/feed/join-vault-form'
import { apiFetch } from '@/lib/api'

const mockApiFetch = vi.mocked(apiFetch)
const SUCCESS_RESP = { vault: { id: 'v1', name: 'My Vault' }, message: 'Joined' }

const renderForm = (props = {}) => {
  const onJoined = vi.fn().mockResolvedValue(undefined)
  const onClose  = vi.fn()
  render(<JoinVaultForm open onJoined={onJoined} onClose={onClose} {...props} />)
  return { onJoined, onClose }
}

// Use getByRole('textbox') to avoid ambiguity from the sr-only label text
describe('JoinVaultForm', () => {
  it('renders null when open=false', () => {
    const { container } = render(
      <JoinVaultForm open={false} onJoined={vi.fn()} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders invite code input when open', () => {
    renderForm()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('prevents duplicate submission while loading', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockReturnValue(new Promise(() => {}))
    renderForm()

    await user.type(screen.getByRole('textbox'), 'ABC123')
    const confirmBtn = screen.getByRole('button', { name: /confirm join vault/i })
    await user.click(confirmBtn)

    expect(confirmBtn).toBeDisabled()
  })

  it('shows inline error after API failure', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValue({ ok: false, status: 400, error: 'Invalid invite code' })
    renderForm()

    await user.type(screen.getByRole('textbox'), 'XXXXXX')
    await user.click(screen.getByRole('button', { name: /confirm join vault/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid invite code')
  })

  it('preserves the invite code after failure', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValue({ ok: false, status: 400, error: 'Error' })
    renderForm()

    await user.type(screen.getByRole('textbox'), 'BADCOD')
    await user.click(screen.getByRole('button', { name: /confirm join vault/i }))
    await screen.findByRole('alert')

    expect(screen.getByRole('textbox')).toHaveValue('BADCOD')
  })

  it('clears the error when the input is edited', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValue({ ok: false, status: 400, error: 'Error' })
    renderForm()

    await user.type(screen.getByRole('textbox'), 'BAD')
    await user.click(screen.getByRole('button', { name: /confirm join vault/i }))
    await screen.findByRole('alert')

    // Type additional character — onChange fires and clears the error
    await user.type(screen.getByRole('textbox'), 'X')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sets aria-invalid and aria-describedby when error is shown', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValue({ ok: false, status: 400, error: 'Error' })
    renderForm()

    await user.type(screen.getByRole('textbox'), 'BADCOD')
    await user.click(screen.getByRole('button', { name: /confirm join vault/i }))
    await screen.findByRole('alert')

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby')
  })

  it('calls onJoined and onClose after successful submission', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValue({ ok: true, data: SUCCESS_RESP })
    const { onJoined, onClose } = renderForm()

    await user.type(screen.getByRole('textbox'), 'GOODCD')
    await user.click(screen.getByRole('button', { name: /confirm join vault/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onJoined).toHaveBeenCalledWith('v1', 'My Vault')
  })

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderForm()

    await user.click(screen.getByRole('button', { name: /cancel join vault/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
