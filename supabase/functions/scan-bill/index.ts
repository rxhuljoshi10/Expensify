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

/**
 * Robustly extract and parse JSON from a Gemini response that may contain
 * markdown fences, trailing commas, or surrounding text.
 */
function safeParseJson(raw: string): object {
  // 1. Strip markdown code fences
  let text = raw.replace(/```(?:json)?[\r\n]?([\s\S]*?)```/g, '$1').trim();

  // 2. Find the outermost { ... } block
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  // 3. Remove trailing commas before } or ] (common Gemini mistake)
  text = text.replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(text);
}

async function parseReceiptText(ocrText: string, today: string): Promise<object> {
  // Safely encode the OCR text so special characters (", \, newlines) don't
  // corrupt the JSON payload sent to the Gemini API.
  const safeOcrText = JSON.stringify(ocrText);

  const prompt = `You are a receipt parser. Extract expense details from this OCR text of a receipt.
Return ONLY a single valid JSON object with NO explanation, NO markdown, NO code fences.

Today's date: ${today}
Categories available: ${CATEGORIES.join(', ')}

OCR Text (JSON-encoded string, decode before reading):
${safeOcrText}

Return EXACTLY this JSON shape:
{
  "merchant": "store name",
  "total": 250.00,
  "date": "YYYY-MM-DD or null",
  "category": "one of the categories listed above",
  "items": [
    { "name": "Item Name", "amount": 60.00, "quantity": 2 },
    { "name": "Another Item", "amount": 40.00 }
  ],
  "confidence": "high | medium | low"
}

Rules:
- "total" must be a number (not a string). Use the grand total / final payable amount.
- "date" must be YYYY-MM-DD format or null if not found.
- "items" must be an array of objects. Each object MUST have "name" (string) and "amount" (number, unit price in rupees). Include "quantity" (number) ONLY if it is clearly stated on the receipt; omit it otherwise. If no items found, use an empty array [].
- "confidence" is your confidence in the extraction: high if all fields found clearly, low if OCR was unclear.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  const data = await response.json();

  if (data.error) throw new Error(`Gemini API error: ${data.error.message}`);

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new Error('Empty response from Gemini');

  try {
    return safeParseJson(raw);
  } catch (e) {
    console.error('[scan-bill] JSON parse failed. Raw response:', raw);
    throw new Error(`Failed to parse Gemini response as JSON: ${(e as Error).message}`);
  }
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

    // Parse with Gemini as a flat object
    const parsed = await parseReceiptText(ocrText, todayStr) as any;

    return new Response(
      JSON.stringify({ ...parsed, ocrText }),
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