// lib/smsSync.ts  v2
// Orchestrator for SMS-to-expense pipeline.
//
// Pipeline overview (processSms):
//   1. isTransactionalSms()      — local filter, zero network
//   2. extractSmsFields()        — new multi-bank name-based extractor (primary)
//      └── extractBasicFields()  — legacy VPA-based fallback for old SMS formats
//      └── enqueueUnparsedSms() — if both fail; drains via LLM on next app open
//   3. isDuplicate()             — 30-min dedup window (AsyncStorage)
//   4. classifyRecipient()       — personal vs merchant (UPI type > heuristics)
//      ├── personal → saveExpense(category='Personal') — no LLM needed
//      └── merchant → categorizeExpense(name) → saveExpense
//
// Offline handling:
//   - Connectivity is checked only for merchant categorization (LLM call)
//   - Personal payments save immediately without network
//   - Merchant SMS that arrive offline go into the offline queue; drained on reconnect
//   - SMS we couldn't parse at all go into the unparsed queue; drained via LLM on open

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { categorizeExpense, parseSmsWithLLM } from './ai';
import {
  isTransactionalSms,
  extractSmsFields,
  extractBasicFields,
  classifyRecipient,
  classifyVpa,
  formatMerchantFromVpa,
  generateDedupKey,
} from './smsParser';

// ── Queue Keys ───────────────────────────────────────────────────────────────

const OFFLINE_QUEUE_KEY   = '@sms_offline_queue';    // merchant SMS that arrived while offline
const RECENT_DEDUP_KEY    = '@sms_recent_dedup';     // dedup entries (last 30 min)
const UNPARSED_QUEUE_KEY  = '@sms_unparsed_queue';   // SMS that local regex couldn't parse → LLM drain

const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// ── Offline Queue ────────────────────────────────────────────────────────────

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
    console.error('[SmsSync] Failed to enqueue offline SMS:', e);
  }
}

async function dequeueAllOfflineSms(): Promise<QueuedSms[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    return JSON.parse(raw);
  } catch (e) {
    console.error('[SmsSync] Failed to dequeue offline SMS:', e);
    return [];
  }
}

// ── Unparsed Queue (LLM drain) ───────────────────────────────────────────────

async function enqueueUnparsedSms(smsBody: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(UNPARSED_QUEUE_KEY);
    const queue: QueuedSms[] = raw ? JSON.parse(raw) : [];
    // Avoid re-queuing the exact same SMS body
    if (!queue.some(q => q.body === smsBody)) {
      queue.push({ body: smsBody, timestamp: Date.now() });
      await AsyncStorage.setItem(UNPARSED_QUEUE_KEY, JSON.stringify(queue));
      console.log('[SmsSync] Queued unparseable SMS for LLM drain');
    }
  } catch (e) {
    console.error('[SmsSync] Failed to enqueue unparsed SMS:', e);
  }
}

async function dequeueAllUnparsedSms(): Promise<QueuedSms[]> {
  try {
    const raw = await AsyncStorage.getItem(UNPARSED_QUEUE_KEY);
    if (!raw) return [];
    await AsyncStorage.removeItem(UNPARSED_QUEUE_KEY);
    return JSON.parse(raw);
  } catch (e) {
    console.error('[SmsSync] Failed to dequeue unparsed SMS:', e);
    return [];
  }
}

// ── Deduplication ────────────────────────────────────────────────────────────

interface DedupEntry {
  key: string;
  timestamp: number;
}

async function isDuplicate(dedupKey: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_DEDUP_KEY);
    const entries: DedupEntry[] = raw ? JSON.parse(raw) : [];

    const now = Date.now();
    const valid = entries.filter(e => now - e.timestamp < DEDUP_WINDOW_MS);

    if (valid.some(e => e.key === dedupKey)) return true;

    valid.push({ key: dedupKey, timestamp: now });
    await AsyncStorage.setItem(RECENT_DEDUP_KEY, JSON.stringify(valid));
    return false;
  } catch (e) {
    console.error('[SmsSync] Dedup check failed:', e);
    return false;
  }
}

// ── Push Notifications ────────────────────────────────────────────────────────

async function sendIndividualNotification(
  title: string,
  body: string,
  screen: string = 'expenses',
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { screen }, sound: 'default' },
      trigger: null,
    });
  } catch (e) {
    console.error('[SmsSync] Failed to send notification:', e);
  }
}

// ── DB Helpers ───────────────────────────────────────────────────────────────

async function saveExpense(
  userId: string,
  amount: number,    // in rupees
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

// ── Currency Formatter ───────────────────────────────────────────────────────

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Process one incoming SMS and save it as an expense if it qualifies.
 *
 * Parsing strategy:
 *   Primary:   extractSmsFields()  — new multi-bank name-based extractor
 *   Fallback:  extractBasicFields() — legacy VPA (@) based extractor
 *   Last resort: enqueueUnparsedSms() — for LLM drain on next app open
 *
 * Classification:
 *   Uses classifyRecipient() which prefers UPI path type (P2M/P2A) over heuristics.
 *   Personal → saves immediately (no LLM).
 *   Merchant → categorizeExpense(name) edge function → saves.
 */
export async function processSms(
  smsBody: string,
  userId: string,
  categories?: string[],
): Promise<void> {
  console.log('[SmsSync] Processing SMS...');

  // Step 1: Local filter — must be a financial debit SMS
  if (!isTransactionalSms(smsBody)) {
    console.log('[SmsSync] Not a transactional SMS, skipping');
    return;
  }

  // Step 2: Field extraction (new format first, legacy VPA fallback)
  let amount: number;
  let recipientName: string | null = null;
  let upiRef: string | null = null;
  let date: string;
  let vpaType: 'P2A' | 'P2M' | null = null;

  const parsed = extractSmsFields(smsBody);

  if (parsed) {
    // ── New format: name extracted directly ──────────────────────────────────
    amount       = parsed.amount;
    recipientName = parsed.recipientName;
    upiRef       = parsed.upiRef;
    date         = parsed.date ?? new Date().toISOString().split('T')[0];
    vpaType      = parsed.vpaType;
    console.log('[SmsSync] Parsed (new format):', { amount, recipientName, upiRef, date, vpaType });
  } else {
    // ── Legacy fallback: VPA-based format ───────────────────────────────────
    const legacy = extractBasicFields(smsBody);
    if (!legacy) {
      console.log('[SmsSync] Could not parse SMS — queuing for LLM drain');
      await enqueueUnparsedSms(smsBody);
      return;
    }

    amount = legacy.amount;
    date   = legacy.date ?? new Date().toISOString().split('T')[0];

    if (legacy.vpa) {
      const cls = classifyVpa(legacy.vpa);
      recipientName = formatMerchantFromVpa(cls.handle, cls.type);
      // Map VPA type to UPI path type signal
      vpaType = cls.type === 'personal' ? 'P2A' : 'P2M';
    }
    console.log('[SmsSync] Parsed (legacy VPA):', { amount, recipientName, date, vpaType });
  }

  // Step 3: Deduplication
  const dedupKey = generateDedupKey(amount, date, upiRef, recipientName);
  if (await isDuplicate(dedupKey)) {
    console.log('[SmsSync] Duplicate SMS detected, skipping. Key:', dedupKey);
    return;
  }

  // Step 4: Classify recipient and save
  const recipientClass = classifyRecipient(recipientName, vpaType);
  const merchantLabel  = recipientName ?? 'Unknown Merchant';

  if (recipientClass === 'personal') {
    // ── Personal payment — no LLM needed ────────────────────────────────────
    console.log('[SmsSync] Personal payment to:', merchantLabel);
    const saved = await saveExpense(userId, amount, merchantLabel, 'Personal', date);
    if (saved) {
      await sendIndividualNotification(
        'Expense Saved',
        `${formatRupees(amount)} to ${merchantLabel} (Personal)`,
        'expenses',
      );
    }
    return;
  }

  // ── Merchant — needs categorization (requires network) ────────────────────
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    console.log('[SmsSync] Offline — queuing merchant SMS for later');
    await enqueueOfflineSms(smsBody);
    return;
  }

  console.log('[SmsSync] Categorizing merchant:', merchantLabel);
  const category = await categorizeExpense(merchantLabel, undefined, categories);
  const saved = await saveExpense(userId, amount, merchantLabel, category, date);
  if (saved) {
    await sendIndividualNotification(
      'Expense Saved',
      `${formatRupees(amount)} at ${merchantLabel} (${category})`,
      'expenses',
    );
  }
}

// ── Offline Queue Processor ──────────────────────────────────────────────────

/**
 * Process SMS that arrived while the device was offline.
 * Called when connectivity is restored.
 */
export async function processOfflineQueue(
  userId: string,
  categories?: string[],
): Promise<void> {
  const queue = await dequeueAllOfflineSms();
  if (queue.length === 0) return;

  console.log(`[SmsSync] Processing ${queue.length} offline SMS`);
  for (const item of queue) {
    try {
      await processSms(item.body, userId, categories);
    } catch (e) {
      console.error('[SmsSync] Failed to process offline SMS:', e);
    }
  }
}

// ── Unparsed Queue Processor (LLM drain) ────────────────────────────────────

/**
 * Process SMS that local regex couldn't parse. Uses the LLM (parse-sms edge
 * function) as a last-resort parser. Called on app open when online.
 *
 * This is the future-proof safety net: any SMS format we haven't profiled
 * locally will eventually be processed via Gemini.
 */
export async function processUnparsedSmsQueue(
  userId: string,
  categories?: string[],
): Promise<void> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  const queue = await dequeueAllUnparsedSms();
  if (queue.length === 0) return;

  console.log(`[SmsSync] LLM-draining ${queue.length} unparsed SMS`);

  for (const item of queue) {
    try {
      if (!isTransactionalSms(item.body)) continue;  // re-check; still filter non-financial

      const llmResult = await parseSmsWithLLM(item.body);
      if (!llmResult || !llmResult.isExpense || !llmResult.amount) {
        console.log('[SmsSync] LLM says not an expense — discarding');
        continue;
      }

      const date = llmResult.date ?? new Date().toISOString().split('T')[0];
      const merchantLabel = llmResult.recipientName ?? 'Unknown Merchant';

      // Dedup using LLM-extracted fields
      const dedupKey = generateDedupKey(llmResult.amount, date, null, merchantLabel);
      if (await isDuplicate(dedupKey)) continue;

      // Classify using LLM-provided vpaType or name heuristics
      const recipientClass = classifyRecipient(llmResult.recipientName, null);

      if (recipientClass === 'personal') {
        await saveExpense(userId, llmResult.amount, merchantLabel, 'Personal', date);
      } else {
        const category = await categorizeExpense(merchantLabel, undefined, categories);
        await saveExpense(userId, llmResult.amount, merchantLabel, category, date);
      }

      console.log('[SmsSync] LLM-parsed and saved:', merchantLabel, llmResult.amount);
    } catch (e) {
      console.error('[SmsSync] Failed to LLM-process unparsed SMS:', e);
    }
  }
}

// ── Pending Expense Expiry ───────────────────────────────────────────────────

/**
 * Expire pending_sms_expenses older than 24 hours.
 * Converts them to regular expenses with raw VPA as merchant and "Other" as category.
 * (Kept for backward compat with any existing pending expenses in DB from old pipeline.)
 */
export async function expirePendingExpenses(userId: string): Promise<void> {
  try {
    const { data: expired, error } = await supabase
      .from('pending_sms_expenses')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    if (error || !expired || expired.length === 0) return;

    console.log(`[SmsSync] Expiring ${expired.length} pending expenses`);

    for (const pending of expired) {
      const merchant = pending.raw_vpa ?? 'Unknown SMS Expense';
      await saveExpense(
        userId,
        pending.amount / 100,
        merchant,
        'Other',
        pending.parsed_date ?? new Date().toISOString().split('T')[0],
      );
      await supabase
        .from('pending_sms_expenses')
        .update({ status: 'expired' })
        .eq('id', pending.id);
    }
  } catch (e) {
    console.error('[SmsSync] Expiry processing failed:', e);
  }
}
