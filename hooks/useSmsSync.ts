// hooks/useSmsSync.ts
// Manages SMS sync lifecycle: permissions, offline queue, expense expiry,
// realtime DB updates, and AppState focus refetching.
// Actual SMS processing is handled by HeadlessJS (SmsHeadlessTask in index.ts).

import { useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid, AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useUserCategories } from './useUserCategories';
import { processOfflineQueue, expirePendingExpenses } from '../lib/smsSync';
import { supabase } from '../lib/supabase';

/**
 * Hook that manages the SMS sync lifecycle & UI synchronization:
 * 1. Requests SMS permissions on mount
 * 2. Realtime listener for `expenses` and `pending_sms_expenses` DB changes
 * 3. AppState change listener (refetches queries when app returns to foreground)
 * 4. Offline queue processing on connectivity restore
 * 5. Expire old pending expenses on mount
 */
export function useSmsSync(): void {
  const { user } = useAuthStore();
  const smsSyncEnabled = useSettingsStore(s => s.smsSyncEnabled);
  const { categories } = useUserCategories();
  const queryClient = useQueryClient();
  const wasOfflineRef = useRef(false);

  const userId = user?.id;
  const categoryNames = categories?.map(c => c.name);

  // ── 1. Request SMS Permissions ───────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!userId || !smsSyncEnabled) return;

    const requestPermissions = async () => {
      try {
        const permissionsToRequest: any[] = [
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        ];

        // On Android 13+ (API 33+), POST_NOTIFICATIONS runtime permission must be explicitly requested
        if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
          permissionsToRequest.push('android.permission.POST_NOTIFICATIONS');
        }

        const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);

        // Also request expo-notifications permission prompt for full OS compatibility
        try {
          const Notifications = require('expo-notifications');
          await Notifications.requestPermissionsAsync();
        } catch (_e) {}

        const hasPermissions =
          granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED;

        if (hasPermissions) {
          console.log('[useSmsSync] SMS & Notification permissions granted');
        } else {
          console.log('[useSmsSync] SMS permissions not granted');
        }
      } catch (e) {
        console.error('[useSmsSync] Permission request failed:', e);
      }
    };

    requestPermissions();
  }, [userId, smsSyncEnabled]);

  // ── Sync Auth Token to Native SharedPreferences for Background Execution ──
  useEffect(() => {
    if (Platform.OS !== 'android' || !userId) return;

    const syncNativeAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (session?.access_token && session?.refresh_token) {
          const { NativeModules } = require('react-native');
          if (NativeModules.SmsReceiverModule?.saveAuthToken) {
            await NativeModules.SmsReceiverModule.saveAuthToken(
              userId,
              session.access_token,
              session.refresh_token,
            );
            console.log('[useSmsSync] Synced auth & refresh tokens to native SharedPreferences');
          }
          if (smsSyncEnabled && NativeModules.SmsReceiverModule?.startForegroundService) {
            await NativeModules.SmsReceiverModule.startForegroundService();
            console.log('[useSmsSync] Started native SMS foreground service');
          }
        }
      } catch (e) {
        console.error('[useSmsSync] Failed to sync auth to native:', e);
      }
    };

    syncNativeAuth();
  }, [userId, smsSyncEnabled]);

  // ── 2. Realtime DB Listener for Personal & Pending Expenses ──────────
  useEffect(() => {
    if (!userId) return;

    console.log('[useSmsSync] Subscribing to realtime updates for user:', userId);

    const channel = supabase
      .channel(`personal-expenses-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[useSmsSync] Realtime DB event (expenses):', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['expenses'] });
          queryClient.invalidateQueries({ queryKey: ['group-expenses'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_sms_expenses',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[useSmsSync] Realtime DB event (pending_sms_expenses):', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['pending-sms-expenses'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  // ── 3. AppState Change Listener (Foreground return refetch) ─────────
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(nextAppState === 'active');
      }

      if (nextAppState === 'active' && userId) {
        console.log('[useSmsSync] App returned to foreground — invalidating expense queries');
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['pending-sms-expenses'] });
        queryClient.invalidateQueries({ queryKey: ['group-expenses'] });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [userId, queryClient]);

  // ── 4. Offline Queue Processing ───────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android' || !userId || !smsSyncEnabled) return;

    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && wasOfflineRef.current) {
        console.log('[useSmsSync] Back online — processing offline queue');
        await processOfflineQueue(userId, categoryNames);
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['pending-sms-expenses'] });
      }
      wasOfflineRef.current = !state.isConnected;
    });

    return () => unsubscribe();
  }, [userId, smsSyncEnabled]);

  // ── 5. Expire Old Pending Expenses (on mount) ─────────────────────────
  useEffect(() => {
    if (!userId) return;

    expirePendingExpenses(userId).then(() => {
      queryClient.invalidateQueries({ queryKey: ['pending-sms-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    });
  }, [userId]);
}
