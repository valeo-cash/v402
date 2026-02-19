-- v2: Tool-aware payment intents — add session billing and tool tracking columns

ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS tool_params_hash TEXT;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS max_calls INTEGER;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS calls_used INTEGER DEFAULT 0;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS spending_account TEXT;

CREATE INDEX IF NOT EXISTS idx_intents_session_id ON payment_intents(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intents_tool_id ON payment_intents(tool_id) WHERE tool_id IS NOT NULL;

-- RPC to atomically increment calls_used
CREATE OR REPLACE FUNCTION increment_calls_used(p_intent_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE payment_intents
  SET calls_used = COALESCE(calls_used, 0) + 1,
      updated_at = NOW()
  WHERE intent_id = p_intent_id;
END;
$$ LANGUAGE plpgsql;
