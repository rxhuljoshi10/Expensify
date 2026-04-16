// hooks/useExpenses.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Expense, CreateExpenseInput } from '../types/expense';
import { useEffect } from 'react';
import { useFamilyGroup } from './useFamilyGroup';

const QUERY_KEY = ['expenses'];
const GROUP_QUERY_KEY = ['group-expenses'];

// ── Fetch all expenses for the current user ──────────────────────────
export const useExpenses = () => {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: QUERY_KEY,
        queryFn: async (): Promise<Expense[]> => {
            const { data, error } = await supabase
                .from('expenses')
                .select('*')
                .eq('user_id', user!.id)
                .order('expense_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data ?? [];
        },
        enabled: !!user,
    });
};

// ── Add a new expense ────────────────────────────────────────────────
export const useAddExpense = () => {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: CreateExpenseInput) => {
            const { data, error } = await supabase
                .from('expenses')
                .insert({ ...input, user_id: user!.id, source: 'manual' })
                .select()
                .single();
            if (error) throw error;

            // Fire budget check in background — don't await
            supabase.functions.invoke('send-notifications', {
                body: { type: 'budget', userId: user!.id },
            }).catch(console.error);

            return data;
        },
        // Optimistic update — item appears instantly before server confirms
        onMutate: async (input) => {
            await queryClient.cancelQueries({ queryKey: QUERY_KEY });
            const previous = queryClient.getQueryData<Expense[]>(QUERY_KEY);

            const optimistic: Expense = {
                id: `temp-${Date.now()}`,
                user_id: user!.id,
                created_at: new Date().toISOString(),
                source: 'manual',
                ...input,
            };

            queryClient.setQueryData<Expense[]>(QUERY_KEY, old =>
                [optimistic, ...(old ?? [])]
            );
            return { previous };
        },
        onError: (_err, _vars, ctx) => {
            // Roll back on failure
            queryClient.setQueryData(QUERY_KEY, ctx?.previous);
        },
        onSettled: () => {
            // Always refetch to sync real IDs from server
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
    });
};

// ── Update an existing expense ───────────────────────────────────────
export const useUpdateExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...input }: Partial<Expense> & { id: string }) => {
            const { data, error } = await supabase
                .from('expenses')
                .update(input)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    });
};

// ── Delete an expense ────────────────────────────────────────────────
export const useDeleteExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: QUERY_KEY });
            const previous = queryClient.getQueryData<Expense[]>(QUERY_KEY);
            queryClient.setQueryData<Expense[]>(QUERY_KEY, old =>
                (old ?? []).filter(e => e.id !== id)
            );
            return { previous };
        },
        onError: (_err, _vars, ctx) => {
            queryClient.setQueryData(QUERY_KEY, ctx?.previous);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    });
};

export const useGroupExpenses = () => {
  const { user } = useAuthStore();
  const { data: group } = useFamilyGroup();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: GROUP_QUERY_KEY,
    queryFn: async (): Promise<(Expense & { member_name: string })[]> => {
      if (!group) return [];

      // Get all member IDs including owner
      const memberIds = [
        group.owner_id,
        ...(group.members?.map(m => m.user_id) ?? []),
      ];

      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .in('user_id', memberIds)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map(e => {
        const member = group.members?.find(m => m.user_id === e.user_id);
        const isOwner = e.user_id === group.owner_id;
        
        let mName = member?.name;
        
        // robust fallback if name is an empty string
        if (!mName || mName.trim() === '') {
            if (member?.email) {
                mName = member.email.split('@')[0];
            } else if (isOwner) {
                mName = group.name + ' Owner';
            } else {
                mName = 'Group Member';
            }
        }

        if (e.user_id === user?.id) {
            mName += ' (You)';
        }

        return {
          ...e,
          member_name: mName,
        };
      });
    },
    enabled: !!user && !!group,
  });

  // ── Realtime subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!group) return;

    const memberIds = [
      group.owner_id,
      ...(group.members?.map(m => m.user_id) ?? []),
    ];

    const channel = supabase
      .channel(`group-expenses-${group.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',           // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'expenses',
          filter: `user_id=in.(${memberIds.join(',')})`,
        },
        (payload) => {
          console.log('Realtime event:', payload.eventType);
          // Invalidate and refetch group expenses on any change
          queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [group?.id]);

  return query;
};