-- Create notification_preferences table
-- Stores per-user granular notification toggles and time preferences.
-- The Edge Function reads this table to decide whether/when to send each notification type.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_reminder          BOOLEAN  DEFAULT true  NOT NULL,
  daily_reminder_time     TIME     DEFAULT '21:00:00' NOT NULL,
  budget_alerts           BOOLEAN  DEFAULT true  NOT NULL,
  recurring_reminders     BOOLEAN  DEFAULT true  NOT NULL,
  recurring_reminder_time TIME     DEFAULT '09:00:00' NOT NULL,
  weekly_summary          BOOLEAN  DEFAULT true  NOT NULL,
  spending_insights       BOOLEAN  DEFAULT true  NOT NULL,
  family_alerts           BOOLEAN  DEFAULT true  NOT NULL,
  share_with_family       BOOLEAN  DEFAULT true  NOT NULL,
  quiet_hours_enabled     BOOLEAN  DEFAULT false NOT NULL,
  quiet_hours_start       TIME     DEFAULT '23:00:00' NOT NULL,
  quiet_hours_end         TIME     DEFAULT '07:00:00' NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id)
);

-- ── Row Level Security ────────────────────────────────────────────────
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
