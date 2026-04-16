// app/notification-settings.tsx
import { useState, useEffect } from 'react';
import {
    View, Text, Switch, StyleSheet,
    ScrollView, TouchableOpacity,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from '../lib/toast';
import { scheduleLocalNotification } from '../lib/notifications';

interface Prefs {
    daily_reminder: boolean;
    budget_alerts: boolean;
    reminder_time: string;
}

const DEFAULT_PREFS: Prefs = {
    daily_reminder: true,
    budget_alerts: true,
    reminder_time: '21:00',
};

export default function NotificationSettingsScreen() {
    const { user } = useAuthStore();
    const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // Load saved preferences from users table
        supabase
            .from('users')
            .select('notification_prefs')
            .eq('id', user!.id)
            .single()
            .then(({ data }) => {
                if (data?.notification_prefs) {
                    setPrefs({ ...DEFAULT_PREFS, ...data.notification_prefs });
                }
            });
    }, []);

    const savePrefs = async (updated: Prefs) => {
        setIsSaving(true);
        const { error } = await supabase
            .from('users')
            .update({ notification_prefs: updated })
            .eq('id', user!.id);
        setIsSaving(false);
        if (error) toast.error('Failed to save');
        else toast.success('Preferences saved');
    };

    const toggle = (key: keyof Prefs) => {
        const updated = { ...prefs, [key]: !prefs[key] };
        setPrefs(updated);
        savePrefs(updated);
    };

    const testNotification = async () => {
        await scheduleLocalNotification(
            '💰 Daily reminder',
            "Don't forget to log today's expenses!",
            3
        );
        toast.info('Test notification in 3 seconds');
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.heading}>Notifications</Text>

            {/* Daily reminder toggle */}
            <View style={styles.settingCard}>
                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>Daily reminder</Text>
                        <Text style={styles.settingSubtext}>
                            Reminds you to log expenses at 9 PM if you haven't added any today
                        </Text>
                    </View>
                    <Switch
                        value={prefs.daily_reminder}
                        onValueChange={() => toggle('daily_reminder')}
                        trackColor={{ true: '#6C63FF', false: '#ddd' }}
                        thumbColor="#fff"
                    />
                </View>
            </View>

            {/* Budget alerts toggle */}
            <View style={styles.settingCard}>
                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>Budget alerts</Text>
                        <Text style={styles.settingSubtext}>
                            Alerts when you reach 80% and 100% of your monthly budget
                        </Text>
                    </View>
                    <Switch
                        value={prefs.budget_alerts}
                        onValueChange={() => toggle('budget_alerts')}
                        trackColor={{ true: '#6C63FF', false: '#ddd' }}
                        thumbColor="#fff"
                    />
                </View>
            </View>

            {/* Test notification */}
            <TouchableOpacity style={styles.testButton} onPress={testNotification}>
                <Text style={styles.testButtonText}>Send test notification</Text>
            </TouchableOpacity>

            <Text style={styles.note}>
                Notifications require the app to have been opened at least once on this device.
            </Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f8ff', padding: 20 },
    heading: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginTop: 16, marginBottom: 24 },
    settingCard: {
        backgroundColor: '#fff', borderRadius: 16,
        padding: 16, marginBottom: 12,
    },
    settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    settingInfo: { flex: 1 },
    settingTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
    settingSubtext: { fontSize: 13, color: '#888', lineHeight: 18 },
    testButton: {
        borderWidth: 1.5, borderColor: '#6C63FF', borderRadius: 12,
        padding: 16, alignItems: 'center', marginTop: 8,
    },
    testButtonText: { color: '#6C63FF', fontSize: 15, fontWeight: '600' },
    note: {
        fontSize: 12, color: '#aaa', textAlign: 'center',
        marginTop: 24, lineHeight: 18,
    },
});