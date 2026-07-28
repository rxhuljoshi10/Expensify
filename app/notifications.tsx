import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { useNotifications, AppNotification } from '../hooks/useNotifications';

const ROUTE_MAP: Record<string, string> = {
  add: '/(tabs)/add',
  home: '/(tabs)/home',
  expenses: '/(tabs)/expenses',
  recurring: '/recurring',
  'budget-settings': '/budget-settings',
  'notification-settings': '/notification-settings',
  profile: '/(tabs)/profile',
};

type FilterType = 'all' | 'unread' | 'budget' | 'family' | 'system';

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // ── Filter notifications ─────────────────────────────────────────────
  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.is_read;
    if (activeFilter === 'budget') return n.type === 'budget';
    if (activeFilter === 'family') return n.type === 'family';
    if (activeFilter === 'system') return n.type === 'system' || n.type === 'daily';
    return true;
  });

  // ── Category Icon & Color ─────────────────────────────────────────────
  const getCategoryMeta = (type: string) => {
    switch (type) {
      case 'budget':
        return { icon: 'wallet-outline', color: '#FF4757', bg: '#FF475722' };
      case 'recurring':
        return { icon: 'repeat-outline', color: '#546DE5', bg: '#546DE522' };
      case 'family':
        return { icon: 'people-outline', color: '#778BEB', bg: '#778BEB22' };
      case 'weekly':
        return { icon: 'bar-chart-outline', color: '#2ED573', bg: '#2ED57322' };
      case 'streak':
        return { icon: 'flame-outline', color: '#FFA502', bg: '#FFA50222' };
      default:
        return { icon: 'notifications-outline', color: theme.primary, bg: `${theme.primary}22` };
    }
  };

  // ── Format Date ──────────────────────────────────────────────────────
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  // ── Handle item press ────────────────────────────────────────────────
  const handleItemPress = (item: AppNotification) => {
    if (!item.is_read) {
      markAsRead(item.id);
    }
    if (item.screen) {
      const targetRoute = ROUTE_MAP[item.screen] ?? `/(tabs)/${item.screen}`;
      router.push(targetRoute as any);
    }
  };

  // ── Confirm Clear All ────────────────────────────────────────────────
  const handleConfirmClearAll = () => {
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to delete all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: () => clearAll() },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={() => markAllAsRead()} style={styles.headerActionButton}>
              <Ionicons name="checkmark-done-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleConfirmClearAll} style={styles.headerActionButton}>
              <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filters Bar ─────────────────────────────────────────────────── */}
      <View style={styles.filterContainer}>
        {(['all', 'unread', 'budget', 'family', 'system'] as FilterType[]).map((f) => {
          const isActive = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? theme.primary : theme.cardBg,
                  borderColor: isActive ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setActiveFilter(f)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: isActive ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Notifications List ───────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: `${theme.primary}15` }]}>
                <Ionicons name="notifications-off-outline" size={40} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No notifications
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                You're all caught up! When updates arrive, they will show up here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = getCategoryMeta(item.type);
            return (
              <TouchableOpacity
                style={[
                  styles.card,
                  {
                    backgroundColor: item.is_read ? theme.cardBg : `${theme.primary}0D`,
                    borderColor: item.is_read ? theme.border : `${theme.primary}33`,
                  },
                ]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.cardIcon, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text
                      style={[
                        styles.cardTitle,
                        {
                          color: theme.text,
                          fontWeight: item.is_read ? '600' : '700',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={[styles.cardTime, { color: theme.textSecondary }]}>
                      {formatTime(item.created_at)}
                    </Text>
                  </View>

                  <Text
                    style={[styles.cardText, { color: theme.textSecondary }]}
                    numberOfLines={2}
                  >
                    {item.body}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteNotification(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  unreadBadge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionButton: {
    padding: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  cardTime: {
    fontSize: 11,
  },
  cardText: {
    fontSize: 13,
    lineHeight: 18,
  },
  deleteButton: {
    padding: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
