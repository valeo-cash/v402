import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { createGatewayContext, v402GatewayFastify } from "@v402pay/gateway";
import { createV402Client } from "@v402pay/sdk";
import type { PaymentIntent } from "@v402pay/core";

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
