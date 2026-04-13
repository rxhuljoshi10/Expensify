// supabase/functions/scan-bill/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY')!;
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

// ── Step 1: Google Vision OCR ─────────────────────────────────────────
async function extractTextFromImage(base64Image: string): Promise<string> {
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        }],
      }),
    }
  );

  const data = await response.json();

  if (data.error) throw new Error(`Vision API error: ${data.error.message}`);

  const annotation = data.responses?.[0]?.fullTextAnnotation;
  if (!annotation?.text) throw new Error('No text found in image');

  return annotation.text;
}

// ── Step 2: Gemini Flash parsing ──────────────────────────────────────
async function parseReceiptText(ocrText: string, today: string): Promise<object> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a receipt parser. Extract expense details from this OCR text of a receipt.
Return ONLY valid JSON with no explanation, no markdown, no code fences.

Today's date: ${today}
Categories available: ${CATEGORIES.join(', ')}

OCR Text:
${ocrText}

Extract all expense items from the following bill or receipt scanned through OCR.

Rules:
- Ignore total, tax, GST, subtotal
- Extract individual items
- amount must be number

Return ONLY JSON array.
[
  {
    "item": "Pizza",
    "amount": 120,
    "category": "Food"
  }
]`,
          }],
        }],
        generationConfig: {
          temperature: 0.1,   // low temperature for consistent structured output
          maxOutputTokens: 300,
        },
      }),
    }
  );

  const data = await response.json();

  if (data.error) throw new Error(`Gemini API error: ${data.error.message}`);

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new Error('Empty response from Gemini');

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}

// ── Main handler ──────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, today } = await req.json();

    if (!imageBase64) {
      throw new Error('No image provided');
    }

    const todayStr = today ?? new Date().toISOString().split('T')[0];

    // Run Vision OCR
    const ocrText = await extractTextFromImage(imageBase64);

    // Parse with Gemini
    const parsed = await parseReceiptText(ocrText, todayStr);

    return new Response(
      JSON.stringify({ ...parsed as object, ocrText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('scan-bill error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});