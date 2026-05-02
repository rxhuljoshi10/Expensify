import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, ActivityIndicator, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useTheme, Theme } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useInsightStore } from '../../store/insightStore';

const QUICK_ACTIONS = [
    { icon: 'trending-down', label: 'Biggest Leaks', color: '#EF4444', query: 'What are my biggest spending categories this month and where am I overspending?' },
    { icon: 'save', label: 'Saving Tips', color: '#10B981', query: 'Based on my spending, give me 3 specific tips to save money this month.' },
    { icon: 'checkmark-circle', label: 'On Track?', color: '#6C63FF', query: 'Compare my spending this month vs last month. Am I on track financially?' },
    { icon: 'calendar', label: 'Weekly Report', color: '#F59E0B', query: 'Give me a summary of my spending this week broken down by category.' },
];

const MAX_HISTORY = 5;

export default function AssistantScreen() {
    const { user } = useAuthStore();
    const router = useRouter();
    const theme = useTheme();
    const styles = createStyles(theme);

    const { isGenerating, triggerGeneration, liveBriefing } = useInsightStore();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showAllHistory, setShowAllHistory] = useState(false);

    const { data: insights = [], isLoading, refetch } = useQuery({
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
        await refetch();
    };

    const toggleExpand = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(prev => (prev === id ? null : id));
    };

    const latestInsight = insights.find(i => i.type === 'coaching_briefing') || insights[0];
    const displayContent = liveBriefing || latestInsight?.content;
    const displayMetadata = latestInsight?.metadata || {};
    const historicalInsights = insights.filter(i => i.id !== latestInsight?.id);
    const visibleHistory = showAllHistory ? historicalInsights : historicalInsights.slice(0, MAX_HISTORY);

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

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isGenerating} onRefresh={handleRefresh} tintColor={theme.primary} />
                }
            >
                {/* Header */}
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

                {/* Main Content */}
                {(isLoading || isGenerating) && !displayContent ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
                ) : displayContent ? (
                    <>
                        {/* Latest Briefing Card */}
                        <View style={styles.heroCard}>
                            <Text style={styles.heroLabel}>LATEST BRIEFING</Text>
                            <Text style={styles.heroContent}>{displayContent}</Text>
                            {displayMetadata.tip && (
                                <View style={styles.tipContainer}>
                                    <Ionicons name="bulb" size={16} color="#EAB308" />
                                    <Text style={styles.tipText}>{displayMetadata.tip}</Text>
                                </View>
                            )}
                        </View>

                        {/* Vital Signs */}
                        <View style={styles.vitalGrid}>
                            {renderVitalSign('Status', displayMetadata.vital_signs?.status?.replace('_', ' ') || 'Analyzing', 'shield-checkmark', '#10B981')}
                            {renderVitalSign('Burn Rate', displayMetadata.vital_signs?.burn_rate || 'Calculating', 'flame', '#F59E0B')}
                            {renderVitalSign('Top Leak', displayMetadata.vital_signs?.top_leak || 'None', 'water', '#3B82F6')}
                            {renderVitalSign('Frequency', 'Daily', 'time', '#8B5CF6')}
                        </View>

                        {/* Anomaly Card */}
                        {displayMetadata.anomaly && (
                            <TouchableOpacity
                                style={styles.anomalyCard}
                                onPress={() => router.push({ pathname: '/ai-bot', params: { initialQuery: `Tell me more about this anomaly: ${displayMetadata.anomaly}` } })}
                            >
                                <View style={styles.anomalyHeader}>
                                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                                    <Text style={styles.anomalyTitle}>AI Observation</Text>
                                </View>
                                <Text style={styles.anomalyText}>{displayMetadata.anomaly}</Text>
                                <Text style={styles.anomalyAction}>Discuss with Assistant →</Text>
                            </TouchableOpacity>
                        )}

                        {/* Quick Actions */}
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Ask Your Coach</Text>
                            <Text style={styles.sectionSubtitle}>Tap to get instant answers</Text>
                            <View style={styles.quickActionsGrid}>
                                {QUICK_ACTIONS.map(action => (
                                    <TouchableOpacity
                                        key={action.label}
                                        style={styles.quickActionCard}
                                        onPress={() => router.push({ pathname: '/ai-bot', params: { initialQuery: action.query } })}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
                                            <Ionicons name={action.icon as any} size={22} color={action.color} />
                                        </View>
                                        <Text style={styles.quickActionLabel}>{action.label}</Text>
                                        <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="rocket-outline" size={64} color={theme.border} />
                        <Text style={styles.emptyText}>Ready to start coaching?</Text>
                        <Text style={styles.emptySubText}>Tap 'Refresh Pulse' to generate your first AI financial briefing.</Text>
                    </View>
                )}

                {/* Previous Sessions */}
                {historicalInsights.length > 0 && (
                    <View style={styles.historySection}>
                        <View style={styles.historySectionHeader}>
                            <Text style={styles.sectionTitle}>Previous Sessions</Text>
                            <Text style={styles.historyCount}>{historicalInsights.length} total</Text>
                        </View>
                        {visibleHistory.map(item => {
                            const isExpanded = expandedId === item.id;
                            const formattedDate = new Date(item.generated_at).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric'
                            });
                            const formattedTime = new Date(item.generated_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit', minute: '2-digit'
                            });
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.historyItem, isExpanded && styles.historyItemExpanded]}
                                    onPress={() => toggleExpand(item.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.historyItemHeader}>
                                        <View style={styles.historyDotContainer}>
                                            <View style={[styles.historyDot, isExpanded && styles.historyDotActive]} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.historyDate}>{formattedDate} · {formattedTime}</Text>
                                            <Text style={styles.historyText} numberOfLines={isExpanded ? undefined : 2}>
                                                {item.content}
                                            </Text>
                                        </View>
                                        <Ionicons
                                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={theme.textSecondary}
                                        />
                                    </View>
                                    {isExpanded && item.metadata?.tip && (
                                        <View style={styles.historyTip}>
                                            <Ionicons name="bulb-outline" size={14} color="#EAB308" />
                                            <Text style={styles.historyTipText}>{item.metadata.tip}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                        {historicalInsights.length > MAX_HISTORY && (
                            <TouchableOpacity
                                style={styles.showMoreBtn}
                                onPress={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setShowAllHistory(prev => !prev);
                                }}
                            >
                                <Text style={styles.showMoreText}>
                                    {showAllHistory ? 'Show Less' : `Show ${historicalInsights.length - MAX_HISTORY} More`}
                                </Text>
                                <Ionicons
                                    name={showAllHistory ? 'chevron-up' : 'chevron-down'}
                                    size={14}
                                    color={theme.primary}
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* FAB */}
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

        // Quick Actions
        sectionContainer: { paddingHorizontal: 16, paddingTop: 8 },
        sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
        sectionSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2, marginBottom: 12 },
        quickActionsGrid: { gap: 10 },
        quickActionCard: {
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderWidth: 1,
            borderColor: theme.border,
        },
        quickActionIcon: { padding: 10, borderRadius: 12 },
        quickActionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.text },

        // History
        historySection: { padding: 16, paddingTop: 24 },
        historySectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
        },
        historyCount: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
        historyItem: {
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 14,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: theme.border,
        },
        historyItemExpanded: {
            borderColor: theme.primary + '50',
        },
        historyItemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
        historyDotContainer: { paddingTop: 5 },
        historyDot: {
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: theme.border,
        },
        historyDotActive: { backgroundColor: theme.primary },
        historyDate: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 },
        historyText: { fontSize: 14, color: theme.text, lineHeight: 20 },
        historyTip: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 6,
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: 1,
            borderColor: theme.border,
        },
        historyTipText: { fontSize: 13, color: theme.textSecondary, flex: 1, lineHeight: 18 },
        showMoreBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 12,
            backgroundColor: theme.primary + '10',
            borderRadius: 12,
            marginTop: 4,
        },
        showMoreText: { fontSize: 14, fontWeight: '700', color: theme.primary },

        // Empty
        emptyContainer: { alignItems: 'center', padding: 40, marginTop: 20 },
        emptyText: { fontSize: 20, fontWeight: '700', color: theme.text, marginTop: 16 },
        emptySubText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },

        // FAB
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