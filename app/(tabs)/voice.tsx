// app/(tabs)/voice.tsx
import { useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity,
    StyleSheet, Alert, Animated
} from 'react-native';
import { useRouter } from 'expo-router';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { parseVoiceExpense } from '../../lib/ai';
import { useAddExpense } from '../../hooks/useExpenses';
import { rupeesToPaise } from '../../lib/currency';
import { toast } from '../../lib/toast';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../../lib/theme';

export default function VoiceScreen() {
    const theme = useTheme();
    const styles = createStyles(theme);
    const router = useRouter();
    const { state, startRecording, stopRecording, reset } = useVoiceRecorder();
    const { mutateAsync: addExpense } = useAddExpense();
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Pulse animation while recording
    useEffect(() => {
        if (state === 'recording') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.stopAnimation();
            pulseAnim.setValue(1);
        }
    }, [state]);

    const handleMicPress = async () => {
        if (state === 'idle') {
            await startRecording();
        } else if (state === 'recording') {
            const uri = await stopRecording();
            if (!uri) return;

            const result = await parseVoiceExpense(uri);
            if (!result || result.expenses.length === 0) {
                toast.error("Couldn't understand that. Try again.");
                reset();
                return;
            }

            const today = new Date().toISOString();

            try {
                // Save all expenses in parallel using mutateAsync (returns a real Promise)
                await Promise.all(
                    result.expenses.map((exp) =>
                        addExpense({
                            amount: rupeesToPaise(exp.amount),
                            merchant: exp.merchant,
                            category: exp.category as any,
                            expense_date: today,
                            description: '',
                        })
                    )
                );

                const count = result.expenses.length;
                if (count === 1) {
                    const e = result.expenses[0];
                    toast.success(`₹${e.amount} to ${e.merchant} saved`);
                } else {
                    toast.success(`${count} expenses saved`);
                }
                reset();
                router.back();
            } catch (e: any) {
                toast.error(e?.message ?? 'Failed to save expenses');
                reset();
            }
        }
    };

    const statusText = {
        idle: 'Tap to speak',
        recording: 'Listening... tap to stop',
        processing: 'Saving expenses...',
        done: 'Done!',
        error: 'Something went wrong',
    }[state];

    const isProcessing = state === 'processing';

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Voice input</Text>
            <Text style={styles.hint}>
                Say one or multiple expenses:{'\n'}
                "Spent 480 on Swiggy" or{'\n'}
                "Zudio 3000, DMart 1000, biryani 250"
            </Text>

            {/* Mic button */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                    style={[
                        styles.micButton,
                        state === 'recording' && styles.micButtonActive,
                        isProcessing && styles.micButtonProcessing,
                    ]}
                    onPress={handleMicPress}
                    disabled={isProcessing}
                >
                    {state === 'recording' 
                        ? <Ionicons name="stop" size={44} color="#fff" />
                        : state === 'processing' 
                            ? <Ionicons name="hourglass" size={44} color={theme.textSecondary} />
                            : <Ionicons name="mic" size={44} color={theme.primary} />
                    }
                </TouchableOpacity>
            </Animated.View>

            <Text style={styles.statusText}>{statusText}</Text>

            {state !== 'idle' && !isProcessing && (
                <TouchableOpacity onPress={reset} style={styles.cancelButton}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            flex: 1, backgroundColor: theme.background,
            alignItems: 'center', justifyContent: 'center', padding: 32,
        },
        title: { fontSize: 24, fontWeight: '700', color: theme.text, marginBottom: 12 },
        hint: {
            fontSize: 15, color: theme.textSecondary, textAlign: 'center',
            lineHeight: 24, marginBottom: 60,
        },
        micButton: {
            width: 120, height: 120, borderRadius: 60,
            backgroundColor: theme.primary + '11', borderWidth: 3, borderColor: theme.primary,
            alignItems: 'center', justifyContent: 'center', marginBottom: 32,
        },
        micButtonActive: { backgroundColor: theme.primary, borderColor: theme.primary },
        micButtonProcessing: { backgroundColor: theme.separator, borderColor: theme.border },
        micIcon: { fontSize: 44 },
        statusText: { fontSize: 16, color: theme.textSecondary, textAlign: 'center', marginBottom: 24 },
        cancelButton: { padding: 12 },
        cancelText: { fontSize: 15, color: theme.danger },
    });
}