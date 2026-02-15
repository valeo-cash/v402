import { NextResponse } from "next/server";
import { createTool } from "@/lib/db/tools";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      merchantId,
      tool_id,
      name,
      description,
      base_url,
      path_pattern,
      pricing_model,
      accepted_currency,
      merchant_wallet,
    } = body;
    if (!merchantId || !tool_id || !name || !base_url || !path_pattern || !merchant_wallet) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const row = await createTool(merchantId, {
      tool_id,
      name,
      description: description ?? "",
      base_url,
      path_pattern,
      pricing_model: pricing_model ?? { per_call: 0 },
      accepted_currency: accepted_currency ?? "USDC",
      merchant_wallet,
    });
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create tool" },
      { status: 500 }
    );
  }
}
