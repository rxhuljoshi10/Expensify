// supabase/functions/parse-voice-expense/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const GOOGLE_CLOUD_API_KEY = Deno.env.get('GOOGLE_CLOUD_API_KEY');
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
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const today = formData.get('today') as string;

    const fileName = audioFile.name || 'audio.wav';
    const ext = fileName.split('.').pop()?.toLowerCase();

    let encoding = "LINEAR16";
    let sampleRateHertz = 44100;

    if (ext === "3gp" || ext === "amr") {
      encoding = "AMR";
      sampleRateHertz = 8000;
    } else if (ext === "wav" || ext === "caf") {
      encoding = "LINEAR16";
      sampleRateHertz = 44100;
    }

    // Step 1: Google Speech to Text
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = encode(new Uint8Array(arrayBuffer));

    const speechRes = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_CLOUD_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            encoding,
            sampleRateHertz,
            languageCode: "en-US",
          },
          audio: {
            content: base64Audio,
          },
        }),
      }
    );

    const speechData = await speechRes.json();
    if (speechData.error) {
      throw new Error(speechData.error.message || 'Error parsing speech');
    }

    const transcript = speechData.results
      ?.map((result: any) => result.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(" ") || null;

    if (!transcript) {
      throw new Error('No speech detected');
    }


    // Step 2: Gemini Parsing — extract one or more expenses as a JSON array
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expense extraction assistant. The user spoke one or more expenses aloud.
Extract ALL expenses mentioned and return them as a JSON array.

Each object in the array must have exactly these fields:
- "amount": a plain number (no currency symbols, no commas)
- "merchant": the merchant or vendor name
- "category": the best matching category from this list: ${CATEGORIES.join(', ')}

Rules:
- If only one expense is mentioned, still return an array with one element.
- Do NOT include any extra text, markdown, or code fences — output raw JSON only.
- If an amount is ambiguous (e.g. "3k"), convert it to a number (3000).

Example input: "zudio 3000, dmart 1000, chicken biryani 250"
Example output: [{"amount":3000,"merchant":"Zudio","category":"Shopping"},{"amount":1000,"merchant":"DMart","category":"Shopping"},{"amount":250,"merchant":"Chicken Biryani","category":"Food"}]

Example input: "Spent 200 on Uber ride"
Example output: [{"amount":200,"merchant":"Uber","category":"Transport"}]

Input: "${transcript}"
Output:`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 5024,
          responseMimeType: 'application/json',
        }
      }),
    });

    const geminiData = await geminiRes.json();

    if (geminiData.error) {
      throw new Error('Gemini API Error: ' + geminiData.error.message);
    }

    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!raw) {
      throw new Error('Gemini returned empty response');
    }

    // Parse the JSON array response
    let parsed: { amount: number; merchant: string; category: string }[];
    try {
      parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Not an array');
    } catch {
      throw new Error('Could not parse expenses from transcript');
    }

    // Validate and sanitise each expense
    const expenses = parsed
      .map((item) => {
        const amount = parseFloat(String(item.amount));
        if (isNaN(amount) || amount <= 0) return null;
        const merchant = String(item.merchant || '').trim() || 'Unknown';
        const category = CATEGORIES.find(
          (c) => c.toLowerCase() === String(item.category || '').toLowerCase()
        ) ?? 'Other';
        return { amount, merchant, category };
      })
      .filter(Boolean) as { amount: number; merchant: string; category: string }[];

    if (expenses.length === 0) {
      throw new Error('Could not extract any valid expenses from transcript');
    }

    return new Response(
      JSON.stringify({ transcript, expenses }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
