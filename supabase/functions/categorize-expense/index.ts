// supabase/functions/categorize-expense/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;

const CATEGORIES = [
  'Food', 'Transport', 'Shopping', 'Health',
  'Entertainment', 'Home', 'Education', 'Bills',
  'Personal', 'Travel', 'Fitness', 'Other'
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { merchant, description } = await req.json();

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expense categorizer. Given a merchant name and optional description, return ONLY the single best category from this list with no explanation:
${CATEGORIES.join(', ')}

Merchant: ${merchant}
Description: ${description ?? ''}

Reply with exactly one category name from the list above.`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 100
        }
      }),
    });

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // Validate the response is actually one of our categories
    const category = CATEGORIES.find(
      c => c.toLowerCase() === raw.toLowerCase()
    ) ?? 'Other';

    return new Response(
      JSON.stringify({ category }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ category: 'Other', error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      // Return 200 with fallback — never let AI failure block saving an expense
    );
  }
});