// app/(tabs)/expenses.tsx
import { useState, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useExpenses, useDeleteExpense } from '../../hooks/useExpenses';
import ExpenseRow from '../../components/ExpenseRow';
import { CATEGORIES } from '../../constants/categories';
import { Category } from '../../types/expense';
import ExpenseListSkeleton from '../../components/ExpenseListSkeleton';
import { useTheme, Theme } from '../../lib/theme';

export default function ExpensesScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { data: expenses = [], isLoading } = useExpenses();
  const { mutate: deleteExpense } = useDeleteExpense();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');

  const filtered = useMemo(() =>
    expenses.filter(e => {
      const matchesSearch = e.merchant.toLowerCase().includes(search.toLowerCase()) ||
        (e.description ?? '').toLowerCase().includes(search.toLowerCase());
      return matchesSearch && (activeCategory === 'All' || e.category === activeCategory);
    }), [expenses, search, activeCategory]);

  const confirmDelete = (id: string, merchant: string) => {
    Alert.alert('Delete expense', `Remove "${merchant}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(id) },
    ]);
  };

  if (isLoading) return <ExpenseListSkeleton />;

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search expenses..."
          placeholderTextColor={theme.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        horizontal
        data={[{ name: 'All', icon: '✨', color: '#6C63FF' }, ...CATEGORIES]}
        keyExtractor={i => i.name}
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, activeCategory === item.name && styles.filterChipActive]}
            onPress={() => setActiveCategory(item.name as Category | 'All')}
          >
            <Text style={[styles.filterChipText, activeCategory === item.name && styles.filterChipTextActive]}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />

      {filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>💸</Text>
          <Text style={styles.emptyText}>No expenses yet</Text>
          <Text style={styles.emptySubtext}>Tap + to add your first one</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => e.id}
          renderItem={({ item }) => (
            <ExpenseRow
              expense={item}
              onPress={() => router.push(`/edit-expense?id=${item.id}`)}
              onLongPress={() => confirmDelete(item.id, item.merchant)}
            />
          )}
        />
      )}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background, paddingTop: 16 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    searchBox: { padding: 16, paddingBottom: 8 },
    searchInput: {
      backgroundColor: theme.inputBg, borderRadius: 12,
      padding: 12, fontSize: 15, color: theme.text,
      borderWidth: 1, borderColor: theme.border,
    },
    filterRow: { paddingLeft: 16, paddingBottom: 8, maxHeight: 44 },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
      backgroundColor: theme.surface, marginRight: 8,
      borderWidth: 1, borderColor: theme.border,
    },
    filterChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    filterChipText: { fontSize: 13, color: theme.textSecondary },
    filterChipTextActive: { color: '#fff' },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 18, fontWeight: '600', color: theme.text },
    emptySubtext: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },
  });
}