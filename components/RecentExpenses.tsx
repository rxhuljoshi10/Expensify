// components/RecentExpenses.tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Expense } from '../types/expense';
import { getCategoryMeta } from '../constants/categories';
import { formatAmount } from '../lib/currency';

interface Props {
    expenses: Expense[];
}

export default function RecentExpenses({ expenses }: Props) {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.heading}>Recent</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/expenses')}>
                    <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
            </View>
            {expenses.length === 0 ? (
                <Text style={styles.empty}>No expenses yet</Text>
            ) : (
                expenses.map(e => {
                    const cat = getCategoryMeta(e.category);
                    return (
                        <TouchableOpacity
                            key={e.id}
                            style={styles.row}
                            onPress={() => router.push(`/edit-expense?id=${e.id}`)}
                        >
                            <View style={[styles.iconBox, { backgroundColor: cat.color + '22' }]}>
                                <Text style={styles.icon}>{cat.icon}</Text>
                            </View>
                            <View style={styles.info}>
                                <Text style={styles.merchant} numberOfLines={1}>{e.merchant}</Text>
                                <Text style={styles.category}>{e.category}</Text>
                            </View>
                            <Text style={styles.amount}>{formatAmount(e.amount)}</Text>
                        </TouchableOpacity>
                    );
                })
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    heading: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
    seeAll: { fontSize: 13, color: '#6C63FF' },
    empty: { color: '#aaa', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
    iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 18 },
    info: { flex: 1 },
    merchant: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
    category: { fontSize: 12, color: '#aaa', marginTop: 2 },
    amount: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
});