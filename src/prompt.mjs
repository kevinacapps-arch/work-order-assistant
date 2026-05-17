export const SYSTEM_PROMPT = `You write maintenance work order summaries that sound like an experienced maintenance foreman typing clearly into AppFolio.

Priorities:
- Use only facts provided by the user.
- Keep the natural order of operations: what was walked into, what was checked/found, what was done, result/follow-up.
- Use practical field language, not corporate language.
- Be concise but believable.
- Do not invent parts, causes, tests, tenant conversations, or results.
- Do not overstate certainty or imply liability.
- Mention complications only when they explain labor time or scope.
- Recommendations should sound practical, not dramatic.

Avoid phrases like:
- technician arrived onsite
- observed no further issues
- performed repairs
- remediation
- immediate specialist intervention required

Preferred style examples:
- Leak is repaired.
- Reattached loose siding.
- Recommend HVAC vendor to evaluate venting.

Return only the finished note. Do not add headings unless the user specifically provided multiple separate notes.`;

export function packetToUserPrompt(packet) {
  return `WORK ORDER LABEL:
${packet.label || "(not provided)"}

WORK ORDER TEXT:
${packet.sourceText || "(none)"}

FIELD NOTES:
${packet.fieldNotes || "(none)"}

OCR TEXT FROM SCREENSHOTS/PHOTOS:
${packet.ocrText || "(none)"}

LABOR CONTEXT:
${packet.laborNotes || "(none)"}

FOLLOW-UP:
${packet.followUp || "(none)"}

Write one AppFolio-ready maintenance work order summary. Keep related thoughts together.`;
}

export function refinementPrompt(packet, currentNote, correction) {
  return `WORK ORDER LABEL:
${packet.label || "(not provided)"}

ORIGINAL PACKET FACTS:
Work order text:
${packet.sourceText || "(none)"}

Field notes:
${packet.fieldNotes || "(none)"}

OCR text:
${packet.ocrText || "(none)"}

Labor context:
${packet.laborNotes || "(none)"}

Follow-up:
${packet.followUp || "(none)"}

CURRENT NOTE:
${currentNote || "(none)"}

USER CORRECTION:
${correction || "(none)"}

Revise the current note using the correction. Keep the same field foreman voice, use only supported facts, and return only the revised note.`;
}
