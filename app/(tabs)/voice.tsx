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

import { useTheme, Theme } from '../../lib/theme';

export default function VoiceScreen() {
    const theme = useTheme();
    const styles = createStyles(theme);
    const router = useRouter();
    const { state, startRecording, stopRecording, reset } = useVoiceRecorder();
    const { mutate: addExpense } = useAddExpense();
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
            if (!result) {
                toast.error("Couldn't understand that. Try again.");
                reset();
                return;
            }

            // Auto-save the expense
            addExpense({
                amount: rupeesToPaise(result.amount),
                merchant: result.merchant,
                category: result.category as any,
                expense_date: new Date().toISOString(),
                description: '',
            }, {
                onSuccess: () => {
                    toast.success(`₹${result.amount} to ${result.merchant} saved`);
                    reset();
                    router.back();
                },
                onError: (e) => {
                    toast.error(e.message);
                    reset();
                },
            });
        }
    };

    const statusText = {
        idle: 'Tap to speak',
        recording: 'Listening... tap to stop',
        processing: 'Saving expense...',
        done: 'Done!',
        error: 'Something went wrong',
    }[state];

    const isProcessing = state === 'processing';

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Voice input</Text>
            <Text style={styles.hint}>
                Say something like:{'\n'}
                "Spent 480 on Swiggy" or{'\n'}
                "Uber ride 320 rupees"
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
                    <Text style={styles.micIcon}>
                        {state === 'recording' ? '⏹' : state === 'processing' ? '⏳' : '🎤'}
                    </Text>
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