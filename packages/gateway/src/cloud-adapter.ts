/**
 * v402 Cloud API adapter. When V402_API_KEY is set, the gateway uses this
 * instead of Supabase for intents, verification, and receipts.
 */

import type { PaymentIntent } from "@v402pay/core";

export type CloudAdapterConfig = {
  apiKey: string;
  baseUrl: string;
};

export type CloudAdapter = {
  createIntent(params: {
    method: string;
    path: string;
    query?: Record<string, string>;
    body: string | Uint8Array;
    contentType?: string;
    baseUrl: string;
    requestHash: string;
  }): Promise<PaymentIntent>;
  getConsumedReceipt(intentId: string, requestHash: string): Promise<{
    responseStatus: number;
    responseHeaders: Record<string, string>;
    responseBody: string | null;
    receipt: Record<string, string>;
  } | null>;
  verifyIntent(intentId: string, txSignature: string, requestHash: string): Promise<{ payer: string }>;
  storeReceipt(params: {
    intentId: string;
    requestHash: string;
    txSig: string;
    payer: string;
    responseStatus: number;
    responseHeaders: Record<string, string>;
    responseBody: string;
  }): Promise<{ receiptId: string; serverSig: string; payload: Record<string, string> }>;
};

export function createCloudAdapter(config: CloudAdapterConfig): CloudAdapter {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  const base = config.baseUrl.replace(/\/$/, "");

  return {
    async createIntent(params) {
      const res = await fetch(`${base}/v1/intents`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          method: params.method,
          path: params.path,
          query: params.query,
          bodyHash: params.requestHash,
          contentType: params.contentType,
          baseUrl: params.baseUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Cloud createIntent failed: ${res.status} ${err}`);
      }
      const data = (await res.json()) as PaymentIntent;
      return data;
    },

    async getConsumedReceipt(intentId, requestHashValue) {
      const url = `${base}/v1/receipts?intentId=${encodeURIComponent(intentId)}&requestHash=${encodeURIComponent(requestHashValue)}`;
      const res = await fetch(url, { method: "GET", headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Cloud getReceipt failed: ${res.status}`);
      const data = (await res.json()) as {
        responseStatus: number;
        responseHeaders: Record<string, string>;
        responseBody: string | null;
        receiptId: string;
        serverSig: string;
        intentId: string;
        requestHash: string;
        responseHash: string;
        txSig: string;
        payer: string;
        merchant: string;
        timestamp: string;
      };
      return {
        responseStatus: data.responseStatus,
        responseHeaders: data.responseHeaders ?? {},
        responseBody: data.responseBody,
        receipt: {
          receiptId: data.receiptId,
          serverSig: data.serverSig,
          intentId: data.intentId,
          requestHash: data.requestHash,
          responseHash: data.responseHash,
          txSig: data.txSig,
          payer: data.payer,
          merchant: data.merchant,
          timestamp: data.timestamp,
        },
      };
    },

    async verifyIntent(intentId, txSignature, requestHashValue) {
      const res = await fetch(`${base}/v1/intents/${encodeURIComponent(intentId)}/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({ txSignature, requestHash: requestHashValue }),
      });
      const data = (await res.json()) as { verified: boolean; payer?: string; error?: string };
      if (!res.ok || !data.verified) {
        throw new Error(data.error ?? `Cloud verify failed: ${res.status}`);
      }
      if (!data.payer) throw new Error("Cloud verify did not return payer");
      return { payer: data.payer };
    },

    async storeReceipt(params) {
      const res = await fetch(`${base}/v1/receipts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          intentId: params.intentId,
          requestHash: params.requestHash,
          txSig: params.txSig,
          payer: params.payer,
          responseStatus: params.responseStatus,
          responseHeaders: params.responseHeaders,
          responseBody: params.responseBody,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Cloud storeReceipt failed: ${res.status} ${err}`);
      }
      const data = (await res.json()) as {
        receiptId: string;
        serverSig: string;
        intentId: string;
        requestHash: string;
        responseHash: string;
        txSig: string;
        payer: string;
        merchant: string;
        timestamp: string;
      };
      return {
        receiptId: data.receiptId,
        serverSig: data.serverSig,
        payload: {
          receiptId: data.receiptId,
          intentId: data.intentId,
          requestHash: data.requestHash,
          responseHash: data.responseHash,
          txSig: data.txSig,
          payer: data.payer,
          merchant: data.merchant,
          timestamp: data.timestamp,
          serverSig: data.serverSig,
        },
      };
    },
  };
}
