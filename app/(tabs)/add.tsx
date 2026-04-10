// app/(tabs)/add.tsx
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { toast } from '../../lib/toast';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAddExpense } from '../../hooks/useExpenses';
import CategoryPicker from '../../components/CategoryPicker';
import { rupeesToPaise } from '../../lib/currency';
import { Category } from '../../types/expense';
import { useTheme, Theme } from '../../lib/theme';
import { useEffect, useRef } from 'react';
import { categorizeExpense } from '../../lib/ai';

export default function AddExpenseScreen() {
    const theme = useTheme();
    const styles = createStyles(theme);
    const router = useRouter();
    const { mutate: addExpense, isPending } = useAddExpense();

    const [amount, setAmount] = useState('');
    const [merchant, setMerchant] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<Category>('Food');
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [errors, setErrors] = useState<{ amount?: string; merchant?: string }>({});
    const [isCategorizing, setIsCategorizing] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const validate = (): boolean => {
        const newErrors: typeof errors = {};
        const parsed = parseFloat(amount);
        if (!amount || isNaN(parsed) || parsed <= 0) newErrors.amount = 'Please enter a valid amount';
        if (!merchant.trim()) newErrors.merchant = 'Merchant name is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;
        const parsed = parseFloat(amount);
        addExpense({
            amount: rupeesToPaise(parsed),
            category,
            merchant: merchant.trim(),
            description: description.trim(),
            expense_date: date.toISOString().split('T')[0],
        }, {
            onSuccess: () => {
                toast.success('Expense added');
                setAmount('');
                setMerchant('');
                setDescription('');
                setCategory('Food');
                setDate(new Date());
                setErrors({});
                router.back();
            },
            onError: (e) => { toast.error(e.message); },
        });
    };

    useEffect(() => {
        if (!merchant.trim() || merchant.trim().length < 3) return;

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setIsCategorizing(true);
            const suggested = await categorizeExpense(merchant, description);
            setCategory(suggested as Category);
            setIsCategorizing(false);
        }, 600);

        return () => clearTimeout(debounceRef.current);
    }, [merchant]);

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
                <Text style={styles.heading}>Add expense</Text>

                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput
                    style={[styles.amountInput, errors.amount && { borderColor: '#ff4444' }]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    autoFocus
                />
                {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}

                <Text style={styles.label}>Merchant</Text>
                <TextInput
                    style={[styles.input, errors.merchant && { borderColor: '#ff4444' }]}
                    placeholder="e.g. Swiggy, Uber, DMart"
                    placeholderTextColor={theme.textSecondary}
                    value={merchant}
                    onChangeText={setMerchant}
                />
                {errors.merchant && <Text style={styles.errorText}>{errors.merchant}</Text>}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.label}>Category</Text>
                    {isCategorizing && (
                        <Text style={{ fontSize: 12, color: '#6C63FF' }}>AI suggesting...</Text>
                    )}
                </View>
                <CategoryPicker selected={category} onSelect={setCategory} />

                <Text style={styles.label}>Date</Text>
                <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                    <Text style={{ color: theme.text }}>{date.toDateString()}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                    <DateTimePicker value={date} mode="date" maximumDate={new Date()} onChange={(_, s) => { setShowDatePicker(false); if (s) setDate(s); }} />
                )}

                <Text style={styles.label}>Note (optional)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Any extra detail..."
                    placeholderTextColor={theme.textSecondary}
                    value={description}
                    onChangeText={setDescription}
                />

                <TouchableOpacity style={[styles.saveButton, isPending && styles.saveButtonDisabled]} onPress={handleSave} disabled={isPending}>
                    <Text style={styles.saveButtonText}>{isPending ? 'Saving...' : 'Save Expense'}</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background, padding: 24 },
        heading: { fontSize: 24, fontWeight: '700', marginBottom: 24, marginTop: 16, color: theme.text },
        label: { fontSize: 13, color: theme.textSecondary, marginBottom: 6, marginTop: 16 },
        amountInput: { fontSize: 40, fontWeight: '700', color: theme.text, borderBottomWidth: 2, borderColor: theme.primary, paddingBottom: 8 },
        input: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: theme.inputBg, color: theme.text, justifyContent: 'center' },
        saveButton: { backgroundColor: theme.primary, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 32, marginBottom: 48 },
        saveButtonDisabled: { opacity: 0.6 },
        saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
        errorText: { fontSize: 12, color: '#ff4444', marginTop: 4, marginBottom: 4 },
    });
}