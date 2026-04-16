// app/_layout.tsx
import { useEffect, useRef } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import Toast from 'react-native-toast-message';
import OfflineBanner from '../components/OfflineBanner';
import * as Notifications from 'expo-notifications';

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

function NotificationHandler() {
  const router = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    // Handle notifications received while app is open
    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
      });

    // Handle notification taps
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        const screen = response.notification.request.content.data?.screen;
        if (screen === 'add') router.push('/(tabs)/add');
        if (screen === 'home') router.push('/(tabs)/home');
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard />
      <NotificationHandler />
      <OfflineBanner />
      <Toast />
    </QueryClientProvider>
  );
}
