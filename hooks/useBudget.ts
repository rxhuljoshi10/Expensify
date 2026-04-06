// hooks/useBudget.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Budget } from '../types/expense';

const currentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const QUERY_KEY = ['budget', currentMonth()];

export const useBudget = () => {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: QUERY_KEY,
        queryFn: async (): Promise<Budget | null> => {
            const { data, error } = await supabase
                .from('budgets')
                .select('*')
                .eq('user_id', user!.id)
                .eq('month', currentMonth())
                .maybeSingle();    // returns null instead of error if no row

            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });
};

export const useSetBudget = () => {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            totalBudget,
            categoryBudgets,
        }: {
            totalBudget: number;
            categoryBudgets?: Record<string, number>;
        }) => {
            const { data, error } = await supabase
                .from('budgets')
                .upsert({
                    user_id: user!.id,
                    month: currentMonth(),
                    total_budget: totalBudget,
                    category_budgets: categoryBudgets ?? {},
                    alert_at_pct: 80,
                    alerted_80: false,
                    alerted_100: false,
                }, { onConflict: 'user_id,month' })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    });
};