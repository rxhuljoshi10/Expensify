import React from 'react';
import { Tabs } from 'expo-router';
// Optional: import an icon set like Ionicons or MaterialCommunityIcons if available,
// but for now we'll just use text labels or default icons.

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: true,
      tabBarActiveTintColor: '#007AFF', // Standard active color
    }}>
      <Tabs.Screen 
        name="home" 
        options={{ 
          title: 'Dashboard', 
          tabBarLabel: 'Home'
        }} 
      />
      <Tabs.Screen 
        name="expenses" 
        options={{ 
          title: 'Expenses', 
          tabBarLabel: 'Expenses'
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Profile', 
          tabBarLabel: 'Profile'
        }} 
      />
    </Tabs>
  );
}
