// hooks/useSmsSync.ts
// Main hook that connects the native SMS BroadcastReceiver to the
// smsSync orchestrator. Activated in _layout.tsx when user is logged in.

import { useEffect, useRef } from 'react';
import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useUserCategories } from './useUserCategories';
import { processSms, processOfflineQueue, expirePendingExpenses } from '../lib/smsSync';
import { useQueryClient } from '@tanstack/react-query';

const { SmsReceiverModule } = NativeModules;

/**
 * Hook that manages the SMS sync lifecycle:
 * 1. Listens for incoming SMS via native BroadcastReceiver
 * 2. Processes each SMS through the sync pipeline
 * 3. Handles offline queue processing on connectivity restore
 * 4. Expires old pending expenses on mount
 */
export function useSmsSync(): void {
  const { user } = useAuthStore();
  const smsSyncEnabled = useSettingsStore(s => s.smsSyncEnabled);
  const { categories } = useUserCategories();
  const queryClient = useQueryClient();
  const wasOfflineRef = useRef(false);

  const userId = user?.id;
  const categoryNames = categories?.map(c => c.name);

  // ── SMS Listener ───────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android' || !userId || !smsSyncEnabled) return;

    let eventEmitter: NativeEventEmitter | null = null;
    let subscription: any = null;

    const setup = async () => {
      try {
        // Request permissions if not already granted
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        ]);

        const hasPermissions =
          granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED;

        if (!hasPermissions) {
          console.log('[useSmsSync] SMS permissions not granted');
          return;
        }

        // Start native listener
        await SmsReceiverModule.startListening();

        // Subscribe to SMS events
        eventEmitter = new NativeEventEmitter(SmsReceiverModule);
        subscription = eventEmitter.addListener(
          'onSmsReceived',
          async (event: { sender: string; body: string; timestamp: number }) => {
            console.log('[useSmsSync] SMS received from:', event.sender);
            await processSms(event.body, userId, categoryNames);
            // Invalidate expense queries so UI updates
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['pending-sms-expenses'] });
          },
        );

        console.log('[useSmsSync] SMS listener active');
      } catch (e) {
        console.error('[useSmsSync] Setup failed:', e);
      }
    };

    setup();

    return () => {
      subscription?.remove();
      if (SmsReceiverModule?.stopListening) {
        SmsReceiverModule.stopListening().catch(() => {});
      }
    };
  }, [userId, smsSyncEnabled, categoryNames?.join(',')]);

  // ── Offline Queue Processing ───────────────────────────────────────
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
  }, [userId, smsSyncEnabled, categoryNames?.join(',')]);

  // ── Expire Old Pending Expenses (on mount) ─────────────────────────
  useEffect(() => {
    if (!userId) return;

    expirePendingExpenses(userId).then(() => {
      queryClient.invalidateQueries({ queryKey: ['pending-sms-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    });
  }, [userId]);
}
