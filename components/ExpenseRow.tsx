// components/ExpenseRow.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Expense } from '../types/expense';
import { useUserCategories } from '../hooks/useUserCategories';
import { formatAmount } from '../lib/currency';
import { useTheme, Theme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    expense: Expense;
    onPress: () => void;
    onLongPress?: () => void;
}

export default function ExpenseRow({ expense, onPress, onLongPress }: Props) {
    const theme = useTheme();
    const styles = createStyles(theme);
    const { getCategoryMeta } = useUserCategories();
    const cat = getCategoryMeta(expense.category);

    const isPending = expense._categorizationStatus === 'pending';
    const isFailed  = expense._categorizationStatus === 'failed';

    // ── Display logic ───────────────────────────────────────────────────────
    // Primary priority: spentOn → merchant → category → "Categorizing…" / "Uncategorized"
    const spentOn   = expense.spent_on?.trim() || null;
    const merchant  = expense.merchant?.trim() || null;
    const catName   = expense.category?.trim() || null;

    const primaryText = spentOn
        ?? merchant
        ?? catName
        ?? (isPending ? 'Categorizing…' : 'Uncategorized');

    // Secondary row:
    // - If spentOn is primary: show merchant (muted) + category pill
    // - If merchant is primary: show category pill only
    // - If category is primary: show nothing extra (category is already the primary)
    const secondaryMerchant = spentOn && merchant ? merchant : null;
    const showCategoryPill  = primaryText !== catName; // don't repeat category if it's already primary

    return (
        <TouchableOpacity style={styles.row} onPress={onPress} onLongPress={onLongPress}>
            <View style={[styles.iconBox, { backgroundColor: cat.color + '22' }]}>
                {isPending
                    ? <Ionicons name="hourglass-outline" size={20} color={theme.textSecondary} />
                    : <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                }
            </View>
            <View style={styles.info}>
                <Text
                    style={[styles.primary, isPending && styles.primaryPending]}
                    numberOfLines={1}
                >
                    {primaryText}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap', gap: 4 }}>
                    {/* Muted merchant — only shown when spentOn is the primary text */}
                    {secondaryMerchant && (
                        <Text style={styles.secondary} numberOfLines={1}>{secondaryMerchant}</Text>
                    )}
                    {secondaryMerchant && showCategoryPill && (
                        <Text style={styles.dotSeparator}>•</Text>
                    )}
                    {/* Category pill — hidden when category is already the primary text */}
                    {showCategoryPill && (
                        <Text style={styles.category}>
                            {isPending ? 'Categorizing…' : isFailed ? 'Uncategorized' : (catName ?? '')}
                        </Text>
                    )}
                    {(expense as any).member_name && (
                        <>
                            <Text style={styles.dotSeparator}>•</Text>
                            <Text style={styles.memberBadge} numberOfLines={1}>
                                👤 {(expense as any).member_name}
                            </Text>
                        </>
                    )}
                    {expense.items && expense.items.length > 0 && (
                        <>
                            <Text style={styles.dotSeparator}>•</Text>
                            <View style={styles.itemsBadge}>
                                <Ionicons name="receipt-outline" size={10} color={theme.primary} />
                                <Text style={styles.itemsBadgeText}>
                                    {expense.items.length} item{expense.items.length > 1 ? 's' : ''}
                                </Text>
                            </View>
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
        info: { flex: 1 },
        primary: { fontSize: 15, fontWeight: '500', color: theme.text },
        primaryPending: { color: theme.textSecondary, fontStyle: 'italic' },
        secondary: { fontSize: 12, color: theme.textSecondary, flexShrink: 1 },
        category: { fontSize: 13, color: theme.textSecondary },
        dotSeparator: { fontSize: 10, color: theme.textSecondary, marginHorizontal: 2, marginTop: 1 },
        memberBadge: { flexShrink: 1, fontSize: 11, fontWeight: '500', color: theme.primary, backgroundColor: theme.primary + '11', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
        itemsBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
        itemsBadgeText: { fontSize: 11, fontWeight: '600', color: theme.primary },
        right: { alignItems: 'flex-end', flexShrink: 0 },
        amount: { fontSize: 15, fontWeight: '600', color: theme.text },
        date: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    });
}