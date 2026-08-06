import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@expensify_settings';

// ── Notification preference types ─────────────────────────────────────
export interface NotificationPreferences {
    dailyReminder: boolean;
    dailyReminderTime: string;       // "HH:MM" — default "21:00"
    budgetAlerts: boolean;
    recurringReminders: boolean;
    recurringReminderTime: string;   // "HH:MM" — default "09:00"
    weeklySummary: boolean;
    spendingInsights: boolean;
    familyAlerts: boolean;
    shareWithFamily: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;         // "HH:MM" — default "23:00"
    quietHoursEnd: string;           // "HH:MM" — default "07:00"
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
    dailyReminder: true,
    dailyReminderTime: '21:00',
    budgetAlerts: true,
    recurringReminders: true,
    recurringReminderTime: '09:00',
    weeklySummary: true,
    spendingInsights: true,
    familyAlerts: true,
    shareWithFamily: true,
    quietHoursEnabled: false,
    quietHoursStart: '23:00',
    quietHoursEnd: '07:00',
};

// ── Store interface ───────────────────────────────────────────────────
interface SettingsState {
    theme: 'light' | 'dark';
    notificationsEnabled: boolean;
    notificationPreferences: NotificationPreferences;
    smsSyncEnabled: boolean;
    toggleTheme: () => void;
    setNotificationsEnabled: (enabled: boolean) => void;
    updateNotificationPreferences: (prefs: Partial<NotificationPreferences>) => void;
    setSmsSyncEnabled: (enabled: boolean) => void;
    loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    theme: 'dark',
    notificationsEnabled: true,
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFS },
    smsSyncEnabled: false,

    toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        persist(get());
    },

    setNotificationsEnabled: (enabled) => {
        set({ notificationsEnabled: enabled });
        persist(get());
    },

    updateNotificationPreferences: (prefs) => {
        const updated = { ...get().notificationPreferences, ...prefs };
        set({ notificationPreferences: updated });
        persist(get());
    },

    setSmsSyncEnabled: (enabled) => {
        set({ smsSyncEnabled: enabled });
        persist(get());
    },

    loadSettings: async () => {
        try {
            const raw = await AsyncStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                set({
                    theme: parsed.theme ?? 'dark',
                    notificationsEnabled: parsed.notificationsEnabled ?? true,
                    notificationPreferences: {
                        ...DEFAULT_NOTIFICATION_PREFS,
                        ...(parsed.notificationPreferences ?? {}),
                    },
                    smsSyncEnabled: parsed.smsSyncEnabled ?? false,
                });
            }
        } catch (e) {
            // silently fall back to defaults
        }
    },
}));

function persist(state: SettingsState) {
    AsyncStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
            theme: state.theme,
            notificationsEnabled: state.notificationsEnabled,
            notificationPreferences: state.notificationPreferences,
            smsSyncEnabled: state.smsSyncEnabled,
        }),
    );
}
