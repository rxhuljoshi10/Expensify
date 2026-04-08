// lib/haptics.ts
import * as Haptics from 'expo-haptics';

export const haptics = {
    // Light tap — for selections, filter tabs
    light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

    // Medium — for saving, confirming
    medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

    // Heavy — for deleting, errors
    heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),

    // Success pattern
    success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),

    // Error pattern
    error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};