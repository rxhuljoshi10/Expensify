// components/SkeletonLoader.tsx
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../lib/theme';

interface Props { width?: number | string; height?: number; borderRadius?: number; style?: ViewStyle; }

export default function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
    const theme = useTheme();
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View
            style={[{ backgroundColor: theme.skeletonBg, width: width as any, height, borderRadius, opacity }, style]}
        />
    );
}