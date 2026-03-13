/**
 * Local Authentication — Simple username/password auth for self-hosting.
 *
 * When LOCAL_AUTH=true, this replaces Manus OAuth entirely:
 *   - Login page at /login (served by the frontend)
 *   - POST /api/auth/login validates credentials against .env
 *   - Session is a signed JWT cookie (same as Manus OAuth flow)
 *   - No external OAuth server needed
 *
 * Single user (legacy):
 *   LOCAL_AUTH=true
 *   LOCAL_USERNAME=admin
 *   LOCAL_PASSWORD=your-secure-password
 *
 * Multiple users:
 *   LOCAL_AUTH=true
 *   LOCAL_USERS=[{"username":"rob","password":"pass1","name":"Rob","role":"admin"},{"username":"alice","password":"pass2","name":"Alice","role":"user"}]
 *
 * When LOCAL_USERS is set it takes precedence over LOCAL_USERNAME/LOCAL_PASSWORD.
 * Each user gets their own isolated DB record and conversation history.
 */
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import * as db from "../db";
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
  // Multi-user mode: LOCAL_USERS JSON array takes precedence
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

  // Single-user legacy fallback
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

/** Deterministic openId per username so the same user always maps to the same DB row */
function openIdForUsername(username: string): string {
  return `local-user-${username.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
}

// ============================================================
// DB USER PROVISIONING
// ============================================================

/** Ensure all configured local users exist in the database */
async function ensureLocalUsers(): Promise<void> {
  const users = getLocalUsers();
  for (const u of users) {
    try {
      await db.upsertUser({
        openId: openIdForUsername(u.username),
        name: u.name,
        email: null,
        loginMethod: "local",
        role: u.role,
        lastSignedIn: new Date(),
      });
    } catch (err) {
      console.error(`[LocalAuth] Failed to ensure user '${u.username}':`, err);
    }
  }
  console.log(`[LocalAuth] ${users.length} local user(s) provisioned`);
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
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecret());
}

export async function verifyLocalSession(
  cookieValue: string | undefined | null
): Promise<{ openId: string; appId: string; name: string } | null> {
  if (!cookieValue) return null;

  try {
    const { payload } = await jwtVerify(cookieValue, getSecret(), {
      algorithms: ["HS256"],
    });
    const { openId, appId, name } = payload as Record<string, unknown>;

    if (typeof openId !== "string" || typeof appId !== "string" || typeof name !== "string") {
      return null;
    }

    return { openId, appId, name };
  } catch {
    return null;
  }
}

export async function authenticateLocalRequest(req: Request): Promise<User | null> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const { parse } = await import("cookie");
  const cookies = parse(cookieHeader);
  const sessionCookie = cookies[COOKIE_NAME];

  const session = await verifyLocalSession(sessionCookie);
  if (!session) return null;

  const user = await db.getUserByOpenId(session.openId);
  if (user) {
    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
  }
  return user ?? null;
}

// ============================================================
// EXPRESS ROUTES
// ============================================================

export function registerLocalAuthRoutes(app: Express): void {
  console.log("[LocalAuth] Registering local auth routes (LOCAL_AUTH=true)");

  // Provision all users on startup
  ensureLocalUsers();

  // POST /api/auth/login — validate credentials, set session cookie
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body || {};

    const users = getLocalUsers();
    if (users.length === 0) {
      return res.status(500).json({
        error:
          "No users configured. Set LOCAL_USERS or LOCAL_USERNAME/LOCAL_PASSWORD in environment.",
      });
    }

    const matchedUser = users.find(
      (u) => u.username === username && u.password === password
    );

    if (!matchedUser) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    try {
      // Ensure this user exists in DB (idempotent)
      await db.upsertUser({
        openId: openIdForUsername(matchedUser.username),
        name: matchedUser.name,
        email: null,
        loginMethod: "local",
        role: matchedUser.role,
        lastSignedIn: new Date(),
      });

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
