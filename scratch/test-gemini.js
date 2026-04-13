const fs = require('fs');
require('dotenv').config({ path: './supabase/.env' }); // or just pass key

async function test() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.log("No key found, reading from supabase/functions/.env");
  }

  const payload = {
    systemInstruction: {
      parts: [{ text: "You are a test." }]
    },
    contents: [{
      role: 'user',
      parts: [{ text: "Hello" }]
    }],
    generationConfig: {
      maxOutputTokens: 2048,
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
