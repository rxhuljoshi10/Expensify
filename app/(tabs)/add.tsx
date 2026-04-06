// app/(tabs)/add.tsx
import { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAddExpense } from '../../hooks/useExpenses';
import CategoryPicker from '../../components/CategoryPicker';
import { rupeesToPaise } from '../../lib/currency';
import { Category } from '../../types/expense';

export default function AddExpenseScreen() {
    const router = useRouter();
    const { mutate: addExpense, isPending } = useAddExpense();

    const [amount, setAmount] = useState('');
    const [merchant, setMerchant] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<Category>('Food');
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const handleSave = () => {
        const parsed = parseFloat(amount);
        if (!amount || isNaN(parsed) || parsed <= 0) {
            Alert.alert('Invalid amount', 'Please enter a valid amount');
            return;
        }
        if (!merchant.trim()) {
            Alert.alert('Missing info', 'Please enter a merchant name');
            return;
        }

        addExpense({
            amount: rupeesToPaise(parsed),   // always store as paise
            category,
            merchant: merchant.trim(),
            description: description.trim(),
            expense_date: date.toISOString().split('T')[0],
        }, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('Error', e.message),
        });
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
                <Text style={styles.heading}>Add expense</Text>

                {/* Amount */}
                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput
                    style={styles.amountInput}
                    placeholder="0"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    autoFocus
                />

                {/* Merchant */}
                <Text style={styles.label}>Merchant</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Swiggy, Uber, DMart"
                    value={merchant}
                    onChangeText={setMerchant}
                />

                {/* Category */}
                <Text style={styles.label}>Category</Text>
                <CategoryPicker selected={category} onSelect={setCategory} />

                {/* Date */}
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Text>{date.toDateString()}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                    <DateTimePicker
                        value={date}
                        mode="date"
                        maximumDate={new Date()}
                        onChange={(_, selected) => {
                            setShowDatePicker(false);
                            if (selected) setDate(selected);
                        }}
                    />
                )}

                {/* Note (optional) */}
                <Text style={styles.label}>Note (optional)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Any extra detail..."
                    value={description}
                    onChangeText={setDescription}
                />

                {/* Save */}
                <TouchableOpacity
                    style={[styles.saveButton, isPending && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={isPending}
                >
                    <Text style={styles.saveButtonText}>
                        {isPending ? 'Saving...' : 'Save Expense'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 24 },
    heading: { fontSize: 24, fontWeight: '700', marginBottom: 24, marginTop: 16 },
    label: { fontSize: 13, color: '#888', marginBottom: 6, marginTop: 16 },
    amountInput: {
        fontSize: 40, fontWeight: '700', color: '#1a1a1a',
        borderBottomWidth: 2, borderColor: '#6C63FF', paddingBottom: 8,
    },
    input: {
        borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12,
        padding: 14, fontSize: 16, backgroundColor: '#fafafa',
        justifyContent: 'center',
    },
    saveButton: {
        backgroundColor: '#6C63FF', borderRadius: 14, padding: 18,
        alignItems: 'center', marginTop: 32, marginBottom: 48,
    },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});