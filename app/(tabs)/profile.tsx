import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, TextInput, Switch, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useRouter } from 'expo-router';
import { useFamilyGroup } from '../../hooks/useFamilyGroup';
import { useTheme, Theme } from '../../lib/theme';

// ── helpers ──────────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ['#6C63FF', '#FF6B6B', '#4ECDC4', '#F7B731', '#A29BFE', '#FD79A8'];

function avatarColor(seed: string) {
  return AVATAR_PALETTE[seed.charCodeAt(0) % AVATAR_PALETTE.length];
}

function initials(name: string, email: string) {
  if (name?.trim()) {
    const p = name.trim().split(' ');
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : p[0][0].toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? '?';
}

function formatDate(d: Date | null) {
  if (!d) return 'Not set';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── component ─────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { user, signOut } = useAuthStore();
  const { theme: colorScheme, toggleTheme, notificationsEnabled, setNotificationsEnabled } = useSettingsStore();
  const router = useRouter();
  const { data: group } = useFamilyGroup();

  const [name, setName] = useState<string>(user?.user_metadata?.full_name ?? '');
  const [editingName, setEditingName] = useState(false);
  const [dob, setDob] = useState<Date | null>(
    user?.user_metadata?.dob ? new Date(user.user_metadata.dob) : null,
  );
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const seed = name || user?.email || 'A';
  const color = avatarColor(seed);
  const avatarText = initials(name, user?.email ?? '');

  // ── handlers ────────────────────────────────────────────────────────────────
  const saveName = async () => {
    if (!name.trim()) { setEditingName(false); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    setSaving(false);
    setEditingName(false);
    if (error) Alert.alert('Error', error.message);
    else Toast.show({ type: 'success', text1: 'Name updated ✓' });
  };

  const saveDOB = async (date: Date) => {
    setDob(date);
    setShowPicker(false);
    const { error } = await supabase.auth.updateUser({ data: { dob: date.toISOString().split('T')[0] } });
    if (error) Alert.alert('Error', error.message);
    else Toast.show({ type: 'success', text1: 'Date of birth saved ✓' });
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  // ── demo rows ────────────────────────────────────────────────────────────────
  const moreItems = [
    {
      icon: 'download-outline' as const,
      label: 'Export Data',
      onPress: () => Alert.alert('Coming Soon', 'CSV export will be available in the next update!'),
    },
    {
      icon: 'shield-checkmark-outline' as const,
      label: 'Privacy Policy',
      onPress: () => Alert.alert('Privacy Policy', 'Your data is stored securely and never sold to third parties.'),
    },
    {
      icon: 'help-circle-outline' as const,
      label: 'Help & Support',
      onPress: () => Alert.alert('Help & Support', 'Contact us at support@expensify.app'),
    },
    {
      icon: 'star-outline' as const,
      label: 'Rate the App',
      onPress: () => Alert.alert('Thank you! ❤️', 'Your support means the world to us.'),
    },
    {
      icon: 'information-circle-outline' as const,
      label: 'App Version',
      onPress: () => Alert.alert('Version', 'Expensify v1.0.0'),
    },
  ];

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + Name ── */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: color }]}>
            <Text style={styles.avatarText}>{avatarText}</Text>
          </View>

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                autoFocus
                placeholder="Your name"
                placeholderTextColor={theme.textSecondary}
                returnKeyType="done"
                onSubmitEditing={saveName}
              />
              <TouchableOpacity
                style={[styles.saveChip, { opacity: saving ? 0.5 : 1 }]}
                onPress={saveName}
                disabled={saving}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelChip}
                onPress={() => setEditingName(false)}
              >
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.nameRow} onPress={() => setEditingName(true)}>
              <Text style={styles.displayName}>{name || 'Tap to add your name'}</Text>
              <Ionicons name="pencil-outline" size={14} color={theme.textSecondary} style={{ marginLeft: 6, marginTop: 2 }} />
            </TouchableOpacity>
          )}

          <Text style={styles.emailLabel}>{user?.email}</Text>
        </View>

        {/* ── Personal Info ── */}
        <Text style={styles.sectionHeader}>Personal Info</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => setEditingName(true)}>
            <View style={[styles.rowIcon, { backgroundColor: '#6C63FF22' }]}>
              <Ionicons name="person-outline" size={17} color={theme.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Full Name</Text>
              <Text style={styles.rowValue}>{name || 'Not set'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={() => setShowPicker(true)}>
            <View style={[styles.rowIcon, { backgroundColor: '#FF6B6B22' }]}>
              <Ionicons name="calendar-outline" size={17} color="#FF6B6B" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Date of Birth</Text>
              <Text style={styles.rowValue}>{formatDate(dob)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: '#4ECDC422' }]}>
              <Ionicons name="mail-outline" size={17} color="#4ECDC4" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {/* ── Account ── */}
        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/family')}>
            <View style={[styles.rowIcon, { backgroundColor: '#FD79A822' }]}>
              <Ionicons name="people-outline" size={17} color="#FD79A8" />
            </View>
            <Text style={[styles.rowContent, styles.rowLabel]}>
              {group ? `Family: ${group.name}` : 'Family Group'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={() => router.push('/recurring')}>
            <View style={[styles.rowIcon, { backgroundColor: '#6C63FF22' }]}>
              <Ionicons name="repeat-outline" size={17} color={theme.primary} />
            </View>
            <Text style={[styles.rowContent, styles.rowLabel]}>Recurring Expenses</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Settings ── */}
        <Text style={styles.sectionHeader}>Settings</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: '#A29BFE22' }]}>
              <Ionicons name={colorScheme === 'dark' ? 'moon' : 'sunny'} size={17} color="#A29BFE" />
            </View>
            <Text style={[styles.rowContent, styles.rowLabel]}>Dark Mode</Text>
            <Switch
              value={colorScheme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: '#F7B73122' }]}>
              <Ionicons name="notifications-outline" size={17} color="#F7B731" />
            </View>
            <Text style={[styles.rowContent, styles.rowLabel]}>Push Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={() => router.push('/budget-settings')}>
            <View style={[styles.rowIcon, { backgroundColor: '#4ECDC422' }]}>
              <Ionicons name="wallet-outline" size={17} color="#4ECDC4" />
            </View>
            <Text style={[styles.rowContent, styles.rowLabel]}>Budget Settings</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── More ── */}
        <Text style={styles.sectionHeader}>More</Text>
        <View style={styles.card}>
          {moreItems.map((item, i) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity style={styles.row} onPress={item.onPress}>
                <View style={[styles.rowIcon, { backgroundColor: `${theme.primary}22` }]}>
                  <Ionicons name={item.icon} size={17} color={theme.primary} />
                </View>
                <Text style={[styles.rowContent, styles.rowLabel]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
              {i < moreItems.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Sign Out ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#FF3B30" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Expensify v1.0.0 · Made with ❤️</Text>
      </ScrollView>

      {/* Date Picker */}
      {showPicker && (
        <DateTimePicker
          mode="date"
          value={dob ?? new Date(2000, 0, 1)}
          maximumDate={new Date()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            if (date) saveDOB(date);
            else setShowPicker(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
function createStyles(theme: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    scroll: { paddingBottom: 40 },

    // Avatar section
    avatarSection: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
    avatar: {
      width: 88, height: 88, borderRadius: 44,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 14,
      shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10,
      elevation: 6,
    },
    avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
    nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    displayName: { fontSize: 22, fontWeight: '700', color: theme.text },
    emailLabel: { fontSize: 14, color: theme.textSecondary, marginTop: 2 },

    // Inline name edit
    nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    nameInput: {
      flex: 1, fontSize: 20, fontWeight: '600', color: theme.text,
      borderBottomWidth: 2, borderBottomColor: theme.primary,
      paddingBottom: 4, paddingHorizontal: 2,
    },
    saveChip: {
      backgroundColor: theme.primary, borderRadius: 20,
      width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    },
    cancelChip: {
      backgroundColor: theme.surface, borderRadius: 20, borderWidth: 1, borderColor: theme.border,
      width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    },

    // Section header
    sectionHeader: {
      fontSize: 12, fontWeight: '700', letterSpacing: 1,
      color: theme.textSecondary, textTransform: 'uppercase',
      marginHorizontal: 16, marginBottom: 8, marginTop: 4,
    },

    // Card
    card: {
      backgroundColor: theme.cardBg, borderRadius: 16,
      marginHorizontal: 16, marginBottom: 20,
      borderWidth: 1, borderColor: theme.border,
      overflow: 'hidden',
    },

    // Row
    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    },
    rowIcon: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    rowContent: { flex: 1 },
    rowLabel: { fontSize: 15, color: theme.text, fontWeight: '500' },
    rowValue: { fontSize: 13, color: theme.textSecondary, marginTop: 1 },

    divider: { height: 1, backgroundColor: theme.border, marginHorizontal: 16 },

    // Sign out
    signOutBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, marginHorizontal: 16, marginTop: 4, marginBottom: 16,
      paddingVertical: 14, borderRadius: 14,
      borderWidth: 1, borderColor: '#FF3B3033',
      backgroundColor: '#FF3B3011',
    },
    signOutText: { fontSize: 15, fontWeight: '600', color: '#FF3B30' },

    footer: { textAlign: 'center', color: theme.textSecondary, fontSize: 12, marginTop: 8 },
  });
}
