import { createClient } from "@supabase/supabase-js";
import { canonicalToolMetadata, signEd25519Message } from "@v402pay/core";
import { decryptMerchantKey } from "@v402pay/gateway";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const encryptionKey = process.env.ENCRYPTION_KEY!;

export type ToolInsert = {
  tool_id: string;
  merchant_id: string;
  name: string;
  description: string;
  base_url: string;
  path_pattern: string;
  pricing_model: { per_call?: number; per_step?: number };
  accepted_currency: string;
  merchant_wallet: string;
  metadata_signature: string;
  status: string;
};

export async function createTool(merchantId: string, tool: Omit<ToolInsert, "merchant_id" | "metadata_signature" | "status">): Promise<ToolInsert & { id: string }> {
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: merchant } = await supabase
    .from("merchants")
    .select("signing_private_key_encrypted")
    .eq("id", merchantId)
    .single();
  if (!merchant?.signing_private_key_encrypted) throw new Error("Merchant not found");

  const now = new Date().toISOString();
  const payload = canonicalToolMetadata({
    toolId: tool.tool_id,
    name: tool.name,
    description: tool.description ?? "",
    baseUrl: tool.base_url,
    pathPattern: tool.path_pattern,
    pricingModel: tool.pricing_model,
    acceptedCurrency: tool.accepted_currency,
    merchantWallet: tool.merchant_wallet,
    createdAt: now,
    updatedAt: now,
  });
  const privateKey = decryptMerchantKey(merchant.signing_private_key_encrypted, encryptionKey);
  const metadata_signature = await signEd25519Message(payload, Buffer.from(privateKey, "hex"));

  const row: ToolInsert = {
    ...tool,
    merchant_id: merchantId,
    metadata_signature,
    status: "active",
  };

  const { data: inserted, error } = await supabase
    .from("tools")
    .insert(row)
    .select("id, tool_id, merchant_id, name, description, base_url, path_pattern, pricing_model, accepted_currency, merchant_wallet, metadata_signature, status")
    .single();

  if (error) throw new Error(error.message);
  return inserted as ToolInsert & { id: string };
}
