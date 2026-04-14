import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useRouter } from 'expo-router';
import { useFamilyGroup } from '../../hooks/useFamilyGroup';


export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const { data: group } = useFamilyGroup();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.userInfoBox}>
        <Text style={styles.label}>Logged in as:</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push('/family')}
      >
        <Text style={styles.menuIcon}>👨‍👩‍👧‍👦</Text>
        <Text style={styles.menuText}>
          {group ? `Family: ${group.name}` : 'Family group'}
        </Text>
        <Text style={styles.menuArrow}>›</Text>
      </TouchableOpacity>

      {group && (
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/family-dashboard')}
        >
          <Text style={styles.menuIcon}>📊</Text>
          <Text style={styles.menuText}>Family dashboard</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 32,
    marginBottom: 24,
  },
  userInfoBox: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  button: {
    height: 50,
    width: '100%',
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, borderBottomWidth: 0.5, borderColor: '#f0f0f0', gap: 12,
  },
  menuIcon: { fontSize: 22 },
  menuText: { flex: 1, fontSize: 16, color: '#1a1a1a' },
  menuArrow: { fontSize: 20, color: '#ccc' },
});
