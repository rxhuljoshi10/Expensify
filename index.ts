import 'expo-router/entry';
import { AppRegistry } from 'react-native';
import { processSms } from './lib/smsSync';
import { useAuthStore } from './store/authStore';
import { supabase } from './lib/supabase';

// Register Headless JS task for processing SMS when app is minimized or closed
AppRegistry.registerHeadlessTask('SmsHeadlessTask', () => async (taskData: { sender?: string; body?: string; timestamp?: number }) => {
  console.log('[HeadlessJS] Background SMS received:', taskData?.body);
  if (!taskData?.body) return;

  try {
    let userId = useAuthStore.getState().user?.id;
    if (!userId) {
      console.log('[HeadlessJS] authStore user is null, fetching session from Supabase...');
      const { data } = await supabase.auth.getSession();
      userId = data.session?.user?.id;
    }

    if (!userId) {
      console.log('[HeadlessJS] No active session found, skipping background SMS processing');
      return;
    }

    console.log('[HeadlessJS] Processing background SMS for user:', userId);
    await processSms(taskData.body, userId);
    console.log('[HeadlessJS] Background SMS processed successfully');
  } catch (e) {
    console.error('[HeadlessJS] Background SMS processing failed:', e);
  }
});

console.log('[Expensify] App initialized');
