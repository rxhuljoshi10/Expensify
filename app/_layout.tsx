// app/_layout.tsx
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import Toast from 'react-native-toast-message';
import OfflineBanner from '../components/OfflineBanner';

const queryClient = new QueryClient();

function AuthGuard() {
  const { session, isLoading, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Not logged in — send to login
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Already logged in — send to home
      router.replace('/(tabs)/home');
    }
  }, [session, isLoading, segments]);

  return <Slot />;
}

// export default function RootLayout() {
//   return (
//     <QueryClientProvider client={queryClient}>
//       <AuthGuard />
//       <Toast />
//     </QueryClientProvider>
//   );
// }

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard />
      <OfflineBanner />
      <Toast />
    </QueryClientProvider>
  );
}
