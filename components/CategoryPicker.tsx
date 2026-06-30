// components/CategoryPicker.tsx
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useUserCategories } from '../hooks/useUserCategories';
import { Category } from '../types/expense';
import { useTheme, Theme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Props { selected: Category | null; onSelect: (c: Category) => void; }

export default function CategoryPicker({ selected, onSelect }: Props) {
    const theme = useTheme();
    const styles = createStyles(theme);
    const router = useRouter();
    const { categories, isLoading } = useUserCategories();

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={styles.loadingText}>Loading categories...</Text>
            </View>
        );
    }

    // Shift the selected category to the front of the list
    const sortedCategories = [...categories].sort((a, b) => {
        if (a.name === selected) return -1;
        if (b.name === selected) return 1;
        return 0;
    });

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
            {sortedCategories.map(cat => (
                <TouchableOpacity
                    key={cat.id}
                    style={[styles.chip, selected === cat.name && { backgroundColor: cat.color, borderColor: cat.color }]}
                    onPress={() => onSelect(cat.name)}
                >
                    <Ionicons name={cat.icon as any} size={16} color={selected === cat.name ? '#fff' : cat.color} />
                    <Text style={[styles.label, selected === cat.name && styles.labelSelected]}>{cat.name}</Text>
                </TouchableOpacity>
            ))}

            {/* Manage Categories Button at the end of CategoryPicker list */}
            <TouchableOpacity
                style={[styles.chip, styles.manageChip]}
                onPress={() => router.push('/manage-categories')}
            >
                <Ionicons name="add" size={18} color={theme.primary} />
                <Text style={[styles.label, { color: theme.primary, fontWeight: '600' }]}>Add</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        scroll: { marginVertical: 8 },
        chip: {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 14, paddingVertical: 8,
            borderRadius: 20, borderWidth: 1, borderColor: theme.border,
            marginRight: 8, backgroundColor: theme.surface,
        },
        manageChip: {
            borderColor: theme.primary + '44',
            backgroundColor: theme.primary + '08',
        },
        icon: { fontSize: 16 },
        label: { fontSize: 14, color: theme.textSecondary },
        labelSelected: { color: '#fff', fontWeight: '600' },
        loadingContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 12,
        },
        loadingText: {
            fontSize: 14,
            color: theme.textSecondary,
        },
    });
}