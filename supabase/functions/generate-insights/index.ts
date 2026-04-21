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
        let userList = [];
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
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sinceStr = thirtyDaysAgo.toISOString().split('T')[0];

        for (const user of userList) {
            try {
                console.log(`Processing User: ${user.id}`);
                const { data: expenses, error: expError } = await supabase
                    .from('expenses')
                    .select('amount, category, merchant, expense_date')
                    .eq('user_id', user.id)
                    .gte('expense_date', sinceStr);

                if (expError) {
                    console.error(`Error fetching expenses for ${user.id}:`, expError);
                    continue;
                }

                const expenseList = expenses || [];
                console.log(`Found ${expenseList.length} expenses for coaching.`);

                const totalPaise = expenseList.reduce((s, e) => s + e.amount, 0);
                const catTotals: Record<string, number> = {};
                expenseList.forEach(e => {
                    catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount;
                });

                const context = `User: ${user.id}\nTransactions: ${expenseList.length}\nTotal: ₹${Math.round(totalPaise / 100)}\nProfile: ${Object.entries(catTotals).map(([k,v]) => `${k}: ₹${Math.round(v/100)}`).join(', ')}`;

                console.log("Calling Gemini API...");
                const aiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: `You are a Smart Financial Coach. Return a JSON briefing.
{
  "briefing": "Conversational summary.",
  "vital_signs": { "status": "on_track"|"warning", "burn_rate": "low"|"high", "top_leak": "category" },
  "anomaly": "Insight or null",
  "tip": "Action tip."
}

CRITICAL INSTRUCTION: Ensure the briefing and tips are highly varied and different on every request. Keep it conversational.
Current Date: ${new Date().toLocaleDateString()}

DATA:
${context}` }] }],
                            generationConfig: { responseMimeType: "application/json", temperature: 1.0 }
                        }),
                    },
                );

                const aiData = await aiResponse.json();
                if (!aiData.candidates?.[0]) {
                    console.error("AI returned no candidates:", JSON.stringify(aiData));
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