import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "module";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, "../..");
const THEMES_DIR = path.join(ROOT, "themes");

// Reuse existing theme-loader (CJS)
const themeLoader = require(path.join(ROOT, "src", "theme", "loader"));
themeLoader.init(path.join(ROOT, "src"), null);

const MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".gif": "image/gif",
  ".apng": "image/apng",
  ".webp": "image/webp",
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: "theme-api",
      configureServer(server) {
        // SSE clients for hot-reload
        const sseClients = new Set<import("http").ServerResponse>();

        // Watch theme directories
        try {
          for (const entry of fs.readdirSync(THEMES_DIR, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
            const watchDir = path.join(THEMES_DIR, entry.name);
            try {
              fs.watch(watchDir, { recursive: true }, (_event, _filename) => {
                const msg = `data: ${JSON.stringify({ type: "theme-changed", theme: entry.name })}\n\n`;
                for (const client of sseClients) {
                  try { client.write(msg); } catch { sseClients.delete(client); }
                }
              });
            } catch {}
          }
        } catch {}

        server.middlewares.use((req, res, next) => {
          const url = req.url || "";

          // GET /api/themes
          if (url === "/api/themes") {
            const themes = themeLoader.discoverThemes();
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(themes));
            return;
          }

          // GET /api/themes/:id/config
          const configMatch = url.match(/^\/api\/themes\/([^/]+)\/config$/);
          if (configMatch) {
            const themeId = decodeURIComponent(configMatch[1]);
            try {
              const theme = themeLoader.loadTheme(themeId);
              const config = themeLoader.getRendererConfig();
              const themeDirName = path.basename(themeLoader.getActiveTheme()._themeDir);
              config.assetsPath = `/assets/${themeDirName}`;
              config.sourceAssetsPath = `/assets/${themeDirName}`;
              config.states = theme.states;
              config.miniMode = theme.miniMode;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(config));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
            return;
          }

          // GET /api/watch (SSE)
          if (url === "/api/watch") {
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            });
            res.write("data: connected\n\n");
            sseClients.add(res);
            req.on("close", () => sseClients.delete(res));
            return;
          }

          // GET /assets/:themeDir/:file
          const assetMatch = url.match(/^\/assets\/([^/]+)\/(.+)$/);
          if (assetMatch) {
            const themeDir = decodeURIComponent(assetMatch[1]);
            const file = path.basename(decodeURIComponent(assetMatch[2]));
            const themeAssetPath = path.join(THEMES_DIR, themeDir, "assets", file);

            let filePath = themeAssetPath;
            if (!fs.existsSync(filePath)) {
              filePath = path.join(ROOT, "assets", "svg", file);
            }
            if (fs.existsSync(filePath)) {
              const ext = path.extname(filePath).toLowerCase();
              res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
              res.setHeader("Cache-Control", "no-cache");
              res.end(fs.readFileSync(filePath));
            } else {
              res.statusCode = 404;
              res.end("Asset not found");
            }
            return;
          }

          next();
        });
      },
    },
  ],
});
