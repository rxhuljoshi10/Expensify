// Direct Expo Push API test — bypasses the edge function entirely
// Run with: node scratch/test-direct-push.mjs

const EXPO_PUSH_TOKEN = 'ExponentPushToken[5vTDmKAJb9a5L_fdglH4dK]';

async function main() {
  console.log('🔔 Sending notification directly to Expo Push API...');
  console.log(`   Token: ${EXPO_PUSH_TOKEN}\n`);

  const message = {
    to: EXPO_PUSH_TOKEN,
    title: '🧪 Test Notification',
    body: 'If you see this, push notifications are working!',
    data: { screen: 'home' },
    sound: 'default',
    priority: 'high',
  };

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(message),
  });

  const result = await res.json();
  console.log('Expo Push API response:', JSON.stringify(result, null, 2));

  if (result.data) {
    const ticket = result.data;
    if (ticket.status === 'ok') {
      console.log('\n✅ Expo accepted the notification! Ticket ID:', ticket.id);
      console.log('   You should receive it on your phone within seconds.');
    } else if (ticket.status === 'error') {
      console.log('\n❌ Expo rejected the notification:');
      console.log('   Error:', ticket.message);
      console.log('   Details:', ticket.details?.error);
    }
  }
}

main().catch(console.error);
