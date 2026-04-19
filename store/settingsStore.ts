import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@expensify_settings';

interface SettingsState {
    theme: 'light' | 'dark';
    notificationsEnabled: boolean;
    toggleTheme: () => void;
    setNotificationsEnabled: (enabled: boolean) => void;
    loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    theme: 'dark',
    notificationsEnabled: true,

    toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: next, notificationsEnabled: get().notificationsEnabled }));
    },

    setNotificationsEnabled: (enabled) => {
        set({ notificationsEnabled: enabled });
        AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: get().theme, notificationsEnabled: enabled }));
    },

    loadSettings: async () => {
        try {
            const raw = await AsyncStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const { theme, notificationsEnabled } = JSON.parse(raw);
                set({
                    theme: theme ?? 'dark',
                    notificationsEnabled: notificationsEnabled ?? true,
                });
            }
        } catch (e) {
            // silently fall back to defaults
        }
    },
}));
