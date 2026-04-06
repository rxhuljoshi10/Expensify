// app/(tabs)/expenses.tsx
import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useExpenses, useDeleteExpense } from '../../hooks/useExpenses';
import ExpenseRow from '../../components/ExpenseRow';
import { CATEGORIES } from '../../constants/categories';
import { Category } from '../../types/expense';

export default function ExpensesScreen() {
  const router = useRouter();
  const { data: expenses = [], isLoading } = useExpenses();
  const { mutate: deleteExpense } = useDeleteExpense();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch =
        e.merchant.toLowerCase().includes(search.toLowerCase()) ||
        (e.description ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === 'All' || e.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, activeCategory]);

  const confirmDelete = (id: string, merchant: string) => {
    Alert.alert(
      'Delete expense',
      `Remove "${merchant}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(id) },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search expenses..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category filter tabs */}
      <FlatList
        horizontal
        data={[{ name: 'All', icon: '✨', color: '#6C63FF' }, ...CATEGORIES]}
        keyExtractor={i => i.name}
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              activeCategory === item.name && styles.filterChipActive,
            ]}
            onPress={() => setActiveCategory(item.name as Category | 'All')}
          >
            <Text style={styles.filterChipText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Expense list */}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchBox: { padding: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: '#f5f5f5', borderRadius: 12,
    padding: 12, fontSize: 15,
  },
  filterRow: { paddingLeft: 16, paddingBottom: 8, maxHeight: 44 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#f0f0f0', marginRight: 8,
  },
  filterChipActive: { backgroundColor: '#6C63FF' },
  filterChipText: { fontSize: 13, color: '#333' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptySubtext: { fontSize: 14, color: '#aaa', marginTop: 4 },
});