export function normalizeText(value) {
  if (value == null) return "";
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function dedupeLines(value) {
  const text = normalizeText(value);
  if (!text) return "";

  const seen = new Set();
  const kept = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      if (kept.at(-1) !== "") kept.push("");
      continue;
    }

    const key = line.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;

    seen.add(key);
    kept.push(line);
  }

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function limitText(value, maxChars, label, trimReport) {
  const text = normalizeText(value);
  if (!text || text.length <= maxChars) return text;

  const shortened = text.slice(0, maxChars).trimEnd();
  trimReport.push({
    field: label,
    originalChars: text.length,
    keptChars: shortened.length,
    droppedChars: text.length - shortened.length
  });
  return shortened;
}

export function buildPacket(rawPacket, caps) {
  const trimReport = [];
  const packet = {
    packetId: normalizeText(rawPacket.packetId || rawPacket.job_id || ""),
    label: limitText(rawPacket.label || rawPacket.jobLabel || "", 240, "label", trimReport),
    sourceText: limitText(
      rawPacket.sourceText || rawPacket.source_text || "",
      caps.source,
      "sourceText",
      trimReport
    ),
    fieldNotes: limitText(
      rawPacket.fieldNotes || rawPacket.field_notes || "",
      caps.fieldNotes,
      "fieldNotes",
      trimReport
    ),
    ocrText: limitText(
      dedupeLines(rawPacket.ocrText || rawPacket.ocr_text || ""),
      caps.ocr,
      "ocrText",
      trimReport
    ),
    laborNotes: limitText(
      rawPacket.laborNotes || rawPacket.labor_notes || "",
      caps.labor,
      "laborNotes",
      trimReport
    ),
    followUp: limitText(
      rawPacket.followUp || rawPacket.follow_up || "",
      caps.followUp,
      "followUp",
      trimReport
    )
  };

  return { packet, trimReport };
}

export function hasUsefulPacketText(packet) {
  return Boolean(
    packet.sourceText ||
      packet.fieldNotes ||
      packet.ocrText ||
      packet.laborNotes ||
      packet.followUp
  );
}
