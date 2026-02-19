import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import path from "path";

const SKILL_DIR = path.resolve("packages/integrations/openclaw");
const SCRIPTS_DIR = path.join(SKILL_DIR, "scripts");
const STATE_FILE = path.join(SCRIPTS_DIR, ".v402-state.json");
const SKILL_FILE = path.join(SKILL_DIR, "SKILL.md");

const BASE_ENV: Record<string, string> = {
  ...process.env as Record<string, string>,
  V402_DAILY_CAP: "5.0",
  V402_PER_CALL_CAP: "1.0",
  V402_ALLOWED_TOOLS: "web_search,get_token_price",
  V402_ALLOWED_MERCHANTS: "merchant_a,merchant_b",
  V402_WALLET_PRIVATE_KEY: "unused_for_policy_tests",
};

function runPolicy(cmd: string, envOverrides: Record<string, string> = {}): unknown {
  const env = { ...BASE_ENV, ...envOverrides };
  const result = execSync(`node v402-policy.mjs ${cmd}`, {
    cwd: SCRIPTS_DIR,
    env,
    encoding: "utf8",
  });
  return JSON.parse(result.trim());
}

function cleanState() {
  if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
}

beforeEach(() => cleanState());
afterAll(() => cleanState());

// ── Policy script tests ─────────────────────────────────────────────────

describe("v402-policy.mjs check", () => {
  it("allows payment within caps", () => {
    const res = runPolicy("check --amount 0.5 --tool_id web_search --merchant merchant_a") as {
      allowed: boolean;
      reason: string;
    };
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe("ok");
  });

  it("blocks amount exceeding per-call cap", () => {
    const res = runPolicy("check --amount 2.0 --tool_id web_search") as {
      allowed: boolean;
      reason: string;
    };
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("per-call cap");
  });

  it("blocks tool not in allowlist", () => {
    const res = runPolicy("check --amount 0.01 --tool_id hack_tool") as {
      allowed: boolean;
      reason: string;
    };
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("not in allowed list");
    expect(res.reason).toContain("hack_tool");
  });

  it("blocks merchant not in allowlist", () => {
    const res = runPolicy("check --amount 0.01 --tool_id web_search --merchant unknown_merchant") as {
      allowed: boolean;
      reason: string;
    };
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("not in allowed list");
    expect(res.reason).toContain("unknown_merchant");
  });

  it("blocks when daily cap would be exceeded", () => {
    runPolicy(
      "record --amount 4.5 --tool_id web_search --merchant merchant_a --tx_signature sig1 --intent_id i1",
    );
    const res = runPolicy("check --amount 0.6 --tool_id web_search --merchant merchant_a") as {
      allowed: boolean;
      reason: string;
    };
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Daily cap");
  });
});

describe("v402-policy.mjs record", () => {
  it("increments daily spent", () => {
    runPolicy("record --amount 1.5 --tool_id web_search --merchant merchant_a --tx_signature sig1 --intent_id i1");
    const budget = runPolicy("budget") as { spent_today: number };
    expect(budget.spent_today).toBeCloseTo(1.5);
  });
});

describe("v402-policy.mjs budget", () => {
  it("returns correct remaining after record", () => {
    runPolicy("record --amount 2.0 --tool_id web_search --merchant merchant_a --tx_signature sig1 --intent_id i1");
    const budget = runPolicy("budget") as {
      daily_cap: number;
      spent_today: number;
      remaining: number;
      per_call_cap: number;
    };
    expect(budget.daily_cap).toBe(5);
    expect(budget.per_call_cap).toBe(1);
    expect(budget.spent_today).toBeCloseTo(2.0);
    expect(budget.remaining).toBeCloseTo(3.0);
  });
});

describe("v402-policy.mjs history", () => {
  it("returns recorded payments", () => {
    runPolicy("record --amount 0.1 --tool_id web_search --merchant merchant_a --tx_signature sig1 --intent_id i1");
    runPolicy("record --amount 0.2 --tool_id get_token_price --merchant merchant_b --tx_signature sig2 --intent_id i2");
    const history = runPolicy("history") as {
      total: number;
      payments: Array<{ tool_id: string; amount: number }>;
    };
    expect(history.total).toBe(2);
    expect(history.payments).toHaveLength(2);
    expect(history.payments[0].tool_id).toBe("web_search");
    expect(history.payments[1].tool_id).toBe("get_token_price");
  });
});

describe("v402-policy.mjs reset", () => {
  it("clears state", () => {
    runPolicy("record --amount 3.0 --tool_id web_search --merchant merchant_a --tx_signature sig1 --intent_id i1");
    runPolicy("reset");
    const budget = runPolicy("budget") as { spent_today: number };
    expect(budget.spent_today).toBe(0);
  });
});

describe("v402-policy.mjs day rollover", () => {
  it("resets dailySpent when dayStart is yesterday", () => {
    runPolicy("record --amount 4.0 --tool_id web_search --merchant merchant_a --tx_signature sig1 --intent_id i1");

    // Manually set dayStart to yesterday
    const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    state.dayStart = yesterday.toISOString();
    writeFileSync(STATE_FILE, JSON.stringify(state));

    const budget = runPolicy("budget") as { spent_today: number; remaining: number };
    expect(budget.spent_today).toBe(0);
    expect(budget.remaining).toBe(5);
  });
});

// ── SKILL.md frontmatter tests ──────────────────────────────────────────

describe("SKILL.md", () => {
  function parseFrontmatter() {
    const content = readFileSync(SKILL_FILE, "utf8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const result: Record<string, string> = {};
    const lines = match[1].split("\n");
    for (const line of lines) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        result[key] = val;
      }
    }
    return result;
  }

  it("exists and has valid YAML frontmatter", () => {
    expect(existsSync(SKILL_FILE)).toBe(true);
    const fm = parseFrontmatter();
    expect(fm).not.toBeNull();
    expect(fm!.name).toBeDefined();
    expect(fm!.description).toBeDefined();
    expect(fm!.metadata).toBeDefined();
  });

  it("frontmatter has name = v402", () => {
    const fm = parseFrontmatter()!;
    expect(fm.name).toBe("v402");
  });

  it("frontmatter metadata is valid single-line JSON", () => {
    const fm = parseFrontmatter()!;
    const metaRaw = fm.metadata;
    expect(() => JSON.parse(metaRaw)).not.toThrow();
  });

  it("metadata.openclaw.requires.bins includes node", () => {
    const fm = parseFrontmatter()!;
    const meta = JSON.parse(fm.metadata);
    expect(meta.openclaw.requires.bins).toContain("node");
  });

  it("metadata.openclaw.requires.env includes V402_WALLET_PRIVATE_KEY", () => {
    const fm = parseFrontmatter()!;
    const meta = JSON.parse(fm.metadata);
    expect(meta.openclaw.requires.env).toContain("V402_WALLET_PRIVATE_KEY");
  });
});
