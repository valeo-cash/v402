import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyEd25519Message, canonicalToolMetadata } from "@v402pay/core";

export type ToolRow = {
  id: string;
  tool_id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  base_url: string;
  path_pattern: string;
  pricing_model: Record<string, unknown>;
  accepted_currency: string;
  merchant_wallet: string;
  metadata_signature: string;
  status: string;
  created_at: string;
  updated_at: string;
  merchants?: { signing_public_key: string; signing_private_key_encrypted: string } | null;
};

function toToolMetadataInput(tool: ToolRow): Parameters<typeof canonicalToolMetadata>[0] {
  return {
    toolId: tool.tool_id,
    name: tool.name,
    description: tool.description ?? "",
    baseUrl: tool.base_url,
    pathPattern: tool.path_pattern,
    pricingModel: tool.pricing_model,
    acceptedCurrency: tool.accepted_currency,
    merchantWallet: tool.merchant_wallet,
    createdAt: tool.created_at,
    updatedAt: tool.updated_at,
  };
}

export async function findToolByPath(
  supabase: SupabaseClient,
  baseUrl: string,
  path: string
): Promise<ToolRow | null> {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.replace(/\/+/g, "/").replace(/^\/+/, "/") || "/";
  const { data: tools } = await supabase
    .from("tools")
    .select(
      "id, tool_id, merchant_id, name, description, base_url, path_pattern, pricing_model, accepted_currency, merchant_wallet, metadata_signature, status, created_at, updated_at, merchants(signing_public_key, signing_private_key_encrypted)"
    )
    .eq("base_url", normalizedBase)
    .eq("status", "active");

  if (!tools?.length) return null;

  for (const t of tools) {
    const pattern = (t as ToolRow).path_pattern;
    if (matchPathPattern(pattern, normalizedPath)) {
      const row = t as unknown as ToolRow;
      row.merchants = (t as { merchants: ToolRow["merchants"] }).merchants ?? null;
      return row;
    }
  }
  return null;
}

function matchPathPattern(pattern: string, path: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]+") + "$"
  );
  return regex.test(path);
}

/**
 * Verify tool metadata_signature against merchant's signing public key.
 * Gateway must only issue intents for tools that return true.
 */
export async function verifyToolMetadataSignature(tool: ToolRow): Promise<boolean> {
  const pubKey = tool.merchants?.signing_public_key ?? "";
  if (!pubKey || !tool.metadata_signature) return false;
  const canonical = canonicalToolMetadata(toToolMetadataInput(tool));
  return verifyEd25519Message(canonical, tool.metadata_signature, pubKey);
}
