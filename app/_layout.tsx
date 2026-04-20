import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import Toast from 'react-native-toast-message';
import OfflineBanner from '../components/OfflineBanner';
import { useTheme } from '../lib/theme';
import { ThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

const queryClient = new QueryClient();

function AuthGuard() {
  const { session, isLoading, initialize } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    loadSettings();
    const unsubscribe = initialize();
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isSetup = segments[0] === 'onboarding';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session) {
      const hasName = !!session.user.user_metadata?.full_name;
      
      if (!hasName && !isSetup) {
        // Needs onboarding
        router.replace('/onboarding');
      } else if (hasName && (inAuthGroup || isSetup)) {
        // Logged in and set up -> go to home 
        router.replace('/(tabs)/home');
      }
    }
  }, [session, isLoading, segments]);

  // Block rendering until we know the auth state.
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

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
