/**
 * Canonical representation for request hashing (deterministic across SDK and gateway).
 * Spec: docs/spec.md §1.
 */

function normalizePath(path: string): string {
  let p = path.replace(/\/+/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

function buildSortedQuery(query: Record<string, string>): string {
  const keys = Object.keys(query).sort();
  return keys.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join("&");
}

/**
 * Stable JSON stringify with sorted object keys (recursive).
 */
export function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object).sort();
    const pairs = keys.map(
      (k) => JSON.stringify(k) + ":" + stableStringify((value as Record<string, unknown>)[k])
    );
    return "{" + pairs.join(",") + "}";
  }
  return "null";
}

export type CanonicalRequestInput = {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: string | Uint8Array;
  contentType?: string;
};

/**
 * Build canonical request string for hashing.
 * - JSON: body is parsed and stable-stringified (content-type application/json or *+json).
 * - Non-JSON: body used as raw (string or bytes); we normalize to UTF-8 string for non-binary.
 */
export function buildCanonicalRequest(input: CanonicalRequestInput): string {
  const method = input.method.toUpperCase();
  const path = normalizePath(input.path);
  const query = input.query ?? {};
  const queryStr = buildSortedQuery(query);
  // Normalize so client and gateway match (e.g. "application/json; charset=utf-8" → "application/json")
  const contentType = (input.contentType ?? "").split(";")[0].trim();

  let bodyPart: string;
  const rawBody = input.body;
  if (rawBody === undefined || rawBody === "") {
    bodyPart = "";
  } else if (
    contentType &&
    (contentType.startsWith("application/json") || contentType.includes("+json"))
  ) {
    const str = typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody);
    try {
      const parsed = JSON.parse(str) as unknown;
      bodyPart = stableStringify(parsed);
    } catch {
      bodyPart = str;
    }
  } else {
    bodyPart = typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody);
  }

  return [method, path, queryStr, bodyPart, contentType].join("\n");
}
