/** Base URL of the FastAPI backend. Set NEXT_PUBLIC_API_URL in .env.local. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Fetches a JSON response from the backend, throwing on non-2xx status. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Error thrown by apiRequest for non-2xx responses. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function detailMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
};

/**
 * Calls the backend from the browser with the HttpOnly auth cookie attached.
 *
 * The X-Requested-With header is required by the API for cookie-authenticated writes
 * (CSRF protection), so always go through this helper for authenticated calls.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Requested-With": "fetch" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const retryAfter = Number(res.headers.get("Retry-After"));
    throw new ApiError(
      res.status,
      detailMessage(body, `Request failed with status ${res.status}`),
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
