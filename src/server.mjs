import http from "node:http";
import https from "node:https";
import { appPageHtml } from "./appPage.mjs";
import { loadEnvFile } from "./env.mjs";
import { testPageHtml } from "./testPage.mjs";
import { batchDraft, draftWorkOrder, refineWorkOrder } from "./workOrderAi.mjs";

loadEnvFile();

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const SHARED_SECRET = process.env.APP_SHARED_SECRET || "";
const PROXY_TARGET = process.env.PROXY_TARGET || "";
const RATE_LIMIT_WINDOW_MS = numberFromEnv(process.env.API_RATE_LIMIT_WINDOW_MS, 60_000);
const RATE_LIMIT_MAX_REQUESTS = numberFromEnv(process.env.API_RATE_LIMIT_MAX_REQUESTS, 60);
const MAX_BODY_BYTES = numberFromEnv(process.env.MAX_BODY_BYTES, 2_000_000);
const rateBuckets = new Map();

const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;

    if (req.method === "OPTIONS") {
      return sendJson(res, 204, null);
    }

    if (req.method === "GET" && path === "/health") {
      return sendJson(res, 200, { ok: true, proxy: Boolean(PROXY_TARGET) });
    }

    if (PROXY_TARGET) {
      if (declaredBodySize(req) > MAX_BODY_BYTES) {
        return sendJson(res, 413, { error: "Request body too large." });
      }
      if (path.startsWith("/api/") && req.method === "POST") {
        enforceRateLimit(req);
      }
      return proxyRequest(req, res);
    }

    if (req.method === "GET" && path === "/") {
      return sendHtml(res, 200, appPageHtml());
    }

    if (req.method === "GET" && path === "/api") {
      return sendJson(res, 200, {
        name: "work-order-assistant",
        endpoints: ["/", "/app", "/test", "/api/auth-check", "/api/draft", "/api/refine", "/api/batch", "/health"]
      });
    }

    if (req.method === "GET" && path === "/test") {
      return sendHtml(res, 200, testPageHtml());
    }

    if (req.method === "GET" && (path === "/app" || path === "/app/")) {
      return sendHtml(res, 200, appPageHtml());
    }

    if (!path.startsWith("/api/")) {
      return sendJson(res, 404, { error: "Not found" });
    }

    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Use POST for API endpoints." });
    }

    enforceRateLimit(req);
    authorize(req);

    if (path === "/api/auth-check") {
      return sendJson(res, 200, { ok: true });
    }

    const body = await readJson(req);

    if (path === "/api/draft") {
      return sendJson(res, 200, await draftWorkOrder(body));
    }

    if (path === "/api/refine") {
      return sendJson(res, 200, await refineWorkOrder(body));
    }

    if (path === "/api/batch") {
      return sendJson(res, 200, await batchDraft(body.packets));
    }

    return sendJson(res, 404, { error: "Unknown API endpoint." });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, {
      error: error.message || "Unexpected server error."
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Work order assistant listening on http://${HOST}:${PORT}`);
  if (PROXY_TARGET) console.log(`Proxying requests to ${PROXY_TARGET}`);
});

function authorize(req) {
  if (!SHARED_SECRET) return;

  const header = req.headers.authorization || "";
  const shortcutSecret = req.headers["x-app-secret"] || "";
  const expected = `Bearer ${SHARED_SECRET}`;
  if (header !== expected && shortcutSecret !== SHARED_SECRET) {
    const error = new Error("Unauthorized.");
    error.statusCode = 401;
    throw error;
  }
}

function enforceRateLimit(req) {
  if (!RATE_LIMIT_MAX_REQUESTS || RATE_LIMIT_MAX_REQUESTS < 1) return;

  const now = Date.now();
  const key = clientIp(req);
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const hits = (rateBuckets.get(key) || []).filter((hit) => hit > cutoff);

  if (hits.length >= RATE_LIMIT_MAX_REQUESTS) {
    const error = new Error("Too many requests. Wait a minute and try again.");
    error.statusCode = 429;
    throw error;
  }

  hits.push(now);
  rateBuckets.set(key, hits);

  for (const [bucketKey, bucketHits] of rateBuckets) {
    const kept = bucketHits.filter((hit) => hit > cutoff);
    if (kept.length) rateBuckets.set(bucketKey, kept);
    else rateBuckets.delete(bucketKey);
  }
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY_BYTES) {
        const error = new Error("Request body too large.");
        error.statusCode = 413;
        reject(error);
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        const error = new Error("Invalid JSON body.");
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function declaredBodySize(req) {
  const size = Number(req.headers["content-length"] || 0);
  return Number.isFinite(size) ? size : 0;
}

function proxyRequest(req, res) {
  return new Promise((resolve) => {
    const upstreamUrl = new URL(req.url || "/", PROXY_TARGET);
    const client = upstreamUrl.protocol === "https:" ? https : http;
    const headers = { ...req.headers, host: upstreamUrl.host };

    delete headers.connection;
    delete headers["keep-alive"];
    delete headers["proxy-authenticate"];
    delete headers["proxy-authorization"];
    delete headers.te;
    delete headers.trailer;
    delete headers["transfer-encoding"];
    delete headers.upgrade;

    const upstream = client.request(
      upstreamUrl,
      {
        method: req.method,
        headers
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
        upstreamRes.pipe(res);
        upstreamRes.on("end", resolve);
      }
    );

    upstream.on("error", (error) => {
      sendJson(res, 502, { error: error.message || "Proxy request failed." });
      resolve();
    });

    req.pipe(upstream);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-App-Secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  });

  if (status === 204) {
    res.end();
    return;
  }

  res.end(JSON.stringify(payload, null, 2));
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8"
  });
  res.end(html);
}
