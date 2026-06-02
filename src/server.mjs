import http from "node:http";
import https from "node:https";
import { appPageHtml } from "./appPage.mjs";
import { loadEnvFile } from "./env.mjs";
import { testPageHtml } from "./testPage.mjs";
import { assertDailySpendAvailable, recordAiUsage, usageConfig, usageDashboardData } from "./usageStore.mjs";
import { batchDraft, draftWorkOrder, refineWorkOrder } from "./workOrderAi.mjs";

loadEnvFile();

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const SHARED_SECRET = process.env.APP_SHARED_SECRET || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const PROXY_TARGET = process.env.PROXY_TARGET || "";
const RATE_LIMIT_WINDOW_MS = numberFromEnv(process.env.API_RATE_LIMIT_WINDOW_MS, 60_000);
const RATE_LIMIT_MAX_REQUESTS = numberFromEnv(process.env.API_RATE_LIMIT_MAX_REQUESTS, 60);
const MAX_BODY_BYTES = numberFromEnv(process.env.MAX_BODY_BYTES, 2_000_000);
const BACKEND_VERSION = "entry-checklist-labor-bookends-2026-06-01";
const rateBuckets = new Map();

const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;

    if (req.method === "OPTIONS") {
      return sendJson(res, 204, null);
    }

    if (req.method === "GET" && path === "/health") {
      return sendJson(res, 200, { ok: true, proxy: Boolean(PROXY_TARGET), version: BACKEND_VERSION });
    }

    if (req.method === "GET" && path === "/admin") {
      return sendHtml(res, 200, adminPageHtml());
    }

    if (req.method === "GET" && path === "/api/admin/usage") {
      authorizeAdmin(req);
      return sendJson(res, 200, await usageDashboardData(usageConfig()));
    }

    if (PROXY_TARGET) {
      if (declaredBodySize(req) > MAX_BODY_BYTES) {
        return sendJson(res, 413, { error: "Request body too large." });
      }
      if (path.startsWith("/api/") && req.method === "POST") {
        enforceRateLimit(req);
      }

      const trackEndpoint = trackedAiEndpoint(req.method, path);
      if (trackEndpoint) {
        if (SHARED_SECRET) authorize(req);
        await assertDailySpendAvailable(usageConfig());
      }

      return proxyRequest(req, res, { trackEndpoint });
    }

    if (req.method === "GET" && path === "/") {
      return sendHtml(res, 200, appPageHtml());
    }

    if (req.method === "GET" && path === "/api") {
      return sendJson(res, 200, {
        name: "work-order-assistant",
        endpoints: ["/", "/app", "/admin", "/test", "/api/auth-check", "/api/draft", "/api/refine", "/api/batch", "/api/admin/usage", "/health"]
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
      await assertDailySpendAvailable(usageConfig());
      try {
        const payload = await draftWorkOrder(body);
        await recordAiUsage({
          endpoint: "draft",
          model: payload.model,
          usage: payload.usage,
          status: "success"
        }, usageConfig());
        return sendJson(res, 200, payload);
      } catch (error) {
        await recordAiUsage({
          endpoint: "draft",
          model: process.env.OPENAI_MODEL || null,
          usage: null,
          status: "failed",
          error: error.message
        }, usageConfig());
        throw error;
      }
    }

    if (path === "/api/refine") {
      await assertDailySpendAvailable(usageConfig());
      try {
        const payload = await refineWorkOrder(body);
        await recordAiUsage({
          endpoint: "refine",
          model: payload.model,
          usage: payload.usage,
          status: "success"
        }, usageConfig());
        return sendJson(res, 200, payload);
      } catch (error) {
        await recordAiUsage({
          endpoint: "refine",
          model: process.env.OPENAI_MODEL || null,
          usage: null,
          status: "failed",
          error: error.message
        }, usageConfig());
        throw error;
      }
    }

    if (path === "/api/batch") {
      const payload = await batchDraft(body.packets, {
        beforeRequest: () => assertDailySpendAvailable(usageConfig()),
        afterResult: (result) => recordAiUsage({
          endpoint: "batch",
          model: result.model,
          usage: result.usage,
          status: "success"
        }, usageConfig()),
        afterError: (error) => recordAiUsage({
          endpoint: "batch",
          model: process.env.OPENAI_MODEL || null,
          usage: null,
          status: "failed",
          error: error.message
        }, usageConfig())
      });
      return sendJson(res, 200, payload);
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

function authorizeAdmin(req) {
  if (!ADMIN_SECRET) {
    const error = new Error("Admin dashboard is not configured.");
    error.statusCode = 404;
    throw error;
  }

  const header = req.headers.authorization || "";
  const adminSecret = req.headers["x-admin-secret"] || "";
  const expected = `Bearer ${ADMIN_SECRET}`;
  if (header !== expected && adminSecret !== ADMIN_SECRET) {
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

function trackedAiEndpoint(method, path) {
  if (method !== "POST") return null;
  if (path === "/api/draft") return "draft";
  if (path === "/api/refine") return "refine";
  if (path === "/api/batch") return "batch";
  return null;
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

function proxyRequest(req, res, options = {}) {
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
        if (!options.trackEndpoint) {
          res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
          upstreamRes.pipe(res);
          upstreamRes.on("end", resolve);
          return;
        }

        const chunks = [];
        upstreamRes.on("data", (chunk) => chunks.push(chunk));
        upstreamRes.on("end", async () => {
          const body = Buffer.concat(chunks);
          res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
          res.end(body);

          await recordProxyUsage(options.trackEndpoint, upstreamRes.statusCode || 502, body).catch((error) => {
            console.error("Usage recording failed:", error);
          });
          resolve();
        });
      }
    );

    upstream.on("error", (error) => {
      if (options.trackEndpoint) {
        recordAiUsage({
          endpoint: options.trackEndpoint,
          model: process.env.OPENAI_MODEL || null,
          usage: null,
          status: "failed",
          error: error.message
        }, usageConfig()).catch((usageError) => {
          console.error("Usage recording failed:", usageError);
        });
      }
      sendJson(res, 502, { error: error.message || "Proxy request failed." });
      resolve();
    });

    req.pipe(upstream);
  });
}

async function recordProxyUsage(endpoint, statusCode, body) {
  const text = body.toString("utf8");
  let json = {};
  try {
    json = JSON.parse(text || "{}");
  } catch {
    json = {};
  }
  if (statusCode < 200 || statusCode >= 300) {
    await recordAiUsage({
      endpoint,
      model: process.env.OPENAI_MODEL || json.model || null,
      usage: null,
      status: "failed",
      error: json.error || `Upstream returned ${statusCode}`
    }, usageConfig());
    return;
  }

  const usage = endpoint === "batch" ? aggregateBatchUsage(json) : json.usage;
  await recordAiUsage({
    endpoint,
    model: json.model || process.env.OPENAI_MODEL || null,
    usage,
    status: "success"
  }, usageConfig());
}

function aggregateBatchUsage(json) {
  const totals = { input_tokens: 0, output_tokens: 0 };
  let found = false;
  for (const result of json?.results || []) {
    const usage = result?.usage;
    if (!usage) continue;
    const input = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
    const output = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
    if (Number.isFinite(input)) totals.input_tokens += input;
    if (Number.isFinite(output)) totals.output_tokens += output;
    found = true;
  }
  return found ? totals : null;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-App-Secret, X-Admin-Secret",
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

function adminPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Toodles Admin</title>
  <style>
    :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    body { margin: 0; background: #0a0a08; color: #f0ede4; }
    main { max-width: 980px; margin: 0 auto; padding: 28px; }
    h1 { font-size: clamp(42px, 9vw, 92px); line-height: .85; margin: 0 0 20px; letter-spacing: .04em; }
    label { display: block; color: #807d72; font-size: 12px; text-transform: uppercase; letter-spacing: .16em; margin-bottom: 8px; }
    .row { display: flex; gap: 10px; margin-bottom: 20px; }
    input { flex: 1; min-width: 0; background: #121210; border: 1px solid #444440; color: #f0ede4; padding: 12px; font: inherit; }
    button { background: #f5c518; color: #0a0a08; border: 0; padding: 12px 16px; font-weight: 800; cursor: pointer; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
    .card { border: 1px solid #32322c; background: #121210; padding: 16px; }
    .k { color: #807d72; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; }
    .v { font-size: 28px; margin-top: 8px; color: #f5c518; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th, td { border-bottom: 1px solid #32322c; padding: 10px 8px; text-align: left; }
    th { color: #807d72; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
    .err { color: #ff8050; min-height: 22px; margin: 10px 0; }
  </style>
</head>
<body>
  <main>
    <h1>TOODLES ADMIN</h1>
    <label for="secret">Admin secret</label>
    <div class="row">
      <input id="secret" type="password" autocomplete="current-password">
      <button id="loadBtn">Load stats</button>
    </div>
    <div id="error" class="err"></div>
    <section id="stats" hidden>
      <div class="grid">
        <div class="card"><div class="k">Today spend</div><div id="todaySpend" class="v"></div></div>
        <div class="card"><div class="k">Remaining today</div><div id="remaining" class="v"></div></div>
        <div class="card"><div class="k">Today requests</div><div id="requests" class="v"></div></div>
        <div class="card"><div class="k">Month spend</div><div id="monthSpend" class="v"></div></div>
      </div>
      <table>
        <thead><tr><th>Day</th><th>Requests</th><th>Failures</th><th>Input</th><th>Output</th><th>Spend</th></tr></thead>
        <tbody id="days"></tbody>
      </table>
    </section>
  </main>
  <script>
    const secretInput = document.getElementById("secret");
    const saved = sessionStorage.getItem("toodles-admin-secret") || "";
    secretInput.value = saved;
    document.getElementById("loadBtn").addEventListener("click", loadStats);
    secretInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loadStats();
    });

    async function loadStats() {
      const secret = secretInput.value.trim();
      sessionStorage.setItem("toodles-admin-secret", secret);
      document.getElementById("error").textContent = "";
      const response = await fetch("/api/admin/usage", {
        headers: { "X-Admin-Secret": secret }
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        document.getElementById("stats").hidden = true;
        document.getElementById("error").textContent = json.error || "Could not load stats.";
        return;
      }
      render(json);
    }

    function render(data) {
      document.getElementById("stats").hidden = false;
      document.getElementById("todaySpend").textContent = usd(data.today.estimatedUsd) + " / " + usd(data.today.capUsd);
      document.getElementById("remaining").textContent = usd(data.today.remainingUsd);
      document.getElementById("requests").textContent = String(data.today.requests);
      document.getElementById("monthSpend").textContent = usd(data.month.estimatedUsd);
      document.getElementById("days").innerHTML = data.last7Days.map((day) => "<tr><td>" + esc(day.day) + "</td><td>" + day.requests + "</td><td>" + day.failures + "</td><td>" + day.inputTokens + "</td><td>" + day.outputTokens + "</td><td>" + usd(day.estimatedUsd) + "</td></tr>").join("");
    }

    function usd(value) {
      return "$" + Number(value || 0).toFixed(4);
    }

    function esc(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }
  </script>
</body>
</html>`;
}
