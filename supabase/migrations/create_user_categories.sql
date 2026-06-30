-- Migration: Create user_categories table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_categories (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT 'ellipsis-horizontal',
  color        TEXT NOT NULL DEFAULT '#D3D3D3',
  last_used_at TIMESTAMPTZ DEFAULT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Row Level Security
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own categories"
  ON user_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON user_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON user_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON user_categories FOR DELETE
  USING (auth.uid() = user_id);
