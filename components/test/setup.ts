import '@testing-library/jest-dom'
import { vi, afterEach, beforeEach } from 'vitest'

// ── Global fetch mock ─────────────────────────────────────────────────────────
global.fetch = vi.fn()

// ── HTMLMediaElement ──────────────────────────────────────────────────────────
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})
Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn(),
})

// ── window.matchMedia ─────────────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ── IntersectionObserver ──────────────────────────────────────────────────────
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe:    vi.fn(),
  unobserve:  vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof IntersectionObserver

// ── ResizeObserver ────────────────────────────────────────────────────────────
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe:    vi.fn(),
  unobserve:  vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof ResizeObserver

// ── Element.prototype.scrollIntoView ─────────────────────────────────────────
Element.prototype.scrollIntoView = vi.fn()

// ── navigator.onLine ─────────────────────────────────────────────────────────
Object.defineProperty(navigator, 'onLine', {
  configurable: true,
  writable:     true,
  value:        true,
})

beforeEach(() => {
  sessionStorage.setItem('token', 'test-token')
  ;(navigator as unknown as { onLine: boolean }).onLine = true
})

afterEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

// URL object URL stubs — jsdom does not implement these
if (!(URL as any).createObjectURL) {
  (URL as any).createObjectURL = () => "blob:stub"
  URL.revokeObjectURL = () => {}
}
