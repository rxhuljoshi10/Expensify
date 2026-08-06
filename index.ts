import 'expo-router/entry';
import { AppRegistry } from 'react-native';
import { processSms } from './lib/smsSync';
import { useAuthStore } from './store/authStore';

// Register Headless JS task for processing SMS when app is minimized or closed
AppRegistry.registerHeadlessTask('SmsHeadlessTask', () => async (taskData: { sender?: string; body?: string; timestamp?: number }) => {
  console.log('[HeadlessJS] Background SMS received:', taskData?.body);
  if (!taskData?.body) return;

  try {
    const user = useAuthStore.getState().user;
    if (!user?.id) return;
    await processSms(taskData.body, user.id);
  } catch (e) {
    console.error('[HeadlessJS] Background SMS processing failed:', e);
  }
});

console.log('[Expensify] App initialized');
