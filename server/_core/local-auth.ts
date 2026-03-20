/**
 * Local Authentication for mce-workspace
 *
 * mce-workspace does NOT have its own user database.
 * Users are authenticated by oe-toolkit which issues a JWT.
 * This module validates that JWT and extracts the user context from it.
 *
 * The JWT is shared between oe-toolkit and mce-workspace via SHARED_JWT_SECRET.
 * When LOCAL_AUTH=true, both services use the same local credentials and secret.
 */
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";

// ============================================================
// USER LIST PARSING
// ============================================================

interface LocalUserConfig {
  username: string;
  password: string;
  name: string;
  role: "admin" | "user";
}

function getLocalUsers(): LocalUserConfig[] {
  if (ENV.localUsers) {
    try {
      const parsed = JSON.parse(ENV.localUsers);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((u: Record<string, string>, i: number) => ({
          username: u.username || `user${i + 1}`,
          password: u.password || "",
          name: u.name || u.username || `User ${i + 1}`,
          role: (u.role === "admin" || u.role === "user" ? u.role : "user") as "admin" | "user",
        }));
      }
    } catch (err) {
      console.error("[LocalAuth] Failed to parse LOCAL_USERS JSON:", err);
    }
  }

  if (ENV.localUsername && ENV.localPassword) {
    return [
      {
        username: ENV.localUsername,
        password: ENV.localPassword,
        name: ENV.localUsername,
        role: "admin",
      },
    ];
  }

  return [];
}

/** Deterministic numeric user ID from username (consistent across restarts) */
function userIdForUsername(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash) + username.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

/** Deterministic openId per username */
function openIdForUsername(username: string): string {
  return `local-user-${username.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
}

// ============================================================
// JWT SESSION
// ============================================================

function getSecret() {
  return new TextEncoder().encode(ENV.cookieSecret || "local-dev-secret-change-me");
}

async function createSessionForUser(user: LocalUserConfig): Promise<string> {
  const issuedAt = Date.now();
  const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);

  return new SignJWT({
    openId: openIdForUsername(user.username),
    appId: ENV.appId || "local-app",
    name: user.name,
    role: user.role,
    userId: userIdForUsername(user.username),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecret());
}

export async function verifyLocalSession(
  cookieValue: string | undefined | null
): Promise<{ openId: string; appId: string; name: string; role?: string; userId?: number } | null> {
  if (!cookieValue) return null;

  try {
    const { payload } = await jwtVerify(cookieValue, getSecret(), {
      algorithms: ["HS256"],
    });
    const { openId, appId, name, role, userId } = payload as Record<string, unknown>;

    if (typeof openId !== "string" || typeof appId !== "string" || typeof name !== "string") {
      return null;
    }

    return {
      openId,
      appId,
      name,
      role: typeof role === "string" ? role : "user",
      userId: typeof userId === "number" ? userId : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Authenticate a request and return a User object from the JWT payload.
 * mce-workspace does NOT look up users in a database — the JWT is the source of truth.
 */
export async function authenticateLocalRequest(req: Request): Promise<User | null> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const { parse } = await import("cookie");
  const cookies = parse(cookieHeader);
  const sessionCookie = cookies[COOKIE_NAME];

  const session = await verifyLocalSession(sessionCookie);
  if (!session) return null;

  const now = new Date();
  return {
    id: session.userId ?? userIdForUsername(session.openId),
    openId: session.openId,
    name: session.name,
    email: null,
    loginMethod: "local",
    role: (session.role === "admin" ? "admin" : "user") as "admin" | "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

// ============================================================
// EXPRESS ROUTES
// ============================================================

export function registerLocalAuthRoutes(app: Express): void {
  console.log("[LocalAuth] Registering local auth routes (LOCAL_AUTH=true)");

  const users = getLocalUsers();
  console.log(`[LocalAuth] ${users.length} local user(s) configured`);

  // POST /api/auth/login — validate credentials, set session cookie
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body || {};

    const localUsers = getLocalUsers();
    if (localUsers.length === 0) {
      return res.status(500).json({
        error: "No users configured. Set LOCAL_USERS or LOCAL_USERNAME/LOCAL_PASSWORD in environment.",
      });
    }

    const matchedUser = localUsers.find(
      (u) => u.username === username && u.password === password
    );

    if (!matchedUser) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    try {
      const sessionToken = await createSessionForUser(matchedUser);
      const cookieOptions = getSessionCookieOptions(req);

      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { name: matchedUser.name, role: matchedUser.role } });
    } catch (err) {
      console.error("[LocalAuth] Login failed:", err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // GET /api/auth/mode — tell the frontend which auth mode is active
  app.get("/api/auth/mode", (_req: Request, res: Response) => {
    res.json({ mode: "local" });
  });
}

export function isLocalAuth(): boolean {
  return ENV.localAuth;
}
