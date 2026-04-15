// hooks/useRecurring.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { RecurringExpense, CreateRecurringInput } from '../types/expense';

const QUERY_KEY = ['recurring'];

export const useRecurring = () => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<RecurringExpense[]> => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('user_id', user!.id)
        .order('next_due_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
};

export const useAddRecurring = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRecurringInput) => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .insert({ ...input, user_id: user!.id, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

export const useToggleRecurring = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('recurring_expenses')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

export const useDeleteRecurring = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<RecurringExpense[]>(QUERY_KEY);
      queryClient.setQueryData<RecurringExpense[]>(QUERY_KEY,
        old => (old ?? []).filter(r => r.id !== id)
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(QUERY_KEY, ctx?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};