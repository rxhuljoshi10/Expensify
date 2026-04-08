// lib/toast.ts
import Toast from 'react-native-toast-message';

export const toast = {
    success: (message: string) =>
        Toast.show({ type: 'success', text1: message, visibilityTime: 2500 }),

    error: (message: string) =>
        Toast.show({ type: 'error', text1: message, visibilityTime: 3500 }),

    info: (message: string) =>
        Toast.show({ type: 'info', text1: message, visibilityTime: 2500 }),
};