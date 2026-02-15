import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildCanonicalRequest, requestHash, type PaymentIntent } from "@v402pay/core";
import type { GatewayConfig } from "./config.js";
import { getGatewayConfig } from "./config.js";
import {
  findToolByPath,
  verifyToolMetadataSignature,
  type ToolRow,
} from "./tools.js";
import {
  findConsumedReceipt,
  findIntentByReference,
  createIntent,
  markIntentPaidVerified,
  markIntentConsumed,
  dbIntentToPaymentIntent,
} from "./intent.js";
import { getPolicyByPayer, checkPolicy, getDailySpend, incrementDailySpend } from "./policy.js";
import { verifyPayment } from "./verify.js";
import { createAndStoreReceipt } from "./receipt.js";
import { createCloudAdapter, type CloudAdapter } from "./cloud-adapter.js";

export type GatewayContext = {
  config: GatewayConfig;
  supabase: SupabaseClient;
  cloudAdapter?: CloudAdapter;
};

export function createGatewayContext(env: NodeJS.ProcessEnv): GatewayContext {
  const config = getGatewayConfig(env);
  const supabase = config.v402ApiKey
    ? (null as unknown as SupabaseClient)
    : createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const cloudAdapter =
    config.v402ApiKey && config.v402CloudUrl
      ? createCloudAdapter({ apiKey: config.v402ApiKey, baseUrl: config.v402CloudUrl })
      : undefined;
  return { config, supabase, cloudAdapter };
}

export type IncomingRequest = {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string | Uint8Array;
  contentType?: string;
};

export type V402Result =
  | { type: "402"; intent: PaymentIntent }
  | { type: "replay"; responseStatus: number; responseHeaders: Record<string, string>; responseBody: string | null; receipt: Record<string, string> }
  | { type: "forward"; upstreamRequest: IncomingRequest; intentId: string; txSig: string };

export async function handleV402(
  ctx: GatewayContext,
  req: IncomingRequest,
  intentIdHeader?: string,
  txHeader?: string,
  requestHashHeader?: string
): Promise<V402Result> {
  const canonical = buildCanonicalRequest({
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length ? req.query : undefined,
    body: req.body,
    contentType: req.contentType,
  });
  const hash = requestHash(canonical);

  if (intentIdHeader && txHeader && requestHashHeader && requestHashHeader === hash) {
    if (ctx.cloudAdapter) {
      const consumed = await ctx.cloudAdapter.getConsumedReceipt(intentIdHeader, hash);
      if (consumed) {
        return {
          type: "replay",
          responseStatus: consumed.responseStatus,
          responseHeaders: consumed.responseHeaders,
          responseBody: consumed.responseBody,
          receipt: consumed.receipt,
        };
      }
      try {
        await ctx.cloudAdapter.verifyIntent(intentIdHeader, txHeader, hash);
        return { type: "forward", upstreamRequest: req, intentId: intentIdHeader, txSig: txHeader };
      } catch {
        throw new Error("Payment verification failed");
      }
    }

    const consumed = await findConsumedReceipt(ctx.supabase, intentIdHeader, hash);
    if (consumed) {
      return {
        type: "replay",
        responseStatus: consumed.response_status,
        responseHeaders: consumed.response_headers,
        responseBody: consumed.response_body,
        receipt: {
          receiptId: consumed.receipt_id,
          serverSig: consumed.server_sig,
          ...consumed.receipt_payload,
        },
      };
    }

    const intentRow = await findIntentByReference(ctx.supabase, intentIdHeader);
    if (intentRow && (intentRow.status === "created" || intentRow.status === "paid_verified")) {
      const intent = dbIntentToPaymentIntent(intentRow, hash);
      const { payer } = await verifyPayment(txHeader, intent, ctx.config);
      await markIntentPaidVerified(ctx.supabase, intentRow.intent_id, payer);

      const toolRow = await ctx.supabase
        .from("tools")
        .select("tool_id, merchant_wallet")
        .eq("id", intentRow.tool_id)
        .single();
      const tw = toolRow.data as { tool_id: string; merchant_wallet: string } | null;
      const policy = await getPolicyByPayer(ctx.supabase, payer);
      const dailySpend = await getDailySpend(ctx.supabase, payer);
      const check = checkPolicy(policy ?? {}, {
        amount: parseFloat(intentRow.amount),
        toolId: tw?.tool_id ?? "",
        merchantWallet: tw?.merchant_wallet ?? "",
        dailySpend,
      });
      if (!check.allowed) throw new Error(check.reason ?? "Policy denied");

      await incrementDailySpend(ctx.supabase, payer, parseFloat(intentRow.amount));
      return { type: "forward", upstreamRequest: req, intentId: intentRow.intent_id, txSig: txHeader };
    }
  }

  const baseUrl = req.headers["x-forwarded-host"]
    ? `${req.headers["x-forwarded-proto"] ?? "https"}://${req.headers["x-forwarded-host"]}`
    : req.headers.origin ?? "";

  if (ctx.cloudAdapter) {
    const body =
      typeof req.body === "string" ? req.body : Buffer.from(req.body).toString("utf8");
    const intent = await ctx.cloudAdapter.createIntent({
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length ? req.query : undefined,
      body: req.body,
      contentType: req.contentType,
      baseUrl,
      requestHash: hash,
    });
    return { type: "402", intent };
  }

  const tool = await findToolByPath(ctx.supabase, baseUrl, req.path);
  if (!tool) throw new Error("Tool not found");

  const validSig = await verifyToolMetadataSignature(tool as ToolRow);
  if (!validSig) throw new Error("Tool metadata signature invalid");

  const amount = resolveAmount(tool as ToolRow);
  const intentRow = await createIntent(ctx.supabase, {
    toolId: tool.tool_id,
    toolDbId: tool.id,
    amount: String(amount),
    currency: tool.accepted_currency,
    recipient: tool.merchant_wallet,
    requestHash: hash,
  });

  const intent: PaymentIntent = {
    intentId: intentRow.intent_id,
    toolId: (tool as ToolRow).tool_id,
    amount: intentRow.amount,
    currency: intentRow.currency as "USDC" | "SOL",
    chain: "solana",
    recipient: intentRow.recipient,
    reference: intentRow.reference,
    expiresAt: intentRow.expires_at,
    requestHash: hash,
  };

  return { type: "402", intent };
}

function resolveAmount(tool: ToolRow): number {
  const model = tool.pricing_model as { per_call?: number; per_step?: number };
  return model.per_call ?? model.per_step ?? 0;
}

export async function completeWithReceipt(
  ctx: GatewayContext,
  intentId: string,
  txSig: string,
  requestHashValue: string,
  responseStatus: number,
  responseHeaders: Record<string, string>,
  responseBody: string
): Promise<{ receiptId: string; serverSig: string; payload: Record<string, string> }> {
  if (ctx.cloudAdapter) {
    const result = await ctx.cloudAdapter.storeReceipt({
      intentId,
      requestHash: requestHashValue,
      txSig,
      payer: "",
      responseStatus,
      responseHeaders,
      responseBody,
    });
    return {
      receiptId: result.receiptId,
      serverSig: result.serverSig,
      payload: result.payload,
    };
  }

  const intentRow = await findIntentByReference(ctx.supabase, intentId);
  if (!intentRow) throw new Error("Intent not found");

  const tool = await ctx.supabase
    .from("tools")
    .select("id, tool_id, merchant_wallet, merchants(signing_public_key, signing_private_key_encrypted)")
    .eq("id", intentRow.tool_id)
    .single();

  const toolData = tool.data as {
    id: string;
    tool_id: string;
    merchant_wallet: string;
    merchants: { signing_public_key: string; signing_private_key_encrypted: string } | null;
  } | null;
  if (!toolData?.merchants) throw new Error("Merchant signing key not found");

  const { payload, receiptId, serverSig } = await createAndStoreReceipt(ctx.supabase, {
    intentId,
    intentDbId: intentRow.id,
    toolId: toolData.tool_id,
    toolDbId: toolData.id,
    requestHash: requestHashValue,
    responseStatus,
    responseHeaders,
    responseBody,
    txSig,
    payer: intentRow.payer ?? "",
    merchantWallet: toolData.merchant_wallet,
    signingPublicKey: toolData.merchants.signing_public_key,
    signingPrivateKeyEncrypted: toolData.merchants.signing_private_key_encrypted,
    encryptionKey: ctx.config.encryptionKey,
  });

  await markIntentConsumed(ctx.supabase, intentId);

  return {
    receiptId,
    serverSig,
    payload: {
      receiptId: payload.receiptId,
      intentId: payload.intentId,
      toolId: payload.toolId,
      requestHash: payload.requestHash,
      responseHash: payload.responseHash,
      txSig: payload.txSig,
      payer: payload.payer,
      merchant: payload.merchant,
      timestamp: payload.timestamp,
      serverSig,
    },
  };
}
