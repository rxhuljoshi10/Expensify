// app/budget-settings.tsx
import { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useBudget, useSetBudget } from '../hooks/useBudget';
import { CATEGORIES } from '../constants/categories';
import { rupeesToPaise, formatAmount } from '../lib/currency';

export default function BudgetSettingsScreen() {
    const router = useRouter();
    const { data: budget } = useBudget();
    const { mutate: setBudget, isPending } = useSetBudget();

    const [totalBudget, setTotalBudget] = useState('');
    const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>({});

    // Prefill if budget already exists
    useEffect(() => {
        if (budget) {
            setTotalBudget(String(budget.total_budget / 100));
            if (budget.category_budgets) {
                const readable: Record<string, string> = {};
                Object.entries(budget.category_budgets).forEach(([k, v]) => {
                    readable[k] = String((v as number) / 100);
                });
                setCategoryBudgets(readable);
            }
        }
    }, [budget]);

    const handleSave = () => {
        const parsed = parseFloat(totalBudget);
        if (isNaN(parsed) || parsed <= 0) {
            Alert.alert('Invalid amount', 'Please enter a valid monthly budget');
            return;
        }

        // Convert category budgets to paise
        const catPaise: Record<string, number> = {};
        Object.entries(categoryBudgets).forEach(([k, v]) => {
            const n = parseFloat(v);
            if (!isNaN(n) && n > 0) catPaise[k] = rupeesToPaise(n);
        });

        setBudget({
            totalBudget: rupeesToPaise(parsed),
            categoryBudgets: catPaise,
        }, {
            onSuccess: () => {
                Alert.alert('Saved', 'Budget updated successfully');
                router.back();
            },
            onError: (e) => Alert.alert('Error', e.message),
        });
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
                <Text style={styles.heading}>Budget settings</Text>
                <Text style={styles.subheading}>
                    {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </Text>

                {/* Total monthly budget */}
                <Text style={styles.label}>Total monthly budget (₹)</Text>
                <TextInput
                    style={styles.amountInput}
                    placeholder="e.g. 30000"
                    value={totalBudget}
                    onChangeText={setTotalBudget}
                    keyboardType="decimal-pad"
                    autoFocus
                />

                {/* Per-category limits (optional) */}
                <Text style={styles.sectionTitle}>Per-category limits (optional)</Text>
                <Text style={styles.sectionSubtext}>
                    Leave blank to skip a category
                </Text>

                {CATEGORIES.map(cat => (
                    <View key={cat.name} style={styles.categoryRow}>
                        <Text style={styles.categoryIcon}>{cat.icon}</Text>
                        <Text style={styles.categoryName}>{cat.name}</Text>
                        <TextInput
                            style={styles.categoryInput}
                            placeholder="₹ limit"
                            value={categoryBudgets[cat.name] ?? ''}
                            onChangeText={v =>
                                setCategoryBudgets(prev => ({ ...prev, [cat.name]: v }))
                            }
                            keyboardType="decimal-pad"
                        />
                    </View>
                ))}

                <TouchableOpacity
                    style={[styles.saveButton, isPending && styles.disabled]}
                    onPress={handleSave}
                    disabled={isPending}
                >
                    <Text style={styles.saveButtonText}>
                        {isPending ? 'Saving...' : 'Save Budget'}
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 48 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 24 },
    heading: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginTop: 16 },
    subheading: { fontSize: 14, color: '#aaa', marginBottom: 24, marginTop: 4 },
    label: { fontSize: 13, color: '#888', marginBottom: 8 },
    amountInput: {
        fontSize: 36, fontWeight: '700', color: '#1a1a1a',
        borderBottomWidth: 2, borderColor: '#6C63FF',
        paddingBottom: 8, marginBottom: 32,
    },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
    sectionSubtext: { fontSize: 13, color: '#aaa', marginBottom: 16 },
    categoryRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: 0.5, borderColor: '#f0f0f0', gap: 10,
    },
    categoryIcon: { fontSize: 20, width: 28 },
    categoryName: { flex: 1, fontSize: 15, color: '#1a1a1a' },
    categoryInput: {
        width: 100, borderWidth: 1, borderColor: '#e0e0e0',
        borderRadius: 8, padding: 8, fontSize: 14,
        textAlign: 'right', backgroundColor: '#fafafa',
    },
    saveButton: {
        backgroundColor: '#6C63FF', borderRadius: 14,
        padding: 18, alignItems: 'center', marginTop: 32,
    },
    disabled: { opacity: 0.6 },
    saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});