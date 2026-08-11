// app/edit-recurring.tsx
import { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ScrollView, KeyboardAvoidingView,
    Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRecurring, useUpdateRecurring, useDeleteRecurring } from '../hooks/useRecurring';
import { useUserCategories } from '../hooks/useUserCategories';
import CategoryPicker from '../components/CategoryPicker';
import { rupeesToPaise } from '../lib/currency';
import { Category, RecurringFrequency } from '../types/expense';
import { toast } from '../lib/toast';
import { useTheme, Theme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';

const FREQUENCIES: { key: RecurringFrequency; label: string; icon: string }[] = [
    { key: 'daily', label: 'Daily', icon: '📅' },
    { key: 'weekly', label: 'Weekly', icon: '📆' },
    { key: 'monthly', label: 'Monthly', icon: '🗓️' },
    { key: 'yearly', label: 'Yearly', icon: '📅' },
];

export default function EditRecurringScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const theme = useTheme();
    const styles = createStyles(theme);

    const { data: recurringList = [], isLoading } = useRecurring();
    const { mutate: updateRecurring, isPending: isUpdating } = useUpdateRecurring();
    const { mutate: deleteRecurring, isPending: isDeleting } = useDeleteRecurring();
    const { categories, trackCategoryUsage } = useUserCategories();

    const recurring = recurringList.find(r => r.id === id);

    const [amount, setAmount] = useState('');
    const [merchant, setMerchant] = useState('');
    const [category, setCategory] = useState<Category>('Bills');
    const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
    const [nextDueDate, setNextDueDate] = useState('');
    const [errors, setErrors] = useState<{ amount?: string; merchant?: string }>({});

    useEffect(() => {
        if (recurring) {
            setAmount((recurring.amount / 100).toString());
            setMerchant(recurring.merchant);
            setCategory(recurring.category);
            setFrequency(recurring.frequency);
            setNextDueDate(recurring.next_due_date);
        }
    }, [recurring]);

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={theme.primary} size="large" />
            </View>
        );
    }

    if (!recurring) {
        return (
            <View style={styles.centered}>
                <Text style={styles.notFoundText}>Recurring expense not found</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const validate = (): boolean => {
        const newErrors: typeof errors = {};
        const parsed = parseFloat(amount);
        if (!amount || isNaN(parsed) || parsed <= 0)
            newErrors.amount = 'Please enter a valid amount';
        if (!merchant.trim())
            newErrors.merchant = 'Merchant name is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;

        updateRecurring({
            id: recurring.id,
            amount: rupeesToPaise(parseFloat(amount)),
            merchant: merchant.trim(),
            category,
            frequency,
            next_due_date: nextDueDate,
        }, {
            onSuccess: () => {
                if (category) {
                    trackCategoryUsage(category);
                }
                toast.success('Recurring expense updated');
                router.back();
            },
            onError: (e) => {
                toast.error(e.message);
            },
        });
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete recurring expense',
            `Are you sure you want to delete "${recurring.merchant}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        deleteRecurring(recurring.id, {
                            onSuccess: () => {
                                toast.success('Deleted');
                                router.back();
                            },
                            onError: (e) => toast.error(e.message),
                        });
                    },
                },
            ]
        );
    };

    const isPending = isUpdating || isDeleting;

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.heading}>Edit recurring expense</Text>
                    <TouchableOpacity onPress={handleDelete} style={styles.headerDelete}>
                        <Ionicons name="trash-outline" size={22} color={theme.danger} />
                    </TouchableOpacity>
                </View>

                {/* Amount */}
                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput
                    style={[styles.amountInput, errors.amount && styles.inputError]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    value={amount}
                    onChangeText={v => { setAmount(v); setErrors(e => ({ ...e, amount: undefined })); }}
                    keyboardType="decimal-pad"
                />
                {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}

                {/* Merchant */}
                <Text style={styles.label}>Merchant / Description</Text>
                <TextInput
                    style={[styles.input, errors.merchant && styles.inputError]}
                    placeholder="e.g. Netflix, Rent, EMI"
                    placeholderTextColor={theme.textSecondary}
                    value={merchant}
                    onChangeText={v => { setMerchant(v); setErrors(e => ({ ...e, merchant: undefined })); }}
                />
                {errors.merchant && <Text style={styles.errorText}>{errors.merchant}</Text>}

                {/* Category */}
                <Text style={styles.label}>Category</Text>
                <CategoryPicker selected={category} onSelect={setCategory} />

                {/* Frequency */}
                <Text style={styles.label}>Frequency</Text>
                <View style={styles.frequencyRow}>
                    {FREQUENCIES.map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[
                                styles.frequencyChip,
                                frequency === f.key && styles.frequencyChipActive,
                            ]}
                            onPress={() => setFrequency(f.key)}
                        >
                            <Text style={styles.frequencyIcon}>{f.icon}</Text>
                            <Text style={[
                                styles.frequencyLabel,
                                frequency === f.key && styles.frequencyLabelActive,
                            ]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Next due date */}
                <Text style={styles.label}>Next due date</Text>
                <TextInput
                    style={styles.input}
                    value={nextDueDate}
                    onChangeText={setNextDueDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numbers-and-punctuation"
                />
                <Text style={styles.hint}>
                    The expense will be auto-added on this date and repeat {frequency}.
                </Text>

                <TouchableOpacity
                    style={[styles.saveButton, isPending && styles.disabled]}
                    onPress={handleSave}
                    disabled={isPending}
                >
                    <Text style={styles.saveButtonText}>
                        {isUpdating ? 'Saving...' : 'Update Recurring Expense'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDelete}
                    disabled={isPending}
                >
                    <Text style={styles.deleteButtonText}>Delete Recurring Expense</Text>
                </TouchableOpacity>

                <View style={{ height: 48 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background, padding: 24 },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background, padding: 24 },
        notFoundText: { fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 16 },
        backButton: { backgroundColor: theme.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
        backButtonText: { color: '#fff', fontWeight: '600' },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 24 },
        headerBack: { padding: 4 },
        headerDelete: { padding: 4 },
        heading: { fontSize: 20, fontWeight: '700', color: theme.text },
        label: { fontSize: 13, color: theme.textSecondary, marginBottom: 6, marginTop: 16 },
        amountInput: {
            fontSize: 40, fontWeight: '700', color: theme.text,
            borderBottomWidth: 2, borderColor: theme.primary, paddingBottom: 8,
        },
        input: {
            borderWidth: 1, borderColor: theme.border, borderRadius: 12,
            padding: 14, fontSize: 16, backgroundColor: theme.inputBg, color: theme.text,
        },
        inputError: { borderColor: theme.danger },
        errorText: { fontSize: 12, color: theme.danger, marginTop: 4 },
        hint: { fontSize: 12, color: theme.textSecondary, marginTop: 8, lineHeight: 18 },
        frequencyRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
        frequencyChip: {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 16, paddingVertical: 10,
            borderRadius: 12, borderWidth: 1, borderColor: theme.border,
            backgroundColor: theme.cardBg,
        },
        frequencyChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
        frequencyIcon: { fontSize: 16 },
        frequencyLabel: { fontSize: 14, color: theme.text, fontWeight: '500' },
        frequencyLabelActive: { color: '#fff' },
        saveButton: {
            backgroundColor: theme.primary, borderRadius: 14,
            padding: 18, alignItems: 'center', marginTop: 32,
        },
        disabled: { opacity: 0.6 },
        saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
        deleteButton: {
            borderWidth: 1, borderColor: theme.danger, borderRadius: 14,
            padding: 16, alignItems: 'center', marginTop: 12,
            backgroundColor: theme.danger + '10',
        },
        deleteButtonText: { color: theme.danger, fontSize: 16, fontWeight: '600' },
    });
}
