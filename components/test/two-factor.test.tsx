import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LoginScreen } from "@/components/screens/login-screen"
import { TwoStepCard } from "@/components/settings/two-step-card"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))

const bodyOf = (i: number) => JSON.parse((vi.mocked(fetch).mock.calls[i][1] as RequestInit).body as string)
const urlOf  = (i: number) => String(vi.mocked(fetch).mock.calls[i][0])

beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); sessionStorage.clear() })
afterEach(() => { vi.unstubAllGlobals() })

async function signIn() {
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "a@b.co" } })
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "pw-123456" } })
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }))
}

describe("Login with 2-step verification", () => {
  it("without 2FA, signs straight in", async () => {
    vi.mocked(fetch).mockReturnValueOnce(json({ token: "access-1" }))
    const nav = vi.fn()
    render(<LoginScreen onNavigate={nav} />)
    await signIn()
    await waitFor(() => expect(nav).toHaveBeenCalledWith("feed"))
    expect(sessionStorage.getItem("token")).toBe("access-1")
  })

  it("with 2FA, asks for the code and only then signs in", async () => {
    vi.mocked(fetch)
      .mockReturnValueOnce(json({ mfa_required: true, mfa_token: "pending-1", email_hint: "a•••@b.co" }))
      .mockReturnValueOnce(json({ token: "access-2" }))
    const nav = vi.fn()
    render(<LoginScreen onNavigate={nav} />)
    await signIn()

    expect(await screen.findByText(/sent a 6-digit code to a•••@b\.co/i)).toBeInTheDocument()
    expect(nav).not.toHaveBeenCalled()
    expect(sessionStorage.getItem("token")).toBeNull()

    fireEvent.change(screen.getByLabelText(/sign-in code/i), { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: /verify/i }))
    await waitFor(() => expect(nav).toHaveBeenCalledWith("feed"))
    expect(urlOf(1)).toMatch(/\/api\/login\/mfa$/)
    expect(bodyOf(1)).toEqual({ mfa_token: "pending-1", code: "123456" })
    expect(sessionStorage.getItem("token")).toBe("access-2")
  })

  it("shows the error for a wrong code and stays on the code step", async () => {
    vi.mocked(fetch)
      .mockReturnValueOnce(json({ mfa_required: true, mfa_token: "p", email_hint: "x" }))
      .mockReturnValueOnce(json({ error: "That code isn't right." }, 401))
    const nav = vi.fn()
    render(<LoginScreen onNavigate={nav} />)
    await signIn()
    fireEvent.change(await screen.findByLabelText(/sign-in code/i), { target: { value: "000000" } })
    fireEvent.click(screen.getByRole("button", { name: /verify/i }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't right/i)
    expect(nav).not.toHaveBeenCalled()
  })

  it("resend swaps in the new pending token", async () => {
    vi.mocked(fetch)
      .mockReturnValueOnce(json({ mfa_required: true, mfa_token: "old", email_hint: "x" }))
      .mockReturnValueOnce(json({ mfa_required: true, mfa_token: "new", email_hint: "x" }))
      .mockReturnValueOnce(json({ token: "access" }))
    render(<LoginScreen onNavigate={vi.fn()} />)
    await signIn()
    fireEvent.click(await screen.findByRole("button", { name: /send a new code/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(bodyOf(1)).toEqual({ mfa_token: "old" })
    fireEvent.change(screen.getByLabelText(/sign-in code/i), { target: { value: "111111" } })
    fireEvent.click(screen.getByRole("button", { name: /verify/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    expect(bodyOf(2).mfa_token).toBe("new")
  })

  it("Back returns to the password form", async () => {
    vi.mocked(fetch).mockReturnValueOnce(json({ mfa_required: true, mfa_token: "p", email_hint: "x" }))
    render(<LoginScreen onNavigate={vi.fn()} />)
    await signIn()
    fireEvent.click(await screen.findByRole("button", { name: /^back$/i }))
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument()
  })
})

describe("Settings: 2-step verification card", () => {
  it("turns on after the emailed code is confirmed", async () => {
    vi.mocked(fetch)
      .mockReturnValueOnce(json({ email_hint: "a•••@b.co" }))
      .mockReturnValueOnce(json({ mfaEnabled: true }))
    const onChange = vi.fn()
    render(<TwoStepCard enabled={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: /turn on/i }))
    fireEvent.change(await screen.findByLabelText(/6-digit code sent to a•••@b\.co/i), { target: { value: "654321" } })
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true))
    expect(urlOf(1)).toMatch(/\/api\/mfa\/enable\/confirm$/)
    expect(bodyOf(1)).toEqual({ code: "654321" })
  })

  it("turning off asks for the password", async () => {
    vi.mocked(fetch).mockReturnValueOnce(json({ error: "Password is incorrect." }, 400))
      .mockReturnValueOnce(json({ mfaEnabled: false }))
    const onChange = vi.fn()
    render(<TwoStepCard enabled onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: /turn off/i }))
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } })
    fireEvent.click(screen.getAllByRole("button", { name: /turn off/i }).at(-1)!)
    expect(await screen.findByRole("alert")).toHaveTextContent(/incorrect/i)
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "right" } })
    fireEvent.click(screen.getAllByRole("button", { name: /turn off/i }).at(-1)!)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false))
  })
})
