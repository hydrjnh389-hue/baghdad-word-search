const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 4173;
const HOST = "0.0.0.0";
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, "players-db.json");
const OWNER_KEY = "baghdad-owner-2026";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function readPlayers() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writePlayers(players) {
  fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2), "utf8");
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 10000) {
        reject(new Error("Request body is too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveFile(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const safeUrl = decodeURIComponent(parsedUrl.pathname);
  const requestedPath = safeUrl === "/" ? "/arabic-word-search-public.html" : safeUrl;
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (requestedPath === "/arabic-word-search-owner.html" && parsedUrl.searchParams.get("ownerKey") !== OWNER_KEY) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Owner page is private");
    return;
  }

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (parsedUrl.pathname === "/api/players" && req.method === "GET") {
    if (parsedUrl.searchParams.get("ownerKey") !== OWNER_KEY) {
      sendJson(res, 403, { ok: false, message: "Owner access only" });
      return;
    }
    sendJson(res, 200, readPlayers());
    return;
  }

  if (parsedUrl.pathname === "/api/players" && req.method === "POST") {
    try {
      const payload = JSON.parse(await readBody(req));
      const username = String(payload.username || "").trim().slice(0, 24);
      const score = Number(payload.score);
      const total = Number(payload.total);

      if (!username || !Number.isFinite(score) || !Number.isFinite(total)) {
        sendJson(res, 400, { ok: false, message: "Invalid player result" });
        return;
      }

      const players = readPlayers();
      players.push({
        username,
        score,
        total,
        date: new Date().toLocaleString("ar-IQ"),
        createdAt: new Date().toISOString()
      });
      writePlayers(players);
      sendJson(res, 201, { ok: true });
    } catch {
      sendJson(res, 500, { ok: false, message: "Could not save player result" });
    }
    return;
  }

  serveFile(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Baghdad word search server: http://localhost:${PORT}`);
});
