// components/BudgetCard.tsx — fix the first line
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Budget } from '../types/expense';
import { formatAmount } from '../lib/currency';

interface Props {
    budget: Budget | null;
    spentPaise: number;
}

export default function BudgetCard({ budget, spentPaise }: Props) {
    const router = useRouter();
    const animWidth = useRef(new Animated.Value(0)).current;

    const pct = budget ? Math.min((spentPaise / budget.total_budget) * 100, 100) : 0;
    const remaining = budget ? budget.total_budget - spentPaise : 0;
    const isOver = spentPaise > (budget?.total_budget ?? Infinity);
    const isWarning = pct >= 80 && !isOver;

    const barColor = isOver ? '#ff4444' : isWarning ? '#FF9500' : '#34C759';

    useEffect(() => {
        Animated.timing(animWidth, {
            toValue: pct,
            duration: 600,
            useNativeDriver: false,
        }).start();
    }, [pct]);

    // No budget set yet
    if (!budget) {
        return (
            <TouchableOpacity
                style={styles.emptyCard}
                onPress={() => router.push('/budget-settings')}
            >
                <Text style={styles.emptyIcon}>🎯</Text>
                <Text style={styles.emptyTitle}>Set a monthly budget</Text>
                <Text style={styles.emptySubtext}>Tap to get started</Text>
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.heading}>Monthly budget</Text>
                <TouchableOpacity onPress={() => router.push('/budget-settings')}>
                    <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
            </View>

            {/* Amounts */}
            <View style={styles.amountRow}>
                <View>
                    <Text style={styles.amountLabel}>Spent</Text>
                    <Text style={[styles.amountValue, isOver && styles.amountOver]}>
                        {formatAmount(spentPaise)}
                    </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amountLabel}>Budget</Text>
                    <Text style={styles.amountValue}>{formatAmount(budget.total_budget)}</Text>
                </View>
            </View>

            {/* Progress bar */}
            <View style={styles.barTrack}>
                <Animated.View
                    style={[
                        styles.barFill,
                        {
                            backgroundColor: barColor,
                            width: animWidth.interpolate({
                                inputRange: [0, 100],
                                outputRange: ['0%', '100%'],
                            }),
                        },
                    ]}
                />
            </View>

            {/* Status text */}
            {isOver ? (
                <View style={styles.alertBanner}>
                    <Text style={styles.alertText}>
                        ⚠️ Over budget by {formatAmount(spentPaise - budget.total_budget)}
                    </Text>
                </View>
            ) : isWarning ? (
                <Text style={styles.warningText}>
                    🟡 {Math.round(pct)}% used — {formatAmount(remaining)} remaining
                </Text>
            ) : (
                <Text style={styles.safeText}>
                    {formatAmount(remaining)} remaining · {Math.round(pct)}% used
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    emptyCard: {
        backgroundColor: '#f7f7ff',
        borderRadius: 16,
        padding: 24,
        marginBottom: 16,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#e0deff',
        borderStyle: 'dashed',
    },
    emptyIcon: { fontSize: 32, marginBottom: 8 },
    emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
    emptySubtext: { fontSize: 13, color: '#aaa', marginTop: 4 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    heading: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
    editLink: { fontSize: 13, color: '#6C63FF' },
    amountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    amountLabel: { fontSize: 12, color: '#aaa', marginBottom: 2 },
    amountValue: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
    amountOver: { color: '#ff4444' },
    barTrack: {
        height: 8, backgroundColor: '#f0f0f0',
        borderRadius: 4, overflow: 'hidden', marginBottom: 10,
    },
    barFill: { height: '100%', borderRadius: 4 },
    alertBanner: {
        backgroundColor: '#fff0f0', borderRadius: 8,
        padding: 10, marginTop: 4,
    },
    alertText: { fontSize: 13, color: '#ff4444', fontWeight: '500' },
    warningText: { fontSize: 13, color: '#FF9500' },
    safeText: { fontSize: 13, color: '#aaa' },
});