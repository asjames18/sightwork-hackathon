/**
 * Finding the JSON answer in a Responses API body.
 *
 * With web_search on, a Responses body can hold more than one message: a short progress sentence
 * ("Pricing your Atlanta ranges...") before the search calls, then the final message with the JSON
 * the schema asked for. `output_text` may also join every message's text into one string. Reading
 * only the first text part, or parsing the joined string, then fails with "not JSON" even though the
 * answer is there. This helper looks in the order most likely to hold the real answer:
 *   1. every output_text part, last first, whole text parsed;
 *   2. the joined output_text, whole text parsed;
 *   3. the last balanced {...} or [...] block (code fences removed) that parses, last part first.
 * Pure logic, no DOM, no network.
 */

export type ResponseJson =
  | { ok: true; json: unknown; text: string }
  /** `text` is the last text seen (for the error message), or null when the body had no text. */
  | { ok: false; text: string | null };

/** Every output_text part in a Responses body, in order. */
export function outputTextParts(body: Record<string, unknown>): string[] {
  const out: string[] = [];
  const output = body.output;
  if (!Array.isArray(output)) return out;
  for (const item of output) {
    if (item === null || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part === null || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "output_text" && typeof p.text === "string") out.push(p.text);
    }
  }
  return out;
}

function tryParse(text: string): { ok: true; json: unknown } | { ok: false } {
  const t = text.trim();
  if (t.length === 0) return { ok: false };
  try {
    return { ok: true, json: JSON.parse(t) };
  } catch {
    return { ok: false };
  }
}

/** Strip a ```json ... ``` fence around the whole text, if there is one. */
function unfence(text: string): string {
  const m = /^\s*```[a-zA-Z]*\s*\n?([\s\S]*?)\n?\s*```\s*$/.exec(text);
  return m ? m[1] : text;
}

/** End index (exclusive) of the balanced JSON block starting at `start`, or -1. Skips brackets inside strings. */
function blockEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  const stack: string[] = [close];
  let inString = false;
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") {
      if (stack.pop() !== c) return -1;
      if (stack.length === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * The last top-level JSON object or array inside prose that parses, or undefined.
 * Top-level means not nested in a block already taken, scanning left to right.
 */
export function lastJsonBlock(text: string): { json: unknown; text: string } | undefined {
  const body = unfence(text);
  let found: { json: unknown; text: string } | undefined;
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === "{" || c === "[") {
      const end = blockEnd(body, i);
      if (end > 0) {
        const slice = body.slice(i, end);
        const parsed = tryParse(slice);
        if (parsed.ok) {
          found = { json: parsed.json, text: slice };
          i = end;
          continue;
        }
      }
    }
    i++;
  }
  return found;
}

/** The JSON answer in a Responses body, looked for in the order described above. */
export function findResponseJson(body: Record<string, unknown>): ResponseJson {
  const parts = outputTextParts(body);
  const joined = typeof body.output_text === "string" ? body.output_text : null;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = tryParse(unfence(parts[i]));
    if (p.ok) return { ok: true, json: p.json, text: parts[i] };
  }
  if (joined !== null) {
    const p = tryParse(unfence(joined));
    if (p.ok) return { ok: true, json: p.json, text: joined };
  }
  const texts = joined !== null ? [...parts, joined] : parts;
  for (let i = texts.length - 1; i >= 0; i--) {
    const block = lastJsonBlock(texts[i]);
    if (block) return { ok: true, json: block.json, text: block.text };
  }
  const last = parts.length > 0 ? parts[parts.length - 1] : joined;
  return { ok: false, text: last };
}
