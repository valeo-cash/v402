import { describe, it, expect } from "vitest";
import { sha256Hex, requestHash } from "../hash.js";

describe("sha256Hex", () => {
  it("returns lowercase hex string", () => {
    const out = sha256Hex("hello");
    expect(out).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic", () => {
    expect(sha256Hex("same")).toBe(sha256Hex("same"));
  });

  it("differs for different input", () => {
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });
});

describe("requestHash", () => {
  it("hashes canonical request string", () => {
    const h = requestHash("GET\n/api\n\n\n");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for same canonical request", () => {
    const c = "POST\n/run\n\n{\"x\":1}\napplication/json";
    expect(requestHash(c)).toBe(requestHash(c));
  });
});
