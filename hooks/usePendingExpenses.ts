// hooks/usePendingExpenses.ts
// React Query hooks for managing pending SMS expenses that need user confirmation.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { PendingSmsExpense } from '../types/expense';

const QUERY_KEY = ['pending-sms-expenses'];

// ── Fetch all pending SMS expenses ───────────────────────────────────

export const usePendingExpenses = () => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<PendingSmsExpense[]> => {
      const { data, error } = await supabase
        .from('pending_sms_expenses')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
};

// ── Resolve a pending expense ────────────────────────────────────────
// Converts a pending SMS expense into a real expense and creates a merchant mapping.

interface ResolveInput {
  pendingId: string;
  merchantName: string;
  category: string;
}

export const useResolvePendingExpense = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pendingId, merchantName, category }: ResolveInput) => {
      // 1. Fetch the pending expense
      const { data: pending, error: fetchError } = await supabase
        .from('pending_sms_expenses')
        .select('*')
        .eq('id', pendingId)
        .single();

      if (fetchError || !pending) throw fetchError ?? new Error('Pending expense not found');

      // 2. Create the real expense
      const { error: insertError } = await supabase
        .from('expenses')
        .insert({
          user_id: user!.id,
          amount: pending.amount,  // already in paise
          merchant: merchantName,
          category,
          expense_date: pending.parsed_date ?? new Date().toISOString().split('T')[0],
          source: 'sms',
        });

      if (insertError) throw insertError;

      // 3. Create/update merchant mapping for future auto-resolution
      if (pending.raw_vpa) {
        await supabase
          .from('merchant_mappings')
          .upsert(
            {
              user_id: user!.id,
              raw_vpa: pending.raw_vpa.toLowerCase(),
              friendly_name: merchantName,
              category,
              use_count: 1,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,raw_vpa' },
          );
      }

      // 4. Mark pending expense as processed
      await supabase
        .from('pending_sms_expenses')
        .update({ status: 'processed' })
        .eq('id', pendingId);

      // 5. Fire notification checks
      supabase.functions.invoke('send-notifications', {
        body: { type: 'budget', userId: user!.id },
      }).catch(console.error);

      return { merchantName, category };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
};

// ── Dismiss a pending expense ────────────────────────────────────────

export const useDismissPendingExpense = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pendingId: string) => {
      // 1. Fetch the pending expense
      const { data: pending, error: fetchError } = await supabase
        .from('pending_sms_expenses')
        .select('*')
        .eq('id', pendingId)
        .single();

      if (fetchError || !pending) throw fetchError ?? new Error('Pending expense not found');

      // 2. Save it as a regular expense using raw_vpa (or fallback) as merchant
      const merchant = pending.raw_vpa ?? 'Unknown SMS Expense';
      const { error: insertError } = await supabase
        .from('expenses')
        .insert({
          user_id: user!.id,
          amount: pending.amount,  // in paise
          merchant,
          category: 'Other',
          expense_date: pending.parsed_date ?? new Date().toISOString().split('T')[0],
          source: 'sms',
        });

      if (insertError) throw insertError;

      // 3. Mark pending expense as processed
      const { error: updateError } = await supabase
        .from('pending_sms_expenses')
        .update({ status: 'processed' })
        .eq('id', pendingId);

      if (updateError) throw updateError;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
};
