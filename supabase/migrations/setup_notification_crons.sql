-- ═══════════════════════════════════════════════════════════════════════
--  pg_cron schedules for Expensify notifications
--  Run this in the Supabase SQL Editor after deploying the edge function.
--
--  All times are in UTC. Adjust for your timezone:
--    IST (UTC+5:30):  9 AM IST = 3:30 AM UTC,  9 PM IST = 3:30 PM UTC
--    You can change the cron expressions below to match your users' timezone.
--
--  Prerequisites:
--    1. pg_cron and pg_net extensions must be enabled
--    2. send-notifications edge function must be deployed
--    3. Replace YOUR_ANON_KEY below with your actual Supabase anon key
-- ═══════════════════════════════════════════════════════════════════════

-- ── Enable required extensions ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Helper: Supabase project URL (already set as env var) ─────────────
-- We use current_setting to get the Supabase URL dynamically,
-- but for pg_cron we need literals. Replace the URL below.
-- Example: https://yourproject.supabase.co/functions/v1/send-notifications

-- ═══════════════════════════════════════════════════════════════════════
--  CRON JOBS
-- ═══════════════════════════════════════════════════════════════════════

-- 1. DAILY EXPENSE REMINDER — Every day at 9 PM IST (3:30 PM UTC)
-- "You haven't logged expenses today"
SELECT cron.schedule(
  'daily-expense-reminder',
  '30 15 * * *',
  $$
  SELECT net.http_post(
    url    := 'YOUR_SUPABASE_URL/functions/v1/send-notifications',
    body   := '{"type": "daily"}'::jsonb,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);

-- 2. RECURRING DUE ALERTS — Every day at 9 AM IST (3:30 AM UTC)
-- "Netflix is due today"
SELECT cron.schedule(
  'recurring-due-reminder',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url    := 'YOUR_SUPABASE_URL/functions/v1/send-notifications',
    body   := '{"type": "recurring-due"}'::jsonb,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);

-- 3. WEEKLY SUMMARY — Every Sunday at 7 PM IST (1:30 PM UTC)
-- "Your week in review: ₹4,250 across 12 transactions"
SELECT cron.schedule(
  'weekly-summary',
  '30 13 * * 0',
  $$
  SELECT net.http_post(
    url    := 'YOUR_SUPABASE_URL/functions/v1/send-notifications',
    body   := '{"type": "weekly-summary"}'::jsonb,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);

-- 4. STREAK CHECK — Every day at 10 PM IST (4:30 PM UTC)
-- "🔥 7-day streak!"
SELECT cron.schedule(
  'streak-check',
  '30 16 * * *',
  $$
  SELECT net.http_post(
    url    := 'YOUR_SUPABASE_URL/functions/v1/send-notifications',
    body   := '{"type": "streak"}'::jsonb,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);

-- 5. MID-MONTH PACE CHECK — 15th of every month at 10 AM IST (4:30 AM UTC)
-- "You're 50% through the month but spent 70% of budget"
SELECT cron.schedule(
  'pace-check',
  '30 4 15 * *',
  $$
  SELECT net.http_post(
    url    := 'YOUR_SUPABASE_URL/functions/v1/send-notifications',
    body   := '{"type": "pace-check"}'::jsonb,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);

-- 6. MONTHLY RESET REMINDER — 1st of every month at 10 AM IST (4:30 AM UTC)
-- "New month! Set your July budget"
SELECT cron.schedule(
  'monthly-reset-reminder',
  '30 4 1 * *',
  $$
  SELECT net.http_post(
    url    := 'YOUR_SUPABASE_URL/functions/v1/send-notifications',
    body   := '{"type": "monthly-reset"}'::jsonb,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);

-- 7. ZERO-SPEND DAY — Every day at 9 AM IST (3:30 AM UTC)
-- "No spending yesterday — money saved!"
SELECT cron.schedule(
  'zero-spend-celebration',
  '35 3 * * *',
  $$
  SELECT net.http_post(
    url    := 'YOUR_SUPABASE_URL/functions/v1/send-notifications',
    body   := '{"type": "zero-spend"}'::jsonb,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);

-- 8. SAVINGS CONGRATULATION — Last day of month at 8 PM IST (2:30 PM UTC)
-- We schedule it for the 28th to be safe; the edge function handles the logic.
SELECT cron.schedule(
  'savings-congrats',
  '30 14 28 * *',
  $$
  SELECT net.http_post(
    url    := 'YOUR_SUPABASE_URL/functions/v1/send-notifications',
    body   := '{"type": "savings-congrats"}'::jsonb,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);

-- ═══════════════════════════════════════════════════════════════════════
--  MANAGEMENT QUERIES
-- ═══════════════════════════════════════════════════════════════════════

-- View all active cron jobs:
-- SELECT * FROM cron.job;

-- View recent job runs:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Remove a specific job:
-- SELECT cron.unschedule('daily-expense-reminder');

-- Remove ALL notification jobs:
-- SELECT cron.unschedule(jobname)
-- FROM cron.job
-- WHERE jobname IN (
--   'daily-expense-reminder', 'recurring-due-reminder', 'weekly-summary',
--   'streak-check', 'pace-check', 'monthly-reset-reminder',
--   'zero-spend-celebration', 'savings-congrats'
-- );
