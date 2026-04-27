import { env } from "@/config/env";
import { clearSession, getAccessToken } from "@/lib/auth/tokenStore";
import { ApiError } from "@/lib/api/error";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const apiPath = normalizedPath.startsWith("/api/")
    ? normalizedPath
    : `/api/v1${normalizedPath}`;

  const base = normalizeBaseUrl(env.NEXT_PUBLIC_API_BASE_URL);
  return `${base}${apiPath}`;
}

async function safeReadJson(res: Response): Promise<unknown | null> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function extractErrorCode(details: unknown): string | undefined {
  if (!details || typeof details !== "object") return undefined;
  if (Array.isArray(details)) return undefined;
  const value = (details as { code?: unknown }).code;
  return typeof value === "string" ? value : undefined;
}

function maybeRedirectVerificationRequired(details: unknown) {
  const code = extractErrorCode(details);
  if (code !== "VERIFICATION_REQUIRED") return;
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/verify") return;

  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const target = `/verify?returnTo=${encodeURIComponent(returnTo)}`;
  window.location.assign(target);
}

function maybeRedirectUnauthorized(status: number, isAuthRequest: boolean) {
  if (!isAuthRequest) return;
  if (status !== 401) return;
  if (typeof window === "undefined") return;

  // Avoid redirect loops if something calls an auth endpoint from /auth/*.
  if (window.location.pathname.startsWith("/auth/")) return;

  clearSession();
  window.location.assign("/auth/sign-in");
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = {}
): Promise<T> {
  const headers = new Headers(init.headers);

  if (options.auth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(buildApiUrl(path), {
      ...init,
      headers,
    });
  } catch (e) {
    const base = env.NEXT_PUBLIC_API_BASE_URL;
    const message = e instanceof Error ? e.message : "Network error";
    throw new ApiError(`Network error contacting API (${base}): ${message}`, {
      status: 0,
    });
  }

  const requestId = res.headers.get("x-request-id") ?? undefined;
  const json = await safeReadJson(res);

  if (!res.ok) {
    const message = (() => {
      if (
        json &&
        typeof json === "object" &&
        json !== null &&
        "error" in json &&
        typeof (json as { error?: unknown }).error === "string"
      ) {
        return (json as { error: string }).error;
      }

      return res.statusText || "Request failed";
    })();

    maybeRedirectVerificationRequired(json);
    maybeRedirectUnauthorized(res.status, Boolean(options.auth));
    const code = extractErrorCode(json);
    throw new ApiError(message, { status: res.status, requestId, details: json, code });
  }

  // Standard envelope: { success: true, data: <payload>, error: null }
  if (json && typeof json === "object" && json !== null && "success" in json) {
    const envJson = json as { success?: unknown; data?: unknown; error?: unknown };

    if (envJson.success === true) {
      return envJson.data as T;
    }

    const message = typeof envJson.error === "string" ? envJson.error : "Request failed";
    maybeRedirectVerificationRequired(json);
    maybeRedirectUnauthorized(res.status, Boolean(options.auth));
    const code = extractErrorCode(json);
    throw new ApiError(message, { status: res.status, requestId, details: json, code });
  }

  return json as T;
}

export async function apiGet<T>(path: string, options?: { auth?: boolean }) {
  return apiFetch<T>(path, { method: "GET" }, options);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: { auth?: boolean }
) {
  return apiFetch<T>(
    path,
    {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    options
  );
}

export async function apiPut<T>(
  path: string,
  body?: unknown,
  options?: { auth?: boolean }
) {
  return apiFetch<T>(
    path,
    {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    options
  );
}

export async function apiDelete<T>(path: string, options?: { auth?: boolean }) {
  return apiFetch<T>(path, { method: "DELETE" }, options);
}
