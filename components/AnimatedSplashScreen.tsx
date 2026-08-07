// components/AnimatedSplashScreen.tsx
// Lightning-fast animated splash screen with primary green background (#03C775)
// and bottom "Expensify" branding label.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

interface Props {
  isReady: boolean;
  onFinish?: () => void;
}

export default function AnimatedSplashScreen({ isReady, onFinish }: Props) {
  const [animationComplete, setAnimationComplete] = useState(false);

  // Animated values
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelTranslateY = useRef(new Animated.Value(10)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide native OS splash immediately — background color (#03C775) is identical so transition is 100% seamless!
    SplashScreen.hideAsync().catch(() => {});

    // Fast, snappy entrance animation (200ms)
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(labelTranslateY, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Snappy exit transition as soon as app state isReady === true
  useEffect(() => {
    if (!isReady) return;

    Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1.05,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAnimationComplete(true);
      if (onFinish) onFinish();
    });
  }, [isReady]);

  if (animationComplete) return null;

  return (
    <Animated.View
      style={[styles.container, { opacity: containerOpacity }]}
      pointerEvents="none"
    >
      {/* Centered Brand Icon */}
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
        }}
      >
        <Image
          source={require('../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Bottom Branding Label */}
      <SafeAreaView style={styles.bottomContainer}>
        <Animated.View
          style={{
            opacity: labelOpacity,
            transform: [{ translateY: labelTranslateY }],
          }}
        >
          <Text style={styles.brandText}>EXPENSIFY</Text>
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#03C775', // Primary green throughout!
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  logo: {
    width: 140,
    height: 140,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 6,
    textTransform: 'uppercase',
  },
});
