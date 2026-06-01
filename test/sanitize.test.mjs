import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { appPageHtml } from "../src/appPage.mjs";
import { buildPacket, dedupeLines, limitText, normalizeText } from "../src/sanitize.mjs";
import { estimateUsd, recordAiUsage, usageDashboardData } from "../src/usageStore.mjs";
import { batchDraft, extractOutputText } from "../src/workOrderAi.mjs";

test("normalizeText cleans spacing and line endings", () => {
  assert.equal(normalizeText("  a\tb\r\n\r\n\r\n\r\nc  "), "a b\n\n\nc");
});

test("dedupeLines removes repeated OCR lines", () => {
  assert.equal(dedupeLines("Unit 204\nunit   204\nKitchen sink"), "Unit 204\nKitchen sink");
});

test("limitText records trim report", () => {
  const report = [];
  const value = limitText("abcdef", 3, "fieldNotes", report);
  assert.equal(value, "abc");
  assert.equal(report[0].droppedChars, 3);
});

test("buildPacket accepts snake_case and camelCase", () => {
  const { packet } = buildPacket(
    {
      job_id: "abc",
      source_text: "source",
      fieldNotes: "field",
      labor_notes: "labor"
    },
    { source: 100, fieldNotes: 100, ocr: 100, labor: 100, followUp: 100 }
  );

  assert.equal(packet.packetId, "abc");
  assert.equal(packet.sourceText, "source");
  assert.equal(packet.fieldNotes, "field");
  assert.equal(packet.laborNotes, "labor");
});

test("extractOutputText handles responses output array", () => {
  const text = extractOutputText({
    output: [
      {
        content: [{ type: "output_text", text: "Leak is repaired." }]
      }
    ]
  });

  assert.equal(text, "Leak is repaired.");
});

test("app page embedded script is valid browser JavaScript", () => {
  const script = appPageHtml().match(/<script>([\s\S]*)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
});

test("app page uses Toodles backend wiring instead of mockup API", () => {
  const html = appPageHtml();
  assert.match(html, /TOODLES/);
  assert.match(html, /\/api\/draft/);
  assert.match(html, /\/api\/refine/);
  assert.doesNotMatch(html, /api\.anthropic\.com/);
  assert.doesNotMatch(html, /one bucket per work order/i);
  assert.doesNotMatch(html, /FOR THE OFFICE/);
  assert.doesNotMatch(html, /WO #\d/);
});

test("batch requests are capped before model calls", async () => {
  const previous = process.env.MAX_BATCH_PACKETS;
  process.env.MAX_BATCH_PACKETS = "2";
  try {
    await assert.rejects(
      () => batchDraft([{ sourceText: "a" }, { sourceText: "b" }, { sourceText: "c" }]),
      /Batch request limit is 2 packets/
    );
  } finally {
    if (previous === undefined) delete process.env.MAX_BATCH_PACKETS;
    else process.env.MAX_BATCH_PACKETS = previous;
  }
});

test("usage cost estimation uses response token counts", () => {
  const cost = estimateUsd(
    { input_tokens: 1000, output_tokens: 500 },
    {
      inputCostPer1M: 2,
      outputCostPer1M: 8,
      unknownRequestCostUsd: 0.05
    }
  );

  assert.equal(cost, 0.006);
});

test("usage dashboard summarizes daily spend from sqlite", async () => {
  const config = {
    dbPath: path.join(os.tmpdir(), `toodles-usage-${Date.now()}-${Math.random()}.sqlite`),
    dailyCapUsd: 1,
    inputCostPer1M: 2,
    outputCostPer1M: 8,
    unknownRequestCostUsd: 0.05
  };

  await recordAiUsage({
    endpoint: "draft",
    model: "test-model",
    usage: { input_tokens: 1000, output_tokens: 500 },
    status: "success"
  }, config);

  const summary = await usageDashboardData(config);

  assert.equal(summary.today.requests, 1);
  assert.equal(summary.today.inputTokens, 1000);
  assert.equal(summary.today.outputTokens, 500);
  assert.equal(summary.today.estimatedUsd, 0.006);
  assert.equal(summary.today.remainingUsd, 0.994);
});
