import { apiBaseUrl } from "@/lib/env"

/**
 * Typed fetch client for the ResolveAI API.
 *
 * - The access token is held in memory only (never localStorage), which keeps
 *   it out of reach of persistent XSS payloads. Sessions are restored through
 *   the HttpOnly refresh cookie.
 * - A 401 triggers a single refresh attempt and one retry of the original call.
 * - Errors are normalised to `ApiError` from the backend envelope
 *   `{ code, message, details, request_id }`.
 */
export interface ApiErrorBody {
  code?: string
  message?: string
  details?: unknown
  request_id?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  readonly requestId?: string

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    requestId?: string
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }

  get isUnauthorized() {
    return this.status === 401
  }

  get isForbidden() {
    return this.status === 403
  }

  get isNotFound() {
    return this.status === 404
  }
}

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

type RefreshHandler = () => Promise<string | null>

let refreshHandler: RefreshHandler | null = null
let refreshInFlight: Promise<string | null> | null = null

/** Registered by the auth provider; must refresh the cookie and return a token. */
export function setRefreshHandler(handler: RefreshHandler | null) {
  refreshHandler = handler
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

export interface ApiRequestOptions {
  method?: HttpMethod
  body?: unknown
  signal?: AbortSignal
  headers?: Record<string, string>
  /** Skip the Authorization header (used by login/register/refresh). */
  skipAuth?: boolean
  /** Sent as `Idempotency-Key` for create operations that support it. */
  idempotencyKey?: string
}

async function send<T>(path: string, options: ApiRequestOptions, allowRetry: boolean): Promise<T> {
  const headers = new Headers({ Accept: "application/json", ...options.headers })
  if (options.body !== undefined) headers.set("Content-Type", "application/json")
  if (accessToken && !options.skipAuth) headers.set("Authorization", `Bearer ${accessToken}`)
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey)

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "include",
      signal: options.signal,
    })
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Unable to reach the ResolveAI API. Check that the backend is running."
    )
  }

  if (response.status === 401 && allowRetry && !options.skipAuth && refreshHandler) {
    refreshInFlight = refreshInFlight ?? refreshHandler().finally(() => {
      refreshInFlight = null
    })
    const token = await refreshInFlight
    if (token) return send<T>(path, options, false)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let payload: unknown
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const body = (payload && typeof payload === "object" ? payload : {}) as ApiErrorBody
    throw new ApiError(
      response.status,
      body.code ?? `http_${response.status}`,
      body.message ?? response.statusText ?? "Request failed",
      body.details,
      body.request_id
    )
  }

  return payload as T
}

export function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return send<T>(path, options, true)
}

// ── Server-sent events ─────────────────────────────────────

/** One `event: frame` payload from the chat stream. */
export interface SseFrame {
  type: string
  [key: string]: unknown
}

async function openStream(
  path: string,
  options: ApiRequestOptions,
  allowRetry: boolean
): Promise<Response> {
  const headers = new Headers({ Accept: "text/event-stream", ...options.headers })
  if (options.body !== undefined) headers.set("Content-Type", "application/json")
  if (accessToken && !options.skipAuth) headers.set("Authorization", `Bearer ${accessToken}`)

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? "POST",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "include",
      signal: options.signal,
    })
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error
    throw new ApiError(
      0,
      "network_error",
      "Unable to reach the ResolveAI API. Check that the backend is running."
    )
  }

  if (response.status === 401 && allowRetry && !options.skipAuth && refreshHandler) {
    refreshInFlight = refreshInFlight ?? refreshHandler().finally(() => {
      refreshInFlight = null
    })
    const token = await refreshInFlight
    if (token) return openStream(path, options, false)
  }

  if (!response.ok) {
    const text = await response.text()
    let payload: unknown
    try {
      payload = text ? JSON.parse(text) : undefined
    } catch {
      payload = text
    }
    const body = (payload && typeof payload === "object" ? payload : {}) as ApiErrorBody
    throw new ApiError(
      response.status,
      body.code ?? `http_${response.status}`,
      body.message ?? response.statusText ?? "Request failed",
      body.details,
      body.request_id
    )
  }

  return response
}

/** Parse one SSE block into a frame; ignores comments and heartbeat events. */
export function parseSseBlock(block: string): SseFrame | null {
  const event = /^event:\s*(.+)$/m.exec(block)?.[1]?.trim()
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")

  if (!data || (event && event !== "frame")) return null
  try {
    const parsed = JSON.parse(data) as unknown
    if (parsed && typeof parsed === "object" && typeof (parsed as SseFrame).type === "string") {
      return parsed as SseFrame
    }
  } catch {
    // A malformed frame must not kill the stream; the server also sends `done`.
  }
  return null
}

/**
 * Consume an SSE endpoint as an async iterator.
 *
 * Frames arrive as `event: frame` + a JSON `data:` line. The reader is released
 * when the caller stops early or the request is aborted.
 */
export async function* apiStream(
  path: string,
  options: ApiRequestOptions = {}
): AsyncGenerator<SseFrame> {
  const response = await openStream(path, options, true)
  if (!response.body) {
    throw new ApiError(0, "stream_unavailable", "The server did not return a stream")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n")

      let boundary = buffer.indexOf("\n\n")
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const frame = parseSseBlock(block)
        if (frame) yield frame
        boundary = buffer.indexOf("\n\n")
      }
    }

    const tail = parseSseBlock(buffer)
    if (tail) yield tail
  } finally {
    reader.releaseLock()
  }
}
