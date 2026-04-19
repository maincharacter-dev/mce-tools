/**
 * Sprocket API Client (mce-workspace)
 *
 * Thin HTTP client that authenticates with the Sprocket (oe-ai-agent-2) REST API
 * using local auth (username/password → session cookie).
 *
 * Used by the Report Builder to generate section content via the live Sprocket agent.
 */

import { ENV } from "./_core/env";

const COOKIE_NAME = "app_session_id";

let cachedSessionCookie: string | null = null;
let sessionExpiresAt: number = 0;

// ─────────────────────────────────────────────
// Session management
// ─────────────────────────────────────────────

async function login(): Promise<string> {
  const res = await fetch(`${ENV.sprocketUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: ENV.sprocketUsername,
      password: ENV.sprocketPassword,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sprocket login failed (${res.status}): ${body}`);
  }

  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("Sprocket login succeeded but no session cookie returned");

  const match = setCookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) {
    const anyMatch = setCookie.match(/^([^=]+)=([^;]+)/);
    if (!anyMatch) throw new Error("Could not parse session cookie from Sprocket response");
    return `${anyMatch[1]}=${anyMatch[2]}`;
  }

  return `${COOKIE_NAME}=${match[1]}`;
}

async function getSessionCookie(): Promise<string> {
  const now = Date.now();
  if (cachedSessionCookie && now < sessionExpiresAt) {
    return cachedSessionCookie;
  }
  cachedSessionCookie = await login();
  sessionExpiresAt = now + 23 * 60 * 60 * 1000;
  return cachedSessionCookie;
}

// ─────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────

async function sprocketFetch(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<Response> {
  const cookie = await getSessionCookie();

  // 45-second timeout — Sprocket /api/chat can take a while with tool calls,
  // but we don't want to block report generation indefinitely.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let res: Response;
  try {
    res = await fetch(`${ENV.sprocketUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...(options.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401 && !retried) {
    cachedSessionCookie = null;
    sessionExpiresAt = 0;
    return sprocketFetch(path, options, true);
  }

  return res;
}

async function sprocketPost<T>(path: string, body: unknown): Promise<T> {
  const res = await sprocketFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Sprocket POST ${path} failed (${res.status}): ${errBody}`);
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// Sprocket API methods
// ─────────────────────────────────────────────

export interface SprocketChatResponse {
  message: string;
  conversationId: string;
  actions?: unknown[];
}

/**
 * Send a chat message to Sprocket (non-streaming).
 * Optionally inject a system context prefix (e.g. project data summary).
 */
export async function sprocketChat(params: {
  message: string;
  userId?: number;
  conversationId?: string;
  systemContext?: string;
}): Promise<SprocketChatResponse> {
  return sprocketPost<SprocketChatResponse>("/api/chat", {
    message: params.systemContext
      ? `${params.systemContext}\n\n---\n\n${params.message}`
      : params.message,
    userId: params.userId ?? 1,
    conversationId: params.conversationId,
  });
}
