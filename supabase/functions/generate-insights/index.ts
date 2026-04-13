// supabase/functions/generate-insights/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get all users
  const { data: users } = await supabase.from('users').select('id');
  if (!users) return new Response('No users');

  const month = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  let processed = 0;

  for (const user of users) {
    try {
      // Get this month's expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, category, merchant, expense_date')
        .eq('user_id', user.id)
        .gte('expense_date', `${month}-01`)
        .order('expense_date', { ascending: false });

      if (!expenses || expenses.length < 3) continue; // not enough data

      // Summarize for Gemini
      const total = expenses.reduce((s, e) => s + e.amount, 0);
      const byCategory: Record<string, number> = {};
      expenses.forEach(e => {
        byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
      });
      const topCategory = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])[0];

      const summary = `
Total spent this month: ₹${Math.round(total / 100)}
Number of transactions: ${expenses.length}
Top category: ${topCategory[0]} (₹${Math.round(topCategory[1] / 100)})
Categories: ${Object.entries(byCategory).map(([k, v]) => `${k}: ₹${Math.round(v / 100)}`).join(', ')}
      `.trim();

      // Generate insight with Gemini
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Based on this spending summary, write ONE short, specific, actionable insight (max 2 sentences). Be conversational, not preachy. Focus on the most interesting pattern.

${summary}

Write only the insight text, no labels or formatting.`,
              }],
            }],
            generationConfig: { maxOutputTokens: 1024 },
          }),
        },
      );

      const aiData = await response.json();
      console.log('Gemini response status:', response.status);
      console.log('Gemini response body:', JSON.stringify(aiData));

      if (!aiData.candidates || !aiData.candidates[0]) {
        console.error('No candidates in Gemini response:', JSON.stringify(aiData));
        continue;
      }
      const content = aiData.candidates[0].content.parts[0].text.trim();

      // Store insight — upsert so it replaces today's insight if re-run
      await supabase.from('insights').upsert({
        user_id: user.id,
        type: 'monthly_summary',
        content,
        generated_at: new Date().toISOString(),
        is_read: false,
      }, { onConflict: 'user_id,type' });

      processed++;

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));

    } catch (e) {
      console.error(`Error for user ${user.id}:`, e);
    }
  }

  return new Response(`Generated insights for ${processed} users`);
});