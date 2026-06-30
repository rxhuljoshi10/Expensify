// hooks/useUserCategories.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { UserCategory } from '../types/expense';
import { DEFAULT_CATEGORIES } from '../constants/categories';

const QUERY_KEY = ['user-categories'];

export const useUserCategories = () => {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    // ── Fetch Categories (with Auto-Seeding & Custom Sort) ─────────────
    const query = useQuery({
        queryKey: QUERY_KEY,
        queryFn: async (): Promise<UserCategory[]> => {
            if (!user) return [];

            // 1. Fetch user's categories
            const { data, error } = await supabase
                .from('user_categories')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;

            // 2. Seeding logic if empty
            if (!data || data.length === 0) {
                const toInsert = DEFAULT_CATEGORIES.map((cat, idx) => ({
                    user_id: user.id,
                    name: cat.name,
                    icon: cat.icon,
                    color: cat.color,
                }));

                const { error: seedError } = await supabase
                    .from('user_categories')
                    .insert(toInsert);

                if (seedError) throw seedError;

                // Re-fetch to get valid database IDs
                const { data: refetched, error: refetchError } = await supabase
                    .from('user_categories')
                    .select('*')
                    .eq('user_id', user.id);

                if (refetchError) throw refetchError;
                return sortCategories(refetched ?? []);
            }

            return sortCategories(data);
        },
        enabled: !!user,
    });

    // Helper: Sort categories by last_used_at DESC, then name ASC, putting "Other" last.
    const sortCategories = (list: UserCategory[]): UserCategory[] => {
        const sortedData = [...list];
        const otherIdx = sortedData.findIndex(c => c.name.toLowerCase() === 'other');
        let otherItem: UserCategory | null = null;
        if (otherIdx !== -1) {
            otherItem = sortedData.splice(otherIdx, 1)[0];
        }

        sortedData.sort((a, b) => {
            const timeA = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
            const timeB = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
            
            if (timeA !== timeB) {
                return timeB - timeA; // Descending (most recently used first)
            }
            
            // Default to alphabetical
            return a.name.localeCompare(b.name);
        });

        if (otherItem) {
            sortedData.push(otherItem);
        }
        return sortedData;
    };

    // ── Add Category ───────────────────────────────────────────────────
    const addMutation = useMutation({
        mutationFn: async ({ name, icon, color }: { name: string; icon: string; color: string }) => {
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('user_categories')
                .insert({
                    user_id: user.id,
                    name: name.trim(),
                    icon,
                    color,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
    });

    // ── Update Category ────────────────────────────────────────────────
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<UserCategory, 'id' | 'user_id' | 'created_at'>> }) => {
            const { data, error } = await supabase
                .from('user_categories')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
    });

    // ── Delete Category (with Remap) ──────────────────────────────────
    const deleteMutation = useMutation({
        mutationFn: async ({ id, name }: { id: string; name: string }) => {
            if (!user) throw new Error('Not authenticated');

            // 1. Remap active expenses to 'Other'
            const { error: expError } = await supabase
                .from('expenses')
                .update({ category: 'Other' })
                .eq('user_id', user.id)
                .eq('category', name);

            if (expError) throw expError;

            // 2. Remap recurring expenses to 'Other'
            const { error: recError } = await supabase
                .from('recurring_expenses')
                .update({ category: 'Other' })
                .eq('user_id', user.id)
                .eq('category', name);

            if (recError) throw recError;

            // 3. Delete from user_categories
            const { error: deleteError } = await supabase
                .from('user_categories')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            // Invalidate expenses and recurring queries to show remapped categories instantly
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['recurring'] });
        },
    });

    // ── Track Category Usage ───────────────────────────────────────────
    const trackCategoryUsageMutation = useMutation({
        mutationFn: async (name: string) => {
            if (!user || !name) return;
            const { error } = await supabase
                .from('user_categories')
                .update({ last_used_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .eq('name', name);
            if (error) console.error('Failed to update category last_used_at:', error);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
    });

    // ── Helper: Get Category Meta ──────────────────────────────────────
    const getCategoryMeta = (categoryName: string) => {
        const categoriesList = query.data ?? [];
        const found = categoriesList.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
        if (found) {
            return { name: found.name, icon: found.icon, color: found.color };
        }
        // Fallback to "Other" style
        const otherDefault = DEFAULT_CATEGORIES.find(c => c.name === 'Other') ?? {
            name: 'Other',
            icon: 'ellipsis-horizontal',
            color: '#D3D3D3',
        };
        return otherDefault;
    };

    // ── Helper: Get Expense Count For Category ────────────────────────
    const getExpenseCount = async (categoryName: string): Promise<number> => {
        if (!user) return 0;
        const { count, error } = await supabase
            .from('expenses')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('category', categoryName);

        if (error) {
            console.error('Error counting expenses for category:', error);
            return 0;
        }
        return count ?? 0;
    };

    return {
        categories: query.data ?? [],
        isLoading: query.isLoading,
        isSeeding: query.isFetching && !query.data,
        addCategory: addMutation.mutateAsync,
        isAdding: addMutation.isPending,
        updateCategory: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,
        deleteCategory: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,
        trackCategoryUsage: trackCategoryUsageMutation.mutateAsync,
        getCategoryMeta,
        getExpenseCount,
    };
};
