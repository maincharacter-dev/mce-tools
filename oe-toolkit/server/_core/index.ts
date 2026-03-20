import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLocalAuthRoutes } from "./local-auth";
import { isLocalAuth } from "./env";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { createProxyMiddleware } from "http-proxy-middleware";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Auth mode endpoint — tells the client whether to use local login or OAuth
  app.get("/api/auth/mode", (_req, res) => {
    res.json({ mode: isLocalAuth() ? "local" : "oauth" });
  });

  if (isLocalAuth()) {
    console.log("[Server] Running in LOCAL_AUTH mode — using .env credentials");
    registerLocalAuthRoutes(app);
  } else {
    // OAuth callback under /api/oauth/callback
    registerOAuthRoutes(app);
  }
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // ─── Sprocket SSE streaming proxy ───────────────────────────────────────────
  // This route proxies the Sprocket SSE stream directly to the browser client.
  // tRPC cannot handle SSE, so this is a plain Express route.
  app.post("/api/agent/stream", async (req, res) => {
    try {
      const { sprocketChatStream } = await import("../sprocket-client");
      const { message, conversationId, systemContext } = req.body as {
        message: string;
        conversationId?: string;
        systemContext?: string;
      };

      if (!message) {
        res.status(400).json({ error: "message is required" });
        return;
      }

      const upstream = await sprocketChatStream({
        message,
        conversationId,
        systemContext,
        userId: 1,
      });

      if (!upstream.ok || !upstream.body) {
        const body = await upstream.text();
        res.status(upstream.status).json({ error: body });
        return;
      }

      // Forward SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      // Pipe the upstream SSE stream to the client
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();

      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              break;
            }
            res.write(decoder.decode(value, { stream: true }));
            // Flush immediately for SSE
            if ((res as any).flush) (res as any).flush();
          }
        } catch (err) {
          console.error("[SSE proxy] Stream error:", err);
          res.end();
        }
      };

      // Handle client disconnect
      req.on("close", () => {
        reader.cancel().catch(() => {});
      });

      pump();
    } catch (err: any) {
      console.error("[SSE proxy] Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // ─── MCE Workspace proxy ──────────────────────────────────────────────
  // Forward /workspace/* to mce-workspace so toolkit.maincharacter.wtf/workspace/ works
  const workspaceUrl = process.env.MCE_WORKSPACE_URL || "http://mce-workspace:3000";
  app.use("/workspace", createProxyMiddleware({
    target: workspaceUrl,
    changeOrigin: true,
    on: {
      error: (err: any, _req: any, res: any) => {
        console.error("[Workspace proxy] Error:", err.message);
        if (!res.headersSent) {
          (res as any).status(502).json({ error: "MCE Workspace unavailable" });
        }
      },
    },
  }));

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
