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

// ── Send to Expo Push API ─────────────────────────────────────────────
async function sendPushNotifications(messages: object[]) {
  if (messages.length === 0) return;

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(messages),
  });

  const data = await response.json();
  console.log('Expo push response:', JSON.stringify(data));
  return data;
}

// ── Daily reminder handler ────────────────────────────────────────────
async function sendDailyReminders(supabase: any) {
  const today = new Date().toISOString().split('T')[0];

  // Get all users with push tokens
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('user_id, token');

  if (!tokens || tokens.length === 0) return 0;

  // Find users who haven't logged anything today
  const messages = [];
  for (const { user_id, token } of tokens) {
    const { count } = await supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('expense_date', today);

    if (count === 0) {
      messages.push({
        to: token,
        title: '💰 Daily reminder',
        body: "Don't forget to log today's expenses!",
        data: { screen: 'add' },
        sound: 'default',
      });
    }
  }

  await sendPushNotifications(messages);
  return messages.length;
}

// ── Budget alert handler ──────────────────────────────────────────────
async function checkBudgetAlerts(supabase: any, userId: string) {
  const month = new Date().toISOString().slice(0, 7);

  // Get budget for this month
  const { data: budget } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  if (!budget || !budget.total_budget) return;

  // Get total spent this month
  const monthStart = `${month}-01`;
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('user_id', userId)
    .gte('expense_date', monthStart);

  const spent = (expenses ?? []).reduce((s: number, e: any) => s + e.amount, 0);
  const pct = (spent / budget.total_budget) * 100;

  // Get user's push tokens
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!tokens || tokens.length === 0) return;

  const messages = [];

  // 80% alert — fire once
  if (pct >= 80 && pct < 100 && !budget.alerted_80) {
    for (const { token } of tokens) {
      messages.push({
        to: token,
        title: '⚠️ Budget warning',
        body: `You've used 80% of your monthly budget. ₹${Math.round((budget.total_budget - spent) / 100)} remaining.`,
        data: { screen: 'home' },
        sound: 'default',
      });
    }
    // Mark as alerted so we don't send again
    await supabase
      .from('budgets')
      .update({ alerted_80: true })
      .eq('id', budget.id);
  }

  // 100% alert — fire once
  if (pct >= 100 && !budget.alerted_100) {
    for (const { token } of tokens) {
      messages.push({
        to: token,
        title: '🚨 Budget exceeded',
        body: `You've exceeded your monthly budget by ₹${Math.round((spent - budget.total_budget) / 100)}.`,
        data: { screen: 'home' },
        sound: 'default',
      });
    }
    await supabase
      .from('budgets')
      .update({ alerted_100: true })
      .eq('id', budget.id);
  }

  await sendPushNotifications(messages);
}

// ── Main handler ──────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const type = body.type ?? 'daily';

    if (type === 'daily') {
      const count = await sendDailyReminders(supabase);
      return new Response(
        JSON.stringify({ sent: count }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type === 'budget' && body.userId) {
      await checkBudgetAlerts(supabase, body.userId);
      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('send-notifications error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});