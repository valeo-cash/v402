import { describe, it, expect } from "vitest";
import { hasV402Memo, extractMemoReference } from "../solana/memo.js";

describe("extractMemoReference", () => {
  it("returns reference when memo is v402:<ref>", () => {
    expect(extractMemoReference("v402:abc-123")).toBe("abc-123");
  });

  it("returns null when memo does not start with v402:", () => {
    expect(extractMemoReference("other")).toBeNull();
  });
});

describe("hasV402Memo", () => {
  it("returns true when one memo matches v402:<reference>", () => {
    expect(hasV402Memo([{ data: "v402:ref1" }], "ref1")).toBe(true);
  });

  it("returns false when no memo matches", () => {
    expect(hasV402Memo([{ data: "v402:other" }], "ref1")).toBe(false);
  });

  it("returns true when second memo matches", () => {
    expect(hasV402Memo([{ data: "other" }, { data: "v402:ref1" }], "ref1")).toBe(true);
  });
});
