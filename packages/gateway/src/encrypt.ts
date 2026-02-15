import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(encryptionKey: string): Buffer {
  const key = Buffer.from(encryptionKey, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32-byte hex");
  }
  return key;
}

export function encryptMerchantKey(plaintext: string, encryptionKey: string): string {
  const key = getKey(encryptionKey);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = (cipher as unknown as { getAuthTag(): Buffer }).getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptMerchantKey(ciphertext: string, encryptionKey: string): string {
  const key = getKey(encryptionKey);
  const buf = Buffer.from(ciphertext, "base64");
  if (buf.length < IV_LEN + TAG_LEN) throw new Error("Invalid ciphertext");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString("utf8") + decipher.final("utf8");
}
