-- supabase/migrations/create_merchant_mappings.sql
-- Stores user-defined VPA → friendly merchant name mappings
-- Used to resolve dynamic QR VPAs on subsequent transactions

CREATE TABLE IF NOT EXISTS merchant_mappings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  raw_vpa       TEXT NOT NULL,
  friendly_name TEXT NOT NULL,
  category      TEXT,
  use_count     INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, raw_vpa)
);

-- Row Level Security
ALTER TABLE merchant_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mappings"
  ON merchant_mappings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups by VPA
CREATE INDEX idx_merchant_mappings_user_vpa
  ON merchant_mappings(user_id, raw_vpa);
