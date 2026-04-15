// app/recurring.tsx
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    useRecurring, useToggleRecurring, useDeleteRecurring,
} from '../hooks/useRecurring';
import { getCategoryMeta } from '../constants/categories';
import { formatAmount } from '../lib/currency';
import { RecurringExpense, RecurringFrequency } from '../types/expense';
import { toast } from '../lib/toast';
import { useTheme, Theme } from '../lib/theme';

const frequencyLabel: Record<RecurringFrequency, string> = {
    daily: 'Every day',
    weekly: 'Every week',
    monthly: 'Every month',
    yearly: 'Every year',
};

const daysUntil = (dateStr: string): number => {
    const due = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export default function RecurringScreen() {
    const router = useRouter();
    const theme = useTheme();
    const styles = createStyles(theme);
    const { data: recurring = [], isLoading } = useRecurring();
    const { mutate: toggleRecurring } = useToggleRecurring();
    const { mutate: deleteRecurring } = useDeleteRecurring();

    const handleToggle = (item: RecurringExpense) => {
        toggleRecurring({ id: item.id, is_active: !item.is_active }, {
            onSuccess: () => toast.success(item.is_active ? 'Paused' : 'Resumed'),
            onError: (e) => toast.error(e.message),
        });
    };

    const handleDelete = (item: RecurringExpense) => {
        Alert.alert(
            'Delete recurring expense',
            `Stop auto-adding "${item.merchant}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: () => {
                        deleteRecurring(item.id, {
                            onSuccess: () => toast.success('Deleted'),
                            onError: (e) => toast.error(e.message),
                        });
                    },
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.heading}>Recurring expenses</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => router.push('/add-recurring')}
                >
                    <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            {recurring.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>🔄</Text>
                    <Text style={styles.emptyTitle}>No recurring expenses</Text>
                    <Text style={styles.emptySubtext}>
                        Add rent, subscriptions and EMIs so they get logged automatically
                    </Text>
                    <TouchableOpacity
                        style={styles.emptyButton}
                        onPress={() => router.push('/add-recurring')}
                    >
                        <Text style={styles.emptyButtonText}>Add your first one</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={recurring}
                    keyExtractor={r => r.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => {
                        const cat = getCategoryMeta(item.category);
                        const days = daysUntil(item.next_due_date);
                        const isDueSoon = days <= 3 && days >= 0;
                        const isOverdue = days < 0;

                        return (
                            <View style={[styles.card, !item.is_active && styles.cardPaused]}>
                                {/* Top row */}
                                <View style={styles.cardTop}>
                                    <View style={[styles.iconBox, { backgroundColor: cat.color + '22' }]}>
                                        <Text style={styles.icon}>{cat.icon}</Text>
                                    </View>
                                    <View style={styles.info}>
                                        <Text style={[styles.merchant, !item.is_active && styles.textMuted]}>
                                            {item.merchant}
                                        </Text>
                                        <Text style={styles.meta}>
                                            {formatAmount(item.amount)} · {frequencyLabel[item.frequency]}
                                        </Text>
                                    </View>
                                    {/* Toggle active/paused */}
                                    <Switch
                                        value={item.is_active}
                                        onValueChange={() => handleToggle(item)}
                                        trackColor={{ true: theme.primary, false: theme.separator }}
                                        thumbColor="#fff"
                                    />
                                </View>

                                {/* Due date row */}
                                <View style={styles.cardBottom}>
                                    <View style={[
                                        styles.dueBadge,
                                        isOverdue && styles.dueBadgeOverdue,
                                        isDueSoon && styles.dueBadgeSoon,
                                    ]}>
                                        <Text style={[
                                            styles.dueText,
                                            isOverdue && styles.dueTextOverdue,
                                            isDueSoon && styles.dueTextSoon,
                                        ]}>
                                            {isOverdue
                                                ? `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`
                                                : days === 0
                                                    ? 'Due today'
                                                    : `Due in ${days} day${days !== 1 ? 's' : ''}`}
                                        </Text>
                                    </View>
                                    <Text style={styles.nextDate}>{item.next_due_date}</Text>

                                    <TouchableOpacity onPress={() => handleDelete(item)}>
                                        <Text style={styles.deleteText}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    }}
                />
            )}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        header: {
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            padding: 20, paddingTop: 24, backgroundColor: theme.surface,
            borderBottomWidth: 0.5, borderColor: theme.border,
        },
        heading: { fontSize: 22, fontWeight: '700', color: theme.text },
        addButton: {
            backgroundColor: theme.primary, borderRadius: 10,
            paddingHorizontal: 16, paddingVertical: 8,
        },
        addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

        list: { padding: 16, gap: 12 },

        card: {
            backgroundColor: theme.cardBg, borderRadius: 16,
            padding: 16, gap: 12,
        },
        cardPaused: { opacity: 0.6 },
        cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        iconBox: {
            width: 44, height: 44, borderRadius: 12,
            alignItems: 'center', justifyContent: 'center',
        },
        icon: { fontSize: 20 },
        info: { flex: 1 },
        merchant: { fontSize: 16, fontWeight: '600', color: theme.text },
        textMuted: { color: theme.textSecondary },
        meta: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },

        cardBottom: {
            flexDirection: 'row', alignItems: 'center', gap: 8,
            borderTopWidth: 0.5, borderColor: theme.border, paddingTop: 12,
        },
        dueBadge: {
            backgroundColor: theme.primary + '1A', borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 4,
        },
        dueBadgeSoon: { backgroundColor: '#FF95001A' },
        dueBadgeOverdue: { backgroundColor: theme.danger + '1A' },
        dueText: { fontSize: 12, color: theme.primary, fontWeight: '500' },
        dueTextSoon: { color: '#FF9500' },
        dueTextOverdue: { color: theme.danger },
        nextDate: { flex: 1, fontSize: 12, color: theme.textSecondary, textAlign: 'right' },
        deleteText: { fontSize: 13, color: theme.danger },

        emptyContainer: {
            flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
        },
        emptyIcon: { fontSize: 56, marginBottom: 16 },
        emptyTitle: { fontSize: 20, fontWeight: '600', color: theme.text, marginBottom: 8 },
        emptySubtext: {
            fontSize: 15, color: theme.textSecondary, textAlign: 'center',
            lineHeight: 22, marginBottom: 24,
        },
        emptyButton: {
            backgroundColor: theme.primary, borderRadius: 12,
            paddingHorizontal: 24, paddingVertical: 14,
        },
        emptyButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    });
}