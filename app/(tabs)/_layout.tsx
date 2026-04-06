// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function TabsLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { borderTopWidth: 0.5, borderTopColor: '#f0f0f0' },
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#aaa',
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }}
      />
      <Tabs.Screen
        name="expenses"
        options={{ title: 'Expenses', tabBarIcon: ({ color }) => <TabIcon emoji="📋" color={color} /> }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.addButton}>
              <View style={styles.addButtonInner} />
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
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20, opacity: color === '#6C63FF' ? 1 : 0.5 }}>{emoji}</Text>;
}

const styles = StyleSheet.create({
  addButtonWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  addButton: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  addButtonInner: {
    width: 20, height: 20,
    borderTopWidth: 2.5, borderLeftWidth: 2.5,
    borderColor: '#fff',
    transform: [{ rotate: '135deg' }],
    marginTop: 4,
  },
});