/**
 * One-time seed: demo user + merchant + tool so you can run the merchant server
 * without using the web UI. Loads .env from repo root (../../.env).
 *
 * Run from repo root: pnpm play  (or: pnpm --filter @v402pay/gateway exec node packages/gateway/scripts/seed-demo.mjs)
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY
 * Optional: DEMO_BASE_URL (default http://localhost:4040), DEMO_MERCHANT_WALLET (default placeholder)
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env from repo root when run from packages/gateway
const root = resolve(process.cwd(), "..", "..");
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const { encryptMerchantKey } = await import("@v402pay/gateway");
const { canonicalToolMetadata, signEd25519Message } = await import("@v402pay/core");
const { getPublicKeyAsync } = await import("@noble/ed25519");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const DEMO_MERCHANT_WALLET =
  process.env.DEMO_MERCHANT_WALLET || "11111111111111111111111111111111";
const DEMO_BASE_URL = process.env.DEMO_BASE_URL || "http://localhost:4040";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ENCRYPTION_KEY) {
  console.error(
    "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ENCRYPTION_KEY. Set them in .env at repo root."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const seed = randomBytes(32);
const pubKey = await getPublicKeyAsync(seed);
const pubHex = Buffer.from(pubKey).toString("hex");
const encrypted = encryptMerchantKey(seed.toString("hex"), ENCRYPTION_KEY);

const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
  email: "demo@v402pay.local",
  password: "demo-password-change-me",
  email_confirm: true,
});
if (userErr || !userData.user) {
  if (userErr?.message?.includes("already been registered")) {
    console.log("Demo user already exists. Ensuring demo tool exists.");
    const { data: existing } = await supabase
      .from("merchants")
      .select("id")
      .limit(1)
      .single();
    if (existing) {
      console.log("Demo already seeded. Run: pnpm run server");
      process.exit(0);
    }
  }
  console.error("Create user failed:", userErr?.message);
  process.exit(1);
}

const { data: merchantRow, error: merchantErr } = await supabase
  .from("merchants")
  .insert({
    supabase_user_id: userData.user.id,
    wallet: DEMO_MERCHANT_WALLET,
    signing_public_key: pubHex,
    signing_private_key_encrypted: encrypted,
  })
  .select("id")
  .single();

if (merchantErr || !merchantRow) {
  console.error("Create merchant failed:", merchantErr?.message);
  process.exit(1);
}

const now = new Date().toISOString();
const toolMeta = canonicalToolMetadata({
  toolId: "v402-demo-tool",
  name: "Demo Tool",
  description: "Plug-and-play demo",
  baseUrl: DEMO_BASE_URL,
  pathPattern: "/pay",
  pricingModel: { per_call: 0.001 },
  acceptedCurrency: "SOL",
  merchantWallet: DEMO_MERCHANT_WALLET,
  createdAt: now,
  updatedAt: now,
});
const sig = await signEd25519Message(toolMeta, seed);

const { error: toolErr } = await supabase.from("tools").insert({
  tool_id: "v402-demo-tool",
  merchant_id: merchantRow.id,
  name: "Demo Tool",
  description: "Plug-and-play demo",
  base_url: DEMO_BASE_URL,
  path_pattern: "/pay",
  pricing_model: { per_call: 0.001 },
  accepted_currency: "SOL",
  merchant_wallet: DEMO_MERCHANT_WALLET,
  metadata_signature: sig,
  status: "active",
});

if (toolErr) {
  if (toolErr.code === "23505") {
    console.log("Demo tool already exists. Run: pnpm run server");
    process.exit(0);
  }
  console.error("Create tool failed:", toolErr.message);
  process.exit(1);
}

console.log("Demo seeded. Run: pnpm run server");
