import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { getOrCreateMerchant } from "@/lib/db/merchant";

export async function POST(request: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  if (!wallet || wallet.length < 32) {
    return NextResponse.json({ error: "Valid Solana wallet address required" }, { status: 400 });
  }

  const m = await getOrCreateMerchant(user.id, wallet);
  return NextResponse.json({ merchantId: m.id });
}
