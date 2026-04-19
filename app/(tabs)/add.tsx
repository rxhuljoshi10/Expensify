// app/(tabs)/add.tsx
import { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform, Modal, Animated,
} from 'react-native';
import { toast } from '../../lib/toast';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAddExpense } from '../../hooks/useExpenses';
import CategoryPicker from '../../components/CategoryPicker';
import { rupeesToPaise } from '../../lib/currency';
import { Category } from '../../types/expense';
import { useTheme, Theme } from '../../lib/theme';
import { categorizeExpense, parseVoiceExpense, pickAndScanBill } from '../../lib/ai';
import { Ionicons } from '@expo/vector-icons';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';

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
    const [isScanning, setIsScanning] = useState(false);

    // ── Voice modal ──────────────────────────────────────────────────────────
    const [showVoice, setShowVoice] = useState(false);
    const [multipleExpenses, setMultipleExpenses] = useState<any[] | null>(null);
    const { state: voiceState, startRecording, stopRecording, reset: resetVoice } = useVoiceRecorder();
    const { mutateAsync: addExpenseAsync } = useAddExpense();
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (voiceState === 'recording') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.stopAnimation();
            pulseAnim.setValue(1);
        }
    }, [voiceState]);

    const handleMicPress = async () => {
        if (voiceState === 'idle') {
            await startRecording();
        } else if (voiceState === 'recording') {
            const uri = await stopRecording();
            if (!uri) return;

            const result = await parseVoiceExpense(uri);
            if (!result || result.expenses.length === 0) {
                toast.error("Couldn't understand that. Try again.");
                resetVoice();
                return;
            }

            if (result.expenses.length === 1) {
                // Single expense → pre-fill the form
                const exp = result.expenses[0];
                setAmount(String(exp.amount));
                setMerchant(exp.merchant);
                setCategory(exp.category as Category);
                toast.success('Form filled from voice 🎙️');
                resetVoice();
                setShowVoice(false);
            } else {
                // Multiple expenses → enter review mode
                setMultipleExpenses(result.expenses);
            }
        }
    };

    const handleSaveMultiple = async () => {
        if (!multipleExpenses || multipleExpenses.length === 0) {
            closeVoiceModal();
            return;
        }

        try {
            const today = new Date().toISOString();
            await Promise.all(
                multipleExpenses.map(exp =>
                    addExpenseAsync({
                        amount: rupeesToPaise(exp.amount),
                        merchant: exp.merchant,
                        category: exp.category as any,
                        expense_date: today,
                        description: '',
                    })
                )
            );
            toast.success(`${multipleExpenses.length} expenses saved`);
            resetVoice();
            setMultipleExpenses(null);
            setShowVoice(false);
            router.back();
        } catch (e: any) {
            toast.error(e?.message ?? 'Failed to save');
            resetVoice();
        }
    };

    const closeVoiceModal = () => {
        resetVoice();
        setShowVoice(false);
        setMultipleExpenses(null);
    };

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

    // app/(tabs)/add.tsx — update handleScanBill
    const handleScanBill = async () => {
        setIsScanning(true);

        const result = await pickAndScanBill();
        setIsScanning(false);

        if (!result) {
            // User cancelled or error — don't show error if they just cancelled
            return;
        }

        if (result.confidence === 'low') {
            toast.info('Receipt unclear — please check and correct the details');
        } else if (result.confidence === 'medium') {
            toast.info('Please verify the scanned details');
        } else {
            toast.success('Receipt scanned successfully');
        }

        // Prefill form with scanned data
        if (result.total) setAmount(String(result.total));
        if (result.merchant) setMerchant(result.merchant);
        if (result.category) setCategory(result.category as Category);
        if (result.date) {
            const parsed = new Date(result.date);
            if (!isNaN(parsed.getTime())) setDate(parsed);
        }

        // If items were found, put them in the description
        if (result.items?.length > 0) {
            setDescription(result.items.join(', '));
        }
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

                {/* ── Quick-input row: Scan + Voice ── */}
                <View style={styles.quickRow}>
                    <TouchableOpacity
                        style={[styles.quickButton, { flex: 1.6 }]}
                        onPress={handleScanBill}
                        disabled={isScanning}
                        activeOpacity={0.7}
                    >
                        <View style={styles.quickIcon}>
                            <Ionicons name="camera" size={20} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.quickTitle}>{isScanning ? 'Scanning...' : 'Scan Receipt'}</Text>
                            <Text style={styles.quickSub}>Auto-fill from photo</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.quickButton, { flex: 1 }]}
                        onPress={() => setShowVoice(true)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.quickIcon, { backgroundColor: '#FF6B6B22' }]}>
                            <Ionicons name="mic" size={20} color="#FF6B6B" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.quickTitle}>Voice</Text>
                            <Text style={styles.quickSub}>Speak it</Text>
                        </View>
                    </TouchableOpacity>
                </View>

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

            {/* ── Voice Modal ── */}
            <Modal visible={showVoice} transparent animationType="slide" onRequestClose={closeVoiceModal}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalSheet, multipleExpenses && { flex: 0.8 }]}>
                        <View style={styles.modalHandle} />

                        {multipleExpenses ? (
                            <>
                                <Text style={styles.modalTitle}>Review Expenses</Text>
                                <Text style={styles.modalHint}>Please confirm the expenses below.</Text>
                                
                                <ScrollView style={{ width: '100%', marginTop: 16 }} showsVerticalScrollIndicator={false}>
                                    {multipleExpenses.map((exp: any, index: number) => (
                                        <View key={index} style={styles.reviewItem}>
                                            <View style={styles.reviewContent}>
                                                <TextInput
                                                    style={styles.reviewMerchantInput}
                                                    value={exp.merchant}
                                                    onChangeText={(text) => {
                                                        const newArr = [...multipleExpenses];
                                                        newArr[index] = { ...newArr[index], merchant: text };
                                                        setMultipleExpenses(newArr);
                                                    }}
                                                    placeholder="Merchant"
                                                    placeholderTextColor={theme.textSecondary}
                                                    returnKeyType="done"
                                                />
                                                <Text style={styles.reviewCategory}>{exp.category}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                                                <Text style={[styles.reviewAmountInput, { color: theme.textSecondary, marginRight: 2 }]}>₹</Text>
                                                <TextInput
                                                    style={styles.reviewAmountInput}
                                                    value={String(exp.amount)}
                                                    onChangeText={(text) => {
                                                        const newArr = [...multipleExpenses];
                                                        newArr[index] = { ...newArr[index], amount: text };
                                                        setMultipleExpenses(newArr);
                                                    }}
                                                    keyboardType="decimal-pad"
                                                />
                                            </View>
                                            <TouchableOpacity 
                                                onPress={() => setMultipleExpenses(prev => prev!.filter((_, i) => i !== index))}
                                                style={styles.reviewDeleteIcon}
                                            >
                                                <Ionicons name="trash-outline" size={20} color="#ff4444" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                                
                                <View style={styles.reviewActions}>
                                    <TouchableOpacity style={styles.reviewCancelBtn} onPress={closeVoiceModal}>
                                        <Text style={styles.reviewCancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.reviewSaveBtn} onPress={handleSaveMultiple} disabled={isPending}>
                                        <Text style={styles.reviewSaveText}>{isPending ? 'Saving...' : `Save ${multipleExpenses.length}`}</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <>
                                <Text style={styles.modalTitle}>Voice Input</Text>
                                <Text style={styles.modalHint}>
                                    Say one expense to fill the form, or{`\n`}multiple to save them all at once.{`\n`}"Spent 480 on Swiggy" or "Zudio 3000, DMart 1000"
                                </Text>

                                <Animated.View style={{ transform: [{ scale: pulseAnim }], marginVertical: 24 }}>
                                    <TouchableOpacity
                                        style={[
                                            styles.micButton,
                                            voiceState === 'recording' && styles.micButtonActive,
                                            voiceState === 'processing' && styles.micButtonProcessing,
                                        ]}
                                        onPress={handleMicPress}
                                        disabled={voiceState === 'processing'}
                                    >
                                        {voiceState === 'recording'
                                            ? <Ionicons name="stop" size={40} color="#fff" />
                                            : voiceState === 'processing'
                                                ? <Ionicons name="hourglass" size={40} color={theme.textSecondary} />
                                                : <Ionicons name="mic" size={40} color="#FF6B6B" />
                                        }
                                    </TouchableOpacity>
                                </Animated.View>

                                <Text style={styles.micStatus}>
                                    {{
                                        idle: 'Tap to speak',
                                        recording: 'Listening... tap to stop',
                                        processing: 'Processing...',
                                        done: 'Done!',
                                        error: 'Something went wrong',
                                    }[voiceState]}
                                </Text>

                                <TouchableOpacity style={styles.modalClose} onPress={closeVoiceModal}>
                                    <Text style={styles.modalCloseText}>Cancel</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background, padding: 24 },
        heading: { fontSize: 24, fontWeight: '700', marginBottom: 20, marginTop: 16, color: theme.text },

        // Quick-input row
        quickRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
        quickButton: {
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: theme.primary + '11',
            borderRadius: 16, padding: 14,
            borderWidth: 1, borderColor: theme.primary + '33',
        },
        quickIcon: {
            width: 40, height: 40, borderRadius: 10,
            backgroundColor: theme.primary + '22',
            alignItems: 'center', justifyContent: 'center',
        },
        quickTitle: { fontSize: 14, fontWeight: '700', color: theme.text },
        quickSub: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },

        label: { fontSize: 13, color: theme.textSecondary, marginBottom: 6, marginTop: 16 },
        amountInput: { fontSize: 40, fontWeight: '700', color: theme.text, borderBottomWidth: 2, borderColor: theme.primary, paddingBottom: 8 },
        input: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: theme.inputBg, color: theme.text, justifyContent: 'center' },
        saveButton: { backgroundColor: theme.primary, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 32, marginBottom: 60 },
        saveButtonDisabled: { opacity: 0.6 },
        saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
        errorText: { fontSize: 12, color: '#ff4444', marginTop: 4, marginBottom: 4 },

        // Voice modal
        modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000077' },
        modalSheet: {
            backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 28, alignItems: 'center', paddingBottom: 48,
        },
        modalHandle: {
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: theme.border, marginBottom: 20,
        },
        modalTitle: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 8 },
        modalHint: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
        micButton: {
            width: 110, height: 110, borderRadius: 55,
            backgroundColor: '#FF6B6B11', borderWidth: 3, borderColor: '#FF6B6B',
            alignItems: 'center', justifyContent: 'center',
        },
        micButtonActive: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
        micButtonProcessing: { backgroundColor: theme.separator, borderColor: theme.border },
        micStatus: { fontSize: 15, color: theme.textSecondary, marginBottom: 24 },
        modalClose: { paddingVertical: 12, paddingHorizontal: 32 },
        modalCloseText: { fontSize: 15, color: theme.danger, fontWeight: '600' },

        // Review UI for multiple expenses
        reviewItem: {
            flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg,
            padding: 16, borderRadius: 12, marginBottom: 10,
            borderWidth: 1, borderColor: theme.border,
        },
        reviewContent: { flex: 1 },
        reviewMerchantInput: { fontSize: 16, fontWeight: '600', color: theme.text, padding: 0, margin: 0, height: 24 },
        reviewCategory: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
        reviewAmountInput: { fontSize: 18, fontWeight: '700', color: theme.text, padding: 0, margin: 0, textAlign: 'right', minWidth: 40, height: 26 },
        reviewDeleteIcon: { padding: 4 },
        reviewActions: { flexDirection: 'row', alignItems: 'center', marginTop: 16, width: '100%', gap: 12, paddingBottom: 10 },
        reviewCancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
        reviewCancelText: { fontSize: 16, fontWeight: '600', color: theme.text },
        reviewSaveBtn: { flex: 2, padding: 16, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center' },
        reviewSaveText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    });
}