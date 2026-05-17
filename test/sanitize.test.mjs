import test from "node:test";
import assert from "node:assert/strict";
import { buildPacket, dedupeLines, limitText, normalizeText } from "../src/sanitize.mjs";
import { extractOutputText } from "../src/workOrderAi.mjs";

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
