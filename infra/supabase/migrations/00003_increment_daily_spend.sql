-- Atomic increment for daily_spend (avoids read-then-write race).
-- After pulling: run `supabase db push` to apply.
CREATE OR REPLACE FUNCTION increment_daily_spend(p_payer TEXT, p_date DATE, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  INSERT INTO daily_spend (payer, date_utc, amount, updated_at)
  VALUES (p_payer, p_date, p_amount, now())
  ON CONFLICT (payer, date_utc)
  DO UPDATE SET amount = daily_spend.amount + p_amount, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
