// lib/ai.ts
import { supabase } from './supabase';

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