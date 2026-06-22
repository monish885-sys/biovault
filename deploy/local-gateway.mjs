import { createServer, request as httpRequest } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const port = Number(process.env.PORT ?? "8080");
const apiPort = Number(process.env.API_PORT ?? "4000");

const staticRoots = {
  "/client": join(root, "apps/client-portal/dist"),
  "/admin": join(root, "apps/admin-portal/dist"),
  "/": join(root, "apps/marketing/dist"),
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

async function serveStatic(prefix, urlPath, res) {
  const base = staticRoots[prefix];
  const rel = prefix === "/" ? urlPath : urlPath.slice(prefix.length) || "/index.html";
  const filePath = join(base, rel === "/" ? "index.html" : rel);
  const candidates = [filePath, join(base, "index.html")];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const ext = extname(candidate);
      const body = await readFile(candidate);
      res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
      res.end(body);
      return;
    }
  }
  res.writeHead(404).end("Not found");
}

function proxyApi(req, res) {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const payload = Buffer.concat(chunks);
    const pReq = httpRequest(
      {
        hostname: "127.0.0.1",
        port: apiPort,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${apiPort}` },
      },
      (pRes) => {
        res.writeHead(pRes.statusCode ?? 502, pRes.headers);
        pRes.pipe(res);
      },
    );
    pReq.on("error", () => res.writeHead(502).end("API unavailable"));
    if (payload.length) pReq.end(payload);
    else pReq.end();
  });
}

createServer((req, res) => {
  const url = req.url?.split("?")[0] ?? "/";

  if (url === "/health" || url.startsWith("/api/")) {
    proxyApi(req, res);
    return;
  }

  if (url === "/client") {
    res.writeHead(301, { Location: "/client/" });
    res.end();
    return;
  }
  if (url === "/admin") {
    res.writeHead(301, { Location: "/admin/" });
    res.end();
    return;
  }

  if (url.startsWith("/client/")) {
    void serveStatic("/client", url, res);
    return;
  }
  if (url.startsWith("/admin/")) {
    void serveStatic("/admin", url, res);
    return;
  }

  void serveStatic("/", url, res);
}).listen(port, () => {
  console.log(`[gateway] http://127.0.0.1:${port}`);
});
