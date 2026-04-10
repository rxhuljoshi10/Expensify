// lib/ai.ts
import { supabase } from './supabase';

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