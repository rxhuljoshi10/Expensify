// lib/ai.ts
import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export const parseVoiceExpense = async (audioUri: string): Promise<{
  amount: number;
  merchant: string;
  category: string;
  transcript: string;
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

    const { data, error } = await supabase.functions.invoke('parse-voice-expense', {
      body: formData,
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data;
  } catch (e) {
    console.log('Voice parse error:', e);
    return null;
  }
};

export const categorizeExpense = async (
  merchant: string,
  description?: string,
): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('categorize-expense', {
      body: { merchant, description },
    });
    if (error) throw error;
    return data.category ?? 'Other';
  } catch {
    return 'Other';  // always fall back silently
  }
};


export const pickAndScanBill = async (): Promise<{
  merchant: string;
  total: number | null;
  date: string | null;
  category: string;
  items: string[];
  confidence: 'high' | 'medium' | 'low';
  ocrText: string;
} | null> => {
  try {
    // Ask user: camera or gallery
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,    // start with full quality — we compress below
      allowsEditing: true,
      aspect: [3, 4],  // portrait crop — most receipts are tall
    });

    if (result.canceled) return null;

    // Compress to ~600KB — enough for Vision to read clearly
    // Google Vision works better with slightly higher quality than Claude Vision
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

    const { data, error } = await supabase.functions.invoke('scan-bill', {
      body: {
        imageBase64: compressed.base64,
        today,
      },
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data;

  } catch (e: any) {
    console.log('Bill scan error:', e.message);
    return null;
  }
};
