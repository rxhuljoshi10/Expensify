// app/(tabs)/home.tsx
import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStats, Period } from '../../hooks/useDashboardStats';
import { useQueryClient } from '@tanstack/react-query';
import StatCard from '../../components/StatCard';
import SpendingPieChart from '../../components/SpendingPieChart';
import DailyBarChart from '../../components/DailyBarChart';
import DashboardInsights from '../../components/DashboardInsights';
import RecentExpenses from '../../components/RecentExpenses';
import { useBudget } from '../../hooks/useBudget';
import BudgetCard from '../../components/BudgetCard';
import DashboardSkeleton from '../../components/DashboardSkeleton';
import { useTheme, Theme } from '../../lib/theme';
import InsightCard from '../../components/InsightCard';

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('today');
  const [refreshing, setRefreshing] = useState(false);
  const { data: budget } = useBudget();
  const { isLoading } = useDashboardStats(period);

  const {
    todayTotal, weekTotal, monthTotal,
    byCategory, historicalWeeksData, recentExpenses,
    topCategory, averageDailySpend, largestExpense,
  } = useDashboardStats(period);

  const styles = createStyles(theme);

  if (isLoading) return <DashboardSkeleton />;

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['expenses'] });
    setRefreshing(false);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.email?.split('@')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greeting}>{greeting()}, {firstName} 👋</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>

        <InsightCard />

        <View style={styles.statsRow}>
          <StatCard label="Today" amount={todayTotal} highlight={period === 'today'} onPress={() => setPeriod('today')} />
          <StatCard label="This week" amount={weekTotal} highlight={period === 'week'} onPress={() => setPeriod('week')} />
          <StatCard label="This month" amount={monthTotal} highlight={period === 'month'} onPress={() => setPeriod('month')} />
        </View>

        <SpendingPieChart data={byCategory} />
        <DailyBarChart historicalWeeksData={historicalWeeksData} />
        <BudgetCard budget={budget ?? null} spentPaise={monthTotal} />
        <DashboardInsights topCategory={topCategory} averageDailySpend={averageDailySpend} largestExpense={largestExpense} />
        <RecentExpenses expenses={recentExpenses} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 32 },
    greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 8 },
    greeting: { fontSize: 22, fontWeight: '700', color: theme.text },
    date: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    statsRow: { flexDirection: 'row', marginBottom: 20, marginHorizontal: -4 },
  });
}