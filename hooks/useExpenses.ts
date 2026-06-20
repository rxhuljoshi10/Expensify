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
                .insert({ source: 'manual', ...input, user_id: user!.id })
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

export const useGroupExpenses = (isGroupView: boolean = true) => {
  const { user } = useAuthStore();
  const { data: group } = useFamilyGroup();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: GROUP_QUERY_KEY,
    queryFn: async (): Promise<(Expense & { member_name: string })[]> => {
      if (!group) return [];

      // ── Helper: returns the later of two ISO timestamp strings ────────
      // ISO timestamps are lexicographically comparable, so string >= works correctly.
      const laterTs = (a: string, b: string): string => (a >= b ? a : b);

      // ── Determine when the CURRENT VIEWER joined this group ───────────
      // We use full ISO timestamps (not just dates) so same-day precision is exact.
      // A member who joined at 17:36 cannot see expenses created at 10:00 on the same day.
      let viewerJoinTs: string;
      if (user?.id === group.owner_id) {
        viewerJoinTs = group.created_at;           // owner "joined" when group was created
      } else {
        const viewerMember = group.members?.find(m => m.user_id === user?.id);
        viewerJoinTs = viewerMember?.joined_at ?? new Date().toISOString(); // safe fallback = now
      }

      // ── Build per-member query specs ──────────────────────────────────
      // Self   → null cutoff (always see your full own expense history)
      // Others → cutoff = max(their_joined_at, viewer_joined_at)
      //   Blocks both directions:
      //   1. Others can't see a member's expenses created before that member joined
      //   2. You can't see other members' expenses created before YOU joined
      const memberSpecs = [
        {
          user_id: group.owner_id,
          cutoff: group.owner_id === user?.id
            ? null
            : laterTs(group.created_at, viewerJoinTs),
        },
        ...(group.members?.map(m => ({
          user_id: m.user_id,
          cutoff: m.user_id === user?.id
            ? null
            : laterTs(m.joined_at, viewerJoinTs),
        })) ?? []),
      ];

      // ── Fire one query per member in parallel, each filtered at DB level ──
      // Filter on created_at (full timestamp), NOT expense_date (date-only).
      // This prevents same-day leakage: expenses created before the join time are excluded.
      const results = await Promise.all(
        memberSpecs.map(({ user_id, cutoff }) => {
          const q = supabase
            .from('expenses')
            .select('*')
            .eq('user_id', user_id);

          // Apply timestamp filter only when there is a cutoff (null = self, no filter)
          return (cutoff ? q.gte('created_at', cutoff) : q)
            .order('expense_date', { ascending: false })
            .order('created_at', { ascending: false });
        })
      );

      // Surface the first error if any query failed
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;

      // Merge all results and re-sort (each sub-array is sorted, merged result is not)
      const allExpenses = results
        .flatMap(r => r.data ?? [])
        .sort((a, b) => {
          if (b.expense_date !== a.expense_date) {
            return b.expense_date.localeCompare(a.expense_date);
          }
          return b.created_at.localeCompare(a.created_at);
        });

      return allExpenses.map(e => {
        const isOwner = e.user_id === group.owner_id;
        const isSelf = e.user_id === user?.id;

        let mName = '';

        if (isSelf) {
            // Guarantee perfect sync: if the expense belongs to the local user, use their exact live auth metadata.
            mName = user?.user_metadata?.full_name ?? '';
        }

        if (!mName) {
            const member = group.members?.find(m => m.user_id === e.user_id);
            mName = member?.name ?? '';

            if (!mName || mName.trim() === '') {
                if (member?.email) {
                    mName = member.email.split('@')[0];
                } else if (isOwner) {
                    mName = group.name + ' Owner';
                } else {
                    mName = 'Group Member';
                }
            }
        }

        if (isSelf && !mName.includes('(You)')) {
            mName += ' (You)';
        }

        return {
          ...e,
          member_name: mName,
        };
      });
    },
    // isGroupView = false when dashboard is in personal mode → skip this query entirely
    enabled: !!user && !!group && isGroupView,
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