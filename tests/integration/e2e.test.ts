import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { createGatewayContext, v402GatewayFastify } from "@v402pay/gateway";
import { createV402Client, V402PaymentError } from "@v402pay/sdk";
import { buildCanonicalRequest, requestHash } from "@v402pay/core";
import type { PaymentIntent } from "@v402pay/core";

// ---------------------------------------------------------------------------
// Test mode — basic full flow
// ---------------------------------------------------------------------------

const MOCK_CLOUD_PORT = 39542;
const GATEWAY_PORT = 39543;
const MOCK_CLOUD_URL = `http://127.0.0.1:${MOCK_CLOUD_PORT}`;

let mockCloudServer: { close: () => Promise<void> };
let gatewayServer: { close: () => Promise<void> };

describe("e2e: 402 → pay → retry → 200", () => {
  beforeAll(async () => {
    const stored: Map<
      string,
      { responseStatus: number; responseHeaders: Record<string, string>; responseBody: string; receipt: Record<string, string> }
    > = new Map();
    let intentCounter = 0;

    const cloudApp = Fastify();
    cloudApp.post("/v1/intents", async (req, reply) => {
      const body = req.body as { method: string; path: string; bodyHash: string; baseUrl?: string };
      const intentId = `int-e2e-${++intentCounter}`;
      const intent: PaymentIntent = {
        intentId,
        toolId: "tool-e2e",
        amount: "0.001",
        currency: "USDC",
        chain: "solana",
        recipient: "merchant123",
        reference: `ref-${intentId}`,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        requestHash: body?.bodyHash ?? "hash",
      };
      return reply.send(intent);
    });
    cloudApp.get("/v1/receipts", async (_, reply) => {
      return reply.status(404).send({});
    });
    cloudApp.post("/v1/intents/:intentId/verify", async (req, reply) => {
      const { intentId } = req.params as { intentId: string };
      const body = req.body as { txSignature: string; requestHash: string };
      return reply.send({
        verified: true,
        payer: "payer-e2e-" + intentId,
      });
    });
    cloudApp.post("/v1/receipts", async (req, reply) => {
      const body = req.body as {
        intentId: string;
        requestHash: string;
        txSig: string;
        payer: string;
        responseStatus: number;
        responseHeaders: Record<string, string>;
        responseBody: string;
      };
      const key = `${body.intentId}:${body.requestHash}`;
      const receipt = {
        receiptId: "rec-e2e-1",
        serverSig: "sig-e2e",
        intentId: body.intentId,
        requestHash: body.requestHash,
        responseHash: "rh",
        txSig: body.txSig,
        payer: body.payer,
        merchant: "merchant123",
        timestamp: new Date().toISOString(),
      };
      stored.set(key, {
        responseStatus: body.responseStatus,
        responseHeaders: body.responseHeaders ?? {},
        responseBody: body.responseBody,
        receipt: { ...receipt, serverSig: receipt.serverSig },
      });
      return reply.send({
        receiptId: receipt.receiptId,
        serverSig: receipt.serverSig,
        intentId: receipt.intentId,
        requestHash: receipt.requestHash,
        responseHash: receipt.responseHash,
        txSig: receipt.txSig,
        payer: receipt.payer,
        merchant: receipt.merchant,
        timestamp: receipt.timestamp,
      });
    });
    await cloudApp.listen({ port: MOCK_CLOUD_PORT, host: "127.0.0.1" });
    mockCloudServer = cloudApp;

    const ctx = createGatewayContext({
      V402_API_KEY: "ck_test_e2e",
      V402_CLOUD_URL: MOCK_CLOUD_URL,
      V402_TEST_MODE: "true",
    });
    const fastify = Fastify({ logger: false });
    await v402GatewayFastify(ctx, fastify);
    fastify.post("/pay", async (_, reply) => {
      return reply.send({ ok: true, ts: new Date().toISOString() });
    });
    await fastify.listen({ port: GATEWAY_PORT, host: "127.0.0.1" });
    gatewayServer = fastify;
  });

  afterAll(async () => {
    await mockCloudServer?.close();
    await gatewayServer?.close();
  });

  it("full flow: first request 402, pay with mock wallet, retry returns 200 with V402-Receipt", async () => {
    const fakeTxSig = "tx-e2e-fake-signature";
    const adapter = {
      pay: async () => ({ txSig: fakeTxSig }),
    };
    const { fetch } = createV402Client({
      fetch: globalThis.fetch,
      walletAdapter: adapter as any,
    });
    const url = `http://127.0.0.1:${GATEWAY_PORT}/pay`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const receiptHeader = res.headers.get("V402-Receipt");
    expect(receiptHeader).toBeTruthy();
    const receipt = JSON.parse(receiptHeader!);
    expect(receipt.intentId).toMatch(/^int-e2e-/);
    expect(receipt.txSig).toBe(fakeTxSig);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Non-test-mode — policy rejection and replay
// ---------------------------------------------------------------------------

const MOCK_CLOUD_PORT_2 = 39544;
const GATEWAY_PORT_2 = 39545;
const MOCK_CLOUD_URL_2 = `http://127.0.0.1:${MOCK_CLOUD_PORT_2}`;

let mockCloudServer2: { close: () => Promise<void> };
let gatewayServer2: { close: () => Promise<void> };

let shouldRejectVerify = false;

describe("e2e: policy rejection and replay", () => {
  const stored2 = new Map<
    string,
    {
      responseStatus: number;
      responseHeaders: Record<string, string>;
      responseBody: string;
      receipt: Record<string, string>;
    }
  >();
  let intentCounter2 = 0;

  beforeAll(async () => {
    const cloudApp = Fastify();

    cloudApp.post("/v1/intents", async (req, reply) => {
      const body = req.body as { method: string; path: string; bodyHash: string; baseUrl?: string };
      const intentId = `int-e2e2-${++intentCounter2}`;
      const intent: PaymentIntent = {
        intentId,
        toolId: "tool-e2e2",
        amount: "0.001",
        currency: "USDC",
        chain: "solana",
        recipient: "merchant456",
        reference: `ref-${intentId}`,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        requestHash: body?.bodyHash ?? "hash",
      };
      return reply.send(intent);
    });

    cloudApp.get("/v1/receipts", async (req, reply) => {
      const { intentId, requestHash: rh } = req.query as { intentId?: string; requestHash?: string };
      if (!intentId || !rh) return reply.status(404).send({});
      const key = `${intentId}:${rh}`;
      const entry = stored2.get(key);
      if (!entry) return reply.status(404).send({});
      return reply.send({
        responseStatus: entry.responseStatus,
        responseHeaders: entry.responseHeaders,
        responseBody: entry.responseBody,
        ...entry.receipt,
      });
    });

    cloudApp.post("/v1/intents/:intentId/verify", async (req, reply) => {
      if (shouldRejectVerify) {
        return reply.status(403).send({ verified: false, error: "amount exceeds policy" });
      }
      const { intentId } = req.params as { intentId: string };
      return reply.send({ verified: true, payer: "payer-e2e2-" + intentId });
    });

    cloudApp.post("/v1/receipts", async (req, reply) => {
      const body = req.body as {
        intentId: string;
        requestHash: string;
        txSig: string;
        payer: string;
        responseStatus: number;
        responseHeaders: Record<string, string>;
        responseBody: string;
      };
      const key = `${body.intentId}:${body.requestHash}`;
      const receipt = {
        receiptId: `rec-e2e2-${intentCounter2}`,
        serverSig: "sig-e2e2",
        intentId: body.intentId,
        requestHash: body.requestHash,
        responseHash: "rh2",
        txSig: body.txSig,
        payer: body.payer,
        merchant: "merchant456",
        timestamp: new Date().toISOString(),
      };
      stored2.set(key, {
        responseStatus: body.responseStatus,
        responseHeaders: body.responseHeaders ?? {},
        responseBody: body.responseBody,
        receipt: { ...receipt, serverSig: receipt.serverSig },
      });
      return reply.send(receipt);
    });

    await cloudApp.listen({ port: MOCK_CLOUD_PORT_2, host: "127.0.0.1" });
    mockCloudServer2 = cloudApp;

    const ctx = createGatewayContext({
      V402_API_KEY: "ck_test_e2e2",
      V402_CLOUD_URL: MOCK_CLOUD_URL_2,
    });
    const fastify = Fastify({ logger: false });
    await v402GatewayFastify(ctx, fastify);
    fastify.post("/pay", async (_, reply) => {
      return reply.send({ ok: true, ts: new Date().toISOString() });
    });
    await fastify.listen({ port: GATEWAY_PORT_2, host: "127.0.0.1" });
    gatewayServer2 = fastify;
  });

  afterAll(async () => {
    shouldRejectVerify = false;
    await mockCloudServer2?.close();
    await gatewayServer2?.close();
  });

  it("policy rejection: cloud rejects verification → gateway returns error → SDK throws", async () => {
    shouldRejectVerify = true;
    const adapter = { pay: async () => ({ txSig: "tx-policy-reject" }) };
    const { fetch: v402Fetch } = createV402Client({
      fetch: globalThis.fetch,
      walletAdapter: adapter as any,
    });

    const url = `http://127.0.0.1:${GATEWAY_PORT_2}/pay`;
    let caughtError: unknown;
    try {
      await v402Fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: "policy" }),
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(V402PaymentError);
    expect((caughtError as V402PaymentError).code).toBe("RETRY_FAILED");
    shouldRejectVerify = false;
  });

  it("replay: same proof on second request returns stored response (idempotent)", async () => {
    const url = `http://127.0.0.1:${GATEWAY_PORT_2}/pay`;
    const bodyStr = JSON.stringify({ test: "replay" });

    const canonical = buildCanonicalRequest({
      method: "POST",
      path: "/pay",
      body: bodyStr,
      contentType: "application/json",
    });
    const hash = requestHash(canonical);

    // Step 1: first request → 402 with intent
    const first = await globalThis.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyStr,
    });
    expect(first.status).toBe(402);
    const intent = (await first.json()) as PaymentIntent;
    expect(intent.intentId).toBeTruthy();

    // Step 2: paid retry → cloud verifies → forward → 200 + receipt stored
    const second = await globalThis.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "v402-intent": intent.intentId,
        "v402-tx": "tx-replay-proof",
        "v402-request-hash": hash,
      },
      body: bodyStr,
    });
    expect(second.status).toBe(200);
    const secondReceipt = second.headers.get("V402-Receipt");
    expect(secondReceipt).toBeTruthy();
    const secondBody = await second.json();
    expect(secondBody.ok).toBe(true);

    // Step 3: replay with same proof → consumed receipt returned
    const third = await globalThis.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "v402-intent": intent.intentId,
        "v402-tx": "tx-replay-proof",
        "v402-request-hash": hash,
      },
      body: bodyStr,
    });
    expect(third.status).toBe(200);
    const thirdReceipt = third.headers.get("V402-Receipt");
    expect(thirdReceipt).toBeTruthy();

    const replayedReceipt = JSON.parse(thirdReceipt!);
    expect(replayedReceipt.intentId).toBe(intent.intentId);
    expect(replayedReceipt.txSig).toBe("tx-replay-proof");
  });
});
