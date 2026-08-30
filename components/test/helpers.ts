/**
 * Test helpers — deterministic fetch mocking utilities.
 * All helpers use vi.mocked(fetch) and require no real network.
 */
import { vi } from 'vitest'

type FetchMock = ReturnType<typeof vi.fn>

/** Build a minimal mock Response */
export function mockResponse(
  body: unknown,
  status = 200,
): Response {
  const json = JSON.stringify(body)
  return new Response(json, {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Return an ok response with the given data */
export const okResp   = (data: unknown) => Promise.resolve(mockResponse(data))
/** Return a 500 server error */
export const errResp  = (status = 500, error = 'Server error') =>
  Promise.resolve(mockResponse({ error }, status))
/** Simulate a network failure */
export const netFail  = () => Promise.reject(new Error('Network error'))

/** Minimal Post fixture */
export const POST = (overrides = {}) => ({
  id: 'p1',
  author_name: 'Alice',
  author_avatar: '',
  author_id: 'u1',
  vault_id: 'v1',
  vault_name: 'My Vault',
  caption: 'Hello world',
  media_type: 'text' as const,
  media_url: undefined,
  unlock_at: null,
  is_unlocked: true,
  created_at: new Date().toISOString(),
  like_count: 0,
  comment_count: 0,
  has_liked: false,
  ...overrides,
})

/** Minimal Group fixture */
export const GROUP = (overrides = {}) => ({
  id: 'v1',
  name: 'My Vault',
  member_count: 1,
  created_by: 'u1',
  invite_code: 'ABC123',
  user_role: 'owner' as const,
  ...overrides,
})

/** Minimal User fixture */
export const USER = () => ({
  id: 'u1',
  name: 'Alice',
  first_name: 'Alice',
  last_name: '',
  email: 'alice@test.com',
  avatar: null,
})

/**
 * Set up fetch to return different responses per URL pattern.
 * Unmatched URLs return 200 with empty array by default.
 */
export function mockFetchSequence(
  fetchMock: FetchMock,
  handlers: Array<(url: string) => Response | Promise<Response> | null>,
) {
  let idx = 0
  fetchMock.mockImplementation((input: string | URL | Request) => {
    const url = input.toString()
    const handler = handlers[idx] ?? handlers[handlers.length - 1]
    idx++
    const result = handler(url)
    return result ?? okResp([])
  })
}

/**
 * Mock fetch based on URL pattern — stable across multiple calls.
 */
export function mockFetchByUrl(
  fetchMock: FetchMock,
  map: Record<string, () => Response | Promise<Response>>,
  fallback: () => Response | Promise<Response> = () => okResp([]),
) {
  fetchMock.mockImplementation((input: string | URL | Request) => {
    const url = input.toString()
    for (const [pattern, handler] of Object.entries(map)) {
      if (url.includes(pattern)) return handler()
    }
    return fallback()
  })
}
