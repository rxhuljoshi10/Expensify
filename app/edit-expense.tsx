// app/edit-expense.tsx
import { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useExpenses, useUpdateExpense, useDeleteExpense } from '../hooks/useExpenses';
import CategoryPicker from '../components/CategoryPicker';
import { rupeesToPaise, formatAmount } from '../lib/currency';
import { Category } from '../types/expense';

export default function EditExpenseScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: expenses = [] } = useExpenses();
    const { mutate: updateExpense, isPending } = useUpdateExpense();
    const { mutate: deleteExpense } = useDeleteExpense();

    const expense = expenses.find(e => e.id === id);

    const [amount, setAmount] = useState('');
    const [merchant, setMerchant] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<Category>('Food');
    const [date, setDate] = useState(new Date());

    useEffect(() => {
        if (expense) {
            setAmount(String(expense.amount / 100));   // paise → rupees for display
            setMerchant(expense.merchant);
            setDescription(expense.description ?? '');
            setCategory(expense.category);
            setDate(new Date(expense.expense_date));
        }
    }, [expense]);

    if (!expense) {
        return (
            <View style={styles.centered}>
                <Text>Expense not found</Text>
            </View>
        );
    }

    const handleUpdate = () => {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) {
            Alert.alert('Invalid amount', 'Please enter a valid amount');
            return;
        }
        updateExpense({
            id,
            amount: rupeesToPaise(parsed),
            category,
            merchant: merchant.trim(),
            description: description.trim(),
            expense_date: date.toISOString().split('T')[0],
        }, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('Error', e.message),
        });
    };

    const handleDelete = () => {
        Alert.alert('Delete expense', `Remove "${expense.merchant}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: () => deleteExpense(id, { onSuccess: () => router.back() }),
            },
        ]);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
                <Text style={styles.heading}>Edit expense</Text>

                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Merchant</Text>
                <TextInput style={styles.input} value={merchant} onChangeText={setMerchant} />

                <Text style={styles.label}>Category</Text>
                <CategoryPicker selected={category} onSelect={setCategory} />

                <Text style={styles.label}>Note (optional)</Text>
                <TextInput
                    style={styles.input}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Any extra detail..."
                />

                <TouchableOpacity
                    style={[styles.saveButton, isPending && styles.disabled]}
                    onPress={handleUpdate}
                    disabled={isPending}
                >
                    <Text style={styles.saveButtonText}>
                        {isPending ? 'Saving...' : 'Update Expense'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                    <Text style={styles.deleteButtonText}>Delete Expense</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 24 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    heading: { fontSize: 24, fontWeight: '700', marginBottom: 24, marginTop: 16 },
    label: { fontSize: 13, color: '#888', marginBottom: 6, marginTop: 16 },
    amountInput: {
        fontSize: 40, fontWeight: '700', color: '#1a1a1a',
        borderBottomWidth: 2, borderColor: '#6C63FF', paddingBottom: 8,
    },
    input: {
        borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12,
        padding: 14, fontSize: 16, backgroundColor: '#fafafa',
    },
    saveButton: {
        backgroundColor: '#6C63FF', borderRadius: 14, padding: 18,
        alignItems: 'center', marginTop: 32,
    },
    disabled: { opacity: 0.6 },
    saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
    deleteButton: {
        borderWidth: 1, borderColor: '#ff4444', borderRadius: 14,
        padding: 18, alignItems: 'center', marginTop: 12, marginBottom: 48,
    },
    deleteButtonText: { color: '#ff4444', fontSize: 17, fontWeight: '500' },
});