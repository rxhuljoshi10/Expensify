// hooks/useMerchantMappings.ts
// React Query hooks for managing VPA → merchant name mappings.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { MerchantMapping } from '../types/expense';

const QUERY_KEY = ['merchant-mappings'];

// ── Fetch all merchant mappings ──────────────────────────────────────

export const useMerchantMappings = () => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<MerchantMapping[]> => {
      const { data, error } = await supabase
        .from('merchant_mappings')
        .select('*')
        .eq('user_id', user!.id)
        .order('use_count', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
};

// ── Add/update a merchant mapping ────────────────────────────────────

interface AddMappingInput {
  rawVpa: string;
  friendlyName: string;
  category?: string;
}

export const useAddMerchantMapping = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rawVpa, friendlyName, category }: AddMappingInput) => {
      const { data, error } = await supabase
        .from('merchant_mappings')
        .upsert(
          {
            user_id: user!.id,
            raw_vpa: rawVpa.toLowerCase(),
            friendly_name: friendlyName,
            category: category ?? null,
            use_count: 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,raw_vpa' },
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

// ── Delete a merchant mapping ────────────────────────────────────────

export const useDeleteMerchantMapping = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('merchant_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};
