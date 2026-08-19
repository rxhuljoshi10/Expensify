// app/(tabs)/expenses.tsx
import { useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useExpenses, useGroupExpenses, useDeleteExpense } from '../../hooks/useExpenses';
import ExpenseRow from '../../components/ExpenseRow';
import ExpenseDetailSheet from '../../components/ExpenseDetailSheet';
import { useUserCategories } from '../../hooks/useUserCategories';
import { Expense } from '../../types/expense';
import ExpenseListSkeleton from '../../components/ExpenseListSkeleton';
import { useTheme, Theme } from '../../lib/theme';
import { useDashboardStore } from '../../store/dashboardStore';
import { useFamilyGroup } from '../../hooks/useFamilyGroup';
import { useAuthStore } from '../../store/authStore';

type ListItem =
  | { type: 'header'; monthKey: string; label: string; total: number }
  | { type: 'expense'; data: any };

export default function ExpensesScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { user } = useAuthStore();

  const { viewMode: storedViewMode, setViewMode } = useDashboardStore();
  const { data: group } = useFamilyGroup();

  const viewMode = group ? storedViewMode : 'personal';

  useEffect(() => {
    if (!group && storedViewMode === 'group') {
      setViewMode('personal');
    }
  }, [group, storedViewMode, setViewMode]);

  const { data: personalExpenses = [], isLoading: isPersonalLoading } = useExpenses();
  const { data: groupExpenses = [], isLoading: isGroupLoading } = useGroupExpenses(viewMode === 'group');
  const { mutate: deleteExpense } = useDeleteExpense();

  const expenses = viewMode === 'group' ? groupExpenses : personalExpenses;
  const isLoading = viewMode === 'group' ? isGroupLoading : isPersonalLoading;

  const { categories } = useUserCategories();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

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
        const expenseDate = new Date(e.expense_date);
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
      
      const matchesPaymentMode = true;
      return matchesSearch && matchesCategory && matchesTimeline && matchesPaymentMode;
    }), [expenses, search, activeCategory, activeTimelineOption, activePaymentMode]);

  // Grand total of currently filtered expenses
  const filteredTotal = useMemo(
    () => filtered.reduce((sum, e) => sum + e.amount, 0),
    [filtered]
  );

  // Build grouped list: insert month header rows before each new month's expenses
  const groupedList = useMemo((): ListItem[] => {
    const result: ListItem[] = [];
    let currentMonthKey = '';

    // Group expenses by month to compute per-month totals first
    const monthTotals: Record<string, number> = {};
    filtered.forEach(e => {
      const d = new Date(e.expense_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthTotals[key] = (monthTotals[key] ?? 0) + e.amount;
    });

    filtered.forEach(e => {
      const d = new Date(e.expense_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

      if (key !== currentMonthKey) {
        currentMonthKey = key;
        result.push({
          type: 'header',
          monthKey: key,
          label,
          total: monthTotals[key],
        });
      }
      result.push({ type: 'expense', data: e });
    });

    return result;
  }, [filtered]);

  // Whether any filter is narrowing the view to a specific month
  const isMonthFiltered = activeTimelineOption !== 'all';
  const activeMonthLabel = isMonthFiltered
    ? timelineOptions.find(o => o.value === activeTimelineOption)?.label
    : null;

  const confirmDelete = (id: string, merchant: string) => {
    Alert.alert('Delete expense', `Remove "${merchant}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(id) },
    ]);
  };

  if (isLoading) return <ExpenseListSkeleton />;

  return (
    <SafeAreaView style={styles.container}>

      {/* Fixed header */}
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
            data={[{ name: 'All', icon: '✨', color: '#6C63FF' }, ...categories]}
            keyExtractor={i => i.name}
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.filterChip, activeCategory === item.name && styles.filterChipActive]}
                onPress={() => setActiveCategory(item.name)}
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

        {/* Filtered total banner — shown when a specific month (or category) filter is active */}
        {(isMonthFiltered || activeCategory !== 'All') && filtered.length > 0 && (
          <View style={styles.totalBanner}>
            <View>
              <Text style={styles.totalBannerLabel}>
                {activeMonthLabel ?? activeCategory}
                {activeCategory !== 'All' && activeMonthLabel ? ` · ${activeCategory}` : ''}
              </Text>
              <Text style={styles.totalBannerSub}>{filtered.length} transactions</Text>
            </View>
            <Text style={styles.totalBannerAmount}>₹{Math.round(filteredTotal / 100).toLocaleString('en-IN')}</Text>
          </View>
        )}
      </View>

      {/* Expenses list */}
      {filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>💸</Text>
          <Text style={styles.emptyText}>No expenses yet</Text>
          <Text style={styles.emptySubtext}>Tap + to add your first one</Text>
        </View>
      ) : (
        <FlatList
          data={groupedList}
          keyExtractor={(item, index) =>
            item.type === 'header' ? `header-${item.monthKey}` : `expense-${item.data.id}`
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.monthHeader}>
                  <Text style={styles.monthHeaderLabel}>{item.label}</Text>
                  <Text style={styles.monthHeaderTotal}>
                    ₹{Math.round(item.total / 100).toLocaleString('en-IN')}
                  </Text>
                </View>
              );
            }
            const isItemOwner = item.data.user_id === user?.id;
            return (
              <ExpenseRow
                expense={item.data}
                onPress={() => setSelectedExpense(item.data)}
                onLongPress={isItemOwner ? () => confirmDelete(item.data.id, item.data.merchant) : undefined}
              />
            );
          }}
        />
      )}

      {/* Expense Detail Sheet */}
      <ExpenseDetailSheet
        expense={selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onEdit={(id) => {
          if (selectedExpense?.user_id === user?.id) {
            setSelectedExpense(null);
            router.push(`/edit-expense?id=${id}`);
          }
        }}
        onDelete={(id, merchant) => {
          if (selectedExpense?.user_id === user?.id) {
            confirmDelete(id, merchant);
          }
        }}
      />

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

    // Filtered total banner
    totalBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 12,
      marginBottom: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.primary + '15',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.primary + '30',
    },
    totalBannerLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.primary,
    },
    totalBannerSub: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    totalBannerAmount: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.primary,
    },

    // Month separator header
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 6,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    monthHeaderLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    monthHeaderTotal: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
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