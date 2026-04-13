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

    // Fetch last 90 days of expenses for context
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, category, merchant, expense_date, description')
      .eq('user_id', userId)
      .gte('expense_date', since.toISOString().split('T')[0])
      .order('expense_date', { ascending: false });

    if (!expenses || expenses.length === 0) {
      return new Response(
        JSON.stringify({ answer: "You don't have any expenses recorded yet. Start adding expenses and I'll be able to answer questions about your spending!" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format expenses as a concise summary for Claude
    const expenseContext = expenses
      .map(e => `${e.expense_date} | ${e.category} | ${e.merchant} | ₹${Math.round(e.amount / 100)}`)
      .join('\n');

    const total = expenses.reduce((s, e) => s + e.amount, 0);

    const prompt = `You are a helpful personal finance assistant. Answer questions about the user's spending data concisely and helpfully. Use ₹ for amounts. Today is ${new Date().toISOString().split('T')[0]}.

The user's expense data for the last 90 days (${expenses.length} transactions, total ₹${Math.round(total / 100)}):
Date | Category | Merchant | Amount
${expenseContext}

User Question: ${question}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          maxOutputTokens: 2048,
        }
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

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});