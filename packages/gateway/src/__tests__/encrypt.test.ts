import { describe, it, expect } from "vitest";
import { encryptMerchantKey, decryptMerchantKey } from "../encrypt.js";

const validKey = "a".repeat(64);

describe("encrypt/decrypt roundtrip", () => {
  it("decrypt(encrypt(plaintext)) === plaintext", () => {
    const plain = "deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567";
    const enc = encryptMerchantKey(plain, validKey);
    const dec = decryptMerchantKey(enc, validKey);
    expect(dec).toBe(plain);
  });

  it("produces different ciphertext each time (IV is random)", () => {
    const enc1 = encryptMerchantKey("same", validKey);
    const enc2 = encryptMerchantKey("same", validKey);
    expect(enc1).not.toBe(enc2);
    expect(decryptMerchantKey(enc1, validKey)).toBe("same");
    expect(decryptMerchantKey(enc2, validKey)).toBe("same");
  });
});

describe("ENCRYPTION_KEY validation", () => {
  it("rejects non-32-byte hex", () => {
    expect(() => encryptMerchantKey("x", "short")).toThrow(/32-byte hex/);
    expect(() => encryptMerchantKey("x", "g".repeat(64))).toThrow(/32-byte hex/);
  });

  it("accepts 32-byte hex", () => {
    expect(() => encryptMerchantKey("x", validKey)).not.toThrow();
  });
});
