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

        // Historical Weeks Data (4 weeks: w=3 is oldest, w=0 is current)
        const historicalWeeksData: any[] = [];
        const now = new Date();
        
        for (let w = 3; w >= 0; w--) {
            const dateInWeek = new Date(now);
            dateInWeek.setDate(now.getDate() - w * 7);
            
            // strictly find Sunday
            const sunday = new Date(dateInWeek);
            sunday.setDate(dateInWeek.getDate() - dateInWeek.getDay());
            sunday.setHours(0,0,0,0);
            
            const days = [];
            let weeklyTotalAmount = 0;
            
            for (let d = 0; d < 7; d++) {
                const currentDay = new Date(sunday);
                currentDay.setDate(sunday.getDate() + d);
                // Adjust to local ISO equivalent without timezone shifting issues:
                const tzOffset = currentDay.getTimezoneOffset() * 60000;
                const localISOTime = (new Date(currentDay.getTime() - tzOffset)).toISOString().slice(0, 10);
                const dateStr = localISOTime;
                
                // Keep blank if future date
                // To compare accurately ignoring time, strip time from 'now'
                const todayMidnight = new Date(now);
                todayMidnight.setHours(0,0,0,0);
                const isFuture = currentDay > todayMidnight;
                
                const dayExpenses = expenses.filter(e => e.expense_date === dateStr);
                const total = dayExpenses.reduce((s, e) => s + e.amount, 0);
                weeklyTotalAmount += total;
                
                days.push({
                    date: dateStr,
                    total: isFuture ? -1 : total, // -1 signals future/blank
                    label: currentDay.toLocaleDateString('en-IN', { weekday: 'short' })
                });
            }
            
            const saturday = new Date(sunday);
            saturday.setDate(sunday.getDate() + 6);
            
            const formatDate = (date: Date) => date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
            let weekLabel = `${formatDate(sunday)} - ${formatDate(saturday)}`;
            if (w === 0) weekLabel = "This Week";
            if (w === 1) weekLabel = "Last Week";
            
            historicalWeeksData.push({
                id: `week-${w}`,
                weekLabel,
                days,
                total: weeklyTotalAmount,
                average: weeklyTotalAmount / 7, // average over 7 days theoretically
            });
        }
        
        // --- NEW ANALYTICS ---
        const sortedCategories = [...byCategory].sort((a, b) => b.total - a.total);
        const topCategory = sortedCategories.length > 0 ? sortedCategories[0] : null;

        let daysInPeriod = 1;
        if (period === 'week') daysInPeriod = 7;
        else if (period === 'month') {
            const now = new Date();
            daysInPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        } else if (period === 'custom' && customFrom && customTo) {
            daysInPeriod = Math.max(1, Math.ceil((customTo.getTime() - customFrom.getTime()) / (1000 * 60 * 60 * 24)));
        }
        const averageDailySpend = periodTotal / daysInPeriod;

        const sortedExpenses = [...periodExpenses].sort((a, b) => b.amount - a.amount);
        const largestExpense = sortedExpenses.length > 0 ? sortedExpenses[0] : null;

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
            historicalWeeksData,
            recentExpenses,
            topCategory,
            averageDailySpend,
            largestExpense,
        };
    }, [expenses, period, customFrom, customTo, isLoading]);
};