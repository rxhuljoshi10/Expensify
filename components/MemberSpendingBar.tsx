// components/MemberSpendingBar.tsx
import { View, Text, StyleSheet } from 'react-native';
import { formatAmount } from '../lib/currency';
import { useTheme, Theme } from '../lib/theme';

interface Props {
    members: { id: string; name: string; total: number; count: number }[];
    periodTotal: number;
}

const MEMBER_COLORS = ['#6C63FF', '#FF6B6B', '#4ECDC4', '#FFEAA7', '#96CEB4', '#DDA0DD'];

export default function MemberSpendingBar({ members, periodTotal }: Props) {
    const theme = useTheme();
    const styles = createStyles(theme);

    if (members.length === 0) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>No group expenses in this period</Text>
            </View>
        );
    }

    const sortedMembers = [...members].sort((a, b) => b.total - a.total);

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Who spent what</Text>

            {/* Stacked bar */}
            <View style={styles.stackedBar}>
                {sortedMembers.map((m, i) => {
                    const pct = periodTotal > 0 ? (m.total / periodTotal) * 100 : 0;
                    return (
                        <View
                            key={m.id}
                            style={[
                                styles.barSegment,
                                {
                                    flex: pct,
                                    backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length],
                                    borderRadius: i === 0 ? 6 : i === sortedMembers.length - 1 ? 6 : 0,
                                },
                            ]}
                        />
                    );
                })}
            </View>

            {/* Legend */}
            {sortedMembers
                .map((m, i) => {
                    const pct = periodTotal > 0 ? Math.round((m.total / periodTotal) * 100) : 0;
                    return (
                        <View key={m.id} style={styles.legendRow}>
                            <View style={[styles.dot, { backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }]} />
                            <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                            <Text style={styles.memberCount}>{m.count} expenses</Text>
                            <Text style={styles.memberAmount}>{formatAmount(m.total)}</Text>
                            <Text style={styles.memberPct}>{pct}%</Text>
                        </View>
                    );
                })}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: { backgroundColor: theme.cardBg, borderRadius: 16, padding: 16, marginBottom: 16 },
        heading: { fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 12 },
        stackedBar: {
            flexDirection: 'row', height: 12,
            borderRadius: 6, overflow: 'hidden',
            backgroundColor: theme.separator, marginBottom: 16,
        },
        barSegment: { height: '100%' },
        legendRow: {
            flexDirection: 'row', alignItems: 'center',
            paddingVertical: 8, gap: 8,
            borderBottomWidth: 0.5, borderColor: theme.separator,
        },
        dot: { width: 10, height: 10, borderRadius: 5 },
        memberName: { flex: 1, fontSize: 14, color: theme.text, fontWeight: '500' },
        memberCount: { fontSize: 12, color: theme.textSecondary },
        memberAmount: { fontSize: 14, fontWeight: '600', color: theme.text },
        memberPct: { fontSize: 12, color: theme.textSecondary, width: 32, textAlign: 'right' },
        empty: { padding: 24, alignItems: 'center' },
        emptyText: { color: theme.textSecondary, fontSize: 14 },
    });
}