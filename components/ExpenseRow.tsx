// components/ExpenseRow.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Expense } from '../types/expense';
import { getCategoryMeta } from '../constants/categories';
import { formatAmount } from '../lib/currency';
import { useTheme, Theme } from '../lib/theme';

interface Props {
    expense: Expense;
    onPress: () => void;
    onLongPress?: () => void;
}

export default function ExpenseRow({ expense, onPress, onLongPress }: Props) {
    const theme = useTheme();
    const styles = createStyles(theme);
    const cat = getCategoryMeta(expense.category);

    return (
        <TouchableOpacity style={styles.row} onPress={onPress} onLongPress={onLongPress}>
            <View style={[styles.iconBox, { backgroundColor: cat.color + '22' }]}>
                <Text style={styles.icon}>{cat.icon}</Text>
            </View>
            <View style={styles.info}>
                <Text style={styles.merchant} numberOfLines={1}>{expense.merchant}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={styles.category}>{expense.category}</Text>
                    {(expense as any).member_name && (
                        <>
                            <Text style={styles.dotSeparator}>•</Text>
                            <Text style={styles.memberBadge}>👤 {(expense as any).member_name}</Text>
                        </>
                    )}
                </View>
            </View>
            <View style={styles.right}>
                <Text style={styles.amount}>{formatAmount(expense.amount)}</Text>
                <Text style={styles.date}>
                    {new Date(expense.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        row: {
            flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
            paddingHorizontal: 16, borderBottomWidth: 0.5, borderColor: theme.border,
            backgroundColor: theme.surface,
        },
        iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
        icon: { fontSize: 20 },
        info: { flex: 1 },
        merchant: { fontSize: 15, fontWeight: '500', color: theme.text },
        category: { fontSize: 13, color: theme.textSecondary },
        dotSeparator: { fontSize: 10, color: theme.textSecondary, marginHorizontal: 6, marginTop: 1 },
        memberBadge: { fontSize: 11, fontWeight: '500', color: theme.primary, backgroundColor: theme.primary + '11', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
        right: { alignItems: 'flex-end' },
        amount: { fontSize: 15, fontWeight: '600', color: theme.text },
        date: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    });
}