import { describe, it, expect } from "vitest";
import { stableStringify, buildCanonicalRequest } from "../canonical.js";
import { requestHash } from "../hash.js";

describe("stableStringify", () => {
  it("sorts object keys deterministically", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("handles nested objects", () => {
    expect(stableStringify({ z: { y: 1, x: 2 } })).toBe('{"z":{"x":2,"y":1}}');
  });

  it("handles arrays and primitives", () => {
    expect(stableStringify([1, "a"])).toBe('[1,"a"]');
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(true)).toBe("true");
  });
});

describe("buildCanonicalRequest", () => {
  it("joins method, path, query, body, content-type with newline", () => {
    const out = buildCanonicalRequest({
      method: "GET",
      path: "/api/tool",
      contentType: "",
    });
    expect(out).toBe("GET\n/api/tool\n\n\n");
  });

  it("normalizes path (trailing slash removed)", () => {
    const out = buildCanonicalRequest({
      method: "GET",
      path: "/api/tool/",
      contentType: "",
    });
    expect(out).toContain("\n/api/tool\n");
  });

  it("sorts query string", () => {
    const out = buildCanonicalRequest({
      method: "GET",
      path: "/",
      query: { b: "2", a: "1" },
      contentType: "",
    });
    expect(out).toContain("a=1&b=2");
  });

  it("stable-stringifies JSON body when content-type is application/json", () => {
    const out = buildCanonicalRequest({
      method: "POST",
      path: "/",
      body: '{"z":1,"y":2}',
      contentType: "application/json",
    });
    expect(out).toContain('{"y":2,"z":1}');
  });
});

/**
 * Cross-package test vector: same input must yield same hash in SDK and gateway.
 * Spec: docs/spec.md §1.4
 */
describe("cross-package test vector", () => {
  it("GET /api/tool with query a=1,b=2 produces deterministic hash", () => {
    const canonical = buildCanonicalRequest({
      method: "GET",
      path: "/api/tool",
      query: { b: "2", a: "1" },
      contentType: "",
    });
    expect(canonical).toBe("GET\n/api/tool\na=1&b=2\n\n");
    const h = requestHash(canonical);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(requestHash("GET\n/api/tool\na=1&b=2\n\n")).toBe(h);
  });
});
