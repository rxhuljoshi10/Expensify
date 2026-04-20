import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { useTheme, Theme } from '../lib/theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
    const theme = useTheme();
    const styles = createStyles(theme);
    const router = useRouter();
    const { user } = useAuthStore();
    
    // Default to the metadata name if it exists somehow, otherwise empty string.
    const [name, setName] = useState<string>(user?.user_metadata?.full_name ?? '');
    
    const [dob, setDob] = useState<Date>(
        user?.user_metadata?.dob ? new Date(user.user_metadata.dob) : new Date(2000, 0, 1) // default dummy date representing some age
    );
    const [showPicker, setShowPicker] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            toast.error('Please enter your full name');
            return;
        }

        setSaving(true);
        try {
            const { error, data } = await supabase.auth.updateUser({
                data: { 
                    full_name: trimmedName,
                    dob: dob.toISOString(),
                }
            });

            if (error) {
                toast.error(error.message);
                setSaving(false);
                return;
            }

            // Successfully updated
            toast.success('Profile created successfully!');
            
            // The router checking logic in _layout.tsx will organically intercept 
            // the state change and route to /(tabs)/home automatically once the store rehydrates, 
            // but we can actively push to be totally safe in case the listener takes a second.
            router.replace('/(tabs)/home');

        } catch (e: any) {
            toast.error(e?.message ?? 'An error occurred');
            setSaving(false);
        }
    };

    const formatDate = (d: Date) => {
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView 
                style={styles.keyboardView} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="person-add" size={40} color={theme.primary} />
                        </View>
                        <Text style={styles.title}>Welcome back!</Text>
                        <Text style={styles.subtitle}>Let's get your profile set up so we can personalize your experience.</Text>
                    </View>

                    <View style={styles.formContext}>
                        <Text style={styles.label}>Full Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="John Doe"
                            placeholderTextColor={theme.textSecondary}
                            value={name}
                            onChangeText={setName}
                            autoFocus={true}
                            autoCapitalize="words"
                            autoCorrect={false}
                        />

                        <Text style={styles.label}>Date of Birth</Text>
                        <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
                            <Text style={{ color: theme.text, fontSize: 16 }}>{formatDate(dob)}</Text>
                        </TouchableOpacity>

                        {showPicker && (
                            <DateTimePicker
                                value={dob}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                maximumDate={new Date()} // Can't be born in the future
                                onChange={(event, selectedDate) => {
                                    if (Platform.OS === 'android') setShowPicker(false);
                                    if (selectedDate) setDob(selectedDate);
                                }}
                            />
                        )}
                        {Platform.OS === 'ios' && showPicker && (
                            <TouchableOpacity style={styles.iosPickerDone} onPress={() => setShowPicker(false)}>
                                <Text style={styles.iosPickerDoneText}>Done</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity 
                        style={[styles.saveButton, saving && styles.disabledButton]} 
                        onPress={handleSave} 
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text style={styles.saveButtonText}>Save Details & Continue</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: theme.background
        },
        keyboardView: {
            flex: 1,
        },
        content: {
            flex: 1,
            padding: 24,
            paddingTop: 48,
        },
        header: {
            alignItems: 'center',
            marginBottom: 40,
        },
        iconContainer: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: theme.surface,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 10,
            elevation: 4,
        },
        title: {
            fontSize: 28,
            fontWeight: '700',
            color: theme.text,
            marginBottom: 10,
            textAlign: 'center'
        },
        subtitle: {
            fontSize: 15,
            color: theme.textSecondary,
            textAlign: 'center',
            lineHeight: 22,
            paddingHorizontal: 12
        },
        formContext: {
            gap: 8,
        },
        label: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.text,
            marginTop: 12,
            marginBottom: 4,
        },
        input: {
            backgroundColor: theme.inputBg,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            color: theme.text,
        },
        saveButton: {
            backgroundColor: theme.primary,
            borderRadius: 14,
            padding: 18,
            alignItems: 'center',
            marginTop: 20,
            marginBottom: Platform.OS === 'ios' ? 10 : 30,
            flexDirection: 'row',
            justifyContent: 'center'
        },
        disabledButton: {
            opacity: 0.7
        },
        saveButtonText: {
            color: '#fff',
            fontSize: 17,
            fontWeight: '600'
        },
        iosPickerDone: {
            alignSelf: 'flex-end',
            paddingVertical: 8,
            paddingHorizontal: 16
        },
        iosPickerDoneText: {
            color: theme.primary,
            fontSize: 16,
            fontWeight: '600'
        }
    });
}
