// supabase/functions/ai-assistant/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { question, userId } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    // Fetch last 90 days of expenses
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceStr = since.toISOString().split('T')[0];

    const [expensesResult, budgetsResult, latestInsightResult] = await Promise.all([
      supabase
        .from('expenses')
        .select('amount, category, merchant, expense_date, description')
        .eq('user_id', userId)
        .gte('expense_date', sinceStr)
        .order('expense_date', { ascending: false }),
      supabase
        .from('budgets')
        .select('category, amount')
        .eq('user_id', userId),
      supabase
        .from('insights')
        .select('content, generated_at')
        .eq('user_id', userId)
        .eq('type', 'coaching_briefing')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const expenses = expensesResult.data || [];
    const budgets = budgetsResult.data || [];
    const latestInsight = latestInsightResult.data;

    if (expenses.length === 0) {
      return new Response(
        JSON.stringify({ answer: "You don't have any expenses recorded yet. Start adding expenses and I'll be able to answer questions about your spending!" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Split into current month vs rest
    const currentMonthExpenses = expenses.filter((e: any) => e.expense_date >= currentMonthStart);
    const previousExpenses = expenses.filter((e: any) => e.expense_date < currentMonthStart);

    // Category totals for current month
    const currentCatTotals: Record<string, number> = {};
    currentMonthExpenses.forEach((e: any) => {
      currentCatTotals[e.category] = (currentCatTotals[e.category] ?? 0) + e.amount;
    });

    const currentMonthTotal = currentMonthExpenses.reduce((s: number, e: any) => s + e.amount, 0);
    const totalAll = expenses.reduce((s: number, e: any) => s + e.amount, 0);

    // Format expense rows - limit to 100 most recent to avoid token overflow
    const expenseRows = expenses.slice(0, 100)
      .map((e: any) => `${e.expense_date} | ${e.category} | ${e.merchant || 'Unknown'} | ₹${Math.round(e.amount / 100)}${e.description ? ' | ' + e.description : ''}`)
      .join('\n');

    // Format budgets
    const budgetSummary = budgets.length > 0
      ? budgets.map((b: any) => {
          const spent = currentCatTotals[b.category] ?? 0;
          const budgetAmt = b.amount;
          const pct = budgetAmt > 0 ? Math.round((spent / budgetAmt) * 100) : 0;
          return `${b.category}: Budget ₹${Math.round(budgetAmt / 100)}, Spent ₹${Math.round(spent / 100)} (${pct}%)`;
        }).join('\n')
      : 'No budgets set.';

    const prompt = `You are a helpful personal finance assistant for an Indian expense tracking app called Expensify. Be concise, friendly, and use ₹ for all amounts.

TODAY: ${todayStr}
CURRENT MONTH: ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}

=== LATEST AI BRIEFING (${latestInsight ? new Date(latestInsight.generated_at).toLocaleDateString('en-IN') : 'None'}) ===
${latestInsight?.content || 'No briefing generated yet.'}

=== THIS MONTH SUMMARY ===
Transactions: ${currentMonthExpenses.length}
Total Spent: ₹${Math.round(currentMonthTotal / 100)}
By Category: ${Object.entries(currentCatTotals).map(([k, v]) => `${k}: ₹${Math.round((v as number) / 100)}`).join(', ') || 'None'}

=== BUDGETS VS ACTUAL (This Month) ===
${budgetSummary}

=== LAST 90 DAYS - ALL TRANSACTIONS (${expenses.length} total, ₹${Math.round(totalAll / 100)}) ===
Date | Category | Merchant | Amount | Description
${expenseRows}

User Question: ${question}

Answer directly and helpfully. If the question is about current month, only use current month data. If about a specific time period, filter accordingly.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 9999 },
      }),
    });

    const data = await response.json();
    if (!data.candidates || !data.candidates[0]) {
      console.error('Gemini API Error:', JSON.stringify(data));
      throw new Error('Gemini API failed: ' + (data.error?.message || 'Unknown error'));
    }
    const answer = data.candidates[0].content.parts[0].text.trim();

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('ai-assistant error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});