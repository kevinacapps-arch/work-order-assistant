import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);
const DEFAULT_DB_PATH = path.resolve(process.cwd(), "data", "toodles-usage.sqlite");
const DEFAULT_INPUT_COST_PER_1M = 1.25;
const DEFAULT_OUTPUT_COST_PER_1M = 10;
const DEFAULT_UNKNOWN_REQUEST_COST = 0.05;

let dbPromise = null;

export function usageConfig(env = process.env) {
  return {
    dbPath: env.USAGE_DB_PATH || DEFAULT_DB_PATH,
    dailyCapUsd: numberFromEnv(env.DAILY_SPEND_CAP_USD, 1),
    inputCostPer1M: numberFromEnv(env.OPENAI_INPUT_COST_PER_1M_TOKENS, DEFAULT_INPUT_COST_PER_1M),
    outputCostPer1M: numberFromEnv(env.OPENAI_OUTPUT_COST_PER_1M_TOKENS, DEFAULT_OUTPUT_COST_PER_1M),
    unknownRequestCostUsd: numberFromEnv(env.USAGE_UNKNOWN_REQUEST_COST_USD, DEFAULT_UNKNOWN_REQUEST_COST)
  };
}

export function tokenUsageFromResponseUsage(usage = {}) {
  const inputTokens = numberOrNull(usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = numberOrNull(usage.output_tokens ?? usage.completion_tokens);
  return { inputTokens, outputTokens };
}

export function estimateUsd(usage, config = usageConfig()) {
  const { inputTokens, outputTokens } = tokenUsageFromResponseUsage(usage);
  if (inputTokens == null && outputTokens == null) {
    return roundUsd(config.unknownRequestCostUsd);
  }

  const inputCost = ((inputTokens || 0) / 1_000_000) * config.inputCostPer1M;
  const outputCost = ((outputTokens || 0) / 1_000_000) * config.outputCostPer1M;
  return roundUsd(inputCost + outputCost);
}

export async function assertDailySpendAvailable(config = usageConfig()) {
  const today = await usageSummaryForDay(utcDay(), config);
  if (today.estimatedUsd >= config.dailyCapUsd) {
    const error = new Error("Daily AI spend cap reached. Try again tomorrow.");
    error.statusCode = 429;
    error.usage = {
      estimatedUsd: today.estimatedUsd,
      capUsd: config.dailyCapUsd
    };
    throw error;
  }
}

export async function recordAiUsage({ endpoint, model, usage, status = "success", error = null }, config = usageConfig()) {
  const db = await getDb(config.dbPath);
  const now = new Date();
  const day = utcDay(now);
  const month = day.slice(0, 7);
  const { inputTokens, outputTokens } = tokenUsageFromResponseUsage(usage);
  const estimatedUsd = status === "success" ? estimateUsd(usage, config) : 0;

  const stmt = db.prepare(`
    INSERT INTO ai_usage (
      created_at, day, month, endpoint, model, input_tokens, output_tokens,
      estimated_usd, status, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    now.toISOString(),
    day,
    month,
    endpoint,
    model || null,
    inputTokens,
    outputTokens,
    estimatedUsd,
    status,
    error ? String(error).slice(0, 500) : null
  ]);
  stmt.free();
  await persistDb(db, config.dbPath);

  return { inputTokens, outputTokens, estimatedUsd };
}

export async function usageDashboardData(config = usageConfig()) {
  const todayKey = utcDay();
  const db = await getDb(config.dbPath);
  const today = rowToSummary(sumForWhere(db, "day = ?", [todayKey]), config.dailyCapUsd);
  const month = rowToSummary(sumForWhere(db, "month = ?", [todayKey.slice(0, 7)]), config.dailyCapUsd);
  const last7Days = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = utcDay(new Date(Date.now() - offset * 24 * 60 * 60 * 1000));
    last7Days.push({
      day,
      ...rowToSummary(sumForWhere(db, "day = ?", [day]), config.dailyCapUsd)
    });
  }

  return {
    today,
    last7Days,
    month,
    config: {
      dailyCapUsd: config.dailyCapUsd,
      dbPath: config.dbPath
    }
  };
}

async function usageSummaryForDay(day, config) {
  const db = await getDb(config.dbPath);
  return rowToSummary(sumForWhere(db, "day = ?", [day]), config.dailyCapUsd);
}

async function getDb(dbPath) {
  if (!dbPromise) {
    dbPromise = openDb(dbPath);
  }
  return dbPromise;
}

async function openDb(dbPath) {
  const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  });

  await fsp.mkdir(path.dirname(dbPath), { recursive: true });
  const db = fs.existsSync(dbPath)
    ? new SQL.Database(new Uint8Array(await fsp.readFile(dbPath)))
    : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      day TEXT NOT NULL,
      month TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      estimated_usd REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error TEXT
    )
  `);
  await persistDb(db, dbPath);
  return db;
}

async function persistDb(db, dbPath) {
  await fsp.mkdir(path.dirname(dbPath), { recursive: true });
  await fsp.writeFile(dbPath, Buffer.from(db.export()));
}

function sumForWhere(db, whereSql, values) {
  const stmt = db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'success' THEN 1 END) AS requests,
      COUNT(CASE WHEN status != 'success' THEN 1 END) AS failures,
      COALESCE(SUM(input_tokens), 0) AS inputTokens,
      COALESCE(SUM(output_tokens), 0) AS outputTokens,
      COALESCE(SUM(estimated_usd), 0) AS estimatedUsd
    FROM ai_usage
    WHERE ${whereSql}
  `);
  stmt.bind(values);
  const row = stmt.step() ? stmt.getAsObject() : {};
  stmt.free();
  return row;
}

function rowToSummary(row, capUsd) {
  const estimatedUsd = roundUsd(row.estimatedUsd || 0);
  return {
    requests: Number(row.requests || 0),
    failures: Number(row.failures || 0),
    inputTokens: Number(row.inputTokens || 0),
    outputTokens: Number(row.outputTokens || 0),
    estimatedUsd,
    capUsd,
    remainingUsd: roundUsd(Math.max(0, capUsd - estimatedUsd))
  };
}

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundUsd(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000;
}
