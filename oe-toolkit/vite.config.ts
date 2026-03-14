import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// Manus platform plugins are only loaded in the Manus cloud dev environment.
// In Docker / production builds they are skipped to avoid build interference.
const isManusRuntime = process.env.MANUS_RUNTIME === "true";

const plugins: any[] = [react(), tailwindcss()];

if (isManusRuntime) {
  try {
    const { jsxLocPlugin } = await import("@builder.io/vite-plugin-jsx-loc");
    const { vitePluginManusRuntime } = await import("vite-plugin-manus-runtime");
    plugins.push(jsxLocPlugin(), vitePluginManusRuntime());
  } catch {
    // Manus plugins unavailable — skip
  }
}

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
