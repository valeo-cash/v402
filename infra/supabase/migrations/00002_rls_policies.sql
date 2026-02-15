-- RLS: merchants see own data; service role bypass for gateway
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchants_own ON merchants
  FOR ALL USING (auth.uid() = supabase_user_id);

CREATE POLICY tools_merchant ON tools
  FOR ALL USING (
    merchant_id IN (SELECT id FROM merchants WHERE supabase_user_id = auth.uid())
  );

CREATE POLICY payment_intents_via_tool ON payment_intents
  FOR ALL USING (
    tool_id IN (SELECT t.id FROM tools t JOIN merchants m ON t.merchant_id = m.id WHERE m.supabase_user_id = auth.uid())
  );

CREATE POLICY receipts_via_tool ON receipts
  FOR ALL USING (
    tool_id IN (SELECT t.id FROM tools t JOIN merchants m ON t.merchant_id = m.id WHERE m.supabase_user_id = auth.uid())
  );

-- Policies and daily_spend: no direct user access (gateway uses service role)
CREATE POLICY policies_service_only ON policies
  FOR ALL USING (false);

CREATE POLICY daily_spend_service_only ON daily_spend
  FOR ALL USING (false);

CREATE POLICY webhooks_merchant ON webhooks
  FOR ALL USING (
    merchant_id IN (SELECT id FROM merchants WHERE supabase_user_id = auth.uid())
  );
