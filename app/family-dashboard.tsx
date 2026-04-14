// app/family-dashboard.tsx
import { View, Text, ScrollView, StyleSheet, RefreshControl, SafeAreaView } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useGroupStats } from '../hooks/useGroupStats';
import { formatAmount } from '../lib/currency';
import MemberSpendingBar from '../components/MemberSpendingBar';
import GroupExpenseRow from '../components/GroupExpenseRow';
import SpendingPieChart from '../components/SpendingPieChart';

export default function FamilyDashboardScreen() {
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    const {
        group, isLoading, totalMonth,
        byMember, byCategory, recentExpenses, memberCount,
    } = useGroupStats();

    const onRefresh = async () => {
        setRefreshing(true);
        await queryClient.invalidateQueries({ queryKey: ['group-expenses'] });
        setRefreshing(false);
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <Text style={styles.loadingText}>Loading family data...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.groupName}>{group?.name}</Text>
                    <Text style={styles.memberCount}>{memberCount} members</Text>
                </View>

                {/* Total card */}
                <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>Total spent this month</Text>
                    <Text style={styles.totalAmount}>{formatAmount(totalMonth)}</Text>
                    <View style={styles.realtimeBadge}>
                        <View style={styles.realtimeDot} />
                        <Text style={styles.realtimeText}>Live</Text>
                    </View>
                </View>

                {/* Member breakdown */}
                <MemberSpendingBar members={byMember} totalMonth={totalMonth} />

                {/* Category breakdown */}
                <SpendingPieChart data={byCategory} />

                {/* Recent group expenses */}
                <View style={styles.listCard}>
                    <Text style={styles.listHeading}>Recent expenses</Text>
                    {recentExpenses.length === 0 ? (
                        <Text style={styles.emptyText}>No group expenses yet</Text>
                    ) : (
                        recentExpenses.map(e => (
                            <GroupExpenseRow
                                key={e.id}
                                expense={e}
                                onPress={() => { }}
                            />
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f8f8ff' },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 32 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { color: '#aaa', fontSize: 15 },

    header: { marginBottom: 16, marginTop: 8 },
    groupName: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
    memberCount: { fontSize: 14, color: '#aaa', marginTop: 4 },

    totalCard: {
        backgroundColor: '#6C63FF', borderRadius: 20,
        padding: 24, marginBottom: 16, alignItems: 'center',
    },
    totalLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
    totalAmount: { fontSize: 36, fontWeight: '800', color: '#fff', marginBottom: 12 },
    realtimeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
    },
    realtimeDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: '#4ade80',
    },
    realtimeText: { fontSize: 12, color: '#fff', fontWeight: '500' },

    listCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
    listHeading: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', padding: 16, paddingBottom: 8 },
    emptyText: { color: '#aaa', fontSize: 14, padding: 16, textAlign: 'center' },
});