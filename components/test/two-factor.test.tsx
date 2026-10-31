import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LoginScreen } from "@/components/screens/login-screen"
import { TwoStepCard, type MfaState } from "@/components/settings/two-step-card"
import { TwoStepPrompt } from "@/components/settings/two-step-prompt"
import { ResetPasswordScreen } from "@/components/screens/password-reset-screens"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(() => Promise.resolve("data:image/png;base64,QR")) } }))

const OFF: MfaState = { enabled: false, method: null, codesLeft: 0 }
const RC = ["aaaaa-bbbbb", "ccccc-ddddd", "eeeee-fffff", "ggggg-hhhhh", "jjjjj-kkkkk",
            "mmmmm-nnnnn", "ppppp-qqqqq", "rrrrr-sssss", "ttttt-uuuuu", "vvvvv-wwwww"]

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
    render(<TwoStepCard state={OFF} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: /email me a code/i }))
    fireEvent.change(await screen.findByLabelText(/6-digit code sent to a•••@b\.co/i), { target: { value: "654321" } })
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ enabled: true, method: "email", codesLeft: 0 }))
    expect(urlOf(1)).toMatch(/\/api\/mfa\/enable\/confirm$/)
    expect(bodyOf(1)).toEqual({ code: "654321" })
  })

  it("turning off asks for the password", async () => {
    vi.mocked(fetch).mockReturnValueOnce(json({ error: "Password is incorrect." }, 400))
      .mockReturnValueOnce(json({ mfaEnabled: false }))
    const onChange = vi.fn()
    render(<TwoStepCard state={{ enabled: true, method: "email", codesLeft: 0 }} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: /turn off/i }))
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } })
    fireEvent.click(screen.getAllByRole("button", { name: /turn off/i }).at(-1)!)
    expect(await screen.findByRole("alert")).toHaveTextContent(/incorrect/i)
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "right" } })
    fireEvent.click(screen.getAllByRole("button", { name: /turn off/i }).at(-1)!)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(OFF))
  })

  it("authenticator set-up: QR + key, confirm, then recovery codes must be saved", async () => {
    vi.mocked(fetch)
      .mockReturnValueOnce(json({ secret: "JBSWY3DPEHPK3PXP", otpauth_uri: "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP" }))
      .mockReturnValueOnce(json({ error: "That code isn't right." }, 400))
      .mockReturnValueOnce(json({ mfaEnabled: true, mfaMethod: "totp", recovery_codes: RC }))
    const onChange = vi.fn(); const onFinished = vi.fn()
    render(<TwoStepCard state={OFF} onChange={onChange} onFinished={onFinished} />)
    fireEvent.click(screen.getByRole("button", { name: /authenticator app/i }))

    expect(await screen.findByAltText(/qr code/i)).toHaveAttribute("src", "data:image/png;base64,QR")
    expect(screen.getByTestId("totp-secret")).toHaveTextContent("JBSW Y3DP EHPK 3PXP")
    expect(urlOf(0)).toMatch(/\/api\/mfa\/totp\/setup$/)

    fireEvent.change(screen.getByLabelText(/code from the app/i), { target: { value: "000000" } })
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't right/i)
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/code from the app/i), { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }))
    const list = await screen.findByTestId("recovery-codes")
    expect(list.querySelectorAll("li")).toHaveLength(10)
    expect(bodyOf(2)).toEqual({ code: "123456" })
    expect(onChange).toHaveBeenCalledWith({ enabled: true, method: "totp", codesLeft: 10 })

    // "Done" stays disabled until they confirm they saved the codes.
    const done = screen.getByRole("button", { name: /^done$/i })
    expect(done).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/saved these codes/i))
    fireEvent.click(done)
    expect(onFinished).toHaveBeenCalled()
  })

  it("new recovery codes need the password", async () => {
    vi.mocked(fetch).mockReturnValueOnce(json({ recovery_codes: RC }))
    const onChange = vi.fn()
    render(<TwoStepCard state={{ enabled: true, method: "totp", codesLeft: 1 }} onChange={onChange} />)
    expect(screen.getByText(/1 recovery code left/i)).toBeInTheDocument()
    expect(screen.getByText(/running low/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /new recovery codes/i }))
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pw" } })
    fireEvent.click(screen.getByRole("button", { name: /make new codes/i }))
    expect(await screen.findByTestId("recovery-codes")).toBeInTheDocument()
    expect(urlOf(0)).toMatch(/\/api\/mfa\/recovery-codes$/)
    expect(bodyOf(0)).toEqual({ password: "pw" })
    expect(onChange).toHaveBeenCalledWith({ enabled: true, method: "totp", codesLeft: 10 })
  })
})

describe("Login with an authenticator app", () => {
  it("asks for the app code; no email resend; can switch to a recovery code", async () => {
    vi.mocked(fetch)
      .mockReturnValueOnce(json({ mfa_required: true, mfa_token: "p", method: "totp" }))
      .mockReturnValueOnce(json({ token: "access", recovery_codes_left: 9 }))
    const nav = vi.fn()
    render(<LoginScreen onNavigate={nav} />)
    await signIn()
    expect(await screen.findByText(/enter your app code/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /send a new code/i })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /use a recovery code/i }))
    fireEvent.change(screen.getByLabelText(/recovery code/i), { target: { value: "aaaaa-bbbbb" } })
    fireEvent.click(screen.getByRole("button", { name: /verify/i }))
    await waitFor(() => expect(nav).toHaveBeenCalledWith("feed"))
    expect(bodyOf(1)).toEqual({ mfa_token: "p", code: "aaaaa-bbbbb" })
    const { toast } = await import("sonner")
    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/9 left/))
  })
})

describe("Reset password with an authenticator app", () => {
  it("reveals the code field when the server asks, then sends it", async () => {
    vi.mocked(fetch)
      .mockReturnValueOnce(json({ error: "Enter a code…", mfa_code_required: true }, 403))
      .mockReturnValueOnce(json({ message: "ok" }))
    const nav = vi.fn()
    render(<ResetPasswordScreen token="t" onNavigate={nav} />)
    fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: "new-password-1" } })
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "new-password-1" } })
    fireEvent.click(screen.getByRole("button", { name: /update password/i }))
    const codeField = await screen.findByLabelText(/authenticator app/i)
    expect(screen.queryByRole("alert")).toBeNull()        // first time: just ask, no error
    fireEvent.change(codeField, { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: /update password/i }))
    await waitFor(() => expect(nav).toHaveBeenCalledWith("login"))
    expect(bodyOf(1)).toEqual({ token: "t", new_password: "new-password-1", code: "123456" })
  })
})

describe("One-time prompt after sign-up", () => {
  it("shows for a new account; Maybe later remembers the choice", async () => {
    vi.mocked(fetch)
      .mockReturnValueOnce(json({ mfaEnabled: false, mfaPromptDismissed: false }))
      .mockReturnValueOnce(json({ mfaPromptDismissed: true }))
    render(<TwoStepPrompt />)
    expect(await screen.findByRole("dialog", { name: /protect your memories/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /authenticator app/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /email me a code/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /maybe later/i }))
    expect(screen.queryByRole("dialog")).toBeNull()
    await waitFor(() => expect(urlOf(1)).toMatch(/\/api\/me\/mfa-prompt\/dismiss$/))
  })

  it("stays hidden once dismissed or when 2FA is already on", async () => {
    vi.mocked(fetch).mockReturnValueOnce(json({ mfaEnabled: false, mfaPromptDismissed: true }))
    const { unmount } = render(<TwoStepPrompt />)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole("dialog")).toBeNull()
    unmount()
    vi.mocked(fetch).mockReturnValueOnce(json({ mfaEnabled: true, mfaPromptDismissed: false }))
    render(<TwoStepPrompt />)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
