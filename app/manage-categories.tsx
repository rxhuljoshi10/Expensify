// app/manage-categories.tsx
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Modal, TextInput, ActivityIndicator, Alert, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserCategories } from '../hooks/useUserCategories';
import { COLOR_CHOICES, ICON_CHOICES } from '../constants/categories';
import { useTheme, Theme } from '../lib/theme';
import { toast } from '../lib/toast';

const { width } = Dimensions.get('window');

export default function ManageCategoriesScreen() {
    const theme = useTheme();
    const styles = createStyles(theme);
    const router = useRouter();

    const {
        categories,
        isLoading,
        addCategory,
        isAdding,
        deleteCategory,
        isDeleting,
        getExpenseCount
    } = useUserCategories();

    // ── Add Category Modal State ──────────────────────────────────────────
    const [showAddModal, setShowAddModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLOR_CHOICES[0]);
    const [selectedIcon, setSelectedIcon] = useState(ICON_CHOICES[0]);
    const [iconSearch, setIconSearch] = useState('');

    // ── Icons already in use by existing categories ───────────────────────
    const usedIcons = new Set(categories.map(c => c.icon));

    const openAddModal = () => {
        // Auto-pick the first available (unused) icon
        const firstFree = ICON_CHOICES.find(ico => !usedIcons.has(ico)) ?? ICON_CHOICES[0];
        setSelectedIcon(firstFree);
        setNewName('');
        setSelectedColor(COLOR_CHOICES[0]);
        setIconSearch('');
        setShowAddModal(true);
    };

    // ── Delete Category Handler ───────────────────────────────────────────
    const handleDelete = async (id: string, name: string) => {
        if (name.toLowerCase() === 'other') {
            toast.error('The "Other" category cannot be deleted.');
            return;
        }

        try {
            const count = await getExpenseCount(name);
            
            const performDelete = async () => {
                try {
                    await deleteCategory({ id, name });
                    toast.success(`Category "${name}" deleted`);
                } catch (e: any) {
                    toast.error(e?.message ?? 'Failed to delete category');
                }
            };

            if (count > 0) {
                Alert.alert(
                    'Delete Category',
                    `"${name}" is currently used by ${count} expense${count === 1 ? '' : 's'}. Deleting it will remap these to "Other". Proceed?`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete & Remap', style: 'destructive', onPress: performDelete }
                    ]
                );
            } else {
                Alert.alert(
                    'Delete Category',
                    `Are you sure you want to delete the category "${name}"?`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: performDelete }
                    ]
                );
            }
        } catch (e: any) {
            toast.error('Could not verify expense dependencies.');
        }
    };

    // ── Add Category Submission ───────────────────────────────────────────
    const handleAddCategory = async () => {
        const cleanName = newName.trim();
        if (!cleanName) {
            toast.error('Category name is required');
            return;
        }
        if (cleanName.toLowerCase() === 'other') {
            toast.error('Cannot create a category named "Other"');
            return;
        }
        if (categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
            toast.error('A category with this name already exists');
            return;
        }
        if (usedIcons.has(selectedIcon)) {
            toast.error('This icon is already used by another category. Please pick a different one.');
            return;
        }

        try {
            await addCategory({ name: cleanName, icon: selectedIcon, color: selectedColor });
            toast.success(`Category "${cleanName}" created`);
            setShowAddModal(false);
        } catch (e: any) {
            toast.error(e?.message ?? 'Failed to create category');
        }
    };

    // ── Filtered Icons ────────────────────────────────────────────────────
    const filteredIcons = ICON_CHOICES.filter(ico => 
        ico.toLowerCase().replace(/-/g, ' ').includes(iconSearch.toLowerCase().trim())
    );

    if (isLoading || isDeleting) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.loadingText}>Updating categories...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Categories</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Hint */}
            <Text style={styles.hintText}>
                Categories are automatically ordered based on your most recently used selection. "Other" is a system fallback and cannot be deleted.
            </Text>

            {/* Category List */}
            <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
                {categories.map((item) => {
                    const isOther = item.name.toLowerCase() === 'other';
                    return (
                        <View key={item.id} style={styles.categoryRow}>
                            {/* Icon Dot */}
                            <View style={[styles.iconCircle, { backgroundColor: item.color + '22' }]}>
                                <Ionicons name={item.icon as any} size={20} color={item.color} />
                            </View>

                            {/* Name */}
                            <Text style={styles.categoryName} numberOfLines={1}>
                                {item.name}
                            </Text>

                            {/* Delete button */}
                            {!isOther ? (
                                <TouchableOpacity
                                    onPress={() => handleDelete(item.id, item.name)}
                                    style={styles.deleteBtn}
                                >
                                    <Ionicons name="trash-outline" size={20} color={theme.danger} />
                                </TouchableOpacity>
                            ) : (
                                <View style={[styles.deleteBtn, { opacity: 0.15 }]}>
                                    <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Add Category Trigger FAB */}
            <TouchableOpacity style={styles.fab} onPress={openAddModal} activeOpacity={0.85}>
                <Ionicons name="add" size={24} color="#fff" />
                <Text style={styles.fabText}>Add Category</Text>
            </TouchableOpacity>

            {/* Add Category Modal */}
            <Modal visible={showAddModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Category</Text>
                            <TouchableOpacity 
                                onPress={() => {
                                    setShowAddModal(false);
                                    setIconSearch('');
                                }} 
                                style={styles.modalCloseBtn}
                            >
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            {/* Name Input */}
                            <Text style={styles.modalLabel}>Category Name</Text>
                            <TextInput
                                style={styles.nameInput}
                                placeholder="e.g. Subscriptions, Pet Care"
                                placeholderTextColor={theme.textSecondary}
                                value={newName}
                                onChangeText={setNewName}
                                maxLength={24}
                            />

                            {/* Color Selector */}
                            <Text style={styles.modalLabel}>Select Color</Text>
                            <View style={styles.colorGrid}>
                                {COLOR_CHOICES.map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.colorBubble, { backgroundColor: c }]}
                                        onPress={() => setSelectedColor(c)}
                                    >
                                        {selectedColor === c && (
                                            <Ionicons name="checkmark" size={18} color="#fff" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Icon Search & Selector */}
                            <View style={styles.iconSectionHeader}>
                                <Text style={styles.modalLabel}>Select Icon</Text>
                                <View style={styles.searchContainer}>
                                    <Ionicons name="search" size={16} color={theme.textSecondary} style={styles.searchIcon} />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search..."
                                        placeholderTextColor={theme.textSecondary}
                                        value={iconSearch}
                                        onChangeText={setIconSearch}
                                    />
                                    {iconSearch.length > 0 && (
                                        <TouchableOpacity onPress={() => setIconSearch('')} style={styles.clearSearchBtn}>
                                            <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Scrollable Icon Area */}
                            <ScrollView 
                                style={styles.iconScrollArea} 
                                contentContainerStyle={styles.iconGrid} 
                                nestedScrollEnabled={true} 
                                showsVerticalScrollIndicator={true}
                            >
                                {filteredIcons.length === 0 ? (
                                    <Text style={styles.noIconsText}>No matching icons found</Text>
                                ) : (
                                    filteredIcons.map(ico => {
                                        const isUsed = usedIcons.has(ico);
                                        const isSelected = selectedIcon === ico;
                                        return (
                                            <TouchableOpacity
                                                key={ico}
                                                style={[
                                                    styles.iconCell,
                                                    isSelected && { backgroundColor: selectedColor + '22', borderColor: selectedColor },
                                                    isUsed && !isSelected && styles.iconCellUsed,
                                                ]}
                                                onPress={() => !isUsed && setSelectedIcon(ico)}
                                                activeOpacity={isUsed ? 1 : 0.7}
                                            >
                                                <Ionicons
                                                    name={ico as any}
                                                    size={22}
                                                    color={isSelected ? selectedColor : isUsed ? theme.border : theme.textSecondary}
                                                />
                                                {isUsed && (
                                                    <View style={styles.iconUsedBadge}>
                                                        <Ionicons name="lock-closed" size={8} color={theme.textSecondary} />
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </ScrollView>

                            {/* Save Button */}
                            <TouchableOpacity
                                style={[styles.saveBtn, isAdding && styles.saveBtnDisabled]}
                                onPress={handleAddCategory}
                                disabled={isAdding}
                            >
                                {isAdding ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save Category</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        loadingContainer: {
            flex: 1,
            backgroundColor: theme.background,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
        },
        loadingText: {
            fontSize: 15,
            color: theme.textSecondary,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 50,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            backgroundColor: theme.surface,
        },
        backBtn: {
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.text,
        },
        hintText: {
            fontSize: 13,
            color: theme.textSecondary,
            lineHeight: 18,
            paddingHorizontal: 24,
            paddingVertical: 16,
            backgroundColor: theme.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        listContainer: {
            padding: 16,
            paddingBottom: 100,
        },
        categoryRow: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            backgroundColor: theme.surface,
            borderRadius: 14,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: theme.border,
        },
        iconCircle: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        categoryName: {
            flex: 1,
            fontSize: 16,
            fontWeight: '600',
            color: theme.text,
        },
        deleteBtn: {
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
        },
        fab: {
            position: 'absolute',
            bottom: 24,
            left: 24,
            right: 24,
            height: 52,
            backgroundColor: theme.primary,
            borderRadius: 26,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 5,
            elevation: 5,
        },
        fabText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '600',
        },
        // Modal Styles
        modalOverlay: {
            flex: 1,
            backgroundColor: '#00000077',
            justifyContent: 'flex-end',
        },
        modalSheet: {
            backgroundColor: theme.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            height: '85%',
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingVertical: 20,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        modalTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: theme.text,
        },
        modalCloseBtn: {
            padding: 4,
        },
        modalScroll: {
            padding: 24,
            paddingBottom: 48,
        },
        modalLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            alignSelf: 'center',
        },
        nameInput: {
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            padding: 14,
            fontSize: 16,
            backgroundColor: theme.inputBg,
            color: theme.text,
            marginBottom: 24,
            marginTop: 8,
        },
        colorGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 24,
            marginTop: 8,
        },
        colorBubble: {
            width: (width - 48 - 48) / 4,
            height: (width - 48 - 48) / 4,
            borderRadius: ((width - 48 - 48) / 4) / 2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        iconSectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.inputBg,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 10,
            paddingHorizontal: 10,
            height: 36,
            width: 160,
        },
        searchIcon: {
            marginRight: 6,
        },
        searchInput: {
            flex: 1,
            fontSize: 14,
            color: theme.text,
            padding: 0,
        },
        clearSearchBtn: {
            padding: 2,
        },
        iconScrollArea: {
            height: 180,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            backgroundColor: theme.inputBg,
            padding: 12,
            marginBottom: 24,
        },
        iconGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            paddingBottom: 16,
        },
        iconCell: {
            width: (width - 48 - 24 - 40) / 5,
            height: (width - 48 - 24 - 40) / 5,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.surface,
        },
        iconCellUsed: {
            opacity: 0.3,
            backgroundColor: theme.background,
        },
        iconUsedBadge: {
            position: 'absolute',
            bottom: 3,
            right: 3,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: theme.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        noIconsText: {
            flex: 1,
            textAlign: 'center',
            color: theme.textSecondary,
            marginTop: 40,
            fontSize: 14,
        },
        saveBtn: {
            backgroundColor: theme.primary,
            borderRadius: 14,
            padding: 16,
            alignItems: 'center',
            marginTop: 8,
        },
        saveBtnDisabled: {
            opacity: 0.6,
        },
        saveBtnText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '600',
        },
    });
}
