export const API =
  process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:5000"

export const tok = () => sessionStorage.getItem("token") ?? ""

export const ah = () => ({ Authorization: `Bearer ${tok()}` })

export const jsonH = () => ({ "Content-Type": "application/json", ...ah() })

// ---------------------------------------------------------------------------
// Typed fetch wrapper
// ---------------------------------------------------------------------------

export type ApiOk<T>  = { ok: true;  data: T }
export type ApiErr    = { ok: false; status: number; error: string }
export type ApiResult<T> = ApiOk<T> | ApiErr

/**
 * Typed fetch wrapper used by all V1 routes.
 *
 * - Attaches the Bearer token automatically.
 * - Returns { ok: true, data } on success.
 * - Returns { ok: false, status, error } on HTTP error or network failure.
 * - Returns { ok: true, data: null } for 204 No Content.
 * - Does NOT perform any logout or session clearing on 401 — caller decides.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...ah(),
        ...(options.headers ?? {}),
      },
    })

    if (res.status === 204) {
      return { ok: true, data: null as unknown as T }
    }

    if (res.ok) {
      const data = await res.json() as T
      return { ok: true, data }
    }

    // Non-ok response: try to extract error message from JSON body
    let error = "An error occurred"
    try {
      const body = await res.json()
      if (typeof body?.error === "string") error = body.error
    } catch {
      // Response body is not JSON — keep generic message
    }
    return { ok: false, status: res.status, error }

  } catch {
    // fetch() threw — network failure or CORS preflight blocked
    return { ok: false, status: 0, error: "Network error. Check your connection." }
  }
}
