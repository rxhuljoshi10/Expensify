// hooks/useNotificationPreferences.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFS,
  useSettingsStore,
} from '../store/settingsStore';

const QUERY_KEY = ['notification-preferences'];

/** "21:00:00" → "21:00" */
function trimTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : '';
}

/** Map DB row (snake_case) → JS object (camelCase) */
function dbToPrefs(row: any): NotificationPreferences {
  return {
    dailyReminder: row.daily_reminder ?? DEFAULT_NOTIFICATION_PREFS.dailyReminder,
    dailyReminderTime: trimTime(row.daily_reminder_time) || DEFAULT_NOTIFICATION_PREFS.dailyReminderTime,
    budgetAlerts: row.budget_alerts ?? DEFAULT_NOTIFICATION_PREFS.budgetAlerts,
    recurringReminders: row.recurring_reminders ?? DEFAULT_NOTIFICATION_PREFS.recurringReminders,
    recurringReminderTime: trimTime(row.recurring_reminder_time) || DEFAULT_NOTIFICATION_PREFS.recurringReminderTime,
    weeklySummary: row.weekly_summary ?? DEFAULT_NOTIFICATION_PREFS.weeklySummary,
    spendingInsights: row.spending_insights ?? DEFAULT_NOTIFICATION_PREFS.spendingInsights,
    familyAlerts: row.family_alerts ?? DEFAULT_NOTIFICATION_PREFS.familyAlerts,
    shareWithFamily: row.share_with_family ?? DEFAULT_NOTIFICATION_PREFS.shareWithFamily,
    quietHoursEnabled: row.quiet_hours_enabled ?? DEFAULT_NOTIFICATION_PREFS.quietHoursEnabled,
    quietHoursStart: trimTime(row.quiet_hours_start) || DEFAULT_NOTIFICATION_PREFS.quietHoursStart,
    quietHoursEnd: trimTime(row.quiet_hours_end) || DEFAULT_NOTIFICATION_PREFS.quietHoursEnd,
  };
}

/** Map JS object (camelCase) → DB row (snake_case) */
function prefsToDb(prefs: NotificationPreferences, userId: string) {
  return {
    user_id: userId,
    daily_reminder: prefs.dailyReminder,
    daily_reminder_time: prefs.dailyReminderTime + ':00',
    budget_alerts: prefs.budgetAlerts,
    recurring_reminders: prefs.recurringReminders,
    recurring_reminder_time: prefs.recurringReminderTime + ':00',
    weekly_summary: prefs.weeklySummary,
    spending_insights: prefs.spendingInsights,
    family_alerts: prefs.familyAlerts,
    share_with_family: prefs.shareWithFamily,
    quiet_hours_enabled: prefs.quietHoursEnabled,
    quiet_hours_start: prefs.quietHoursStart + ':00',
    quiet_hours_end: prefs.quietHoursEnd + ':00',
    updated_at: new Date().toISOString(),
  };
}

// ── Fetch notification preferences ────────────────────────────────────
export const useNotificationPreferences = () => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<NotificationPreferences> => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return { ...DEFAULT_NOTIFICATION_PREFS };

      const prefs = dbToPrefs(data);

      // Keep local store in sync for offline / instant access
      useSettingsStore.getState().updateNotificationPreferences(prefs);

      return prefs;
    },
    enabled: !!user,
  });
};

// ── Save notification preferences ─────────────────────────────────────
export const useSaveNotificationPreferences = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: NotificationPreferences) => {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert(prefsToDb(prefs, user!.id), { onConflict: 'user_id' });

      if (error) throw error;

      // Keep local store in sync
      useSettingsStore.getState().updateNotificationPreferences(prefs);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};
