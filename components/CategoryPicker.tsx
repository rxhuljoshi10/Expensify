// components/CategoryPicker.tsx
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { Category } from '../types/expense';
import { useTheme, Theme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';

interface Props { selected: Category; onSelect: (c: Category) => void; }

export default function CategoryPicker({ selected, onSelect }: Props) {
    const theme = useTheme();
    const styles = createStyles(theme);

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
            {CATEGORIES.map(cat => (
                <TouchableOpacity
                    key={cat.name}
                    style={[styles.chip, selected === cat.name && { backgroundColor: cat.color, borderColor: cat.color }]}
                    onPress={() => onSelect(cat.name)}
                >
                    <Ionicons name={cat.icon as any} size={16} color={selected === cat.name ? '#fff' : cat.color} />
                    <Text style={[styles.label, selected === cat.name && styles.labelSelected]}>{cat.name}</Text>
                </TouchableOpacity>
            ))}
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
        icon: { fontSize: 16 },
        label: { fontSize: 14, color: theme.textSecondary },
        labelSelected: { color: '#fff', fontWeight: '600' },
    });
}