// lib/smsSync.ts
// Orchestrator module that ties SMS detection, VPA classification,
// local regex parsing, offline queuing, and expense creation together.
//
// ⚠️ NO LLM/Gemini call for SMS parsing — all extraction is local regex.
// Gemini is ONLY used for auto-categorizing known brand VPAs via the
// existing categorize-expense edge function (one lightweight call).

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { categorizeExpense } from './ai';
import {
  isTransactionalSms,
  classifyVpa,
  extractBasicFields,
  generateDedupKey,
  formatMerchantFromVpa,
} from './smsParser';

const OFFLINE_QUEUE_KEY = '@sms_offline_queue';
const RECENT_DEDUP_KEY = '@sms_recent_dedup';
const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// ── Offline Queue ────────────────────────────────────────────────────

interface QueuedSms {
  body: string;
  timestamp: number;
}

async function enqueueOfflineSms(smsBody: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: QueuedSms[] = raw ? JSON.parse(raw) : [];
    queue.push({ body: smsBody, timestamp: Date.now() });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log('[SmsSync] Queued SMS for offline processing');
  } catch (e) {
    console.error('[SmsSync] Failed to enqueue SMS:', e);
  }
}

async function dequeueAllOfflineSms(): Promise<QueuedSms[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    return JSON.parse(raw);
  } catch (e) {
    console.error('[SmsSync] Failed to dequeue SMS:', e);
    return [];
  }
}

// ── Deduplication ────────────────────────────────────────────────────

interface DedupEntry {
  key: string;
  timestamp: number;
}

async function isDuplicate(dedupKey: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_DEDUP_KEY);
    const entries: DedupEntry[] = raw ? JSON.parse(raw) : [];

    // Clean expired entries
    const now = Date.now();
    const valid = entries.filter(e => now - e.timestamp < DEDUP_WINDOW_MS);

    // Check if this key already exists
    if (valid.some(e => e.key === dedupKey)) {
      return true;
    }

    // Add new entry and persist
    valid.push({ key: dedupKey, timestamp: now });
    await AsyncStorage.setItem(RECENT_DEDUP_KEY, JSON.stringify(valid));
    return false;
  } catch (e) {
    console.error('[SmsSync] Dedup check failed:', e);
    return false; // On error, allow the expense to proceed
  }
}

// ── Push Notifications ────────────────────────────────────────────────

// Distinct notification for auto-saved expenses (Brand, Personal, Mapped QR)
async function sendIndividualNotification(
  title: string,
  body: string,
  screen: string = 'expenses',
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { screen },
        sound: 'default',
      },
      trigger: null, // Individual notification — kept separate!
    });
  } catch (e) {
    console.error('[SmsSync] Failed to send notification:', e);
  }
}

// Collapsed notification ONLY for unrecognized pending QR expenses
const PENDING_BATCH_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
let pendingBatchCount = 0;
let pendingBatchResetTimer: ReturnType<typeof setTimeout> | null = null;

async function sendPendingBatchedNotification(
  amount: number,
  merchantName: string,
): Promise<void> {
  try {
    pendingBatchCount += 1;

    if (pendingBatchResetTimer) clearTimeout(pendingBatchResetTimer);
    pendingBatchResetTimer = setTimeout(() => {
      pendingBatchCount = 0;
    }, PENDING_BATCH_WINDOW_MS);

    let title = '';
    let body = '';

    if (pendingBatchCount === 1) {
      title = 'New Expense Detected';
      body = `₹${amount} at ${merchantName}. Tap to name this merchant.`;
    } else {
      title = `📱 ${pendingBatchCount} Pending Expenses`;
      body = `Tap to review and name these merchants.`;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: 'pending_expenses_batched_notification', // Fixed ID collapses only unknown QR notifications!
      content: {
        title,
        body,
        data: { screen: 'pending-expenses' },
        sound: 'default',
      },
      trigger: null,
    });
  } catch (e) {
    console.error('[SmsSync] Failed to send pending notification:', e);
  }
}

// ── Merchant Mapping Lookup ──────────────────────────────────────────

async function lookupMerchantMapping(
  userId: string,
  rawVpa: string,
): Promise<{ friendly_name: string; category: string | null; use_count: number } | null> {
  try {
    const { data, error } = await supabase
      .from('merchant_mappings')
      .select('friendly_name, category, use_count')
      .eq('user_id', userId)
      .eq('raw_vpa', rawVpa.toLowerCase())
      .maybeSingle();

    if (error || !data) return null;

    // Increment use_count in background
    supabase
      .from('merchant_mappings')
      .update({ use_count: (data.use_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('raw_vpa', rawVpa.toLowerCase())
      .then(
        () => {},
        (err) => console.error('[SmsSync] Failed to update use_count:', err)
      );

    return data;
  } catch (e) {
    console.error('[SmsSync] Mapping lookup failed:', e);
    return null;
  }
}

// ── Save Expense ─────────────────────────────────────────────────────

async function saveExpense(
  userId: string,
  amount: number,           // in rupees
  merchant: string,
  category: string,
  expenseDate: string,
): Promise<boolean> {
  try {
    const amountPaise = Math.round(amount * 100);

    const { error } = await supabase
      .from('expenses')
      .insert({
        user_id: userId,
        amount: amountPaise,
        merchant,
        category,
        expense_date: expenseDate,
        source: 'sms',
      });

    if (error) {
      console.error('[SmsSync] Failed to save expense:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[SmsSync] Save expense error:', e);
    return false;
  }
}

// ── Save Pending Expense ─────────────────────────────────────────────

async function savePendingExpense(
  userId: string,
  rawSms: string,
  amount: number,           // in rupees
  rawVpa: string | null,
  vpaType: string,
  parsedDate: string | null,
): Promise<boolean> {
  try {
    const amountPaise = Math.round(amount * 100);

    const { error } = await supabase
      .from('pending_sms_expenses')
      .insert({
        user_id: userId,
        raw_sms: rawSms,
        amount: amountPaise,
        raw_vpa: rawVpa,
        vpa_type: vpaType,
        parsed_date: parsedDate,
      });

    if (error) {
      console.error('[SmsSync] Failed to save pending expense:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[SmsSync] Save pending error:', e);
    return false;
  }
}

// ── Format Currency ──────────────────────────────────────────────────

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ── Main Orchestrator ────────────────────────────────────────────────

/**
 * Process a single incoming SMS message.
 * This is the main entry point called by the useSmsSync hook
 * when a new SMS is received via the native BroadcastReceiver.
 *
 * ALL parsing is done locally with regex — NO LLM calls for extraction.
 * The only network call is the existing `categorize-expense` edge function
 * for known brand VPAs (lightweight, single-word Gemini response).
 */
export async function processSms(
  smsBody: string,
  userId: string,
  categories?: string[],
): Promise<void> {
  console.log('[SmsSync] Processing SMS...');

  // Step 1: Local filter — is this a transactional (debit) SMS?
  if (!isTransactionalSms(smsBody)) {
    console.log('[SmsSync] Not a transactional SMS, skipping');
    return;
  }

  // Step 2: Extract basic fields locally using regex (amount, VPA, date)
  const localFields = extractBasicFields(smsBody);
  if (!localFields) {
    console.log('[SmsSync] Could not extract basic fields, skipping');
    return;
  }

  // Step 3: Deduplication check
  const dedupKey = generateDedupKey(localFields.amount, localFields.date, localFields.vpa);
  if (await isDuplicate(dedupKey)) {
    console.log('[SmsSync] Duplicate SMS detected, skipping');
    return;
  }

  const { amount, vpa, date: expenseDate } = localFields;
  const dateStr = expenseDate ?? new Date().toISOString().split('T')[0];

  // Step 4: If no VPA found, we can't classify — save with raw info
  if (!vpa) {
    console.log('[SmsSync] No VPA found, saving with basic info');
    const saved = await saveExpense(userId, amount, 'Unknown Merchant', 'Other', dateStr);
    if (saved) {
      await sendIndividualNotification(
        'Expense Saved',
        `${formatRupees(amount)} — Unknown merchant (Other)`,
        'expenses',
      );
    }
    return;
  }

  // Step 5: Classify VPA locally (pure string logic, no network)
  const classification = classifyVpa(vpa);

  switch (classification.type) {
    case 'personal': {
      // ── Personal payment (ok* bank / phone number / P2P bank) ──────
      // Auto-save with "Personal" category — NO network call needed
      const displayName = formatMerchantFromVpa(classification.handle, 'personal');
      const saved = await saveExpense(userId, amount, displayName, 'Personal', dateStr);
      if (saved) {
        await sendIndividualNotification(
          'Expense Saved',
          `${formatRupees(amount)} to ${displayName} (Personal)`,
          'expenses',
        );
      }
      break;
    }

    case 'brand': {
      // ── Known brand (e.g., swiggy@icici, uber@hdfcbank) ───────────
      // Use the EXISTING categorize-expense edge function for category.
      // This is the ONLY Gemini call in the entire pipeline — and it's
      // the same lightweight function already used for manual expenses.
      const displayName = formatMerchantFromVpa(classification.handle, 'brand');

      let category = 'Other';
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        // Call existing categorize-expense (tiny, single-word Gemini response)
        category = await categorizeExpense(displayName, undefined, categories);
      } else {
        // Offline: queue for later categorization, save with 'Other' for now
        await enqueueOfflineSms(smsBody);
        console.log('[SmsSync] Offline — queued brand SMS for categorization');
        return;
      }

      const saved = await saveExpense(userId, amount, displayName, category, dateStr);
      if (saved) {
        await sendIndividualNotification(
          'Expense Saved',
          `${formatRupees(amount)} at ${displayName} (${category})`,
          'expenses',
        );
      }
      break;
    }

    case 'dynamic_qr': {
      // ── Dynamic QR (unrecognizable VPA) ────────────────────────────
      // Check merchant mapping table (network call to Supabase DB, not LLM)
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        await enqueueOfflineSms(smsBody);
        console.log('[SmsSync] Offline — queued dynamic QR SMS');
        return;
      }

      const mapping = await lookupMerchantMapping(userId, classification.raw);

      if (mapping) {
        // Known merchant from past user input — auto-save
        const saved = await saveExpense(
          userId,
          amount,
          mapping.friendly_name,
          mapping.category ?? 'Other',
          dateStr,
        );
        if (saved) {
          await sendIndividualNotification(
            'Expense Saved',
            `${formatRupees(amount)} at ${mapping.friendly_name} (${mapping.category ?? 'Other'})`,
            'expenses',
          );
        }
      } else {
        // Unknown merchant — save as pending, ask user to name it
        const saved = await savePendingExpense(
          userId,
          smsBody,
          amount,
          classification.raw,
          'dynamic_qr',
          dateStr,
        );
        if (saved) {
          const displayName = formatMerchantFromVpa(classification.handle, 'dynamic_qr');
          await sendPendingBatchedNotification(amount, displayName);
        }
      }
      break;
    }
  }
}

// ── Offline Queue Processor ──────────────────────────────────────────

/**
 * Process all queued SMS messages that were received while offline.
 * Called when connectivity is restored.
 */
export async function processOfflineQueue(
  userId: string,
  categories?: string[],
): Promise<void> {
  const queue = await dequeueAllOfflineSms();
  if (queue.length === 0) return;

  console.log(`[SmsSync] Processing ${queue.length} offline queued SMS messages`);

  for (const item of queue) {
    try {
      await processSms(item.body, userId, categories);
    } catch (e) {
      console.error('[SmsSync] Failed to process queued SMS:', e);
    }
  }
}

// ── Pending Expense Expiry ───────────────────────────────────────────

/**
 * Expire pending SMS expenses that are older than 24 hours.
 * Converts them to regular expenses with raw VPA as merchant
 * and "Other" as category.
 */
export async function expirePendingExpenses(userId: string): Promise<void> {
  try {
    // Fetch expired pending expenses
    const { data: expired, error } = await supabase
      .from('pending_sms_expenses')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    if (error || !expired || expired.length === 0) return;

    console.log(`[SmsSync] Expiring ${expired.length} pending expenses`);

    for (const pending of expired) {
      // Convert to regular expense with raw VPA as merchant
      const merchant = pending.raw_vpa ?? 'Unknown SMS Expense';
      await saveExpense(
        userId,
        pending.amount / 100, // convert paise back to rupees for saveExpense
        merchant,
        'Other',
        pending.parsed_date ?? new Date().toISOString().split('T')[0],
      );

      // Mark as expired
      await supabase
        .from('pending_sms_expenses')
        .update({ status: 'expired' })
        .eq('id', pending.id);
    }
  } catch (e) {
    console.error('[SmsSync] Expiry processing failed:', e);
  }
}
