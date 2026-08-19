// components/ExpenseDetailSheet.tsx
// Premium receipt-style bottom sheet shown when the user taps an expense row.
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
    Image, Animated, Platform, StatusBar, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../lib/theme';
import { Expense, ExpenseItem } from '../types/expense';
import { useUserCategories } from '../hooks/useUserCategories';
import { formatAmount } from '../lib/currency';
import { getReceiptSignedUrl } from '../lib/storage';
import { useAuthStore } from '../store/authStore';

interface Props {
    expense: Expense | null;
    onClose: () => void;
    onEdit: (id: string) => void;
    onDelete: (id: string, merchant: string) => void;
}

export default function ExpenseDetailSheet({ expense, onClose, onEdit, onDelete }: Props) {
    const theme = useTheme();
    const styles = createStyles(theme);
    const { user } = useAuthStore();
    const { getCategoryMeta } = useUserCategories();

    const isExpenseOwner = expense?.user_id === user?.id;

    // Track sheet height to dynamically slide down by the right amount
    const sheetHeight = useRef(700);

    // Drive the translation directly for smooth gestural dragging and animations
    const translateY = useRef(new Animated.Value(700)).current;

    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [showImageViewer, setShowImageViewer] = useState(false);

    const visible = !!expense;
    const cat = expense ? getCategoryMeta(expense.category) : null;
    const items: ExpenseItem[] = (expense?.items ?? []) as ExpenseItem[];
    const hasItems = items.length > 0;

    // Start slide-up synchronously before the first paint (no 1-frame delay)
    useLayoutEffect(() => {
        if (visible) {
            translateY.setValue(700);
            Animated.timing(translateY, {
                toValue: 0,
                duration: 260,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    // Prefetch signed URL as soon as expense changes so it's ready when sheet appears
    useEffect(() => {
        if (expense?.attachment_url) {
            getReceiptSignedUrl(expense.attachment_url).then(setSignedUrl);
        } else {
            setSignedUrl(null);
        }
    }, [expense?.id]);

    const handleClose = () => {
        Animated.timing(translateY, {
            toValue: sheetHeight.current,
            duration: 200,
            useNativeDriver: true,
        }).start(() => onClose());
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                translateY.setOffset(0);
            },
            onPanResponderMove: (evt, gestureState) => {
                // Drag down only (dy > 0), resist dragging up (dy < 0)
                if (gestureState.dy > 0) {
                    translateY.setValue(gestureState.dy);
                } else {
                    translateY.setValue(gestureState.dy * 0.15);
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (gestureState.dy > 120 || gestureState.vy > 0.5) {
                    handleClose();
                } else {
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        bounciness: 4,
                    }).start();
                }
            },
        })
    ).current;

    if (!expense || !cat) return null;

    // Backdrop fades in alongside the slide
    const backdropOpacity = translateY.interpolate({
        inputRange: [0, 700],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    // Compute items total (in rupees) for display
    const itemsTotal = items.reduce((sum, item) => {
        return sum + item.amount * (item.quantity ?? 1);
    }, 0);

    const formattedDate = new Date(expense.expense_date).toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    });

    const sourceLabel = expense.source === 'scan' ? '📷 Scanned' : expense.source === 'voice' ? '🎙️ Voice' : '✏️ Manual';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            {/* Animated Backdrop */}
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
            </Animated.View>

            {/* Sheet */}
            <Animated.View 
                style={[styles.sheet, { transform: [{ translateY }] }]}
                onLayout={(e) => {
                    sheetHeight.current = e.nativeEvent.layout.height;
                }}
            >
                {/* Drag handle and fixed header to support sliding gesture */}
                <View {...panResponder.panHandlers} style={styles.dragZone}>
                    {/* Handle */}
                    <View style={styles.handle} />

                    {/* ── Header ── */}
                    <View style={styles.header}>
                        <View style={[styles.catIcon, { backgroundColor: cat.color + '22' }]}>
                            <Ionicons name={cat.icon as any} size={28} color={cat.color} />
                        </View>
                        <View style={styles.headerInfo}>
                            <Text style={styles.merchant} numberOfLines={1}>{expense.merchant}</Text>
                            <View style={styles.metaRow}>
                                <Text style={styles.metaText}>{formattedDate}</Text>
                                <Text style={styles.metaDot}>·</Text>
                                <Text style={[styles.metaText, { color: cat.color }]}>{expense.category}</Text>
                                <Text style={styles.metaDot}>·</Text>
                                <Text style={styles.metaText}>{sourceLabel}</Text>
                            </View>
                        </View>
                        <Text style={styles.totalAmount}>{formatAmount(expense.amount)}</Text>
                    </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

                    {/* ── Note ── */}
                    {!!expense.description && (
                        <View style={styles.noteBox}>
                            <Ionicons name="document-text-outline" size={14} color={theme.textSecondary} />
                            <Text style={styles.noteText}>{expense.description}</Text>
                        </View>
                    )}

                    {/* ── Receipt-style Items List ── */}
                    {hasItems && (
                        <View style={styles.receiptCard}>
                            {/* Receipt header */}
                            <View style={styles.receiptHeader}>
                                <Text style={styles.receiptTitle}>ITEMIZED RECEIPT</Text>
                            </View>

                            {/* Dashed divider */}
                            <View style={styles.dashedLine} />

                            {/* Column headers */}
                            <View style={styles.itemRow}>
                                <Text style={[styles.itemName, styles.colHeader]}>ITEM</Text>
                                <Text style={[styles.itemQty, styles.colHeader]}>QTY</Text>
                                <Text style={[styles.itemPrice, styles.colHeader]}>PRICE</Text>
                                <Text style={[styles.itemTotal, styles.colHeader]}>TOTAL</Text>
                            </View>

                            <View style={styles.dashedLine} />

                            {/* Item rows */}
                            {items.map((item, idx) => {
                                const qty = item.quantity ?? 1;
                                const lineTotal = item.amount * qty;
                                return (
                                    <View key={idx} style={styles.itemRow}>
                                        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                                        <Text style={styles.itemQty}>{qty}</Text>
                                        <Text style={styles.itemPrice}>₹{item.amount.toFixed(0)}</Text>
                                        <Text style={styles.itemTotal}>₹{lineTotal.toFixed(0)}</Text>
                                    </View>
                                );
                            })}

                            <View style={styles.dashedLine} />

                            {/* Total row */}
                            <View style={[styles.itemRow, styles.totalRow]}>
                                <Text style={styles.totalLabel}>TOTAL</Text>
                                <Text style={styles.totalValue}>{formatAmount(expense.amount)}</Text>
                            </View>
                        </View>
                    )}

                    {/* ── Attachment ── */}
                    {signedUrl && (
                        <View style={styles.attachSection}>
                            <Text style={styles.attachLabel}>Receipt Photo</Text>
                            <TouchableOpacity
                                style={styles.attachThumbWrap}
                                onPress={() => setShowImageViewer(true)}
                                activeOpacity={0.85}
                            >
                                <Image source={{ uri: signedUrl }} style={styles.attachThumb} resizeMode="cover" />
                                <View style={styles.attachExpand}>
                                    <Ionicons name="expand" size={14} color="#fff" />
                                    <Text style={styles.attachExpandText}>View full</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ── Actions (only for expense owner) ── */}
                    {isExpenseOwner && (
                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={styles.editBtn}
                                onPress={() => { handleClose(); onEdit(expense.id); }}
                            >
                                <Ionicons name="pencil-outline" size={18} color={theme.primary} />
                                <Text style={styles.editBtnText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.deleteBtn}
                                onPress={() => { handleClose(); onDelete(expense.id, expense.merchant); }}
                            >
                                <Ionicons name="trash-outline" size={18} color={theme.danger} />
                                <Text style={styles.deleteBtnText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </Animated.View>

            {/* Full-screen image viewer */}
            {showImageViewer && signedUrl && (
                <Modal visible transparent animationType="fade" onRequestClose={() => setShowImageViewer(false)}>
                    <SafeAreaView style={styles.imageViewerOverlay}>
                        <StatusBar backgroundColor="#000" barStyle="light-content" />
                        <TouchableOpacity
                            style={styles.imageViewerClose}
                            onPress={() => setShowImageViewer(false)}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons name="close-circle" size={36} color="#fff" />
                        </TouchableOpacity>
                        <Image source={{ uri: signedUrl }} style={styles.imageViewerFull} resizeMode="contain" />
                    </SafeAreaView>
                </Modal>
            )}
        </Modal>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        backdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: '#00000077',
        },
        sheet: {
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            backgroundColor: theme.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingBottom: Platform.OS === 'ios' ? 40 : 28,
            paddingTop: 8,
            maxHeight: '92%',
        },
        dragZone: {
            paddingTop: 4,
            paddingBottom: 0,
        },
        handle: {
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: theme.border,
            alignSelf: 'center',
            marginBottom: 12,
        },

        // Header
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
            gap: 14,
        },
        catIcon: {
            width: 52, height: 52,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
        },
        headerInfo: { flex: 1 },
        merchant: {
            fontSize: 18, fontWeight: '700', color: theme.text,
        },
        metaRow: {
            flexDirection: 'row', alignItems: 'center',
            flexWrap: 'wrap', gap: 4, marginTop: 4,
        },
        metaText: { fontSize: 12, color: theme.textSecondary },
        metaDot: { fontSize: 12, color: theme.border, marginHorizontal: 2 },
        totalAmount: {
            fontSize: 20, fontWeight: '800', color: theme.text, flexShrink: 0,
        },

        // Note
        noteBox: {
            flexDirection: 'row', alignItems: 'flex-start', gap: 8,
            backgroundColor: theme.inputBg,
            borderRadius: 12, padding: 12, marginBottom: 16,
        },
        noteText: { flex: 1, fontSize: 14, color: theme.textSecondary, lineHeight: 20 },

        // Receipt card
        receiptCard: {
            backgroundColor: theme.background,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.border,
        },
        receiptHeader: {
            alignItems: 'center',
            marginBottom: 10,
        },
        receiptTitle: {
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 2,
            color: theme.textSecondary,
        },
        dashedLine: {
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            borderStyle: 'dashed',
            marginVertical: 8,
        },
        colHeader: {
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.5,
            color: theme.textSecondary,
            textTransform: 'uppercase',
        },
        itemRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingVertical: 4,
        },
        itemName: {
            flex: 2.5,
            fontSize: 13,
            color: theme.text,
            paddingRight: 4,
        },
        itemQty: {
            flex: 0.5,
            fontSize: 13,
            color: theme.textSecondary,
            textAlign: 'center',
        },
        itemPrice: {
            flex: 1,
            fontSize: 13,
            color: theme.textSecondary,
            textAlign: 'right',
        },
        itemTotal: {
            flex: 1,
            fontSize: 13,
            fontWeight: '600',
            color: theme.text,
            textAlign: 'right',
        },
        totalRow: {
            paddingTop: 6,
        },
        totalLabel: {
            flex: 1,
            fontSize: 14,
            fontWeight: '800',
            color: theme.text,
            letterSpacing: 1,
        },
        totalValue: {
            fontSize: 16,
            fontWeight: '800',
            color: theme.primary,
        },

        // Attachment
        attachSection: { marginBottom: 16 },
        attachLabel: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
        },
        attachThumbWrap: {
            borderRadius: 12,
            overflow: 'hidden',
            height: 160,
            position: 'relative',
        },
        attachThumb: { width: '100%', height: '100%' },
        attachExpand: {
            position: 'absolute',
            bottom: 8, right: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: '#00000088',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
        },
        attachExpandText: { fontSize: 12, color: '#fff', fontWeight: '600' },

        // Actions
        actions: {
            flexDirection: 'row',
            gap: 12,
            marginTop: 8,
        },
        editBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: theme.primary,
            backgroundColor: theme.primary + '11',
        },
        editBtnText: { fontSize: 15, fontWeight: '600', color: theme.primary },
        deleteBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: theme.danger,
            backgroundColor: theme.danger + '11',
        },
        deleteBtnText: { fontSize: 15, fontWeight: '600', color: theme.danger },

        // Full-screen image viewer
        imageViewerOverlay: {
            flex: 1, backgroundColor: '#000',
            justifyContent: 'center', alignItems: 'center',
        },
        imageViewerClose: {
            position: 'absolute', top: 16, right: 16, zIndex: 10,
        },
        imageViewerFull: { width: '100%', height: '90%' },
    });
}
