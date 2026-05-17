import http from "node:http";
import { loadEnvFile } from "./env.mjs";
import { batchDraft, draftWorkOrder, refineWorkOrder } from "./workOrderAi.mjs";

loadEnvFile();

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const SHARED_SECRET = process.env.APP_SHARED_SECRET || "";

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      return sendJson(res, 204, null);
    }

    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && req.url === "/") {
      return sendJson(res, 200, {
        name: "work-order-assistant",
        endpoints: ["/api/draft", "/api/refine", "/api/batch", "/health"]
      });
    }

    if (!req.url?.startsWith("/api/")) {
      return sendJson(res, 404, { error: "Not found" });
    }

    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Use POST for API endpoints." });
    }

    authorize(req);
    const body = await readJson(req);

    if (req.url === "/api/draft") {
      return sendJson(res, 200, await draftWorkOrder(body));
    }

    if (req.url === "/api/refine") {
      return sendJson(res, 200, await refineWorkOrder(body));
    }

    if (req.url === "/api/batch") {
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
});

function authorize(req) {
  if (!SHARED_SECRET) return;

  const header = req.headers.authorization || "";
  const expected = `Bearer ${SHARED_SECRET}`;
  if (header !== expected) {
    const error = new Error("Unauthorized.");
    error.statusCode = 401;
    throw error;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
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

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  });

  if (status === 204) {
    res.end();
    return;
  }

  res.end(JSON.stringify(payload, null, 2));
}
