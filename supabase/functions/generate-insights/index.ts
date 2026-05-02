// supabase/functions/generate-insights/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    console.log("Function triggered: ", req.method);
    
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error("CRITICAL: Missing environment variables");
        return new Response(JSON.stringify({ error: "Server configuration error (env)" }), { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        let userId: string | null = null;
        if (req.method === 'POST') {
            try {
                const body = await req.json();
                userId = body.userId;
                console.log("Received userId:", userId);
            } catch (e) {
                console.log("No JSON body found, likely cron request");
            }
        }

        // Fetch users to process
        let userList: { id: string }[] = [];
        if (userId) {
            userList = [{ id: userId }];
        } else {
            console.log("Fetching all users for batch processing...");
            const { data, error: userError } = await supabase.from('users').select('id');
            if (userError) throw new Error("Users fetch failed: " + userError.message);
            userList = data || [];
        }

        if (userList.length === 0) {
            console.log("No users found to process.");
            return new Response(JSON.stringify({ error: 'No users found' }), { status: 404, headers: corsHeaders });
        }

        let processed = 0;

        // Fetch last 60 days to have enough data for both current month and previous month
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const sinceStr = sixtyDaysAgo.toISOString().split('T')[0];

        for (const user of userList) {
            try {
                console.log(`Processing User: ${user.id}`);
                const { data: expenses, error: expError } = await supabase
                    .from('expenses')
                    .select('amount, category, merchant, expense_date')
                    .eq('user_id', user.id)
                    .gte('expense_date', sinceStr)
                    .order('expense_date', { ascending: false });

                if (expError) {
                    console.error(`Error fetching expenses for ${user.id}:`, expError);
                    continue;
                }

                const expenseList = expenses || [];
                console.log(`Found ${expenseList.length} total expenses.`);

                // --- Split expenses by current month vs previous period ---
                const now = new Date();
                const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const currentMonthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

                const currentMonthExpenses = expenseList.filter((e: any) => e.expense_date >= currentMonthStart);
                const prevMonthExpenses = expenseList.filter((e: any) => e.expense_date < currentMonthStart);

                const totalCurrentMonth = currentMonthExpenses.reduce((s: number, e: any) => s + e.amount, 0);
                const totalPrevPeriod = prevMonthExpenses.reduce((s: number, e: any) => s + e.amount, 0);

                const catCurrentMonth: Record<string, number> = {};
                currentMonthExpenses.forEach((e: any) => {
                    catCurrentMonth[e.category] = (catCurrentMonth[e.category] ?? 0) + e.amount;
                });

                const catPrevPeriod: Record<string, number> = {};
                prevMonthExpenses.forEach((e: any) => {
                    catPrevPeriod[e.category] = (catPrevPeriod[e.category] ?? 0) + e.amount;
                });

                // --- Build structured context for the AI ---
                const todayStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                const currentCatStr = Object.entries(catCurrentMonth).length > 0
                    ? Object.entries(catCurrentMonth).map(([k, v]) => `${k}: ₹${Math.round(v / 100)}`).join(', ')
                    : 'No transactions yet this month';
                const prevCatStr = Object.entries(catPrevPeriod).length > 0
                    ? Object.entries(catPrevPeriod).map(([k, v]) => `${k}: ₹${Math.round(v / 100)}`).join(', ')
                    : 'No transactions in this period';

                const context = [
                    `TODAY: ${todayStr}`,
                    ``,
                    `=== ${currentMonthName} (Current Month So Far) ===`,
                    `Transactions: ${currentMonthExpenses.length}`,
                    `Total Spent: ₹${Math.round(totalCurrentMonth / 100)}`,
                    `By Category: ${currentCatStr}`,
                    ``,
                    `=== Previous Period (Before This Month) ===`,
                    `Transactions: ${prevMonthExpenses.length}`,
                    `Total Spent: ₹${Math.round(totalPrevPeriod / 100)}`,
                    `By Category: ${prevCatStr}`,
                ].join('\n');

                console.log("Context being sent to AI:\n", context);

                // --- Call AI ---
                console.log("Calling Gemini API...");
                const aiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: `You are a Smart Financial Coach for an Indian expense tracking app. Return ONLY valid JSON.
{
  "briefing": "Conversational 2-3 sentence summary of the user's financial situation.",
  "vital_signs": { "status": "on_track" or "warning", "burn_rate": "low" or "high", "top_leak": "top spending category name or null" },
  "anomaly": "One interesting pattern or observation, or null if nothing notable.",
  "tip": "One specific, actionable money-saving tip."
}

CRITICAL RULES — follow these strictly:
- Use ONLY the data provided. Do NOT invent transactions or amounts.
- If "Current Month Transactions" is 0, say the month has just started with no spending yet. Do NOT claim any spending happened.
- Base your "top_leak" on current month data ONLY. If current month has no data, set it to null.
- Always reference the correct month name as given in the data.
- Use ₹ (Indian Rupee) for all amounts.
- Keep the briefing friendly, concise, and encouraging.

FINANCIAL DATA:
${context}` }] }],
                            generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
                        }),
                    },
                );

                const aiData = await aiResponse.json();
                console.log("Gemini HTTP status:", aiResponse.status);
                console.log("Gemini full response:", JSON.stringify(aiData));

                if (!aiData.candidates?.[0]) {
                    console.error("AI returned no candidates. Full response:", JSON.stringify(aiData));
                    // Check for quota/auth errors specifically
                    if (aiData.error) {
                        console.error("Gemini API error code:", aiData.error.code, "message:", aiData.error.message);
                    }
                    continue;
                }
                
                const resultText = aiData.candidates[0].content.parts[0].text;
                console.log("AI Response received:", resultText);
                const result = JSON.parse(resultText);

                const insertData: any = {
                    user_id: user.id,
                    type: 'coaching_briefing',
                    content: result.briefing,
                    generated_at: new Date().toISOString(),
                };

                console.log("Inserting insight into database...");
                const { error: insertError } = await supabase.from('insights').insert({
                    ...insertData,
                    metadata: result
                });

                if (insertError) {
                    console.warn("Primary insert failed, attempting fallback:", insertError.message);
                    const { error: fallbackError } = await supabase.from('insights').insert({
                        ...insertData,
                        content: result.briefing + "\n\nJSON_DATA:" + JSON.stringify(result)
                    });
                    if (fallbackError) console.error("Fallback insert also failed:", fallbackError.message);
                } else {
                    console.log("Insight saved successfully.");
                }

                processed++;
            } catch (e) {
                console.error(`Error in user loop for ${user.id}:`, e);
            }
        }

        return new Response(JSON.stringify({ success: true, processed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error("CRITICAL Top level error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});