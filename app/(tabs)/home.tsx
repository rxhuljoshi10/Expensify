// app/(tabs)/home.tsx
import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStats, Period } from '../../hooks/useDashboardStats';
import { useQueryClient } from '@tanstack/react-query';
import StatCard from '../../components/StatCard';
import SpendingPieChart from '../../components/SpendingPieChart';
import DailyBarChart from '../../components/DailyBarChart';
import RecentExpenses from '../../components/RecentExpenses';
import PeriodFilter from '../../components/PeriodFilter';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('month');
  const [refreshing, setRefreshing] = useState(false);

  const {
    todayTotal,
    weekTotal,
    monthTotal,
    byCategory,
    dailyData,
    recentExpenses,
  } = useDashboardStats(period);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['expenses'] });
    setRefreshing(false);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'there';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
        }
      >
        {/* Greeting */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greeting}>{greeting()}, {firstName} 👋</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long'
              })}
            </Text>
          </View>
        </View>

        {/* Stat cards */}
        <View style={styles.statsRow}>
          <StatCard label="Today" amount={todayTotal} />
          <StatCard label="This week" amount={weekTotal} />
          <StatCard label="This month" amount={monthTotal} highlight />
        </View>

        {/* Period filter */}
        <PeriodFilter active={period} onChange={setPeriod} />

        {/* Charts */}
        <SpendingPieChart data={byCategory} />
        <DailyBarChart data={dailyData} />

        {/* Recent expenses */}
        <RecentExpenses expenses={recentExpenses} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8ff' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  greeting: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  date: { fontSize: 13, color: '#aaa', marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 20,
    marginHorizontal: -4,
  },
});