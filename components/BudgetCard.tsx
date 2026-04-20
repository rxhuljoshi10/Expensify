// components/BudgetCard.tsx
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Budget } from '../types/expense';
import { formatAmount } from '../lib/currency';
import { useTheme, Theme } from '../lib/theme';

interface Props { 
    budget: Budget | null; 
    spentPaise: number; 
    monthByCategory?: { name: string; total: number; color: string; icon: string }[];
}

export default function BudgetCard({ budget, spentPaise, monthByCategory }: Props) {
    const theme = useTheme();
    const styles = createStyles(theme);
    const router = useRouter();
    const animWidth = useRef(new Animated.Value(0)).current;

    const pct = budget ? Math.min((spentPaise / budget.total_budget) * 100, 100) : 0;
    const remaining = budget ? budget.total_budget - spentPaise : 0;
    const isOver = spentPaise > (budget?.total_budget ?? Infinity);
    const isWarning = pct >= 80 && !isOver;
    const barColor = isOver ? '#ff4444' : isWarning ? '#FF9500' : '#34C759';

    useEffect(() => {
        Animated.timing(animWidth, { toValue: pct, duration: 600, useNativeDriver: false }).start();
    }, [pct]);

    if (!budget) {
        return (
            <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/budget-settings')}>
                <Text style={styles.emptyIcon}>🎯</Text>
                <Text style={styles.emptyTitle}>Set a monthly budget</Text>
                <Text style={styles.emptySubtext}>Tap to get started</Text>
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.heading}>Monthly budget</Text>
                <TouchableOpacity onPress={() => router.push('/budget-settings')}>
                    <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.amountRow}>
                <View>
                    <Text style={styles.amountLabel}>Spent</Text>
                    <Text style={[styles.amountValue, isOver && styles.amountOver]}>{formatAmount(spentPaise)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amountLabel}>Budget</Text>
                    <Text style={styles.amountValue}>{formatAmount(budget.total_budget)}</Text>
                </View>
            </View>
            <View style={styles.barTrack}>
                <Animated.View style={[styles.barFill, { backgroundColor: barColor, width: animWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
            </View>
            {isOver ? (
                <View style={styles.alertBanner}><Text style={styles.alertText}>⚠️ Over budget by {formatAmount(spentPaise - budget.total_budget)}</Text></View>
            ) : isWarning ? (
                <Text style={styles.warningText}>🟡 {Math.round(pct)}% used — {formatAmount(remaining)} remaining</Text>
            ) : (
                <Text style={styles.safeText}>{formatAmount(remaining)} remaining · {Math.round(pct)}% used</Text>
            )}

            {budget.category_budgets && Object.keys(budget.category_budgets).length > 0 && (
                <View style={styles.catConfigsContainer}>
                   <View style={styles.catConfigsDivider} />
                   <Text style={styles.catConfigsTitle}>Category limits</Text>
                   {Object.keys(budget.category_budgets).map(catName => {
                       const catBudget = budget.category_budgets![catName] as number;
                       const catSpent = monthByCategory?.find(c => c.name === catName)?.total || 0;
                       const catPct = Math.min((catSpent / catBudget) * 100, 100);
                       const catIsOver = catSpent > catBudget;
                       const catColor = catIsOver ? '#ff4444' : (catPct >= 80 ? '#FF9500' : theme.primary);

                       return (
                           <View key={catName} style={styles.catRow}>
                                <View style={styles.catHeader}>
                                    <Text style={styles.catName}>{catName}</Text>
                                    <Text style={[styles.catAmounts, catIsOver && { color: '#ff4444' }]}>
                                        {formatAmount(catSpent)} / {formatAmount(catBudget)}
                                    </Text>
                                </View>
                                <View style={styles.catTrack}>
                                    <View style={[styles.catFill, { backgroundColor: catColor, width: `${catPct}%` }]} />
                                </View>
                           </View>
                       )
                   })}
                </View>
            )}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        card: { backgroundColor: theme.cardBg, borderRadius: 16, padding: 16, marginBottom: 16 },
        emptyCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 24, marginBottom: 16, alignItems: 'center', borderWidth: 1.5, borderColor: theme.border, borderStyle: 'dashed' },
        emptyIcon: { fontSize: 32, marginBottom: 8 },
        emptyTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
        emptySubtext: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
        header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
        heading: { fontSize: 15, fontWeight: '600', color: theme.text },
        editLink: { fontSize: 13, color: theme.primary },
        amountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
        amountLabel: { fontSize: 12, color: theme.textSecondary, marginBottom: 2 },
        amountValue: { fontSize: 18, fontWeight: '700', color: theme.text },
        amountOver: { color: '#ff4444' },
        barTrack: { height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
        barFill: { height: '100%', borderRadius: 4 },
        alertBanner: { backgroundColor: '#fff0f0', borderRadius: 8, padding: 10, marginTop: 4 },
        alertText: { fontSize: 13, color: '#ff4444', fontWeight: '500' },
        warningText: { fontSize: 13, color: '#FF9500' },
        safeText: { fontSize: 13, color: theme.textSecondary },
        
        catConfigsContainer: { marginTop: 16 },
        catConfigsDivider: { height: 1, backgroundColor: theme.border, marginBottom: 16 },
        catConfigsTitle: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 },
        catRow: { marginBottom: 14 },
        catHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
        catName: { fontSize: 13, color: theme.text, fontWeight: '500' },
        catAmounts: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
        catTrack: { height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' },
        catFill: { height: '100%', borderRadius: 3 },
    });
}