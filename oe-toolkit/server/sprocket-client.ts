/**
 * Sprocket API Client
 *
 * Thin HTTP client that authenticates with the Sprocket (oe-ai-agent-2) REST API
 * using local auth (username/password → session cookie) and proxies requests
 * from OE Toolkit's tRPC layer to Sprocket's REST endpoints.
 *
 * Sprocket runs at SPROCKET_URL with LOCAL_AUTH=true.
 */

import { ENV } from "./_core/env";

const COOKIE_NAME = "app_session_id"; // Sprocket's actual session cookie name

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

  // Extract session cookie from Set-Cookie header
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("Sprocket login succeeded but no session cookie returned");

  // Parse the cookie value
  const match = setCookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) {
    // Try any cookie value if name doesn't match
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
  // Cache for 23 hours (Sprocket sessions last 1 year but we refresh daily)
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

  const res = await fetch(`${ENV.sprocketUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(options.headers ?? {}),
    },
  });

  // If 401, clear cached session and retry once
  if (res.status === 401 && !retried) {
    cachedSessionCookie = null;
    sessionExpiresAt = 0;
    return sprocketFetch(path, options, true);
  }

  return res;
}

async function sprocketGet<T>(path: string): Promise<T> {
  const res = await sprocketFetch(path, { method: "GET" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sprocket GET ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

async function sprocketPost<T>(path: string, body: unknown): Promise<T> {
  const res = await sprocketFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sprocket POST ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

async function sprocketDelete<T>(path: string): Promise<T> {
  const res = await sprocketFetch(path, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sprocket DELETE ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// Sprocket API methods
// ─────────────────────────────────────────────

export interface SprocketConversation {
  id: string;
  title: string | null;
  userId: number;
  projectId: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SprocketMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolCallsJson?: string | null;
  createdAt: string;
}

export interface SprocketChatResponse {
  message: string;
  conversationId: string;
  actions?: unknown[];
}

export interface SprocketHealth {
  status: string;
  knowledgeGraph?: { enabled: boolean; nodeCount?: number };
  vectorStore?: { enabled: boolean };
  database?: { connected: boolean };
}

export interface SprocketProject {
  id: number;
  name: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

/** Check Sprocket health and connectivity */
export async function getSprocketHealth(): Promise<SprocketHealth> {
  return sprocketGet<SprocketHealth>("/api/health");
}

/** List all conversations for a user */
export async function getSprocketConversations(userId: number = 1): Promise<SprocketConversation[]> {
  return sprocketGet<SprocketConversation[]>(`/api/conversations?userId=${userId}`);
}

/** Get messages for a conversation */
export async function getSprocketMessages(conversationId: string): Promise<SprocketMessage[]> {
  return sprocketGet<SprocketMessage[]>(`/api/conversations/${conversationId}/messages`);
}

/** Delete a conversation */
export async function deleteSprocketConversation(conversationId: string): Promise<{ success: boolean }> {
  return sprocketDelete<{ success: boolean }>(`/api/conversations/${conversationId}`);
}

/** Send a chat message (non-streaming) */
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

/** Get a streaming chat response — returns the raw Response for SSE handling */
export async function sprocketChatStream(params: {
  message: string;
  userId?: number;
  conversationId?: string;
  systemContext?: string;
}): Promise<Response> {
  const cookie = await getSessionCookie();
  const res = await fetch(`${ENV.sprocketUrl}/api/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      message: params.systemContext
        ? `${params.systemContext}\n\n---\n\n${params.message}`
        : params.message,
      userId: params.userId ?? 1,
      conversationId: params.conversationId,
    }),
  });

  if (res.status === 401) {
    // Retry once with fresh session
    cachedSessionCookie = null;
    sessionExpiresAt = 0;
    return sprocketChatStream(params);
  }

  return res;
}

/** List Sprocket projects */
export async function getSprocketProjects(userId: number = 1): Promise<SprocketProject[]> {
  return sprocketGet<SprocketProject[]>(`/api/projects?userId=${userId}`);
}

/** Create a Sprocket project */
export async function createSprocketProject(name: string, userId: number = 1): Promise<SprocketProject> {
  return sprocketPost<SprocketProject>("/api/projects", { name, userId });
}

// ─────────────────────────────────────────────
// Background task polling
// ─────────────────────────────────────────────

export interface SprocketBackgroundTask {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  description: string;
  resultContent: string | null;
  artifactsJson: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Get background tasks for a conversation */
export async function getSprocketBackgroundTasks(
  conversationId: string
): Promise<SprocketBackgroundTask[]> {
  return sprocketGet<SprocketBackgroundTask[]>(
    `/api/background-tasks/conversation/${conversationId}`
  );
}

/** Get a single background task by ID */
export async function getSprocketBackgroundTask(
  taskId: string
): Promise<SprocketBackgroundTask> {
  return sprocketGet<SprocketBackgroundTask>(`/api/background-tasks/${taskId}`);
}

// ─────────────────────────────────────────────
// LLM Usage
// ─────────────────────────────────────────────

export interface BudgetStatusEntry {
  service: string;
  spentUsd: number;
  limitUsd: number;
  percentUsed: number;
  level: "ok" | "warning" | "critical";
}

export interface UsageSummary {
  totalTokens: number;
  totalCostUsd: number;
  callCount: number;
  byModel: Array<{ model: string; callCount: number; totalTokens: number; costUsd: number }>;
  byService: Array<{ service: string; callCount: number; totalTokens: number; costUsd: number }>;
  bySource: Array<{ source: string; callCount: number; totalTokens: number; costUsd: number }>;
  daily: Array<{ date: string; callCount: number; totalTokens: number; costUsd: number }>;
  /** 24-hour rolling budget status per service, included in the /api/usage response */
  budgetStatus?: BudgetStatusEntry[];
}

/** Get LLM token & spend summary from Sprocket */
export async function getSprocketUsage(days = 30): Promise<UsageSummary> {
  return sprocketGet<UsageSummary>(`/api/usage?days=${days}`);
}

/** Update the soft budget limit for a service at runtime */
export async function setSprocketBudgetLimit(
  service: string,
  limitUsd: number,
): Promise<void> {
  await sprocketPost<{ ok: boolean }>("/api/usage/budget", { service, limitUsd });
}
