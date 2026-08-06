// app/notification-settings.tsx
import { useState, useEffect } from 'react';
import {
  View, Text, Switch, ScrollView, TouchableOpacity,
  StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, Theme } from '../lib/theme';
import {
  useSettingsStore,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFS,
} from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
} from '../hooks/useNotificationPreferences';
import { useFamilyGroup } from '../hooks/useFamilyGroup';
import {
  registerForPushNotifications,
  unregisterPushToken,
} from '../lib/notifications';
import { toast } from '../lib/toast';

// ── Helpers ───────────────────────────────────────────────────────────
function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function timeToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// ── Component ─────────────────────────────────────────────────────────
export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: group } = useFamilyGroup();

  const { notificationsEnabled, setNotificationsEnabled, smsSyncEnabled, setSmsSyncEnabled } = useSettingsStore();
  const { data: serverPrefs } = useNotificationPreferences();
  const { mutate: savePrefs } = useSaveNotificationPreferences();

  // Local state — initialised from server, updated instantly on toggle
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    ...DEFAULT_NOTIFICATION_PREFS,
  });
  const [activeTimePicker, setActiveTimePicker] = useState<
    keyof NotificationPreferences | null
  >(null);

  // Sync server → local when data arrives
  useEffect(() => {
    if (serverPrefs) setPrefs(serverPrefs);
  }, [serverPrefs]);

  // ── Handlers ────────────────────────────────────────────────────────
  const handlePrefChange = (
    key: keyof NotificationPreferences,
    value: boolean | string,
  ) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    savePrefs(updated);
  };

  const handleMasterToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    if (enabled && user?.id) {
      const token = await registerForPushNotifications(user.id);
      if (!token) {
        toast.error('Could not enable notifications. Check device settings.');
        setNotificationsEnabled(false);
        return;
      }
      toast.success('Notifications enabled');
    } else if (!enabled && user?.id) {
      await unregisterPushToken(user.id);
      toast.success('Notifications disabled');
    }
  };

  const handleTimeChange = (_: any, date: Date | undefined) => {
    if (date && activeTimePicker) {
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      const timeStr = `${h}:${m}`;
      const updated = { ...prefs, [activeTimePicker]: timeStr };
      setPrefs(updated);

      // Android: picker auto-closes → save immediately
      if (Platform.OS === 'android') {
        savePrefs(updated);
        setActiveTimePicker(null);
      }
    } else if (Platform.OS === 'android') {
      // User cancelled the Android dialog
      setActiveTimePicker(null);
    }
  };

  const handlePickerDone = () => {
    savePrefs(prefs);
    setActiveTimePicker(null);
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.heading}>Notifications</Text>
        </View>

        {/* ── Master toggle ── */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: '#03C77522' }]}>
              <Ionicons name="notifications" size={18} color="#03C775" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Push Notifications</Text>
              <Text style={styles.rowDesc}>Enable to receive all alerts</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleMasterToggle}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── SMS Auto-Sync (Android only) ── */}
        {Platform.OS === 'android' && (
          <>
            <Text style={styles.sectionHeader}>SMS Auto-Sync</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: '#6C5CE722' }]}>
                  <Ionicons name="phone-portrait-outline" size={17} color="#6C5CE7" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Auto-detect SMS Expenses</Text>
                  <Text style={styles.rowDesc}>
                    Automatically detect and save expenses from bank transaction SMS
                  </Text>
                </View>
                <Switch
                  value={smsSyncEnabled}
                  onValueChange={(v) => {
                    setSmsSyncEnabled(v);
                    if (v) {
                      toast.success('SMS Auto-Sync enabled');
                    } else {
                      toast.success('SMS Auto-Sync disabled');
                    }
                  }}
                  trackColor={{ false: theme.border, true: '#6C5CE7' }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </>
        )}

        {/* ── Everything below fades when master is off ── */}
        <View
          style={{ opacity: notificationsEnabled ? 1 : 0.35 }}
          pointerEvents={notificationsEnabled ? 'auto' : 'none'}
        >
          {/* ── REMINDERS ── */}
          <Text style={styles.sectionHeader}>Reminders</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: '#F7B73122' }]}>
                <Ionicons name="time-outline" size={17} color="#F7B731" />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Daily Expense Reminder</Text>
                <Text style={styles.rowDesc}>
                  Remind to log expenses at day's end
                </Text>
              </View>
              <Switch
                value={prefs.dailyReminder}
                onValueChange={(v) => handlePrefChange('dailyReminder', v)}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            </View>
            {prefs.dailyReminder && (
              <TouchableOpacity
                style={styles.timeRow}
                onPress={() => setActiveTimePicker('dailyReminderTime')}
              >
                <Text style={styles.timeLabel}>Reminder time</Text>
                <View style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={14} color={theme.primary} />
                  <Text style={styles.timeText}>
                    {formatTimeDisplay(prefs.dailyReminderTime)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: '#FF950022' }]}>
                <Ionicons name="repeat-outline" size={17} color="#FF9500" />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Recurring Due Alerts</Text>
                <Text style={styles.rowDesc}>
                  Morning alert for subscriptions due today
                </Text>
              </View>
              <Switch
                value={prefs.recurringReminders}
                onValueChange={(v) =>
                  handlePrefChange('recurringReminders', v)
                }
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            </View>
            {prefs.recurringReminders && (
              <TouchableOpacity
                style={styles.timeRow}
                onPress={() => setActiveTimePicker('recurringReminderTime')}
              >
                <Text style={styles.timeLabel}>Alert time</Text>
                <View style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={14} color={theme.primary} />
                  <Text style={styles.timeText}>
                    {formatTimeDisplay(prefs.recurringReminderTime)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* ── BUDGET ── */}
          <Text style={styles.sectionHeader}>Budget</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: '#FF6B6B22' }]}>
                <Ionicons name="wallet-outline" size={17} color="#FF6B6B" />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Budget Warnings</Text>
                <Text style={styles.rowDesc}>
                  Alert at 80 % and when budget is exceeded
                </Text>
              </View>
              <Switch
                value={prefs.budgetAlerts}
                onValueChange={(v) => handlePrefChange('budgetAlerts', v)}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* ── INSIGHTS ── */}
          <Text style={styles.sectionHeader}>Insights</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: '#6C63FF22' }]}>
                <Ionicons name="bar-chart-outline" size={17} color="#6C63FF" />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Weekly Summary</Text>
                <Text style={styles.rowDesc}>
                  Sunday evening recap of your spending
                </Text>
              </View>
              <Switch
                value={prefs.weeklySummary}
                onValueChange={(v) => handlePrefChange('weeklySummary', v)}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: '#A29BFE22' }]}>
                <Ionicons name="sparkles-outline" size={17} color="#A29BFE" />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Smart Insights</Text>
                <Text style={styles.rowDesc}>
                  Spending spikes, streaks & celebrations
                </Text>
              </View>
              <Switch
                value={prefs.spendingInsights}
                onValueChange={(v) => handlePrefChange('spendingInsights', v)}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* ── FAMILY (only if user is in a group) ── */}
          {group && (
            <>
              <Text style={styles.sectionHeader}>
                Family · {group.name}
              </Text>
              <View style={styles.card}>
                <View style={styles.row}>
                  <View
                    style={[styles.rowIcon, { backgroundColor: '#FD79A822' }]}
                  >
                    <Ionicons name="people-outline" size={17} color="#FD79A8" />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>Family Expense Alerts</Text>
                    <Text style={styles.rowDesc}>
                      Notify when members add expenses
                    </Text>
                  </View>
                  <Switch
                    value={prefs.familyAlerts}
                    onValueChange={(v) =>
                      handlePrefChange('familyAlerts', v)
                    }
                    trackColor={{ false: theme.border, true: theme.primary }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.row}>
                  <View
                    style={[styles.rowIcon, { backgroundColor: '#4ECDC422' }]}
                  >
                    <Ionicons
                      name="share-outline"
                      size={17}
                      color="#4ECDC4"
                    />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>Share My Expenses</Text>
                    <Text style={styles.rowDesc}>
                      Let family get notified of your expenses
                    </Text>
                  </View>
                  <Switch
                    value={prefs.shareWithFamily}
                    onValueChange={(v) =>
                      handlePrefChange('shareWithFamily', v)
                    }
                    trackColor={{ false: theme.border, true: theme.primary }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            </>
          )}

          {/* ── QUIET HOURS ── */}
          <Text style={styles.sectionHeader}>Do Not Disturb</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: '#4ECDC422' }]}>
                <Ionicons name="moon-outline" size={17} color="#4ECDC4" />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Quiet Hours</Text>
                <Text style={styles.rowDesc}>
                  Pause notifications during set hours
                </Text>
              </View>
              <Switch
                value={prefs.quietHoursEnabled}
                onValueChange={(v) =>
                  handlePrefChange('quietHoursEnabled', v)
                }
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            </View>

            {prefs.quietHoursEnabled && (
              <View style={styles.quietHoursRow}>
                <TouchableOpacity
                  style={styles.quietTimeBlock}
                  onPress={() => setActiveTimePicker('quietHoursStart')}
                >
                  <Text style={styles.quietTimeLabel}>From</Text>
                  <View style={styles.timeBadge}>
                    <Text style={styles.timeText}>
                      {formatTimeDisplay(prefs.quietHoursStart)}
                    </Text>
                  </View>
                </TouchableOpacity>

                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={theme.textSecondary}
                />

                <TouchableOpacity
                  style={styles.quietTimeBlock}
                  onPress={() => setActiveTimePicker('quietHoursEnd')}
                >
                  <Text style={styles.quietTimeLabel}>To</Text>
                  <View style={styles.timeBadge}>
                    <Text style={styles.timeText}>
                      {formatTimeDisplay(prefs.quietHoursEnd)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Time picker (bottom sheet style) ── */}
      {activeTimePicker && (
        <View style={styles.pickerContainer}>
          {Platform.OS === 'ios' && (
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={handlePickerDone}>
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
          <DateTimePicker
            mode="time"
            value={timeToDate(prefs[activeTimePicker] as string)}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
function createStyles(theme: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    scroll: { paddingHorizontal: 16, paddingBottom: 40 },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 16,
    },
    heading: { fontSize: 24, fontWeight: '700', color: theme.text },

    // Section
    sectionHeader: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 8,
      marginTop: 8,
    },

    // Card
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },

    // Row
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowContent: { flex: 1 },
    rowLabel: { fontSize: 15, color: theme.text, fontWeight: '500' },
    rowDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    divider: { height: 1, backgroundColor: theme.border, marginHorizontal: 16 },

    // Time row
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      paddingTop: 4,
      marginLeft: 46,
    },
    timeLabel: { fontSize: 13, color: theme.textSecondary },
    timeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: `${theme.primary}15`,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    timeText: { fontSize: 14, fontWeight: '600', color: theme.primary },

    // Quiet hours
    quietHoursRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 4,
    },
    quietTimeBlock: { alignItems: 'center', gap: 6 },
    quietTimeLabel: { fontSize: 12, color: theme.textSecondary },

    // Time picker
    pickerContainer: {
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderColor: theme.border,
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    pickerDone: { fontSize: 16, fontWeight: '600', color: theme.primary },
  });
}
