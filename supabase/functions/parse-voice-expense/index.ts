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

    // Step 2: Gemini Parsing — pipe-delimited output
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Given this expense transcript, extract exactly three values separated by pipes (|).

Value 1: The amount as a plain number (no currency symbols, no commas)
Value 2: The merchant or vendor name
Value 3: The best matching category from this list: ${CATEGORIES.join(', ')}

Reply with ONLY the three values separated by | on a single line. No other text.

Example input: "Spent 200 on Uber ride"
Example output: 200|Uber|Transport

Input: "${transcript}"
Output:`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 1024
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

    // Parse the pipe-delimited response
    const parts = raw.split('|').map((s: string) => s.trim());
    if (parts.length < 3) {
      throw new Error('Could not parse expense from transcript');
    }

    const amount = parseFloat(parts[0]);
    if (isNaN(amount)) {
      throw new Error('Could not extract amount from transcript');
    }

    const merchant = parts[1];
    const rawCategory = parts[2];
    const category = CATEGORIES.find(c => c.toLowerCase() === rawCategory.toLowerCase()) ?? 'Other';

    return new Response(
      JSON.stringify({ transcript, amount, merchant, category }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
