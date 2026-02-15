/**
 * Hash utilities for canonical request signing.
 * Uses Node `crypto` and `Buffer`; for browser builds use a bundler that polyfills
 * (e.g. globalThis.crypto, buffer) or ensure the runtime provides Node-compatible crypto.
 */
import { createHash } from "crypto";

/**
 * SHA-256 of input, hex-encoded (lowercase).
 * @param input - UTF-8 string or bytes
 * @returns 64-char hex string
 */
export function sha256Hex(input: string | Uint8Array): string {
  const data = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Request hash from canonical request string (UTF-8). Used for V402-Request-Hash header.
 * @param canonicalRequest - Canonical request string from buildCanonicalRequest
 * @returns 64-char hex string
 */
export function requestHash(canonicalRequest: string): string {
  return sha256Hex(canonicalRequest);
}
