// Quick test: sends a notification via the edge function
// Run with: node scratch/test-notification.mjs

const SUPABASE_URL = 'https://boxxvhsgpzhjkomqhyxn.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveHh2aHNncHpoamtvbXFoeXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTgxNTgsImV4cCI6MjA5MDUzNDE1OH0.HG80HR7l5bpWvIos3b59YBxBHUsxPGb0DXIz7llN3bo';

async function testNotification(type) {
  console.log(`\n🔔 Sending "${type}" notification...`);
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/send-notifications`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ type }),
    }
  );

  const text = await res.text();
  console.log(`   Status: ${res.status}`);
  try {
    const json = JSON.parse(text);
    console.log(`   Response:`, JSON.stringify(json, null, 2));
    return json;
  } catch {
    console.log(`   Raw response: ${text}`);
    return null;
  }
}

async function main() {
  console.log('🧪 Notification Test Runner');
  console.log('===========================');
  console.log('Token already confirmed: ExponentPushToken[uoOUQfLOu2RkaG4rwYyxwU]');

  // Try daily reminder first
  const daily = await testNotification('daily');

  // If daily didn't send (user already logged today), try weekly summary
  if (daily?.sent === 0) {
    console.log('\n   ℹ️  Daily skipped (you may have logged expenses today). Trying weekly-summary...');
    await testNotification('weekly-summary');
  }

  // Also try streak check
  await testNotification('streak');

  console.log('\n✅ Done! Check your phone for notifications.');
}

main().catch(console.error);
