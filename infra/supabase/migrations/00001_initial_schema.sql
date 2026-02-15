-- v402pay: initial schema (real, no seed)
-- Merchants: platform-generated signing keypair; private key encrypted at rest
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  signing_public_key TEXT NOT NULL,
  signing_private_key_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(supabase_user_id)
);

CREATE INDEX idx_merchants_supabase_user_id ON merchants(supabase_user_id);

-- Tools: metadata_signature must verify against merchant signing key
CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT NOT NULL UNIQUE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL,
  path_pattern TEXT NOT NULL,
  pricing_model JSONB NOT NULL DEFAULT '{}',
  accepted_currency TEXT NOT NULL DEFAULT 'USDC',
  merchant_wallet TEXT NOT NULL,
  metadata_signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tools_merchant_status ON tools(merchant_id, status);
CREATE INDEX idx_tools_tool_id ON tools(tool_id);

-- Payment intents: payer set after tx verification (derived from tx only)
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id TEXT NOT NULL UNIQUE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'solana',
  recipient TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  request_hash TEXT NOT NULL,
  payer TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid_verified', 'consumed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_intents_intent_id ON payment_intents(intent_id);
CREATE INDEX idx_payment_intents_reference ON payment_intents(reference);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_request_hash ON payment_intents(request_hash);

-- Receipts: store response for idempotency replay
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id TEXT NOT NULL UNIQUE,
  intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  request_hash TEXT NOT NULL,
  response_hash TEXT NOT NULL,
  tx_sig TEXT NOT NULL,
  payer TEXT NOT NULL,
  merchant TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  server_sig TEXT NOT NULL,
  response_status INT NOT NULL,
  response_headers JSONB NOT NULL DEFAULT '{}',
  response_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_receipts_intent_id ON receipts(intent_id);
CREATE INDEX idx_receipts_receipt_id ON receipts(receipt_id);

-- Policies: per payer or per API key
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer TEXT,
  api_key_id TEXT,
  max_spend_per_day NUMERIC,
  max_spend_per_call NUMERIC,
  allowlisted_tool_ids TEXT[],
  allowlisted_merchants TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((payer IS NOT NULL AND api_key_id IS NULL) OR (payer IS NULL AND api_key_id IS NOT NULL))
);

CREATE INDEX idx_policies_payer ON policies(payer);
CREATE INDEX idx_policies_api_key_id ON policies(api_key_id);

-- Daily spend: UTC date, upsert by (payer, date_utc)
CREATE TABLE IF NOT EXISTS daily_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer TEXT NOT NULL,
  date_utc DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payer, date_utc)
);

CREATE INDEX idx_daily_spend_payer_date ON daily_spend(payer, date_utc);

-- Webhooks: merchant receipt events
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['receipt.created'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhooks_merchant_id ON webhooks(merchant_id);
