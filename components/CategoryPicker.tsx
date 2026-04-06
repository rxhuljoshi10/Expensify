// components/CategoryPicker.tsx
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { Category } from '../types/expense';

interface Props {
    selected: Category;
    onSelect: (c: Category) => void;
}

export default function CategoryPicker({ selected, onSelect }: Props) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
            {CATEGORIES.map(cat => (
                <TouchableOpacity
                    key={cat.name}
                    style={[styles.chip, selected === cat.name && { backgroundColor: cat.color }]}
                    onPress={() => onSelect(cat.name)}
                >
                    <Text style={styles.icon}>{cat.icon}</Text>
                    <Text style={[styles.label, selected === cat.name && styles.labelSelected]}>
                        {cat.name}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { marginVertical: 8 },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0',
        marginRight: 8, backgroundColor: '#fff',
    },
    icon: { fontSize: 16 },
    label: { fontSize: 14, color: '#555' },
    labelSelected: { color: '#fff', fontWeight: '600' },
});