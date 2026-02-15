/**
 * CI-grade integration test: Fastify + v402GatewayFastify + Keypair pay on devnet.
 * First call -> 402; after pay, second call -> 200 + receipt.
 * Skips when SOLANA_RPC_URL (or full env) is missing.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import { createGatewayContext, v402GatewayFastify, encryptMerchantKey } from "@v402pay/gateway";
import { createV402Client, createKeypairAdapter } from "@v402pay/sdk";
import { canonicalToolMetadata, signEd25519Message } from "@v402pay/core";
import { createClient } from "@supabase/supabase-js";
import { Keypair } from "@solana/web3.js";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";

const PORT = 4044;
const BASE = `http://127.0.0.1:${PORT}`;

const hasEnv =
  process.env.SOLANA_RPC_URL &&
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.ENCRYPTION_KEY &&
  process.env.USDC_MINT;

describe.skipIf(!hasEnv)("v402 gateway Fastify integration", () => {
  let fastify: Awaited<ReturnType<typeof Fastify>>;
  let testUserId: string;
  let merchantId: string;
  let toolId: string;
  let signingKeypair: Keypair;
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  beforeAll(async () => {
    signingKeypair = Keypair.generate();
    const ed25519 = await import("@noble/ed25519");
    const seed = signingKeypair.secretKey.slice(0, 32);
    const pubHex = Buffer.from(await ed25519.getPublicKeyAsync(seed)).toString("hex");
    const encKey = process.env.ENCRYPTION_KEY!;
    const encrypted = encryptMerchantKey(Buffer.from(seed).toString("hex"), encKey);

    const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
      email: `v402-test-${Date.now()}@v402.local`,
      password: "test-password-123",
      email_confirm: true,
    });
    if (userErr || !userData.user) throw new Error(`Create user failed: ${userErr?.message}`);
    testUserId = userData.user.id;

    const { data: merchantRow, error: merchantErr } = await supabase
      .from("merchants")
      .insert({
        supabase_user_id: testUserId,
        wallet: signingKeypair.publicKey.toBase58(),
        signing_public_key: pubHex,
        signing_private_key_encrypted: encrypted,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (merchantErr || !merchantRow) throw new Error(`Create merchant failed: ${merchantErr?.message}`);
    merchantId = merchantRow.id;

    const now = new Date().toISOString();
    const toolMeta = canonicalToolMetadata({
      toolId: "v402-integration-tool",
      name: "Integration Tool",
      description: "E2E test",
      baseUrl: BASE,
      pathPattern: "/pay",
      pricingModel: { per_call: 0.001 },
      acceptedCurrency: "SOL",
      merchantWallet: signingKeypair.publicKey.toBase58(),
      createdAt: now,
      updatedAt: now,
    });
    const sig = await signEd25519Message(toolMeta, seed);

    const { data: toolRow, error: toolErr } = await supabase
      .from("tools")
      .insert({
        tool_id: "v402-integration-tool",
        merchant_id: merchantId,
        name: "Integration Tool",
        description: "E2E test",
        base_url: BASE,
        path_pattern: "/pay",
        pricing_model: { per_call: 0.001 },
        accepted_currency: "SOL",
        merchant_wallet: signingKeypair.publicKey.toBase58(),
        metadata_signature: sig,
        status: "active",
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (toolErr || !toolRow) throw new Error(`Create tool failed: ${toolErr?.message}`);
    toolId = toolRow.id;

    const ctx = createGatewayContext(process.env as NodeJS.ProcessEnv);
    fastify = Fastify({ logger: false });
    await v402GatewayFastify(ctx, fastify);
    fastify.post("/pay", async (_req: FastifyRequest, reply: FastifyReply) => reply.send({ ok: true }));
    await fastify.listen({ port: PORT, host: "127.0.0.1" });
  }, 15000);

  afterAll(async () => {
    if (fastify) await fastify.close();
    if (toolId) await supabase.from("tools").delete().eq("id", toolId);
    if (merchantId) await supabase.from("merchants").delete().eq("id", merchantId);
    if (testUserId) await supabase.auth.admin.deleteUser(testUserId);
  });

  it("first call returns 402 with intent; after pay, second call returns 200 + receipt", async () => {
    const payerKeypair = Keypair.generate();
    const rpcUrl = process.env.SOLANA_RPC_URL!;
    const conn = new Connection(rpcUrl);
    const airdrop = await conn.requestAirdrop(payerKeypair.publicKey, 1 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(airdrop, "confirmed");

    const url = `${BASE}/pay`;
    const init = {
      method: "POST" as const,
      headers: { "Content-Type": "application/json", Origin: BASE },
      body: JSON.stringify({}),
    };

    const first = await fetch(url, init);
    expect(first.status).toBe(402);
    const intent = (await first.json()) as { intentId: string; reference: string };
    expect(intent.intentId).toBeDefined();
    expect(intent.reference).toBeDefined();

    const adapter = createKeypairAdapter({ keypair: payerKeypair, rpcUrl });
    const { fetch: v402Fetch } = createV402Client({ walletAdapter: adapter });
    const second = await v402Fetch(url, init);
    expect(second.status).toBe(200);
    const receiptHeader = second.headers.get("v402-receipt");
    expect(receiptHeader).toBeTruthy();
    const receipt = JSON.parse(receiptHeader!);
    expect(receipt.receiptId).toBeDefined();
    expect(receipt.txSig).toBeDefined();
  }, 60000);
});
