// components/PeriodFilter.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Period } from '../hooks/useDashboardStats';

const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
];

interface Props {
    active: Period;
    onChange: (p: Period) => void;
}

export default function PeriodFilter({ active, onChange }: Props) {
    return (
        <View style={styles.row}>
            {PERIODS.map(p => (
                <TouchableOpacity
                    key={p.key}
                    style={[styles.tab, active === p.key && styles.tabActive]}
                    onPress={() => onChange(p.key)}
                >
                    <Text style={[styles.tabText, active === p.key && styles.tabTextActive]}>
                        {p.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderRadius: 12,
        padding: 3,
        marginBottom: 16,
    },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
    tabActive: { backgroundColor: '#fff' },
    tabText: { fontSize: 13, color: '#888', fontWeight: '500' },
    tabTextActive: { color: '#6C63FF', fontWeight: '700' },
});