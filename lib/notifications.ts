// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// ── Configure how notifications look when app is in the foreground ────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Deep-link route map ───────────────────────────────────────────────
const ROUTE_MAP: Record<string, string> = {
  add: '/(tabs)/add',
  home: '/(tabs)/home',
  expenses: '/(tabs)/expenses',
  recurring: '/recurring',
  'budget-settings': '/budget-settings',
  'notification-settings': '/notification-settings',
  profile: '/(tabs)/profile',
};

/**
 * Request notification permission, get Expo push token, and store it in
 * the `push_tokens` table. Returns the token string or null on failure.
 */
export async function registerForPushNotifications(
  userId: string,
): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Notifications] Push requires a physical device');
    return null;
  }

  // ── Permission ──────────────────────────────────────────────────────
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return null;
  }

  // ── Android channel ─────────────────────────────────────────────────
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#03C775',
    });
  }

  // ── Get Expo push token ─────────────────────────────────────────────
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error('[Notifications] Missing projectId in app config');
      return null;
    }

    const tokenObj = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenObj.data;

    // Replace existing tokens for this user (handles device switches)
    await supabase.from('push_tokens').delete().eq('user_id', userId);
    const { error } = await supabase.from('push_tokens').insert({
      user_id: userId,
      token,
      platform: Platform.OS,
    });

    if (error) {
      console.error('[Notifications] Failed to save token:', error.message);
    } else {
      console.log('[Notifications] Token registered:', token);
    }

    return token;
  } catch (err: any) {
    if (err?.message?.includes('FirebaseApp is not initialized')) {
      console.warn(
        '[Notifications] Firebase is not initialized. Make sure google-services.json is in android/app/.',
      );
    } else {
      console.error('[Notifications] Failed to get push token:', err);
    }
    return null;
  }
}

/**
 * Remove all push tokens for this user (when they disable notifications).
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    await supabase.from('push_tokens').delete().eq('user_id', userId);
    console.log('[Notifications] Tokens removed');
  } catch (err) {
    console.error('[Notifications] Failed to unregister:', err);
  }
}

/**
 * Listen for notification taps while the app is running (warm start).
 * Returns a cleanup function to remove the listener.
 */
export function setupNotificationResponseListener(
  navigate: (route: string) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const screen = response.notification.request.content.data
        ?.screen as string | undefined;
      if (screen) {
        navigate(ROUTE_MAP[screen] ?? `/(tabs)/${screen}`);
      }
    },
  );
  return () => sub.remove();
}

/**
 * Check if the app was launched by tapping a notification (cold start).
 * Returns the target route, or null.
 */
export async function getInitialNotificationRoute(): Promise<string | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  const screen = response?.notification.request.content.data
    ?.screen as string | undefined;
  return screen ? (ROUTE_MAP[screen] ?? `/(tabs)/${screen}`) : null;
}
