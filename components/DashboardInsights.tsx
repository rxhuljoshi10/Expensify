// components/DashboardInsights.tsx
import { View, Text, StyleSheet } from 'react-native';
import { formatAmount } from '../lib/currency';
import { Expense } from '../types/expense';
import { useTheme, Theme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    topCategory: { name: string; total: number; icon: string; color: string } | null;
    averageDailySpend: number;
    largestExpense: Expense | null;
}

export default function DashboardInsights({ topCategory, averageDailySpend, largestExpense }: Props) {
    const theme = useTheme();
    const styles = createStyles(theme);

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Key Insights</Text>
            <View style={styles.row}>
                <View style={[styles.insightCard, { marginRight: 8 }]}>
                    <View style={styles.iconBox}>
                        <Ionicons name="stats-chart" size={18} color={theme.primary} />
                    </View>
                    <Text style={styles.label}>Daily Average</Text>
                    <Text style={styles.value}>{formatAmount(averageDailySpend)}</Text>
                </View>
                <View style={[styles.insightCard, { marginLeft: 8 }]}>
                    <View style={[styles.iconBox, { backgroundColor: topCategory?.color ? `${topCategory.color}20` : theme.border }]}>
                        <Ionicons 
                            name={(topCategory?.icon as any) || 'help-circle'} 
                            size={18} 
                            color={topCategory?.color || theme.textSecondary} 
                        />
                    </View>
                    <Text style={styles.label}>Highest Drain</Text>
                    <Text style={styles.value}>{topCategory?.name || 'N/A'}</Text>
                </View>
            </View>
            {largestExpense && (
                <View style={styles.largeExpenseCard}>
                    <View>
                        <Text style={styles.label}>Largest Single Purchase</Text>
                        <Text style={styles.singleExpenseDesc}>{largestExpense.merchant}</Text>
                    </View>
                    <Text style={styles.singleExpenseAmount}>{formatAmount(largestExpense.amount)}</Text>
                </View>
            )}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: { marginBottom: 24 },
        heading: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 12, marginLeft: 4 },
        row: { flexDirection: 'row', marginBottom: 16 },
        insightCard: { flex: 1, backgroundColor: theme.cardBg, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
        iconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
        icon: { fontSize: 18 },
        label: { fontSize: 12, color: theme.textSecondary, fontWeight: '500', marginBottom: 4 },
        value: { fontSize: 16, fontWeight: '700', color: theme.text },
        largeExpenseCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.cardBg, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
        singleExpenseDesc: { fontSize: 15, fontWeight: '600', color: theme.text },
        singleExpenseAmount: { fontSize: 16, fontWeight: '700', color: '#FF3B30' },
    });
}
