// app/edit-expense.tsx
import { useState, useEffect } from 'react';
import { getLocalISODate } from '../lib/date';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
    ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator,
    Modal, StatusBar, SafeAreaView,
} from 'react-native';
import { toast } from '../lib/toast';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useExpenses, useUpdateExpense, useDeleteExpense } from '../hooks/useExpenses';
import CategoryPicker from '../components/CategoryPicker';
import { rupeesToPaise } from '../lib/currency';
import { Category } from '../types/expense';
import { useTheme, Theme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
    uploadReceiptAttachment,
    getReceiptSignedUrl,
    deleteReceiptAttachment,
} from '../lib/storage';
import { useAuthStore } from '../store/authStore';

export default function EditExpenseScreen() {
    const theme = useTheme();
    const styles = createStyles(theme);
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: expenses = [] } = useExpenses();
    const { mutate: updateExpense, isPending } = useUpdateExpense();
    const { mutate: deleteExpense } = useDeleteExpense();
    const { user } = useAuthStore();

    const expense = expenses.find(e => e.id === id);

    const [amount, setAmount] = useState('');
    const [merchant, setMerchant] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<Category>('Food');
    const [date, setDate] = useState(new Date());

    // ── Attachment state ──────────────────────────────────────────────────────
    // existingPath: the path currently stored in the DB (from attachment_url column)
    // newUri / newBase64: newly picked but not-yet-uploaded local image
    // signedUrl: temporary viewable URL for the existing attachment
    // removingExisting: user wants to remove the stored attachment
    const [existingPath, setExistingPath] = useState<string | null>(null);
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [newUri, setNewUri] = useState<string | null>(null);
    const [newBase64, setNewBase64] = useState<string | null>(null);
    const [removingExisting, setRemovingExisting] = useState(false);
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
    const [showImageViewer, setShowImageViewer] = useState(false);

    useEffect(() => {
        if (expense) {
            setAmount(String(expense.amount / 100));
            setMerchant(expense.merchant);
            setDescription(expense.description ?? '');
            setCategory(expense.category);
            setDate(new Date(expense.expense_date));

            const path = expense.attachment_url ?? null;
            setExistingPath(path);
            if (path) {
                getReceiptSignedUrl(path).then(url => setSignedUrl(url));
            }
        }
    }, [expense]);

    if (!expense) {
        return <View style={styles.centered}><Text style={{ color: theme.text }}>Expense not found</Text></View>;
    }

    const handlePickNewAttachment = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1,
        });
        if (result.canceled) return;

        const compressed = await ImageManipulator.manipulateAsync(
            result.assets[0].uri,
            [{ resize: { width: 1200 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        if (!compressed.base64) return;
        setNewUri(compressed.uri);
        setNewBase64(compressed.base64);
        setRemovingExisting(false); // they've replaced instead of removing
    };

    const handleUpdate = () => {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) { toast.error('Please enter a valid amount'); return; }

        const doUpdate = async (storagePath: string | null | undefined) => {
            updateExpense({
                id,
                amount: rupeesToPaise(parsed),
                category,
                merchant: merchant.trim(),
                description: description.trim(),
                expense_date: getLocalISODate(date),
                // undefined → don't touch, null → clear, string → new path
                ...(storagePath !== undefined ? { attachment_url: storagePath } : {}),
            }, {
                onSuccess: () => { toast.success('Expense updated'); router.back(); },
                onError: (e) => { toast.error(e.message); },
            });
        };

        if (newBase64 && user) {
            // Upload new image, optionally delete old
            setIsUploadingAttachment(true);
            uploadReceiptAttachment(user.id, newBase64)
                .then(path => {
                    if (existingPath && !removingExisting) {
                        deleteReceiptAttachment(existingPath).catch(() => {});
                    }
                    return doUpdate(path);
                })
                .catch(() => {
                    toast.error('Failed to upload receipt — saving without it');
                    return doUpdate(undefined);
                })
                .finally(() => setIsUploadingAttachment(false));
        } else if (removingExisting && existingPath) {
            // Delete the existing attachment and clear the field
            deleteReceiptAttachment(existingPath).catch(() => {});
            doUpdate(null);
        } else {
            doUpdate(undefined);
        }
    };

    const handleDelete = () => {
        Alert.alert('Delete expense', `Remove "${expense.merchant}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: () => {
                    if (expense.attachment_url) {
                        deleteReceiptAttachment(expense.attachment_url).catch(() => {});
                    }
                    deleteExpense(id, { onSuccess: () => router.back() });
                }
            },
        ]);
    };

    // Determine what preview to show
    const previewUri = newUri ?? signedUrl;
    const hasAttachment = previewUri && !removingExisting;

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
                <Text style={styles.heading}>Edit expense</Text>

                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput style={styles.amountInput} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={theme.textSecondary} />

                <Text style={styles.label}>Merchant</Text>
                <TextInput style={styles.input} value={merchant} onChangeText={setMerchant} placeholderTextColor={theme.textSecondary} />

                <Text style={styles.label}>Category</Text>
                <CategoryPicker selected={category} onSelect={setCategory} />

                <Text style={styles.label}>Note (optional)</Text>
                <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Any extra detail..." placeholderTextColor={theme.textSecondary} />

                {/* ── Receipt Attachment ── */}
                <Text style={styles.label}>Receipt / Attachment (optional)</Text>
                {hasAttachment ? (
                    <View style={styles.attachmentPreview}>
                        <TouchableOpacity onPress={() => setShowImageViewer(true)} activeOpacity={0.85}>
                            <Image source={{ uri: previewUri! }} style={styles.attachmentThumb} resizeMode="cover" />
                            <View style={styles.attachmentZoomHint}>
                                <Ionicons name="expand" size={12} color="#fff" />
                            </View>
                        </TouchableOpacity>
                        <View style={styles.attachmentInfo}>
                            <Text style={styles.attachmentLabel}>Receipt attached</Text>
                            <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                                <TouchableOpacity onPress={handlePickNewAttachment}>
                                    <Text style={{ fontSize: 13, color: theme.primary }}>Change</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                    setNewUri(null);
                                    setNewBase64(null);
                                    setRemovingExisting(true);
                                }}>
                                    <Text style={styles.attachmentRemove}>Remove</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.attachmentButton} onPress={handlePickNewAttachment} activeOpacity={0.7}>
                        <Ionicons name="attach" size={20} color={theme.primary} />
                        <Text style={styles.attachmentButtonText}>Attach a photo or receipt</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.saveButton, (isPending || isUploadingAttachment) && styles.disabled]}
                    onPress={handleUpdate}
                    disabled={isPending || isUploadingAttachment}
                >
                    {isUploadingAttachment
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.saveButtonText}>{isPending ? 'Saving...' : 'Update Expense'}</Text>
                    }
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                    <Text style={styles.deleteButtonText}>Delete Expense</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* ── Full-screen Image Viewer Modal ── */}
            <Modal
                visible={showImageViewer}
                transparent
                animationType="fade"
                onRequestClose={() => setShowImageViewer(false)}
            >
                <SafeAreaView style={styles.imageViewerOverlay}>
                    <StatusBar backgroundColor="#000" barStyle="light-content" />
                    <TouchableOpacity
                        style={styles.imageViewerClose}
                        onPress={() => setShowImageViewer(false)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Ionicons name="close-circle" size={36} color="#fff" />
                    </TouchableOpacity>
                    <Image
                        source={{ uri: previewUri! }}
                        style={styles.imageViewerFull}
                        resizeMode="contain"
                    />
                </SafeAreaView>
            </Modal>
        </KeyboardAvoidingView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background, padding: 24 },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
        heading: { fontSize: 24, fontWeight: '700', marginBottom: 24, marginTop: 16, color: theme.text },
        label: { fontSize: 13, color: theme.textSecondary, marginBottom: 6, marginTop: 16 },
        amountInput: { fontSize: 40, fontWeight: '700', color: theme.text, borderBottomWidth: 2, borderColor: theme.primary, paddingBottom: 8 },
        input: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: theme.inputBg, color: theme.text },
        saveButton: { backgroundColor: theme.primary, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 32 },
        disabled: { opacity: 0.6 },
        saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
        deleteButton: { borderWidth: 1, borderColor: '#ff4444', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 12, marginBottom: 48 },
        deleteButtonText: { color: '#ff4444', fontSize: 17, fontWeight: '500' },

        // Attachment
        attachmentButton: {
            flexDirection: 'row', alignItems: 'center', gap: 10,
            borderWidth: 1, borderColor: theme.primary + '55', borderStyle: 'dashed',
            borderRadius: 12, padding: 14, backgroundColor: theme.primary + '08',
        },
        attachmentButtonText: { fontSize: 15, color: theme.primary, fontWeight: '500' },
        attachmentPreview: {
            flexDirection: 'row', alignItems: 'center', gap: 12,
            borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 10,
            backgroundColor: theme.inputBg,
        },
        attachmentThumb: { width: 60, height: 60, borderRadius: 8 },
        attachmentZoomHint: {
            position: 'absolute', bottom: 4, right: 4,
            backgroundColor: '#00000066', borderRadius: 4, padding: 2,
        },
        attachmentInfo: { flex: 1 },
        attachmentLabel: { fontSize: 14, fontWeight: '600', color: theme.text },
        attachmentRemove: { fontSize: 13, color: theme.danger },

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