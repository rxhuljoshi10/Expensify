import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { getLocalISODate } from '../../lib/date';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStats, Period } from '../../hooks/useDashboardStats';
import { useQueryClient } from '@tanstack/react-query';
import StatCard from '../../components/StatCard';
import SpendingPieChart from '../../components/SpendingPieChart';
import DailyBarChart from '../../components/DailyBarChart';
import DashboardInsights from '../../components/DashboardInsights';
import RecentExpenses from '../../components/RecentExpenses';
import { useBudget } from '../../hooks/useBudget';
import { useUserCategories } from '../../hooks/useUserCategories';
import BudgetCard from '../../components/BudgetCard';
import DashboardSkeleton from '../../components/DashboardSkeleton';
import { useTheme, Theme } from '../../lib/theme';
import InsightCard from '../../components/InsightCard';
import { useFamilyGroup } from '../../hooks/useFamilyGroup';
import { useDashboardStore } from '../../store/dashboardStore';
import MemberSpendingBar from '../../components/MemberSpendingBar';
import { useRecurring } from '../../hooks/useRecurring';
import { useNotifications } from '../../hooks/useNotifications';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('today');
  const [refreshing, setRefreshing] = useState(false);
  const { data: budget } = useBudget();
  const { data: group } = useFamilyGroup();
  const { viewMode, setViewMode } = useDashboardStore();
  const { data: recurring = [] } = useRecurring();
  const { unreadCount } = useNotifications();

  useEffect(() => {
    if (!group && viewMode === 'group') {
      setViewMode('personal');
    }
  }, [group, viewMode, setViewMode]);

  const dueTodayCount = recurring.filter(r => {
    return r.is_active && r.next_due_date === getLocalISODate();
  }).length;

  const { categories, isLoading: isCategoriesLoading } = useUserCategories();

  const {
    isLoading: isStatsLoading, todayTotal, weekTotal, monthTotal, periodTotal,
    byCategory, monthByCategory, historicalWeeksData, recentExpenses,
    topCategory, averageDailySpend, largestExpense,
    memberBreakdown
  } = useDashboardStats(period, undefined, undefined, categories);

  const isLoading = isStatsLoading || isCategoriesLoading;

  const styles = createStyles(theme);

  if (isLoading) return <DashboardSkeleton />;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['group-expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ]);
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

          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={theme.text} />
            {unreadCount > 0 && (
              <View style={[styles.bellBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <InsightCard />

        {group && (
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={viewMode === 'personal' ? styles.activeTab : styles.inactiveTab}
              onPress={() => setViewMode('personal')}
            >
              <Text style={viewMode === 'personal' ? styles.activeTabText : styles.inactiveTabText}>
                Personal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={viewMode === 'group' ? styles.activeTab : styles.inactiveTab}
              onPress={() => setViewMode('group')}
            >
              <Text style={viewMode === 'group' ? styles.activeTabText : styles.inactiveTabText}>
                👨‍👩‍👧 {group.name}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.statsRow}>
          <StatCard label="Today" amount={todayTotal} highlight={period === 'today'} onPress={() => setPeriod('today')} />
          <StatCard label="This week" amount={weekTotal} highlight={period === 'week'} onPress={() => setPeriod('week')} />
          <StatCard label="This month" amount={monthTotal} highlight={period === 'month'} onPress={() => setPeriod('month')} />
        </View>

        {viewMode === 'group' && (
          <MemberSpendingBar members={memberBreakdown} periodTotal={periodTotal} />
        )}

        <SpendingPieChart data={byCategory} />
        <DailyBarChart historicalWeeksData={historicalWeeksData} />
        <BudgetCard budget={budget ?? null} spentPaise={monthTotal} monthByCategory={monthByCategory} />
        {dueTodayCount > 0 && (
          <TouchableOpacity
            style={styles.recurringNudge}
            onPress={() => router.push('/recurring')}
          >
            <Text style={styles.recurringNudgeText}>
              🔄 {dueTodayCount} recurring expense{dueTodayCount > 1 ? 's' : ''} due today
            </Text>
            <Text style={styles.recurringNudgeArrow}>›</Text>
          </TouchableOpacity>
        )}
        <DashboardInsights topCategory={topCategory} averageDailySpend={averageDailySpend} largestExpense={largestExpense} />
        {/* <RecentExpenses expenses={recentExpenses} /> */}
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
    bellButton: {
      position: 'relative',
      padding: 8,
      borderRadius: 12,
      backgroundColor: theme.separator,
    },
    bellBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    bellBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
    },
    statsRow: { flexDirection: 'row', marginBottom: 20, marginHorizontal: -4 },
    viewToggle: {
      flexDirection: 'row', backgroundColor: theme.separator,
      borderRadius: 12, padding: 3, marginBottom: 16,
    },
    activeTab: {
      flex: 1, backgroundColor: theme.cardBg, borderRadius: 10,
      paddingVertical: 8, alignItems: 'center',
    },
    activeTabText: { fontSize: 13, fontWeight: '700', color: theme.primary },
    inactiveTab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
    inactiveTabText: { fontSize: 13, color: theme.textSecondary },
    recurringNudge: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: '#fff8e1', borderRadius: 12,
      padding: 14, marginBottom: 16,
      borderLeftWidth: 3, borderLeftColor: '#FF9500',
    },
    recurringNudgeText: { flex: 1, fontSize: 14, color: '#FF9500', fontWeight: '500' },
    recurringNudgeArrow: { fontSize: 18, color: '#FF9500' },
  });
}