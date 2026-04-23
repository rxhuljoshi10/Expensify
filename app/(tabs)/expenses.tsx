// app/(tabs)/expenses.tsx
import { useState, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useExpenses, useGroupExpenses, useDeleteExpense } from '../../hooks/useExpenses';
import ExpenseRow from '../../components/ExpenseRow';
import { CATEGORIES } from '../../constants/categories';
import { Category } from '../../types/expense';
import ExpenseListSkeleton from '../../components/ExpenseListSkeleton';
import { useTheme, Theme } from '../../lib/theme';
import { useDashboardStore } from '../../store/dashboardStore';
import { useFamilyGroup } from '../../hooks/useFamilyGroup';

export default function ExpensesScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  const { viewMode, setViewMode } = useDashboardStore();
  const { data: group } = useFamilyGroup();
  const { data: personalExpenses = [], isLoading: isPersonalLoading } = useExpenses();
  const { data: groupExpenses = [], isLoading: isGroupLoading } = useGroupExpenses();
  const { mutate: deleteExpense } = useDeleteExpense();

  const expenses = viewMode === 'group' ? groupExpenses : personalExpenses;
  const isLoading = viewMode === 'group' ? isGroupLoading : isPersonalLoading;

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [expandedFilter, setExpandedFilter] = useState<'Timeline' | 'PaymentMode' | null>(null);
  const [activeTimelineOption, setActiveTimelineOption] = useState<string>('all');
  const [activePaymentMode, setActivePaymentMode] = useState<string>('All');
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const timelineOptions = useMemo(() => {
    const options = [{ label: 'All', value: 'all' }];
    const date = new Date();
    for (let i = 0; i < 4; i++) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      options.push({
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        value: `${d.getFullYear()}-${d.getMonth()}`
      });
    }
    options.push({ label: 'Older Expenses', value: 'older' });
    return options;
  }, []);
  
  const paymentModeOptions = ['All', 'Cash', 'Online', 'Credit/Debit Card'];

  const activeFilterCount = 
    (activeCategory !== 'All' ? 1 : 0) + 
    (activeTimelineOption !== 'all' ? 1 : 0) + 
    (activePaymentMode !== 'All' ? 1 : 0);

  const filtered = useMemo(() =>
    expenses.filter(e => {
      const matchesSearch = e.merchant.toLowerCase().includes(search.toLowerCase()) ||
        (e.description ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'All' || e.category === activeCategory;
      
      let matchesTimeline = true;
      if (activeTimelineOption !== 'all') {
        const expenseDate = new Date(e.expense_date); // Fixed: was e.date previously
        if (activeTimelineOption === 'older') {
          const limitDate = new Date();
          limitDate.setMonth(limitDate.getMonth() - 3);
          limitDate.setDate(1);
          limitDate.setHours(0,0,0,0);
          matchesTimeline = expenseDate < limitDate;
        } else {
          const expenseMonthVal = `${expenseDate.getFullYear()}-${expenseDate.getMonth()}`;
          matchesTimeline = expenseMonthVal === activeTimelineOption;
        }
      }
      
      const matchesPaymentMode = true; // Active but dummy

      return matchesSearch && matchesCategory && matchesTimeline && matchesPaymentMode;
    }), [expenses, search, activeCategory, activeTimelineOption, activePaymentMode]);

  const confirmDelete = (id: string, merchant: string) => {
    Alert.alert('Delete expense', `Remove "${merchant}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(id) },
    ]);
  };

  if (isLoading) return <ExpenseListSkeleton />;

  return (
    <SafeAreaView style={styles.container}>

      {/* Fixed header — never shrinks regardless of list size */}
      <View>
        {group && (
          <View style={styles.viewTogglePadding}>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={viewMode === 'personal' ? styles.activeTab : styles.inactiveTab}
                onPress={() => setViewMode('personal')}
              >
                <Text style={viewMode === 'personal' ? styles.activeTabText : styles.inactiveTabText}>
                  👤 Personal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={viewMode === 'group' ? styles.activeTab : styles.inactiveTab}
                onPress={() => setViewMode('group')}
              >
                <Text style={viewMode === 'group' ? styles.activeTabText : styles.inactiveTabText}>
                  👨‍👩‍👧 {group.name}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search expenses..."
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.filterContainer}>
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
          <TouchableOpacity 
            style={styles.filterButton} 
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="options" size={20} color={theme.text} />
            {activeFilterCount > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable expenses list — takes all remaining space */}
      {filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>💸</Text>
          <Text style={styles.emptyText}>No expenses yet</Text>
          <Text style={styles.emptySubtext}>Tap + to add your first one</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
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
        </View>
      )}
      {/* Filter Modal */}
      <Modal visible={showFilterModal} animationType="slide" transparent={true} onRequestClose={() => setShowFilterModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowFilterModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Filters</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {activeFilterCount > 0 && (
                      <TouchableOpacity 
                        onPress={() => {
                          setActiveCategory('All');
                          setActiveTimelineOption('all');
                          setActivePaymentMode('All');
                        }}
                        style={{ marginRight: 16 }}
                      >
                        <Text style={{ color: theme.primary, fontWeight: '600' }}>Clear</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                      <Ionicons name="close" size={24} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.filterTypeRow} 
                  onPress={() => setExpandedFilter(expandedFilter === 'Timeline' ? null : 'Timeline')}
                >
                  <Text style={styles.filterTypeText}>Timeline</Text>
                  <Ionicons name={expandedFilter === 'Timeline' ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                
                {expandedFilter === 'Timeline' && (
                  <View style={styles.filterOptionsContainer}>
                    {timelineOptions.map(option => (
                      <TouchableOpacity 
                        key={option.value} 
                        style={styles.filterOptionButton}
                        onPress={() => setActiveTimelineOption(option.value)}
                      >
                        <Text style={[styles.filterOptionText, activeTimelineOption === option.value && styles.filterOptionTextActive]}>
                          {option.label}
                        </Text>
                        {activeTimelineOption === option.value && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.filterTypeRow} 
                  onPress={() => setExpandedFilter(expandedFilter === 'PaymentMode' ? null : 'PaymentMode')}
                >
                  <Text style={styles.filterTypeText}>Payment Mode</Text>
                  <Ionicons name={expandedFilter === 'PaymentMode' ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                
                {expandedFilter === 'PaymentMode' && (
                  <View style={styles.filterOptionsContainer}>
                    {paymentModeOptions.map(option => (
                      <TouchableOpacity 
                        key={option} 
                        style={styles.filterOptionButton}
                        onPress={() => setActivePaymentMode(option)}
                      >
                        <Text style={[styles.filterOptionText, activePaymentMode === option && styles.filterOptionTextActive]}>
                          {option}
                        </Text>
                        {activePaymentMode === option && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    searchBox: { padding: 10 },
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
    filterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 10,
    },
    filterButton: {
      padding: 8,
      marginLeft: 8,
      marginBottom: 8,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'
    },
    badgeContainer: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: theme.primary,
      borderRadius: 10,
      width: 18,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: {
      color: 'white',
      fontSize: 10,
      fontWeight: 'bold',
    },
    modalContent: {
      backgroundColor: theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20, paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20
    },
    modalTitle: {
      fontSize: 18, fontWeight: '700', color: theme.text
    },
    filterTypeRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border
    },
    filterTypeText: {
      fontSize: 16, color: theme.text, fontWeight: '500'
    },
    filterOptionsContainer: {
      backgroundColor: theme.cardBg, borderRadius: 12, marginTop: 8, overflow: 'hidden'
    },
    filterOptionButton: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border
    },
    filterOptionText: {
      fontSize: 15, color: theme.textSecondary
    },
    filterOptionTextActive: {
      color: theme.primary, fontWeight: '600'
    },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 18, fontWeight: '600', color: theme.text },
    emptySubtext: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },
    viewTogglePadding: {
      paddingHorizontal: 10,
      paddingTop: 8,
    },
    viewToggle: {
      flexDirection: 'row', backgroundColor: theme.separator,
      borderRadius: 12, padding: 3, marginBottom: 8,
    },
    activeTab: {
      flex: 1, backgroundColor: theme.cardBg, borderRadius: 10,
      paddingVertical: 8, alignItems: 'center',
    },
    activeTabText: { fontSize: 13, fontWeight: '700', color: theme.primary },
    inactiveTab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
    inactiveTabText: { fontSize: 13, color: theme.textSecondary },
  });
}