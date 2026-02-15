import { createHash, createPrivateKey, createPublicKey, sign, verify } from "crypto";
import type { ReceiptPayload } from "./types.js";
import { stableStringify } from "./canonical.js";

// Lazy-init @noble/ed25519 via dynamic import so DTS build does not emit require() for ESM-only package.
// Set etc.sha512Sync in Node (createHash) so sync sign/verify work; in browser leave unset (async APIs only).
type Ed25519Module = {
  sign: (message: Uint8Array, privateKey: Uint8Array) => Uint8Array | Promise<Uint8Array>;
  verify: (sig: Uint8Array, message: Uint8Array, publicKey: Uint8Array) => boolean;
  etc?: { sha512Sync?: (...m: Uint8Array[]) => Uint8Array };
};
let ed25519Init: Promise<Ed25519Module> | null = null;
async function getEd25519(): Promise<Ed25519Module> {
  if (ed25519Init == null) {
    ed25519Init = (async () => {
      const ed = (await import("@noble/ed25519")) as unknown as Ed25519Module;
      if (ed.etc != null && typeof ed.etc.sha512Sync !== "function" && typeof createHash === "function") {
        ed.etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array => {
          const totalLen = messages.reduce((s, a) => s + a.length, 0);
          const buf = new Uint8Array(totalLen);
          let off = 0;
          for (const a of messages) {
            buf.set(a, off);
            off += a.length;
          }
          return new Uint8Array(createHash("sha512").update(buf).digest());
        };
      }
      return ed;
    })();
  }
  return ed25519Init;
}

const RECEIPT_CANONICAL_KEYS = [
  "receiptId",
  "intentId",
  "toolId",
  "requestHash",
  "responseHash",
  "txSig",
  "payer",
  "merchant",
  "timestamp",
] as const;

export function buildCanonicalReceiptPayload(payload: ReceiptPayload): string {
  const ordered: Record<string, string> = {};
  for (const k of RECEIPT_CANONICAL_KEYS) {
    if (payload[k] !== undefined) ordered[k] = String(payload[k]);
  }
  return stableStringify(ordered);
}

/**
 * Sign receipt with Ed25519. privateKeyOrSeed: PEM string or 32-byte hex seed.
 */
export async function signReceipt(
  payload: ReceiptPayload,
  privateKeyOrSeed: string | Uint8Array
): Promise<string> {
  const canonical = buildCanonicalReceiptPayload(payload);
  const data = Buffer.from(canonical, "utf8");

  if (typeof privateKeyOrSeed === "string" && privateKeyOrSeed.startsWith("-----")) {
    const key = createPrivateKey(privateKeyOrSeed);
    const sig = sign("ed25519", data, key);
    return sig.toString("base64");
  }

  const seed =
    typeof privateKeyOrSeed === "string"
      ? Buffer.from(privateKeyOrSeed, "hex")
      : privateKeyOrSeed;
  if (seed.length !== 32) throw new Error("Ed25519 seed must be 32 bytes");
  const ed = await getEd25519();
  const sig = await ed.sign(data, seed);
  return Buffer.from(sig).toString("base64");
}

/**
 * Verify receipt Ed25519 signature. publicKey: PEM or 32-byte hex.
 */
export async function verifyReceiptSignature(
  payload: ReceiptPayload,
  signatureBase64: string,
  publicKey: string
): Promise<boolean> {
  const canonical = buildCanonicalReceiptPayload(payload);
  const data = Buffer.from(canonical, "utf8");
  const sigBuf = Buffer.from(signatureBase64, "base64");

  try {
    if (publicKey.startsWith("-----") || publicKey.length > 100) {
      const key = createPublicKey(publicKey);
      return verify("ed25519", data, key, sigBuf);
    }
    const keyBuf = Buffer.from(publicKey, "hex");
    if (keyBuf.length === 32) {
      const ed = await getEd25519();
      return ed.verify(sigBuf, data, keyBuf);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Sign an arbitrary message with Ed25519 (e.g. canonical tool metadata). privateKeyOrSeed: 32-byte hex or PEM.
 */
export async function signEd25519Message(
  message: string,
  privateKeyOrSeed: string | Uint8Array
): Promise<string> {
  const data = Buffer.from(message, "utf8");
  if (typeof privateKeyOrSeed === "string" && privateKeyOrSeed.startsWith("-----")) {
    const { sign: nodeSign } = await import("crypto");
    const key = (await import("crypto")).createPrivateKey(privateKeyOrSeed);
    const sig = nodeSign(null, data, key);
    return Buffer.from(sig).toString("base64");
  }
  const seed =
    typeof privateKeyOrSeed === "string"
      ? Buffer.from(privateKeyOrSeed, "hex")
      : privateKeyOrSeed;
  if (seed.length !== 32) throw new Error("Ed25519 seed must be 32 bytes");
  const ed = await getEd25519();
  const sig = await ed.sign(data, seed);
  return Buffer.from(sig).toString("base64");
}

/**
 * Verify Ed25519 signature over an arbitrary message (e.g. canonical tool metadata).
 */
export async function verifyEd25519Message(
  message: string,
  signatureBase64: string,
  publicKeyHex: string
): Promise<boolean> {
  try {
    const ed = await getEd25519();
    const msgBuf = Buffer.from(message, "utf8");
    const sigBuf = Buffer.from(signatureBase64, "base64");
    const keyBuf = Buffer.from(publicKeyHex, "hex");
    if (keyBuf.length !== 32) return false;
    return ed.verify(sigBuf, msgBuf, keyBuf);
  } catch {
    return false;
  }
}

export function responseHash(
  status: number,
  headers: Record<string, string>,
  body: string
): string {
  const canonical = stableStringify({ status, headers, body });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
