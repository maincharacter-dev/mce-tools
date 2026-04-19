import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { isLocalAuth, registerLocalAuthRoutes, authenticateLocalRequest } from "./local-auth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { runStartupTasks } from "./startup";

import { serveStatic, setupVite } from "./vite";

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
  // Configure body parser with larger size limit for file uploads (250MB for base64 encoded files)
  app.use(express.json({ limit: "250mb" }));
  app.use(express.urlencoded({ limit: "250mb", extended: true }));
  // Auth routes: local mode or Manus OAuth
  if (isLocalAuth()) {
    console.log("[Server] Running in LOCAL_AUTH mode — using .env credentials");
    registerLocalAuthRoutes(app);
  } else {
    // OAuth callback under /api/oauth/callback
    registerOAuthRoutes(app);
  }

  // Auth mode endpoint (always available so frontend can detect mode)
  app.get("/api/auth/mode", (_req, res) => {
    res.json({ mode: isLocalAuth() ? "local" : "oauth" });
  });

  // ─── Report file download routes ─────────────────────────────────────────
  // Serve generated DOCX files from /app/data/reports by DB row ID
  app.get("/api/reports/download/:id", async (req, res) => {
    try {
      const { createMainDbPool } = await import("../db-connection");
      const pool = createMainDbPool();
      const [rows] = await pool.execute(
        "SELECT filename, file_key FROM generated_reports WHERE id = ?",
        [req.params.id]
      ) as any;
      await pool.end();
      const report = rows[0];
      if (!report || !report.file_key) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
      const { existsSync } = await import("fs");
      if (!existsSync(report.file_key)) {
        res.status(404).json({ error: "Report file not found on disk" });
        return;
      }
      res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.sendFile(report.file_key);
    } catch (err: any) {
      console.error("[Download] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Download by draft ID (used by GenerateStep after polling completes)
  app.get("/api/reports/download-by-draft/:draftId", async (req, res) => {
    try {
      const { createMainDbPool } = await import("../db-connection");
      const pool = createMainDbPool();
      const [rows] = await pool.execute(
        "SELECT id, filename, file_key FROM generated_reports WHERE draft_id = ? ORDER BY created_at DESC LIMIT 1",
        [req.params.draftId]
      ) as any;
      await pool.end();
      const report = rows[0];
      if (!report || !report.file_key) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
      const { existsSync } = await import("fs");
      if (!existsSync(report.file_key)) {
        res.status(404).json({ error: "Report file not found on disk" });
        return;
      }
      res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.sendFile(report.file_key);
    } catch (err: any) {
      console.error("[Download] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
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

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);
    if (isLocalAuth()) {
      console.log(`[LocalAuth] Login at http://localhost:${port}/login`);
    }
    // Run startup initialization tasks
    await runStartupTasks();
  });
}

startServer().catch(console.error);
