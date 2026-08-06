// app/pending-expenses.tsx
// Screen for processing pending SMS expenses one-by-one.
// User can name the merchant, pick a category, then save or skip.

import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, Theme } from '../lib/theme';
import { usePendingExpenses, useResolvePendingExpense, useDismissPendingExpense } from '../hooks/usePendingExpenses';
import { useUserCategories } from '../hooks/useUserCategories';
import PendingExpenseCard from '../components/PendingExpenseCard';
import { toast } from '../lib/toast';

export default function PendingExpensesScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { data: pendingExpenses = [], isLoading } = usePendingExpenses();
  const { categories = [] } = useUserCategories();
  const resolveMutation = useResolvePendingExpense();
  const dismissMutation = useDismissPendingExpense();
  const [processedCount, setProcessedCount] = useState(0);

  // The item to process is ALWAYS the first item in the active queue
  const currentExpense = pendingExpenses[0];
  const remainingCount = pendingExpenses.length;
  const totalCount = processedCount + remainingCount;
  const allDone = !isLoading && remainingCount === 0;

  const handleSave = async (merchantName: string, category: string) => {
    if (!currentExpense) return;

    try {
      await resolveMutation.mutateAsync({
        pendingId: currentExpense.id,
        merchantName,
        category,
      });
      toast.success('Expense saved & merchant remembered!');
      setProcessedCount(c => c + 1);
    } catch (e) {
      toast.error('Failed to save expense');
      console.error('[PendingExpenses] Save failed:', e);
    }
  };

  const handleSkip = async () => {
    if (!currentExpense) return;

    try {
      await dismissMutation.mutateAsync(currentExpense.id);
      setProcessedCount(c => c + 1);
    } catch (e) {
      console.error('[PendingExpenses] Skip failed:', e);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Pending Expenses</Text>
          {!allDone && (
            <Text style={styles.counter}>
              {processedCount + 1} of {totalCount}
            </Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {allDone ? (
          /* All caught up state */
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No pending SMS expenses to review.
            </Text>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: theme.primary }]}
              onPress={() => router.back()}
            >
              <Text style={styles.doneButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        ) : currentExpense ? (
          <>
            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${((processedCount + 1) / totalCount) * 100}%`,
                    backgroundColor: theme.primary,
                  },
                ]}
              />
            </View>

            {/* Instruction text */}
            <Text style={styles.instruction}>
              Name this merchant so we can auto-categorize it next time
            </Text>

            {/* Current pending expense card */}
            <PendingExpenseCard
              expense={currentExpense}
              categories={categories}
              onSave={handleSave}
              onSkip={handleSkip}
              isLoading={resolveMutation.isPending || dismissMutation.isPending}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.separator,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    counter: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingTop: 8,
      paddingBottom: 32,
    },
    progressContainer: {
      height: 4,
      backgroundColor: theme.separator,
      borderRadius: 2,
      marginHorizontal: 16,
      marginBottom: 16,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      borderRadius: 2,
    },
    instruction: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
      marginHorizontal: 32,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
    },
    emptyEmoji: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      marginBottom: 32,
    },
    doneButton: {
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
    },
    doneButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
  });
}
