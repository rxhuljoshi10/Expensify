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

    const todayStr = new Date().toISOString().split('T')[0];
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const weekStr = d.toISOString().split('T')[0];
    const monthStr = new Date().toISOString().slice(0, 7) + '-01';
    
    const oldest = monthStr < weekStr ? monthStr : weekStr;

    let processed = 0;

    for (const user of users) {
        try {
            // Get expenses
            const { data: expenses } = await supabase
                .from('expenses')
                .select('amount, category, merchant, expense_date')
                .eq('user_id', user.id)
                .gte('expense_date', oldest)
                .order('expense_date', { ascending: false });

            if (!expenses) continue;

            const dailyExpenses = expenses.filter(e => e.expense_date >= todayStr);
            const weeklyExpenses = expenses.filter(e => e.expense_date >= weekStr);
            const monthlyExpenses = expenses.filter(e => e.expense_date >= monthStr);

            const generateForPeriod = async (expList: any[], type: string, description: string) => {
                if (expList.length < 1) return; // Need at least some data

                const total = expList.reduce((s, e) => s + e.amount, 0);
                const byCategory: Record<string, number> = {};
                expList.forEach(e => {
                    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
                });
                
                const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
                if (sortedCategories.length === 0) return;
                
                const topCategory = sortedCategories[0];

                const summary = `
Total spent ${description}: ₹${Math.round(total / 100)}
Number of transactions: ${expList.length}
Top category: ${topCategory[0]} (₹${Math.round(topCategory[1] / 100)})
Categories: ${sortedCategories.map(([k, v]) => `${k}: ₹${Math.round(v / 100)}`).join(', ')}
                `.trim();

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: `Based on this ${description} spending summary, write ONE short, specific, actionable insight (max 2 sentences). Be conversational, not preachy. Focus on the most interesting pattern.

${summary}

Write only the insight text, no labels or formatting.`,
                                }],
                            }],
                            generationConfig: { maxOutputTokens: 2024 },
                        }),
                    },
                );

                const aiData = await response.json();
                
                if (!aiData.candidates || !aiData.candidates[0]) return;
                
                const content = aiData.candidates[0].content.parts[0].text.trim();

                await supabase.from('insights').upsert({
                    user_id: user.id,
                    type: type,
                    content,
                    generated_at: new Date().toISOString(),
                    is_read: false,
                }, { onConflict: 'user_id,type' });

                await new Promise(r => setTimeout(r, 500)); // Rate limit buffer
            };

            // Only generate monthly if enough data
            if (monthlyExpenses.length >= 3) {
                await generateForPeriod(monthlyExpenses, 'monthly_summary', 'this month');
            }
            if (weeklyExpenses.length >= 2) {
                await generateForPeriod(weeklyExpenses, 'weekly_summary', 'this week');
            }
            if (dailyExpenses.length >= 1) {
                await generateForPeriod(dailyExpenses, 'daily_summary', 'today');
            }

            processed++;

        } catch (e) {
            console.error(`Error for user ${user.id}:`, e);
        }
    }

    return new Response(`Generated insights for ${processed} users`);
});