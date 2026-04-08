// components/OfflineBanner.tsx
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export default function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(false);
    const translateY = useRef(new Animated.Value(-50)).current;

    useEffect(() => {
        const unsub = NetInfo.addEventListener(state => {
            setIsOffline(!state.isConnected);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        Animated.timing(translateY, {
            toValue: isOffline ? 0 : -50,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [isOffline]);

    return (
        <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
            <Text style={styles.text}>📡 No internet connection</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    banner: {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999,
        backgroundColor: '#ff4444', padding: 10, alignItems: 'center',
    },
    text: { color: '#fff', fontSize: 13, fontWeight: '500' },
});