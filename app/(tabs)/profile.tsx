import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useRouter } from 'expo-router';
import { useFamilyGroup } from '../../hooks/useFamilyGroup';
import { useTheme, Theme } from '../../lib/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
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

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push('/recurring')}
      >
        <Text style={styles.menuIcon}>🔄</Text>
        <Text style={styles.menuText}>Recurring expenses</Text>
        <Text style={styles.menuArrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      marginTop: 32,
      marginBottom: 24,
      color: theme.text,
    },
    userInfoBox: {
      width: '100%',
      backgroundColor: theme.cardBg,
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
      color: theme.textSecondary,
      marginBottom: 4,
    },
    email: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    button: {
      height: 50,
      width: '100%',
      backgroundColor: '#FF3B30',
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    menuItem: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 16, borderBottomWidth: 0.5, borderColor: theme.separator, gap: 12,
      width: '100%',
    },
    menuIcon: { fontSize: 22 },
    menuText: { flex: 1, fontSize: 16, color: theme.text },
    menuArrow: { fontSize: 20, color: theme.textSecondary },
  });
}
