// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/theme';

export default function TabsLayout() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopWidth: 0.5,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} active={color === theme.primary} /> }}
      />
      <Tabs.Screen
        name="expenses"
        options={{ title: 'Expenses', tabBarIcon: ({ color }) => <TabIcon emoji="📋" color={color} active={color === theme.primary} /> }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={[styles.addButton, { backgroundColor: theme.primary }]}>
              <View style={styles.plusContainer}>
                <View style={styles.horizontal} />
                <View style={styles.vertical} />
              </View>
            </View>
          ),
          tabBarButton: (props) => (
            <TouchableOpacity
              {...props}
              onPress={() => router.push('/(tabs)/add')}
              style={styles.addButtonWrapper}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} active={color === theme.primary} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, active }: { emoji: string; color: string; active: boolean }) {
  return <Text style={{ fontSize: 20, opacity: active ? 1 : 0.45 }}>{emoji}</Text>;
}

const styles = StyleSheet.create({
  addButtonWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  addButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  plusContainer: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  horizontal: { position: 'absolute', width: 20, height: 2.5, backgroundColor: '#fff' },
  vertical: { position: 'absolute', width: 2.5, height: 20, backgroundColor: '#fff' },
});