import { createClient } from "@supabase/supabase-js";
import { encryptMerchantKey } from "@v402pay/gateway";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const encryptionKey = process.env.ENCRYPTION_KEY!;

export async function getOrCreateMerchant(
  supabaseUserId: string,
  wallet: string
): Promise<{ id: string; signingPublicKey: string }> {
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: existing } = await supabase
    .from("merchants")
    .select("id, signing_public_key")
    .eq("supabase_user_id", supabaseUserId)
    .single();

  if (existing) return { id: existing.id, signingPublicKey: existing.signing_public_key };

  const { getPublicKey } = await import("@noble/ed25519");
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const publicKey = await getPublicKey(seed);
  const publicKeyHex = Buffer.from(publicKey).toString("hex");
  const privateKeyHex = Buffer.from(seed).toString("hex");
  const encrypted = encryptMerchantKey(privateKeyHex, encryptionKey);

  const { data: inserted, error } = await supabase
    .from("merchants")
    .insert({
      supabase_user_id: supabaseUserId,
      wallet,
      signing_public_key: publicKeyHex,
      signing_private_key_encrypted: encrypted,
    })
    .select("id, signing_public_key")
    .single();

  if (error) throw new Error(error.message);
  return { id: inserted.id, signingPublicKey: inserted.signing_public_key };
}

export async function getMerchantByUserId(supabaseUserId: string) {
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data } = await supabase
    .from("merchants")
    .select("id, wallet, signing_public_key")
    .eq("supabase_user_id", supabaseUserId)
    .single();
  return data;
}
