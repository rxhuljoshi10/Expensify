import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useTheme, Theme } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';

export default function InsightsScreen() {
    const { user } = useAuthStore();
    const router = useRouter();
    const theme = useTheme();
    const styles = createStyles(theme);

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

    const renderInsight = ({ item }: { item: any }) => {
        const getIconAndColor = () => {
            if (item.type === 'daily_summary') return { icon: 'cloudy-night', color: '#4CAF50' };
            if (item.type === 'weekly_summary') return { icon: 'calendar', color: '#2196F3' };
            return { icon: 'bar-chart', color: '#9C27B0' }; // monthly
        };

        const { icon, color } = getIconAndColor();

        const formattedDate = new Date(item.generated_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });

        // Map type to a presentable label
        const typeLabel = item.type === 'daily_summary' ? 'Daily Insight' 
                         : item.type === 'weekly_summary' ? 'Weekly Insight' 
                         : 'Monthly Insight';

        return (
            <View style={[styles.card, { borderLeftColor: color }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                            <Ionicons name={icon as any} size={18} color={color} />
                        </View>
                        <Text style={styles.cardType}>{typeLabel}</Text>
                    </View>
                    <Text style={styles.cardDate}>{formattedDate}</Text>
                </View>
                <Text style={styles.cardContent}>{item.content}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>AI Insights</Text>
                <Text style={styles.headerSubtitle}>Your spending patterns analyzed</Text>
            </View>

            <FlatList
                data={insights}
                keyExtractor={(item) => item.id}
                renderItem={renderInsight}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
                }
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="sparkles-outline" size={48} color={theme.textSecondary} style={{ marginBottom: 16 }} />
                            <Text style={styles.emptyText}>No insights available yet.</Text>
                            <Text style={styles.emptySubText}>Keep tracking your expenses to generate AI insights.</Text>
                        </View>
                    ) : null
                }
            />

            {/* Floating Action Button */}
            <TouchableOpacity 
                style={styles.fab} 
                onPress={() => router.push('/ai-bot')}
                activeOpacity={0.8}
            >
                <Ionicons name="chatbubbles" size={24} color="#FFF" />
                <Text style={styles.fabText}>Ask AI Assistant</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        safe: { flex: 1, backgroundColor: theme.background },
        header: { padding: 20, paddingBottom: 12, borderBottomWidth: 0.5, borderColor: theme.border },
        headerTitle: { fontSize: 24, fontWeight: '800', color: theme.text },
        headerSubtitle: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },
        listContainer: { padding: 16, paddingBottom: 100 },
        card: {
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.border,
            borderLeftWidth: 4,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
        },
        cardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        cardHeaderLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        iconContainer: {
            padding: 6,
            borderRadius: 8,
        },
        cardType: {
            fontSize: 15,
            fontWeight: '700',
            color: theme.text,
        },
        cardDate: {
            fontSize: 12,
            color: theme.textSecondary,
        },
        cardContent: {
            fontSize: 15,
            color: theme.text,
            lineHeight: 24,
        },
        emptyContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 60,
        },
        emptyText: {
            fontSize: 18,
            fontWeight: '600',
            color: theme.text,
            marginBottom: 8,
        },
        emptySubText: {
            fontSize: 14,
            color: theme.textSecondary,
            textAlign: 'center',
            paddingHorizontal: 32,
            lineHeight: 20,
        },
        fab: {
            position: 'absolute',
            bottom: 24,
            left: 24,
            right: 24,
            backgroundColor: theme.primary,
            borderRadius: 16,
            paddingVertical: 16,
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
        fabText: {
            color: '#FFF',
            fontSize: 16,
            fontWeight: '700',
        },
    });
}