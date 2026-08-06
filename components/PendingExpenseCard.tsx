// components/PendingExpenseCard.tsx
// Card component for processing a single pending SMS expense.
// Shows amount, raw VPA, timestamp, and provides inputs for naming the merchant.

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../lib/theme';
import { PendingSmsExpense } from '../types/expense';
import { UserCategory } from '../types/expense';

interface Props {
  expense: PendingSmsExpense;
  categories: UserCategory[];
  onSave: (merchantName: string, category: string) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export default function PendingExpenseCard({
  expense,
  categories,
  onSave,
  onSkip,
  isLoading = false,
}: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [merchantName, setMerchantName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const amountRupees = (expense.amount / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const timeStr = new Date(expense.created_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const dateStr = new Date(expense.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

  const canSave = merchantName.trim().length > 0 && selectedCategory;

  const handleSave = () => {
    if (!canSave) return;
    onSave(merchantName.trim(), selectedCategory!);
  };

  return (
    <View style={styles.card}>
      {/* Header — amount and time */}
      <View style={styles.header}>
        <View style={styles.amountRow}>
          <Text style={styles.rupeeSign}>₹</Text>
          <Text style={styles.amount}>{amountRupees}</Text>
        </View>
        <View style={styles.timeContainer}>
          <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.time}>{timeStr} · {dateStr}</Text>
        </View>
      </View>

      {/* Raw VPA info */}
      {expense.raw_vpa && (
        <View style={styles.vpaRow}>
          <Ionicons name="qr-code-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.vpaText} numberOfLines={1}>
            {expense.raw_vpa}
          </Text>
        </View>
      )}

      {/* Merchant name input */}
      <Text style={styles.label}>Where did you spend this?</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Raju Tea Stall, Amazon"
        placeholderTextColor={theme.textSecondary + '80'}
        value={merchantName}
        onChangeText={setMerchantName}
        autoCapitalize="words"
        returnKeyType="done"
        editable={!isLoading}
      />

      {/* Category selection */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryGrid}>
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isSelected ? cat.color + '30' : theme.separator,
                  borderColor: isSelected ? cat.color : 'transparent',
                },
              ]}
              onPress={() => setSelectedCategory(cat.name)}
              disabled={isLoading}
            >
              <Ionicons
                name={cat.icon as any}
                size={16}
                color={isSelected ? cat.color : theme.textSecondary}
              />
              <Text
                style={[
                  styles.categoryName,
                  { color: isSelected ? cat.color : theme.textSecondary },
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          disabled={isLoading}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: canSave ? theme.primary : theme.separator,
              opacity: canSave ? 1 : 0.5,
            },
          ]}
          onPress={handleSave}
          disabled={!canSave || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.saveText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    rupeeSign: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginTop: 2,
    },
    amount: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.text,
      marginLeft: 2,
    },
    timeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.separator,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    time: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    vpaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.separator,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      marginBottom: 16,
    },
    vpaText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontFamily: 'monospace',
      flex: 1,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 8,
      marginTop: 4,
    },
    input: {
      backgroundColor: theme.separator,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      marginBottom: 16,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 20,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1.5,
      gap: 4,
    },
    categoryIcon: {
      fontSize: 14,
    },
    categoryName: {
      fontSize: 12,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
    },
    skipButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: theme.separator,
    },
    skipText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    saveButton: {
      flex: 2,
      flexDirection: 'row',
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    saveText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
  });
}
