// supabase/functions/send-notifications/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL        = 'https://exp.host/--/api/v2/push/send';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** Send an array of Expo push messages (batched). */
async function sendPush(messages: object[]) {
  if (messages.length === 0) return;
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(messages),
  });
  const data = await res.json();
  console.log(`Expo push: sent ${messages.length}, response:`, JSON.stringify(data));
  return data;
}

/** Get all push tokens for a single user. */
async function tokensFor(sb: any, userId: string): Promise<string[]> {
  const { data } = await sb.from('push_tokens').select('token').eq('user_id', userId);
  return (data ?? []).map((r: any) => r.token);
}

/** Get notification preferences for a user (returns defaults if no row). */
async function prefsFor(sb: any, userId: string) {
  const { data } = await sb
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Return defaults if no preferences row exists
  return {
    daily_reminder:          data?.daily_reminder          ?? true,
    daily_reminder_time:     data?.daily_reminder_time     ?? '21:00:00',
    budget_alerts:           data?.budget_alerts           ?? true,
    recurring_reminders:     data?.recurring_reminders     ?? true,
    recurring_reminder_time: data?.recurring_reminder_time ?? '09:00:00',
    weekly_summary:          data?.weekly_summary          ?? true,
    spending_insights:       data?.spending_insights       ?? true,
    family_alerts:           data?.family_alerts           ?? true,
    share_with_family:       data?.share_with_family       ?? true,
    quiet_hours_enabled:     data?.quiet_hours_enabled     ?? false,
    quiet_hours_start:       data?.quiet_hours_start       ?? '23:00:00',
    quiet_hours_end:         data?.quiet_hours_end         ?? '07:00:00',
  };
}

/**
 * Check if the current server time falls within a user's quiet hours.
 * Times are in "HH:MM:SS" format. Handles overnight ranges (e.g. 23:00→07:00).
 */
function isInQuietHours(prefs: any): boolean {
  if (!prefs.quiet_hours_enabled) return false;

  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

  const start = prefs.quiet_hours_start;
  const end   = prefs.quiet_hours_end;

  // Overnight range (e.g., 23:00 → 07:00)
  if (start > end) return hhmm >= start || hhmm < end;
  // Same-day range (e.g., 13:00 → 15:00)
  return hhmm >= start && hhmm < end;
}

/** Format paise → "₹1,234" */
function fmtRupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

/** Today as YYYY-MM-DD */
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Current month as YYYY-MM */
function monthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

// ═══════════════════════════════════════════════════════════════════════
//  NOTIFICATION HANDLERS
// ═══════════════════════════════════════════════════════════════════════

// ── 1. Daily Expense Reminder ─────────────────────────────────────────
// Sends to users who haven't logged ANY expense today.
// Respects: daily_reminder, quiet_hours
async function handleDailyReminder(sb: any) {
  const today = todayStr();
  const { data: tokens } = await sb.from('push_tokens').select('user_id, token');
  if (!tokens?.length) return { sent: 0 };

  const messages: object[] = [];

  for (const { user_id, token } of tokens) {
    const prefs = await prefsFor(sb, user_id);
    if (!prefs.daily_reminder || isInQuietHours(prefs)) continue;

    const { count } = await sb
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('expense_date', today);

    if (count === 0) {
      messages.push({
        to: token,
        title: '💰 Daily reminder',
        body: "You haven't added any expenses today. Log them before you forget!",
        data: { screen: 'add' },
        sound: 'default',
      });
    }
  }

  await sendPush(messages);
  return { sent: messages.length };
}

// ── 2. Budget Alert (80 % / 100 %) ───────────────────────────────────
// Called after each expense is added. Fires once per threshold.
// Respects: budget_alerts
async function handleBudgetAlert(sb: any, userId: string) {
  const prefs = await prefsFor(sb, userId);
  if (!prefs.budget_alerts) return;

  const month = monthStr();
  const { data: budget } = await sb
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  if (!budget?.total_budget) return;

  const monthStart = `${month}-01`;
  const { data: expenses } = await sb
    .from('expenses')
    .select('amount')
    .eq('user_id', userId)
    .gte('expense_date', monthStart);

  const spent = (expenses ?? []).reduce((s: number, e: any) => s + e.amount, 0);
  const pct = (spent / budget.total_budget) * 100;
  const tokens = await tokensFor(sb, userId);
  if (!tokens.length) return;

  const messages: object[] = [];

  if (pct >= 80 && pct < 100 && !budget.alerted_80) {
    for (const to of tokens) {
      messages.push({
        to,
        title: '⚠️ Budget warning',
        body: `You've used 80% of your monthly budget. ${fmtRupees(budget.total_budget - spent)} remaining.`,
        data: { screen: 'home' },
        sound: 'default',
      });
    }
    await sb.from('budgets').update({ alerted_80: true }).eq('id', budget.id);
  }

  if (pct >= 100 && !budget.alerted_100) {
    for (const to of tokens) {
      messages.push({
        to,
        title: '🚨 Budget exceeded!',
        body: `You've exceeded your monthly budget by ${fmtRupees(spent - budget.total_budget)}.`,
        data: { screen: 'home' },
        sound: 'default',
      });
    }
    await sb.from('budgets').update({ alerted_100: true }).eq('id', budget.id);
  }

  await sendPush(messages);
}

// ── 3. Category Budget Breach ─────────────────────────────────────────
// Checks per-category budget limits after each expense.
// Respects: budget_alerts
async function handleCategoryBudget(sb: any, userId: string) {
  const prefs = await prefsFor(sb, userId);
  if (!prefs.budget_alerts) return;

  const month = monthStr();
  const { data: budget } = await sb
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  if (!budget?.category_budgets || Object.keys(budget.category_budgets).length === 0) return;

  const monthStart = `${month}-01`;
  const { data: expenses } = await sb
    .from('expenses')
    .select('amount, category')
    .eq('user_id', userId)
    .gte('expense_date', monthStart);

  if (!expenses?.length) return;

  // Sum by category
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }

  const tokens = await tokensFor(sb, userId);
  if (!tokens.length) return;

  const messages: object[] = [];
  for (const [cat, limit] of Object.entries(budget.category_budgets)) {
    const spent = byCategory[cat] ?? 0;
    if (spent >= (limit as number)) {
      for (const to of tokens) {
        messages.push({
          to,
          title: `🏷️ ${cat} budget used up`,
          body: `You've spent ${fmtRupees(spent)} of your ${fmtRupees(limit as number)} ${cat} limit.`,
          data: { screen: 'home' },
          sound: 'default',
        });
      }
    }
  }

  await sendPush(messages);
}

// ── 4. Recurring Expense Due Today ────────────────────────────────────
// Morning reminder for subscriptions/bills due today.
// Respects: recurring_reminders, quiet_hours
async function handleRecurringDue(sb: any) {
  const today = todayStr();
  const { data: tokens } = await sb.from('push_tokens').select('user_id, token');
  if (!tokens?.length) return { sent: 0 };

  const messages: object[] = [];

  for (const { user_id, token } of tokens) {
    const prefs = await prefsFor(sb, user_id);
    if (!prefs.recurring_reminders || isInQuietHours(prefs)) continue;

    const { data: due } = await sb
      .from('recurring_expenses')
      .select('merchant, amount')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .eq('next_due_date', today);

    if (!due?.length) continue;

    if (due.length === 1) {
      messages.push({
        to: token,
        title: '🔄 Recurring expense due',
        body: `${due[0].merchant} (${fmtRupees(due[0].amount)}) is due today. Tap to log it.`,
        data: { screen: 'recurring' },
        sound: 'default',
      });
    } else {
      const total = due.reduce((s: number, d: any) => s + d.amount, 0);
      messages.push({
        to: token,
        title: '🔄 Recurring expenses due',
        body: `${due.length} subscriptions due today totalling ${fmtRupees(total)}. Tap to review.`,
        data: { screen: 'recurring' },
        sound: 'default',
      });
    }
  }

  await sendPush(messages);
  return { sent: messages.length };
}

// ── 5. Weekly Summary ─────────────────────────────────────────────────
// Sunday evening recap of the user's spending week.
// Respects: weekly_summary, quiet_hours
async function handleWeeklySummary(sb: any) {
  const now = new Date();
  // Calculate Monday of this week
  const monday = new Date(now);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  const mondayStr = monday.toISOString().split('T')[0];
  const todayDate = todayStr();

  const { data: tokens } = await sb.from('push_tokens').select('user_id, token');
  if (!tokens?.length) return { sent: 0 };

  const messages: object[] = [];

  for (const { user_id, token } of tokens) {
    const prefs = await prefsFor(sb, user_id);
    if (!prefs.weekly_summary || isInQuietHours(prefs)) continue;

    const { data: expenses } = await sb
      .from('expenses')
      .select('amount, category')
      .eq('user_id', user_id)
      .gte('expense_date', mondayStr)
      .lte('expense_date', todayDate);

    if (!expenses?.length) continue;

    const total = expenses.reduce((s: number, e: any) => s + e.amount, 0);
    const count = expenses.length;

    // Find top category
    const byCat: Record<string, number> = {};
    for (const e of expenses) {
      byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
    }
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

    let body = `📊 This week: ${fmtRupees(total)} across ${count} transaction${count > 1 ? 's' : ''}.`;
    if (topCat) body += ` Top: ${topCat[0]} (${fmtRupees(topCat[1])}).`;

    messages.push({
      to: token,
      title: '📊 Weekly spending recap',
      body,
      data: { screen: 'home' },
      sound: 'default',
    });
  }

  await sendPush(messages);
  return { sent: messages.length };
}

// ── 6. Spending Spike Detection ───────────────────────────────────────
// Called after each expense. Alerts if today's category spend ≥ 3× the
// rolling 7-day daily average for that category.
// Respects: spending_insights
async function handleSpendingSpike(sb: any, userId: string, category: string) {
  const prefs = await prefsFor(sb, userId);
  if (!prefs.spending_insights) return;

  const today = todayStr();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  // Last 7 days spend in this category (excluding today)
  const { data: histExpenses } = await sb
    .from('expenses')
    .select('amount')
    .eq('user_id', userId)
    .eq('category', category)
    .gte('expense_date', weekAgoStr)
    .lt('expense_date', today);

  const histTotal = (histExpenses ?? []).reduce((s: number, e: any) => s + e.amount, 0);
  const dailyAvg = histTotal / 7;

  // Today's spend in this category
  const { data: todayExpenses } = await sb
    .from('expenses')
    .select('amount')
    .eq('user_id', userId)
    .eq('category', category)
    .eq('expense_date', today);

  const todayTotal = (todayExpenses ?? []).reduce((s: number, e: any) => s + e.amount, 0);

  // Only alert if there's meaningful history and spike is ≥ 3×
  if (dailyAvg > 0 && todayTotal >= dailyAvg * 3) {
    const multiplier = Math.round(todayTotal / dailyAvg);
    const tokens = await tokensFor(sb, userId);

    await sendPush(
      tokens.map(to => ({
        to,
        title: `📈 Unusual ${category} spending`,
        body: `You've spent ${fmtRupees(todayTotal)} on ${category} today — that's ${multiplier}× your daily average.`,
        data: { screen: 'expenses' },
        sound: 'default',
      }))
    );
  }
}

// ── 7. Streak Tracker ─────────────────────────────────────────────────
// Checks consecutive days with at least one expense logged.
// Sends congratulatory push at milestones: 3, 5, 7, 14, 21, 30 days.
// Respects: spending_insights, quiet_hours
async function handleStreakCheck(sb: any) {
  const { data: tokens } = await sb.from('push_tokens').select('user_id, token');
  if (!tokens?.length) return { sent: 0 };

  const messages: object[] = [];
  const milestones = [3, 5, 7, 14, 21, 30];

  for (const { user_id, token } of tokens) {
    const prefs = await prefsFor(sb, user_id);
    if (!prefs.spending_insights || isInQuietHours(prefs)) continue;

    // Count consecutive days backwards from today
    let streak = 0;
    const checkDate = new Date();

    for (let i = 0; i < 60; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const { count } = await sb
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .eq('expense_date', dateStr);

      if (count && count > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    if (milestones.includes(streak)) {
      messages.push({
        to: token,
        title: `🔥 ${streak}-day streak!`,
        body: streak >= 14
          ? `Incredible! ${streak} days of consistent expense tracking. You're a pro!`
          : `${streak} days in a row! Keep the logging habit going. 💪`,
        data: { screen: 'home' },
        sound: 'default',
      });
    }
  }

  await sendPush(messages);
  return { sent: messages.length };
}

// ── 8. Mid-Month Pace Check ───────────────────────────────────────────
// On the 15th, warns if spending pace exceeds budget pace.
// Respects: budget_alerts, quiet_hours
async function handlePaceCheck(sb: any) {
  const { data: tokens } = await sb.from('push_tokens').select('user_id, token');
  if (!tokens?.length) return { sent: 0 };

  const month = monthStr();
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = dayOfMonth / daysInMonth;

  const messages: object[] = [];

  for (const { user_id, token } of tokens) {
    const prefs = await prefsFor(sb, user_id);
    if (!prefs.budget_alerts || isInQuietHours(prefs)) continue;

    const { data: budget } = await sb
      .from('budgets')
      .select('total_budget')
      .eq('user_id', user_id)
      .eq('month', month)
      .maybeSingle();

    if (!budget?.total_budget) continue;

    const monthStart = `${month}-01`;
    const { data: expenses } = await sb
      .from('expenses')
      .select('amount')
      .eq('user_id', user_id)
      .gte('expense_date', monthStart);

    const spent = (expenses ?? []).reduce((s: number, e: any) => s + e.amount, 0);
    const spendProgress = spent / budget.total_budget;

    // Alert if spending pace is ≥ 20% ahead of time pace
    if (spendProgress > monthProgress + 0.2) {
      const pctSpent = Math.round(spendProgress * 100);
      const pctTime = Math.round(monthProgress * 100);

      messages.push({
        to: token,
        title: '⏱️ Spending pace alert',
        body: `You're ${pctTime}% through the month but have spent ${pctSpent}% of your budget. ${fmtRupees(budget.total_budget - spent)} left.`,
        data: { screen: 'home' },
        sound: 'default',
      });
    }
  }

  await sendPush(messages);
  return { sent: messages.length };
}

// ── 9. Monthly Reset Reminder ─────────────────────────────────────────
// 1st of every month: reminder to set a new budget.
// Respects: budget_alerts, quiet_hours
async function handleMonthlyReset(sb: any) {
  const month = monthStr();
  const { data: tokens } = await sb.from('push_tokens').select('user_id, token');
  if (!tokens?.length) return { sent: 0 };

  const messages: object[] = [];

  for (const { user_id, token } of tokens) {
    const prefs = await prefsFor(sb, user_id);
    if (!prefs.budget_alerts || isInQuietHours(prefs)) continue;

    // Only send if user doesn't already have a budget for this month
    const { data: budget } = await sb
      .from('budgets')
      .select('id')
      .eq('user_id', user_id)
      .eq('month', month)
      .maybeSingle();

    if (!budget) {
      const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });
      messages.push({
        to: token,
        title: '🗓️ New month, fresh start!',
        body: `Set your ${monthName} budget to stay on track with your spending goals.`,
        data: { screen: 'budget-settings' },
        sound: 'default',
      });
    }
  }

  await sendPush(messages);
  return { sent: messages.length };
}

// ── 10. Family Expense Notification (real-time) ───────────────────────
// Called when a family member adds an expense. Notifies other group
// members who have family_alerts enabled.
// Respects: share_with_family (sender), family_alerts (receiver), quiet_hours
async function handleFamilyExpense(
  sb: any,
  senderUserId: string,
  amount: number,
  category: string,
  merchant: string,
) {
  // Check if sender allows sharing
  const senderPrefs = await prefsFor(sb, senderUserId);
  if (!senderPrefs.share_with_family) return;

  // Find sender's family group
  // Check if they're an owner
  let group: any = null;
  const { data: ownedGroup } = await sb
    .from('family_groups')
    .select('*')
    .eq('owner_id', senderUserId)
    .maybeSingle();

  if (ownedGroup) {
    group = ownedGroup;
  } else {
    // Check if they're a member (members is a JSONB array)
    const { data: groups } = await sb
      .from('family_groups')
      .select('*');

    for (const g of groups ?? []) {
      const members = g.members ?? [];
      if (members.some((m: any) => m.user_id === senderUserId)) {
        group = g;
        break;
      }
    }
  }

  if (!group) return;

  // Get sender's name
  const { data: senderUser } = await sb
    .from('users')
    .select('name')
    .eq('id', senderUserId)
    .maybeSingle();
  const senderName = senderUser?.name ?? 'A family member';

  // Collect all member IDs (excluding sender)
  const memberIds = [
    group.owner_id,
    ...(group.members ?? []).map((m: any) => m.user_id),
  ].filter((id: string) => id !== senderUserId);

  const messages: object[] = [];

  for (const memberId of memberIds) {
    const prefs = await prefsFor(sb, memberId);
    if (!prefs.family_alerts || isInQuietHours(prefs)) continue;

    const memberTokens = await tokensFor(sb, memberId);
    for (const to of memberTokens) {
      messages.push({
        to,
        title: `👨‍👩‍👧 ${senderName} added an expense`,
        body: `${fmtRupees(amount)} for ${merchant || category}`,
        data: { screen: 'home' },
        sound: 'default',
      });
    }
  }

  await sendPush(messages);
}

// ── 11. Zero-Spend Day Celebration ────────────────────────────────────
// Sent in the morning for users who had ₹0 spending yesterday.
// Respects: spending_insights, quiet_hours
async function handleZeroSpendDay(sb: any) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const { data: tokens } = await sb.from('push_tokens').select('user_id, token');
  if (!tokens?.length) return { sent: 0 };

  const messages: object[] = [];

  for (const { user_id, token } of tokens) {
    const prefs = await prefsFor(sb, user_id);
    if (!prefs.spending_insights || isInQuietHours(prefs)) continue;

    const { count } = await sb
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('expense_date', yesterdayStr);

    if (count === 0) {
      messages.push({
        to: token,
        title: '✨ Zero-spend day!',
        body: 'No spending yesterday — that\'s money saved! Keep it up. 💪',
        data: { screen: 'home' },
        sound: 'default',
      });
    }
  }

  await sendPush(messages);
  return { sent: messages.length };
}

// ── 12. Savings Congratulation ────────────────────────────────────────
// End of month: compare this month vs last month.
// Respects: spending_insights, quiet_hours
async function handleSavingsCongrats(sb: any) {
  const now = new Date();
  const thisMonth = monthStr();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const { data: tokens } = await sb.from('push_tokens').select('user_id, token');
  if (!tokens?.length) return { sent: 0 };

  const messages: object[] = [];

  for (const { user_id, token } of tokens) {
    const prefs = await prefsFor(sb, user_id);
    if (!prefs.spending_insights || isInQuietHours(prefs)) continue;

    // This month total
    const { data: thisExp } = await sb
      .from('expenses')
      .select('amount')
      .eq('user_id', user_id)
      .gte('expense_date', `${thisMonth}-01`)
      .lt('expense_date', `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`);

    // Last month total
    const { data: lastExp } = await sb
      .from('expenses')
      .select('amount')
      .eq('user_id', user_id)
      .gte('expense_date', `${lastMonth}-01`)
      .lt('expense_date', `${thisMonth}-01`);

    const thisTotal = (thisExp ?? []).reduce((s: number, e: any) => s + e.amount, 0);
    const lastTotal = (lastExp ?? []).reduce((s: number, e: any) => s + e.amount, 0);

    if (lastTotal > 0 && thisTotal < lastTotal) {
      const pctSaved = Math.round(((lastTotal - thisTotal) / lastTotal) * 100);
      if (pctSaved >= 5) {
        messages.push({
          to: token,
          title: '🎉 You spent less this month!',
          body: `${pctSaved}% less than last month — you saved ${fmtRupees(lastTotal - thisTotal)}. Great discipline!`,
          data: { screen: 'home' },
          sound: 'default',
        });
      }
    }
  }

  await sendPush(messages);
  return { sent: messages.length };
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const ok = (data: any) =>
    new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const fail = (msg: string, status = 400) =>
    new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const type: string = body.type ?? 'daily';

    switch (type) {
      // ── Cron-triggered (all users) ──────────────────────────────────
      case 'daily':
        return ok(await handleDailyReminder(sb));

      case 'recurring-due':
        return ok(await handleRecurringDue(sb));

      case 'weekly-summary':
        return ok(await handleWeeklySummary(sb));

      case 'streak':
        return ok(await handleStreakCheck(sb));

      case 'pace-check':
        return ok(await handlePaceCheck(sb));

      case 'monthly-reset':
        return ok(await handleMonthlyReset(sb));

      case 'zero-spend':
        return ok(await handleZeroSpendDay(sb));

      case 'savings-congrats':
        return ok(await handleSavingsCongrats(sb));

      // ── Event-triggered (single user) ───────────────────────────────
      case 'budget':
        if (!body.userId) return fail('userId required');
        await handleBudgetAlert(sb, body.userId);
        await handleCategoryBudget(sb, body.userId);
        return ok({ ok: true });

      case 'spending-spike':
        if (!body.userId || !body.category) return fail('userId + category required');
        await handleSpendingSpike(sb, body.userId, body.category);
        return ok({ ok: true });

      case 'test':
        if (!body.userId) return fail('userId required');
        const testTokens = await tokensFor(sb, body.userId);
        if (!testTokens.length) return fail('No push token found for user');
        await sendPush(
          testTokens.map(to => ({
            to,
            title: '🎉 Push Notifications Working!',
            body: 'Congratulations! Your Expensify smart notifications are fully set up and ready.',
            data: { screen: 'home' },
            sound: 'default',
          }))
        );
        return ok({ ok: true, sent: testTokens.length });

      case 'family-expense':
        if (!body.userId) return fail('userId required');
        await handleFamilyExpense(
          sb,
          body.userId,
          body.amount ?? 0,
          body.category ?? '',
          body.merchant ?? '',
        );
        return ok({ ok: true });

      default:
        return fail(`Unknown notification type: ${type}`);
    }
  } catch (error) {
    console.error('send-notifications error:', error.message);
    return fail(error.message, 500);
  }
});