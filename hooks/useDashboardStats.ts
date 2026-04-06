// hooks/useDashboardStats.ts
import { useMemo } from 'react';
import { useExpenses } from './useExpenses';
import { Expense } from '../types/expense';
import { CATEGORIES } from '../constants/categories';

export type Period = 'today' | 'week' | 'month' | 'custom';

const startOf = (period: Period, customFrom?: Date): Date => {
    const now = new Date();
    if (period === 'today') {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (period === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    if (period === 'month') {
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (period === 'custom' && customFrom) return customFrom;
    return new Date(now.getFullYear(), now.getMonth(), 1);
};

const filterByPeriod = (
    expenses: Expense[],
    period: Period,
    customFrom?: Date,
    customTo?: Date,
): Expense[] => {
    const from = startOf(period, customFrom);
    const to = customTo ?? new Date();
    return expenses.filter(e => {
        const d = new Date(e.expense_date);
        return d >= from && d <= to;
    });
};

export const useDashboardStats = (
    period: Period,
    customFrom?: Date,
    customTo?: Date,
) => {
    const { data: expenses = [], isLoading } = useExpenses();

    return useMemo(() => {
        // Always compute today/week/month regardless of selected period
        const todayTotal = filterByPeriod(expenses, 'today')
            .reduce((s, e) => s + e.amount, 0);
        const weekTotal = filterByPeriod(expenses, 'week')
            .reduce((s, e) => s + e.amount, 0);
        const monthTotal = filterByPeriod(expenses, 'month')
            .reduce((s, e) => s + e.amount, 0);

        // Filter for the selected period (used in charts)
        const periodExpenses = filterByPeriod(expenses, period, customFrom, customTo);
        const periodTotal = periodExpenses.reduce((s, e) => s + e.amount, 0);

        // Category breakdown for pie chart
        const byCategory = CATEGORIES.map(cat => {
            const total = periodExpenses
                .filter(e => e.category === cat.name)
                .reduce((s, e) => s + e.amount, 0);
            return { name: cat.name, total, color: cat.color, icon: cat.icon };
        }).filter(c => c.total > 0);

        // Daily totals for bar chart (last 7 days)
        const dailyMap: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            dailyMap[key] = 0;
        }
        expenses.forEach(e => {
            if (dailyMap[e.expense_date] !== undefined) {
                dailyMap[e.expense_date] += e.amount;
            }
        });
        const dailyData = Object.entries(dailyMap).map(([date, total]) => ({
            date,
            total,
            label: new Date(date).toLocaleDateString('en-IN', { weekday: 'short' }),
        }));

        // Recent 5 expenses
        const recentExpenses = [...expenses].slice(0, 5);

        return {
            isLoading,
            todayTotal,
            weekTotal,
            monthTotal,
            periodTotal,
            periodExpenses,
            byCategory,
            dailyData,
            recentExpenses,
        };
    }, [expenses, period, customFrom, customTo, isLoading]);
};