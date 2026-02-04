import { Request, Response } from "express";
import { getAPSAuthUrl, exchangeCodeForToken, listHubs, listProjects } from "./aps";
import { ENV } from "./_core/env";
import { createProjectDbPool } from "./db-connection";

// In-memory token storage keyed by projectId (temporary until saved to DB)
const tokenStore = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number }>();

export function setupAPSOAuthRoutes(app: any) {
  // Initiate OAuth flow - now requires projectId
  app.get("/api/acc/oauth/login", (req: Request, res: Response) => {
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({ error: "Missing projectId parameter" });
    }
    
    const redirectUri = `${req.protocol}://${req.get("host")}/api/acc/oauth/callback`;
    // Pass projectId in state parameter so we know which project to associate tokens with
    const authUrl = getAPSAuthUrl(redirectUri, projectId as string);
    res.json({ authUrl });
  });

  // OAuth callback handler
  app.get("/api/acc/oauth/callback", async (req: Request, res: Response) => {
    const { code, state } = req.query;

    if (!code || typeof code !== "string") {
      return res.status(400).send("Missing authorization code");
    }

    // Extract projectId from state parameter
    const projectId = state as string;
    if (!projectId) {
      return res.status(400).send("Missing project ID in state parameter");
    }

    try {
      // Use X-Forwarded-Proto and X-Forwarded-Host if available (Manus proxy)
      const protocol = req.get("X-Forwarded-Proto") || req.protocol;
      const host = req.get("X-Forwarded-Host") || req.get("host");
      const redirectUri = `${protocol}://${host}/api/acc/oauth/callback`;
      
      console.log("[OAuth Callback] Redirect URI:", redirectUri);
      console.log("[OAuth Callback] Project ID:", projectId);
      
      const tokens = await exchangeCodeForToken(code, redirectUri);

      // Store tokens in memory temporarily (keyed by projectId)
      tokenStore.set(projectId, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || "",
        expiresAt: Date.now() + tokens.expires_in * 1000,
      });

      // Also save to project-specific database for persistence
      const numericProjectId = parseInt(projectId, 10);
      if (!isNaN(numericProjectId)) {
        const projectDb = createProjectDbPool(numericProjectId);
        try {
          // Delete any existing credentials for this project
          await projectDb.execute(`DELETE FROM acc_credentials`);
          
          // Insert new credentials
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
          await projectDb.execute(
            `INSERT INTO acc_credentials (access_token, refresh_token, expires_at) VALUES (?, ?, ?)`,
            [tokens.access_token, tokens.refresh_token || "", expiresAt]
          );
          console.log(`[OAuth Callback] Saved tokens to database for project ${projectId}`);
        } finally {
          await projectDb.end();
        }
      }

      // Redirect back to app with projectId
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'ACC_AUTH_SUCCESS', projectId: '${projectId}' }, '*');
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

  // Get stored access token - now requires projectId
  app.get("/api/acc/oauth/token", async (req: Request, res: Response) => {
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({ error: "Missing projectId parameter" });
    }

    // First check in-memory store
    const memoryTokens = tokenStore.get(projectId as string);
    if (memoryTokens && Date.now() < memoryTokens.expiresAt) {
      return res.json({ accessToken: memoryTokens.accessToken });
    }

    // If not in memory, check database
    const numericProjectId = parseInt(projectId as string, 10);
    if (isNaN(numericProjectId)) {
      return res.status(400).json({ error: "Invalid projectId" });
    }

    const projectDb = createProjectDbPool(numericProjectId);
    try {
      const [rows] = await projectDb.execute(
        `SELECT access_token, refresh_token, expires_at FROM acc_credentials LIMIT 1`
      ) as any;

      if (!rows || rows.length === 0) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const creds = rows[0];
      const expiresAt = new Date(creds.expires_at).getTime();

      // Check if token is expired
      if (Date.now() >= expiresAt) {
        // TODO: Implement token refresh using refresh_token
        return res.status(401).json({ error: "Token expired" });
      }

      // Cache in memory for faster access
      tokenStore.set(projectId as string, {
        accessToken: creds.access_token,
        refreshToken: creds.refresh_token || "",
        expiresAt: expiresAt,
      });

      res.json({ accessToken: creds.access_token });
    } finally {
      await projectDb.end();
    }
  });
}

export function getAccessToken(projectId: string): string | null {
  const tokens = tokenStore.get(projectId);
  if (!tokens || Date.now() >= tokens.expiresAt) {
    return null;
  }
  return tokens.accessToken;
}
