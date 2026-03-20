import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  const basePath = process.env.BASE_PATH || '';

  // Serve static assets at root — Vite builds all asset paths as absolute URLs
  // (e.g. /workspace/assets/index.js) so they resolve correctly regardless of mount path.
  // Do NOT use app.use(basePath, express.static()) — that causes express.static to
  // issue a 302 redirect to itself when it sees a directory request, creating an
  // infinite redirect loop when proxied from another service.
  app.use(express.static(distPath));

  if (basePath) {
    // SPA fallback: serve index.html for any path under the base path
    app.use(`${basePath}/*`, (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
    // Redirect bare root to base path for direct local access (e.g. localhost:3001 → localhost:3001/workspace/)
    app.get("/", (_req, res) => {
      res.redirect(basePath + "/");
    });
  } else {
    // No base path — standard SPA fallback
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
}
