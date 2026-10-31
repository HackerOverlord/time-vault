import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ForgotPasswordScreen, ResetPasswordScreen } from "@/components/screens/password-reset-screens"
import { LoginScreen } from "@/components/screens/login-screen"

const okJson = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))

beforeEach(() => { vi.stubGlobal("fetch", vi.fn()) })
afterEach(() => { vi.unstubAllGlobals() })

describe("Login screen", () => {
  it("links to forgot password", () => {
    const nav = vi.fn()
    render(<LoginScreen onNavigate={nav} />)
    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }))
    expect(nav).toHaveBeenCalledWith("forgot")
  })
})

describe("ForgotPasswordScreen", () => {
  it("posts the email and shows the generic confirmation", async () => {
    vi.mocked(fetch).mockReturnValue(okJson({ message: "ok" }))
    render(<ForgotPasswordScreen onNavigate={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "me@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }))

    await screen.findByText(/check your email/i)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toMatch(/\/api\/forgot-password$/)
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ email: "me@example.com" })
  })
})

describe("ResetPasswordScreen", () => {
  it("blocks mismatched passwords without calling the API", () => {
    render(<ResetPasswordScreen token="tok" onNavigate={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: "longenough1" } })
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "different11" } })
    fireEvent.click(screen.getByRole("button", { name: /update password/i }))
    expect(screen.getByRole("alert")).toHaveTextContent(/don't match/i)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("sends token + new password and returns to sign in on success", async () => {
    vi.mocked(fetch).mockReturnValue(okJson({ message: "ok" }))
    const nav = vi.fn()
    render(<ResetPasswordScreen token="tok123" onNavigate={nav} />)
    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: "longenough1" } })
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "longenough1" } })
    fireEvent.click(screen.getByRole("button", { name: /update password/i }))

    await waitFor(() => expect(nav).toHaveBeenCalledWith("login"))
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ token: "tok123", new_password: "longenough1" })
  })

  it("shows the server error and offers a new link when the token is bad", async () => {
    vi.mocked(fetch).mockReturnValue(okJson({ error: "This reset link is invalid or has expired." }, 400))
    const nav = vi.fn()
    render(<ResetPasswordScreen token="bad" onNavigate={nav} />)
    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: "longenough1" } })
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "longenough1" } })
    fireEvent.click(screen.getByRole("button", { name: /update password/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/i)
    fireEvent.click(screen.getByRole("button", { name: /request a new link/i }))
    expect(nav).toHaveBeenCalledWith("forgot")
  })
})
