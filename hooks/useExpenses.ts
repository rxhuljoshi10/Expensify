// hooks/useExpenses.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Expense, CreateExpenseInput, CategorizationStatus } from '../types/expense';
import { useEffect, useCallback } from 'react';
import { useFamilyGroup } from './useFamilyGroup';
import {
    categorizeExpense,
    enqueuePendingCategorization,
    dequeuePendingCategorizations,
} from '../lib/ai';
import { useUserCategories } from './useUserCategories';

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

// ── Strip client-only fields before sending to DB ──────────────────────
function toDbPayload(input: CreateExpenseInput) {
    const { _userSetCategory, ...rest } = input as CreateExpenseInput & { _userSetCategory?: boolean };
    return rest;
}

// ── Add a new expense ────────────────────────────────────────────────
export const useAddExpense = () => {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const { categories } = useUserCategories();

    return useMutation({
        mutationFn: async (input: CreateExpenseInput) => {
            const payload = toDbPayload(input);
            const { data, error } = await supabase
                .from('expenses')
                .insert({ source: 'manual', ...payload, user_id: user!.id })
                .select()
                .single();
            if (error) throw error;

            // Fire notification checks in background — don't await
            const invoke = (type: string, extra: object = {}) =>
                supabase.functions.invoke('send-notifications', {
                    body: { type, userId: user!.id, ...extra },
                }).catch(console.error);

            invoke('budget');
            invoke('spending-spike', { category: input.category });
            invoke('family-expense', {
                amount: input.amount,
                category: input.category,
                merchant: input.merchant ?? '',
            });

            return data;
        },
        // Optimistic update — item appears instantly before server confirms
        onMutate: async (input) => {
            await queryClient.cancelQueries({ queryKey: QUERY_KEY });
            const previous = queryClient.getQueryData<Expense[]>(QUERY_KEY);

            // Determine initial categorization status for the optimistic entry
            const userSetCategory = !!(input as any)._userSetCategory;
            const needsAutoCategory = !input.category && !!input.spent_on?.trim() && !userSetCategory;
            const categorizationStatus: CategorizationStatus = userSetCategory
                ? 'user_set'
                : needsAutoCategory
                    ? 'pending'
                    : 'done';

            const optimistic: Expense = {
                id: `temp-${Date.now()}`,
                user_id: user!.id,
                created_at: new Date().toISOString(),
                source: 'manual',
                ...toDbPayload(input),
                _categorizationStatus: categorizationStatus,
            };

            queryClient.setQueryData<Expense[]>(QUERY_KEY, old =>
                [optimistic, ...(old ?? [])]
            );
            return { previous };
        },
        onError: (_err, _vars, ctx) => {
            queryClient.setQueryData(QUERY_KEY, ctx?.previous);
        },
        onSuccess: (savedExpense, input) => {
            // ── Background auto-categorization ──────────────────────────────────
            // Only when: user did NOT pick a category, spentOn is present
            const hint = input.spent_on?.trim();
            const userSetCategory = !!(input as any)._userSetCategory;
            const shouldAutoCategory = !userSetCategory && !input.category && !!hint;

            if (shouldAutoCategory && savedExpense?.id) {
                const expenseId = savedExpense.id;
                const categoryNames = categories.map(c => c.name);

                // Fire-and-forget — never blocks the UI
                (async () => {
                    try {
                        const suggested = await categorizeExpense(hint!, undefined, categoryNames);

                        // Race-condition guard: only write back if still 'pending' / not user_set
                        const current = queryClient.getQueryData<Expense[]>(QUERY_KEY);
                        const cached = current?.find(e => e.id === expenseId);
                        if (cached && cached._categorizationStatus !== 'user_set') {
                            await supabase
                                .from('expenses')
                                .update({ category: suggested })
                                .eq('id', expenseId)
                                .eq('user_id', user!.id);

                            queryClient.setQueryData<Expense[]>(QUERY_KEY, old =>
                                (old ?? []).map(e =>
                                    e.id === expenseId
                                        ? { ...e, category: suggested, _categorizationStatus: 'done' }
                                        : e
                                )
                            );
                        }
                    } catch {
                        // LLM failed or offline — mark failed in cache
                        queryClient.setQueryData<Expense[]>(QUERY_KEY, old =>
                            (old ?? []).map(e =>
                                e.id === expenseId
                                    ? { ...e, _categorizationStatus: 'failed' }
                                    : e
                            )
                        );
                        // Persist to retry queue — one attempt on next app open
                        enqueuePendingCategorization({
                            expenseId,
                            hint: hint!,
                            categories: categoryNames,
                        });
                    }
                })();
            }
        },
        onSettled: () => {
            // Always refetch to sync real IDs from server
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
    });
};

// ── Drain offline categorization retry queue on app open ──────────────
// Call once from the root layout. Reads queued items from AsyncStorage,
// fires one categorize attempt each, writes to DB + cache on success.
// Items that fail again are dropped (single retry per spec).
export const useDrainCategorizationQueue = () => {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const { categories } = useUserCategories();

    const drain = useCallback(async () => {
        if (!user) return;
        const items = await dequeuePendingCategorizations();
        if (items.length === 0) return;

        console.log(`[categorize] Draining ${items.length} queued items`);
        const categoryNames = categories.length > 0 ? categories.map(c => c.name) : (items[0]?.categories ?? []);

        for (const item of items) {
            try {
                const suggested = await categorizeExpense(item.hint, undefined, categoryNames);

                // Don't overwrite if user manually set a category in the meantime
                const current = queryClient.getQueryData<Expense[]>(QUERY_KEY);
                const cached = current?.find(e => e.id === item.expenseId);
                if (cached?._categorizationStatus === 'user_set') continue;

                await supabase
                    .from('expenses')
                    .update({ category: suggested })
                    .eq('id', item.expenseId)
                    .eq('user_id', user.id);

                queryClient.setQueryData<Expense[]>(QUERY_KEY, old =>
                    (old ?? []).map(e =>
                        e.id === item.expenseId
                            ? { ...e, category: suggested, _categorizationStatus: 'done' }
                            : e
                    )
                );
            } catch {
                // Single retry only — drop silently if it fails again
                console.warn(`[categorize] Retry failed for expense ${item.expenseId}`);
            }
        }

        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }, [user, categories, queryClient]);

    return { drain };
};

// ── Update an existing expense ───────────────────────────────────────
export const useUpdateExpense = () => {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...input }: Partial<Expense> & { id: string }) => {
            const { data, error } = await supabase
                .from('expenses')
                .update(input)
                .eq('id', id)
                .eq('user_id', user!.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEY });
        },
    });
};

// ── Delete an expense ────────────────────────────────────────────────
export const useDeleteExpense = () => {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', id)
                .eq('user_id', user!.id);
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
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEY });
        },
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

      // Fetch public profiles for all group participant user IDs to resolve real names
      const participantUserIds = Array.from(
        new Set([group.owner_id, ...(group.members?.map(m => m.user_id) ?? [])])
      );

      const { data: userProfiles } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', participantUserIds);

      const profileMap = new Map<string, { name: string; email: string }>();
      (userProfiles ?? []).forEach(p => {
        profileMap.set(p.id, { name: p.name ?? '', email: p.email ?? '' });
      });

      return allExpenses.map(e => {
        const isSelf = e.user_id === user?.id;

        let mName = '';

        if (isSelf) {
            // Guarantee perfect sync: if the expense belongs to local user, use live auth metadata if present
            mName = user?.user_metadata?.full_name ?? profileMap.get(e.user_id)?.name ?? '';
        }

        if (!mName) {
            const profile = profileMap.get(e.user_id);
            if (profile?.name && profile.name.trim()) {
                mName = profile.name.trim();
            } else if (profile?.email && profile.email.trim()) {
                mName = profile.email.split('@')[0];
            } else {
                const member = group.members?.find(m => m.user_id === e.user_id);
                if (member?.name && member.name.trim()) {
                    mName = member.name.trim();
                } else if (member?.email) {
                    mName = member.email.split('@')[0];
                }
            }
        }

        if (!mName) {
            mName = 'Member';
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