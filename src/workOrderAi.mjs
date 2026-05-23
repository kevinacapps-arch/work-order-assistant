import { SYSTEM_PROMPT, packetToUserPrompt, refinementPrompt } from "./prompt.mjs";
import { buildPacket, hasUsefulPacketText } from "./sanitize.mjs";

export function capsFromEnv(env = process.env) {
  return {
    source: numberFromEnv(env.MAX_SOURCE_CHARS, 12000),
    fieldNotes: numberFromEnv(env.MAX_FIELD_NOTES_CHARS, 12000),
    ocr: numberFromEnv(env.MAX_OCR_CHARS, 12000),
    labor: numberFromEnv(env.MAX_LABOR_CHARS, 5000),
    followUp: numberFromEnv(env.MAX_FOLLOW_UP_CHARS, 5000)
  };
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function draftWorkOrder(rawPacket) {
  const { packet, trimReport } = buildPacket(rawPacket, capsFromEnv());
  if (!hasUsefulPacketText(packet)) {
    const error = new Error("Packet does not include any work order text, notes, OCR, labor context, or follow-up.");
    error.statusCode = 400;
    throw error;
  }

  const response = await callOpenAI(packetToUserPrompt(packet));
  return {
    packetId: packet.packetId || null,
    label: packet.label || null,
    draftNote: response.text,
    model: response.model,
    usage: response.usage,
    trimReport
  };
}

export async function refineWorkOrder(rawBody) {
  const { packet, trimReport } = buildPacket(rawBody.packet || rawBody, capsFromEnv());
  const currentNote = String(rawBody.currentNote || rawBody.current_note || "").trim();
  const correction = String(rawBody.correction || rawBody.userCorrection || "").trim();

  if (!currentNote) {
    const error = new Error("Refine request needs currentNote.");
    error.statusCode = 400;
    throw error;
  }

  if (!correction) {
    const error = new Error("Refine request needs correction.");
    error.statusCode = 400;
    throw error;
  }

  const response = await callOpenAI(refinementPrompt(packet, currentNote, correction));
  return {
    packetId: packet.packetId || null,
    label: packet.label || null,
    revisedNote: response.text,
    model: response.model,
    usage: response.usage,
    trimReport
  };
}

export async function batchDraft(rawPackets) {
  if (!Array.isArray(rawPackets)) {
    const error = new Error("Batch request needs packets array.");
    error.statusCode = 400;
    throw error;
  }

  const maxPackets = numberFromEnv(process.env.MAX_BATCH_PACKETS, 10);
  if (rawPackets.length > maxPackets) {
    const error = new Error(`Batch request limit is ${maxPackets} packets.`);
    error.statusCode = 413;
    throw error;
  }

  const results = [];
  for (const packet of rawPackets) {
    try {
      results.push(await draftWorkOrder(packet));
    } catch (error) {
      results.push({
        packetId: packet?.packetId || packet?.job_id || null,
        label: packet?.label || packet?.jobLabel || null,
        error: error.message
      });
    }
  }

  return { results };
}

async function callOpenAI(userPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || "low";
  const timeoutMs = numberFromEnv(process.env.OPENAI_TIMEOUT_MS, 60_000);
  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY is not set.");
    error.statusCode = 500;
    throw error;
  }

  const body = {
    model,
    instructions: SYSTEM_PROMPT,
    input: userPrompt,
    max_output_tokens: 900
  };

  if (reasoningEffort && reasoningEffort !== "default") {
    body.reasoning = { effort: reasoningEffort };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("OpenAI request timed out.");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = json?.error?.message || response.statusText || "OpenAI request failed.";
    const error = new Error(detail);
    error.statusCode = response.status;
    error.openai = json;
    throw error;
  }

  const text = extractOutputText(json);
  if (!text) {
    const error = new Error("OpenAI returned no text.");
    error.statusCode = 502;
    error.openai = json;
    throw error;
  }

  return {
    model,
    text,
    usage: json.usage || null
  };
}

export function extractOutputText(json) {
  if (typeof json?.output_text === "string") return json.output_text.trim();

  const parts = [];
  for (const item of json?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}
