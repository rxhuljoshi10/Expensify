// lib/ai.ts
import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';
import { ExpenseItem } from '../types/expense';
import { requestCameraPermission, requestMediaLibraryPermission } from './permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Pending-categorization retry queue ─────────────────────────────────────────
// Expenses that failed LLM categorization (offline / network error) are
// stored here.  On next app open / network return, the caller retries once.
export const CATEGORIZE_QUEUE_KEY = '@categorize_retry_queue';

export interface PendingCategorizationItem {
    expenseId: string;
    hint: string;        // spentOn text to categorize
    categories: string[];
}

export const enqueuePendingCategorization = async (item: PendingCategorizationItem): Promise<void> => {
    try {
        const raw = await AsyncStorage.getItem(CATEGORIZE_QUEUE_KEY);
        const queue: PendingCategorizationItem[] = raw ? JSON.parse(raw) : [];
        // Avoid duplicates: if this expenseId is already queued, replace it
        const deduped = queue.filter(q => q.expenseId !== item.expenseId);
        deduped.push(item);
        await AsyncStorage.setItem(CATEGORIZE_QUEUE_KEY, JSON.stringify(deduped));
    } catch (e) {
        console.error('[categorize] Failed to enqueue pending item:', e);
    }
};

export const dequeuePendingCategorizations = async (): Promise<PendingCategorizationItem[]> => {
    try {
        const raw = await AsyncStorage.getItem(CATEGORIZE_QUEUE_KEY);
        if (!raw) return [];
        await AsyncStorage.removeItem(CATEGORIZE_QUEUE_KEY);
        return JSON.parse(raw);
    } catch {
        return [];
    }
};

export const parseVoiceExpense = async (audioUri: string, categories?: string[]): Promise<{
  transcript: string;
  expenses: { amount: number; merchant: string; category: string }[];
} | null> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const ext = audioUri.split('.').pop()?.toLowerCase() || 'wav';
    const mimeType = ext === '3gp' || ext === 'amr' ? 'audio/3gpp' : 'audio/wav';

    const formData = new FormData();
    formData.append('audio', {
      uri: audioUri,
      name: `audio.${ext}`,
      type: mimeType,
    } as any);
    formData.append('today', today);
    if (categories) {
      formData.append('categories', JSON.stringify(categories));
    }

    const { data, error } = await supabase.functions.invoke('parse-voice-expense', {
      body: formData,
    });

    if (error) {
      // FunctionsHttpError carries the raw response — read its body for the real message
      const body = await (error as any)?.context?.json?.().catch(() => null);
      console.error('[parseVoiceExpense] Edge Function error:', {
        message: (error as any).message,
        status: (error as any)?.context?.status,
        body,
      });
      throw error;
    }

    console.log('[parseVoiceExpense] Raw response from edge function:', JSON.stringify(data));

    if (data.error) throw new Error(data.error);

    return data; // { transcript, expenses: [{amount, merchant, category}] }
  } catch (e) {
    console.error('[parseVoiceExpense] Caught error:', e);
    return null;
  }
};

/**
 * Categorize an expense given a hint text (spentOn) or merchant name.
 * The edge function receives it as `merchant` for backward compatibility.
 * Change 5 note: when spentOn is absent and merchant is present, pass merchant as hint.
 */
export const categorizeExpense = async (
  hint: string,          // spentOn (primary) — or merchant name as fallback
  description?: string,
  categories?: string[],
): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('categorize-expense', {
      body: { merchant: hint, description, categories },
    });
    if (error) throw error;
    return data.category ?? 'Other';
  } catch {
    return 'Other';  // always fall back silently
  }
};

/**
 * LLM fallback for SMS bodies that local regex patterns couldn't parse.
 * Calls the 'parse-sms' Supabase edge function (deploy separately).
 *
 * Returns null if:
 *  - The edge function is not deployed yet         ← degrades gracefully
 *  - The network is unavailable
 *  - Gemini determines the SMS is not a debit expense
 *
 * When the edge function IS deployed, it should return:
 *  { isExpense: boolean, amount: number, recipientName: string, date: string | null }
 */
export const parseSmsWithLLM = async (smsBody: string): Promise<{
  isExpense: boolean;
  amount: number;
  recipientName: string | null;
  date: string | null;
} | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('parse-sms', {
      body: { smsBody },
    });
    if (error) throw error;
    if (!data?.isExpense || !data?.amount) return null;
    return {
      isExpense: data.isExpense,
      amount: data.amount,
      recipientName: data.recipientName ?? null,
      date: data.date ?? null,
    };
  } catch {
    // Edge function not deployed or network error — silent no-op
    return null;
  }
};


export const pickAndScanBill = async (categories?: string[], onScanStart?: () => void): Promise<{
  merchant: string;
  total: number | null;
  date: string | null;
  category: string;
  items: ExpenseItem[];
  confidence: 'high' | 'medium' | 'low';
  ocrText: string;
  imageUri: string;   // local URI of the compressed image for preview
  base64: string;    // base64 for uploading to Supabase Storage
} | null> => {
  try {
    // Ask user: camera or gallery
    const choice = await new Promise<'camera' | 'gallery' | 'cancel'>((resolve) => {
      Alert.alert(
        'Scan Bill',
        'Choose an image source',
        [
          { text: 'Camera', onPress: () => resolve('camera') },
          { text: 'Gallery', onPress: () => resolve('gallery') },
          { text: 'Cancel', onPress: () => resolve('cancel'), style: 'cancel' }
        ],
        { cancelable: true, onDismiss: () => resolve('cancel') }
      );
    });

    if (choice === 'cancel') return null;

    if (choice === 'camera') {
      const granted = await requestCameraPermission();
      if (!granted) return null;
    } else {
      const granted = await requestMediaLibraryPermission();
      if (!granted) return null;
    }

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,    // start with full quality — we compress below
      allowsEditing: true, // Re-enabled to allow cropping useless background, but without a fixed aspect ratio
    };

    const result = choice === 'camera' 
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled) return null;

    console.log("Image selected successfully");
    onScanStart?.();

    // Compress to ~600KB — enough for Vision to read clearly
    const compressed = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1500 } }],
      {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!compressed.base64) throw new Error('Failed to compress image');

    const today = new Date().toISOString().split('T')[0];

    console.log("Image compressed successfully")
    const { data, error } = await supabase.functions.invoke('scan-bill', {
      body: {
        imageBase64: compressed.base64,
        today,
        categories,
      },
    });

    if (error) {
      const body = await (error as any)?.context?.json?.().catch(() => null);
      console.error('[pickAndScanBill] Edge Function error:', {
        message: (error as any).message,
        status: (error as any)?.context?.status,
        body,
      });
      throw error;
    }

    console.log('[pickAndScanBill] Raw response from edge function:', JSON.stringify(data));

    if (data.error) throw new Error(data.error);

    return {
      ...data,
      imageUri: compressed.uri,
      base64: compressed.base64,
    };

  } catch (e: any) {
    console.error('[pickAndScanBill] Caught error:', e.message ?? e);
    return null;
  }
};
