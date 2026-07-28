// hooks/useNotifications.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'daily' | 'budget' | 'recurring' | 'weekly' | 'streak' | 'family' | 'system';
  screen?: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { session } = useAuthStore();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  // ── Fetch notifications list ──────────────────────────────────────────
  const notificationsQuery = useQuery<AppNotification[]>({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AppNotification[];
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  // ── Unread count query ────────────────────────────────────────────────
  const unreadCount = (notificationsQuery.data ?? []).filter((n) => !n.is_read).length;

  // ── Mark single notification as read ─────────────────────────────────
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  // ── Mark all as read ──────────────────────────────────────────────────
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  // ── Delete single notification ────────────────────────────────────────
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  // ── Clear all notifications ───────────────────────────────────────────
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  return {
    notifications: notificationsQuery.data ?? [],
    unreadCount,
    isLoading: notificationsQuery.isLoading,
    refetch: notificationsQuery.refetch,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteNotificationMutation.mutate,
    clearAll: clearAllMutation.mutate,
  };
}
