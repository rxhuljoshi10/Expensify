// hooks/useGroupStats.ts
import { useMemo } from 'react';
import { useGroupExpenses } from './useExpenses';
import { useFamilyGroup } from './useFamilyGroup';
import { CATEGORIES } from '../constants/categories';

export const useGroupStats = () => {
  const { data: expenses = [], isLoading } = useGroupExpenses();
  const { data: group } = useFamilyGroup();

  return useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonth = expenses.filter(
      e => new Date(e.expense_date) >= monthStart
    );

    const totalMonth = thisMonth.reduce((s, e) => s + e.amount, 0);

    // Per-member breakdown
    const byMember: Record<string, { name: string; total: number; count: number }> = {};
    thisMonth.forEach(e => {
      if (!byMember[e.user_id]) {
        byMember[e.user_id] = { name: e.member_name, total: 0, count: 0 };
      }
      byMember[e.user_id].total += e.amount;
      byMember[e.user_id].count += 1;
    });

    // Per-category breakdown
    const byCategory = CATEGORIES.map(cat => ({
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      total: thisMonth
        .filter(e => e.category === cat.name)
        .reduce((s, e) => s + e.amount, 0),
    })).filter(c => c.total > 0);

    // Recent 10 group expenses
    const recentExpenses = expenses.slice(0, 10);

    return {
      isLoading,
      group,
      totalMonth,
      byMember: Object.entries(byMember).map(([id, v]) => ({ id, ...v })),
      byCategory,
      recentExpenses,
      memberCount: (group?.members?.length ?? 0) + 1,
    };
  }, [expenses, group, isLoading]);
};