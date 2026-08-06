// components/PendingExpensesBanner.tsx
// Animated banner on the home page showing count of pending SMS expenses.
// Mimics the existing recurring nudge banner pattern.

import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme, Theme } from '../lib/theme';

interface Props {
  count: number;
}

export default function PendingExpensesBanner({ count }: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Subtle pulse animation on the icon to draw attention
  useEffect(() => {
    if (count <= 0) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => pulse.stop();
  }, [count]);

  if (count <= 0) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => router.push('/pending-expenses')}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Ionicons name="phone-portrait-outline" size={20} color={theme.primary} />
      </Animated.View>
      <Text style={styles.text}>
        📱 {count} pending SMS expense{count > 1 ? 's' : ''} — Tap to review
      </Text>
      <Ionicons name="chevron-forward" size={18} color={theme.primary} />
    </TouchableOpacity>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary + '15',  // 15% opacity primary
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
      gap: 10,
    },
    text: {
      flex: 1,
      fontSize: 14,
      color: theme.primary,
      fontWeight: '500',
    },
  });
}
