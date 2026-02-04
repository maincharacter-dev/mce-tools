import { Request, Response } from "express";
import { getAPSAuthUrl, exchangeCodeForToken, listHubs, listProjects } from "./aps";
import { ENV } from "./_core/env";

// In-memory token storage (replace with database in production)
const tokenStore = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number }>();

export function setupAPSOAuthRoutes(app: any) {
  // Initiate OAuth flow
  app.get("/api/acc/oauth/login", (req: Request, res: Response) => {
    const redirectUri = `${req.protocol}://${req.get("host")}/api/acc/oauth/callback`;
    const authUrl = getAPSAuthUrl(redirectUri);
    res.json({ authUrl });
  });

  // OAuth callback handler
  app.get("/api/acc/oauth/callback", async (req: Request, res: Response) => {
    const { code, state } = req.query;

    if (!code || typeof code !== "string") {
      return res.status(400).send("Missing authorization code");
    }

    try {
      // Use X-Forwarded-Proto and X-Forwarded-Host if available (Manus proxy)
      const protocol = req.get("X-Forwarded-Proto") || req.protocol;
      const host = req.get("X-Forwarded-Host") || req.get("host");
      const redirectUri = `${protocol}://${host}/api/acc/oauth/callback`;
      
      console.log("[OAuth Callback] Redirect URI:", redirectUri);
      const tokens = await exchangeCodeForToken(code, redirectUri);

      // Store tokens (in production, use database with user ID)
      // For now, use a simple key since we don't have session middleware
      const userId = "default-user";
      tokenStore.set(userId, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || "",
        expiresAt: Date.now() + tokens.expires_in * 1000,
      });

      // Redirect back to app
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'ACC_AUTH_SUCCESS' }, '*');
              window.close();
            </script>
            <p>Authorization successful! You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).send("Authorization failed");
    }
  });

  // Get stored access token
  app.get("/api/acc/oauth/token", (req: Request, res: Response) => {
    const userId = "default-user";
    const tokens = tokenStore.get(userId);

    if (!tokens) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Check if token is expired
    if (Date.now() >= tokens.expiresAt) {
      tokenStore.delete(userId);
      return res.status(401).json({ error: "Token expired" });
    }

    res.json({ accessToken: tokens.accessToken });
  });
}

export function getAccessToken(userId: string): string | null {
  const tokens = tokenStore.get(userId);
  if (!tokens || Date.now() >= tokens.expiresAt) {
    return null;
  }
  return tokens.accessToken;
}
