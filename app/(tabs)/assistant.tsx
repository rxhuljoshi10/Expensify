import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useTheme, Theme } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';

import { useInsightStore } from '../../store/insightStore';

export default function AssistantScreen() {
    const { user } = useAuthStore();
    const router = useRouter();
    const theme = useTheme();
    const styles = createStyles(theme);
    const queryClient = useQueryClient();
    
    // Global state
    const { isGenerating, triggerGeneration } = useInsightStore();

    const { data: insights = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['all-insights', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('insights')
                .select('*')
                .eq('user_id', user!.id)
                .order('generated_at', { ascending: false });
            return data || [];
        },
        enabled: !!user,
    });

    const handleRefresh = async () => {
        if (!user) return;
        await triggerGeneration(user.id);
        refetch(); // Invalidate and refetch local query after global generation
    };

    const latestInsight = insights.find(i => i.type === 'coaching_briefing') || insights[0];
    const historicalInsights = insights.filter(i => i.id !== latestInsight?.id);

    const renderVitalSign = (label: string, value: string, icon: string, color: string) => (
        <View style={styles.vitalCard}>
            <View style={[styles.vitalIconContainer, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon as any} size={20} color={color} />
            </View>
            <View>
                <Text style={styles.vitalLabel}>{label}</Text>
                <Text style={styles.vitalValue}>{value}</Text>
            </View>
        </View>
    );

    const renderHistoricalItem = ({ item }: { item: any }) => {
        const formattedDate = new Date(item.generated_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short'
        });
        return (
            <View style={styles.historyItem}>
                <View style={styles.historyDot} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.historyDate}>{formattedDate}</Text>
                    <Text style={styles.historyText} numberOfLines={2}>{item.content}</Text>
                </View>
            </View>
        );
    };

    const metadata = latestInsight?.metadata || {};

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
                }
            >
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Financial Coach</Text>
                        <Text style={styles.headerSubtitle}>AI-powered pulse check</Text>
                    </View>
                    <TouchableOpacity 
                        style={[styles.refreshBtn, isGenerating && styles.disabled]} 
                        onPress={handleRefresh}
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <ActivityIndicator size="small" color={theme.primary} />
                        ) : (
                            <Ionicons name="sparkles" size={20} color={theme.primary} />
                        )}
                        <Text style={styles.refreshBtnText}>{isGenerating ? 'Thinking...' : 'Refresh Pulse'}</Text>
                    </TouchableOpacity>
                </View>

                {isLoading && !isGenerating ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
                ) : latestInsight ? (
                    <>
                        <View style={styles.heroCard}>
                            <Text style={styles.heroLabel}>LATEST BRIEFING</Text>
                            <Text style={styles.heroContent}>{latestInsight.content}</Text>
                            {metadata.tip && (
                                <View style={styles.tipContainer}>
                                    <Ionicons name="bulb" size={16} color="#EAB308" />
                                    <Text style={styles.tipText}>{metadata.tip}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.vitalGrid}>
                            {renderVitalSign('Status', metadata.vital_signs?.status?.replace('_', ' ') || 'Analyzing', 'shield-checkmark', '#10B981')}
                            {renderVitalSign('Burn Rate', metadata.vital_signs?.burn_rate || 'Calculating', 'flame', '#F59E0B')}
                            {renderVitalSign('Top Leak', metadata.vital_signs?.top_leak || 'None', 'water', '#3B82F6')}
                            {renderVitalSign('Frequency', 'Daily', 'time', '#8B5CF6')}
                        </View>

                        {metadata.anomaly && (
                            <TouchableOpacity 
                                style={styles.anomalyCard}
                                onPress={() => router.push({ pathname: '/ai-bot', params: { initialQuery: `Tell me more about this anomaly: ${metadata.anomaly}` } })}
                            >
                                <View style={styles.anomalyHeader}>
                                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                                    <Text style={styles.anomalyTitle}>AI Observation</Text>
                                </View>
                                <Text style={styles.anomalyText}>{metadata.anomaly}</Text>
                                <Text style={styles.anomalyAction}>Discuss with Assistant →</Text>
                            </TouchableOpacity>
                        )}
                    </>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="rocket-outline" size={64} color={theme.border} />
                        <Text style={styles.emptyText}>Ready to start coaching?</Text>
                        <Text style={styles.emptySubText}>Tap 'Refresh Pulse' to generate your first AI financial briefing.</Text>
                    </View>
                )}

                {historicalInsights.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={styles.sectionTitle}>Previous Sessions</Text>
                        {historicalInsights.map(item => (
                            <View key={item.id}>{renderHistoricalItem({ item })}</View>
                        ))}
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity 
                style={styles.fab} 
                onPress={() => router.push('/ai-bot')}
                activeOpacity={0.8}
            >
                <Ionicons name="chatbubbles" size={24} color="#FFF" />
                <Text style={styles.fabText}>Open Coach Chat</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        safe: { flex: 1, backgroundColor: theme.background },
        scrollContent: { paddingBottom: 120 },
        header: { 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: 24,
            paddingBottom: 16
        },
        headerTitle: { fontSize: 28, fontWeight: '800', color: theme.text },
        headerSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
        refreshBtn: { 
            flexDirection: 'row', 
            alignItems: 'center', 
            backgroundColor: theme.primary + '15',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 12,
            gap: 6
        },
        refreshBtnText: { color: theme.primary, fontWeight: '700', fontSize: 13 },
        disabled: { opacity: 0.5 },
        heroCard: {
            backgroundColor: theme.surface,
            margin: 16,
            borderRadius: 24,
            padding: 24,
            borderWidth: 2,
            borderColor: theme.primary,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 4,
        },
        heroLabel: { color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
        heroContent: { color: theme.text, fontSize: 18, fontWeight: '700', lineHeight: 28 },
        tipContainer: { 
            flexDirection: 'row', 
            alignItems: 'center', 
            marginTop: 16, 
            backgroundColor: theme.primary + '10', 
            padding: 12, 
            borderRadius: 12,
            gap: 8
        },
        tipText: { color: theme.text, fontSize: 13, flex: 1, fontWeight: '500' },
        vitalGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            padding: 12,
            gap: 12
        },
        vitalCard: {
            backgroundColor: theme.surface,
            width: '48%',
            padding: 16,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderWidth: 1,
            borderColor: theme.border
        },
        vitalIconContainer: { padding: 8, borderRadius: 12 },
        vitalLabel: { fontSize: 11, color: theme.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
        vitalValue: { fontSize: 15, color: theme.text, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
        anomalyCard: {
            backgroundColor: '#FF4444' + '10',
            margin: 16,
            padding: 20,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#FF4444' + '30',
        },
        anomalyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
        anomalyTitle: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
        anomalyText: { fontSize: 15, color: theme.text, lineHeight: 22, marginBottom: 12 },
        anomalyAction: { fontSize: 14, fontWeight: '700', color: theme.primary },
        historySection: { padding: 24, paddingTop: 16 },
        sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 16 },
        historyItem: { flexDirection: 'row', gap: 16, marginBottom: 20 },
        historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.border, marginTop: 6 },
        historyDate: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 2 },
        historyText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
        emptyContainer: { alignItems: 'center', padding: 40, marginTop: 20 },
        emptyText: { fontSize: 20, fontWeight: '700', color: theme.text, marginTop: 16 },
        emptySubText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
        fab: {
            position: 'absolute',
            bottom: 24,
            left: 24,
            right: 24,
            backgroundColor: theme.primary,
            borderRadius: 20,
            paddingVertical: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
            gap: 10,
        },
        fabText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    });
}