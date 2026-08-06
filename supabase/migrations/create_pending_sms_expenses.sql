-- supabase/migrations/create_pending_sms_expenses.sql
-- Holds SMS-detected expenses that need user confirmation
-- (dynamic QR VPAs with no existing mapping)
-- Auto-expires after 24h if user does not process them

CREATE TABLE IF NOT EXISTS pending_sms_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  raw_sms       TEXT NOT NULL,
  amount        BIGINT NOT NULL,        -- stored in paise (₹30 = 3000)
  raw_vpa       TEXT,
  vpa_type      TEXT CHECK (vpa_type IN ('personal', 'dynamic_qr', 'brand')),
  parsed_date   DATE,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'expired')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours')
);

-- Row Level Security
ALTER TABLE pending_sms_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pending expenses"
  ON pending_sms_expenses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fetching pending items efficiently
CREATE INDEX idx_pending_sms_user_status
  ON pending_sms_expenses(user_id, status);
