import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to the main home tab
  // If the user isn't logged in, AuthGuard in _layout.tsx will intercept this
  // and send them to the login screen instead.
  return <Redirect href="/(tabs)/home" />;
}
