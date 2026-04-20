#!/usr/bin/env node
"use strict";

/**
 * Mock GitAnimals auth server for Phase 1 E2E testing.
 *
 * Simulates:
 *   GET /auth/desktop?redirect_uri=...&state=...
 *     → HTML page with "로그인 시뮬레이션" button
 *     → Button redirects to redirect_uri?token=mock-gitanimals-token&state=<state>
 *
 * Usage:
 *   GITANIMALS_API_BASE_URL=http://localhost:8766 npm start
 *   node scripts/mock-auth-server.js          (port 8766)
 */

const http = require("http");
const { URL } = require("url");

const PORT = Number(process.env.MOCK_AUTH_PORT) || 8766;

const server = http.createServer((req, res) => {
  let parsed;
  try { parsed = new URL(req.url, `http://localhost:${PORT}`); } catch {
    res.writeHead(400); res.end("bad request"); return;
  }

  if (parsed.pathname === "/auth/desktop") {
    const redirectUri = parsed.searchParams.get("redirect_uri") || "";
    const state = parsed.searchParams.get("state") || "";

    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("token", "mock-gitanimals-token-dev");
    callbackUrl.searchParams.set("state", state);
    const callbackHref = callbackUrl.toString();

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>GitAnimals Mock Auth</title>
<style>
  body { font-family: sans-serif; display: flex; align-items: center;
         justify-content: center; min-height: 100vh; margin: 0;
         background: #f0f4ff; }
  .card { background: #fff; border-radius: 12px; padding: 40px;
          text-align: center; box-shadow: 0 2px 20px rgba(0,0,0,.1); max-width: 360px; }
  h2 { margin: 0 0 8px; }
  p  { color: #666; margin: 0 0 24px; font-size: 13px; }
  .badge { display: inline-block; background: #ffe0b2; color: #e65100;
           font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-bottom: 20px; }
  a  { display: inline-block; background: #4f46e5; color: #fff;
       text-decoration: none; padding: 12px 28px; border-radius: 8px;
       font-size: 15px; font-weight: 600; }
  a:hover { background: #4338ca; }
  .code { font-size: 11px; color: #999; margin-top: 20px; word-break: break-all; }
</style>
</head><body>
<div class="card">
  <div class="badge">🛠 Mock 서버</div>
  <h2>GitAnimals</h2>
  <p>개발 테스트용 로그인 시뮬레이터입니다.<br>실제 GitHub 인증은 진행하지 않습니다.</p>
  <a href="${escHtml(callbackHref)}">✓ 로그인 시뮬레이션</a>
  <p class="code">token: mock-gitanimals-token-dev</p>
</div>
</body></html>`);
    return;
  }

  res.writeHead(404); res.end("not found");
});

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-auth] 서버 시작: http://localhost:${PORT}`);
  console.log(`[mock-auth] 앱 실행 시: GITANIMALS_API_BASE_URL=http://localhost:${PORT} npm start`);
});
