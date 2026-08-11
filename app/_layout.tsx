import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {});
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import Toast from 'react-native-toast-message';
import OfflineBanner from '../components/OfflineBanner';
import { useTheme } from '../lib/theme';
import { ThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

const queryClient = new QueryClient();

import { useInsightStore } from '../store/insightStore';
import { supabase } from '../lib/supabase';
import {
  registerForPushNotifications,
  setupNotificationResponseListener,
  getInitialNotificationRoute,
} from '../lib/notifications';
import { useSmsSync } from '../hooks/useSmsSync';

import AnimatedSplashScreen from '../components/AnimatedSplashScreen';

function AuthGuard() {
  const { session, isLoading, initialize } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();
  const { triggerGeneration, isGenerating } = useInsightStore();

  useEffect(() => {
    loadSettings();
    const unsubscribe = initialize();
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  // Global Auto-Trigger Insights Logic
  useEffect(() => {
    if (isLoading || !session?.user?.id || isGenerating) return;

    const checkAndTrigger = async () => {
      const { data: latest } = await supabase
        .from('insights')
        .select('generated_at')
        .eq('user_id', session.user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const shouldTrigger = !latest || 
        (new Date().getTime() - new Date(latest.generated_at).getTime() > 24 * 60 * 60 * 1000);

      if (shouldTrigger) {
        triggerGeneration(session.user.id);
      }
    };

    checkAndTrigger();
  }, [session?.user?.id, isLoading]);

  // Routing Guard: Redirect to login or home/onboarding based on auth session
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isSetup = segments[0] === 'onboarding';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session) {
      const hasName = !!session.user.user_metadata?.full_name;
      
      if (!hasName && !isSetup) {
        router.replace('/onboarding');
      } else if (hasName && (inAuthGroup || isSetup)) {
        router.replace('/(tabs)/home');
      }
    }
  }, [session, isLoading, segments]);

  // Sync user profile to public.users on every app open
  useEffect(() => {
    if (!session?.user) return;
    const { id, email, user_metadata } = session.user;
    const fullName = user_metadata?.full_name;
    if (!fullName) return;

    supabase.from('users').upsert(
      { id, name: fullName, email: email ?? '' },
      { onConflict: 'id' }
    );
  }, [session?.user?.id]);

  useEffect(() => {
    const cleanup = setupNotificationResponseListener((route) => {
      router.push(route as any);
    });

    getInitialNotificationRoute().then((route) => {
      if (route) setTimeout(() => router.push(route as any), 500);
    });

    return cleanup;
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'none',
      }}
    />
  );
}

export default function RootLayout() {
  const theme = useTheme();
  const colorScheme = useSettingsStore(state => state.theme);
  const isDark = colorScheme === 'dark';
  
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    dark: isDark,
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      primary: theme.primary,
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={theme.background} />
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navTheme}>
          <AuthGuard />
          <OfflineBanner />
          <Toast />
        </ThemeProvider>
      </QueryClientProvider>
    </View>
  );
}
