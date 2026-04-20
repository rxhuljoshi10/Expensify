// app/_layout.tsx
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import Toast from 'react-native-toast-message';
import OfflineBanner from '../components/OfflineBanner';

const queryClient = new QueryClient();

function AuthGuard() {
  const { session, isLoading, initialize } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const segments = useSegments();
  const router = useRouter();

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
  // Without this, Expo Router shows the login screen briefly
  // even when the user has a valid persisted session.
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard />
      <OfflineBanner />
      <Toast />
    </QueryClientProvider>
  );
}
