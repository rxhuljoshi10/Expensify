// app/add-recurring.tsx
import { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ScrollView, KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAddRecurring } from '../hooks/useRecurring';
import CategoryPicker from '../components/CategoryPicker';
import { rupeesToPaise } from '../lib/currency';
import { Category, RecurringFrequency } from '../types/expense';
import { toast } from '../lib/toast';
import { useTheme, Theme } from '../lib/theme';

const FREQUENCIES: { key: RecurringFrequency; label: string; icon: string }[] = [
    { key: 'daily', label: 'Daily', icon: '📅' },
    { key: 'weekly', label: 'Weekly', icon: '📆' },
    { key: 'monthly', label: 'Monthly', icon: '🗓️' },
    { key: 'yearly', label: 'Yearly', icon: '📅' },
];

export default function AddRecurringScreen() {
    const router = useRouter();
    const theme = useTheme();
    const styles = createStyles(theme);
    const { mutate: addRecurring, isPending } = useAddRecurring();

    const [amount, setAmount] = useState('');
    const [merchant, setMerchant] = useState('');
    const [category, setCategory] = useState<Category>('Bills');
    const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
    const [startDate, setStartDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [errors, setErrors] = useState<{ amount?: string; merchant?: string }>({});

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

        addRecurring({
            amount: rupeesToPaise(parseFloat(amount)),
            merchant: merchant.trim(),
            category,
            frequency,
            next_due_date: startDate,
        }, {
            onSuccess: () => {

                toast.success('Recurring expense added');
                router.back();
            },
            onError: (e) => {
                toast.error(e.message);
            },
        });
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
                <Text style={styles.heading}>Add recurring expense</Text>

                {/* Amount */}
                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput
                    style={[styles.amountInput, errors.amount && styles.inputError]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    value={amount}
                    onChangeText={v => { setAmount(v); setErrors(e => ({ ...e, amount: undefined })); }}
                    keyboardType="decimal-pad"
                    autoFocus
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
                            onPress={() => { setFrequency(f.key); }}
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

                {/* Start / next due date */}
                <Text style={styles.label}>First due date</Text>
                <TextInput
                    style={styles.input}
                    value={startDate}
                    onChangeText={setStartDate}
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
                        {isPending ? 'Saving...' : 'Save Recurring Expense'}
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 48 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background, padding: 24 },
        heading: { fontSize: 24, fontWeight: '700', color: theme.text, marginTop: 16, marginBottom: 24 },
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
    });
}