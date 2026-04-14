// components/GroupExpenseRow.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Expense } from '../types/expense';
import { getCategoryMeta } from '../constants/categories';
import { formatAmount } from '../lib/currency';
import { useAuthStore } from '../store/authStore';

interface Props {
    expense: Expense & { member_name: string };
    onPress: () => void;
}

export default function GroupExpenseRow({ expense, onPress }: Props) {
    const { user } = useAuthStore();
    const cat = getCategoryMeta(expense.category);
    const isOwn = expense.user_id === user?.id;

    return (
        <TouchableOpacity style={styles.row} onPress={onPress}>
            <View style={[styles.iconBox, { backgroundColor: cat.color + '22' }]}>
                <Text style={styles.icon}>{cat.icon}</Text>
            </View>
            <View style={styles.info}>
                <Text style={styles.merchant} numberOfLines={1}>{expense.merchant}</Text>
                <View style={styles.metaRow}>
                    <Text style={styles.category}>{expense.category}</Text>
                    <Text style={styles.dot}>·</Text>
                    <Text style={[styles.member, isOwn && styles.memberOwn]}>
                        {isOwn ? 'You' : expense.member_name}
                    </Text>
                </View>
            </View>
            <View style={styles.right}>
                <Text style={styles.amount}>{formatAmount(expense.amount)}</Text>
                <Text style={styles.date}>
                    {new Date(expense.expense_date).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short',
                    })}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 14, paddingHorizontal: 16,
        borderBottomWidth: 0.5, borderColor: '#f0f0f0',
    },
    iconBox: {
        width: 44, height: 44, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    icon: { fontSize: 20 },
    info: { flex: 1 },
    merchant: { fontSize: 15, fontWeight: '500', color: '#1a1a1a' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    category: { fontSize: 12, color: '#aaa' },
    dot: { fontSize: 12, color: '#ccc' },
    member: { fontSize: 12, color: '#888' },
    memberOwn: { color: '#6C63FF', fontWeight: '500' },
    right: { alignItems: 'flex-end' },
    amount: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
    date: { fontSize: 12, color: '#aaa', marginTop: 2 },
});