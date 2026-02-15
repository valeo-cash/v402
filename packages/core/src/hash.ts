import { createHash } from "crypto";

/**
 * SHA-256 of input, hex-encoded (lowercase).
 */
export function sha256Hex(input: string | Uint8Array): string {
  const data = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Request hash from canonical request string (UTF-8).
 */
export function requestHash(canonicalRequest: string): string {
  return sha256Hex(canonicalRequest);
}
