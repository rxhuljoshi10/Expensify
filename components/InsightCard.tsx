import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useTheme, Theme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function InsightCard() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const router = useRouter();
    const theme = useTheme();
    const styles = createStyles(theme);

    const { data: insight } = useQuery({
        queryKey: ['insight', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('insights')
                .select('*')
                .eq('user_id', user!.id)
                .eq('is_read', false)
                .order('generated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data;
        },
        enabled: !!user,
    });

    const { mutate: markRead } = useMutation({
        mutationFn: async (id: string) => {
            await supabase.from('insights').update({ is_read: true }).eq('id', id);
        },
        onMutate: () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['insight'] }),
    });

    if (!insight || insight.is_read) return null;

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Ionicons name="sparkles" size={18} color={theme.primary} />
                    <Text style={styles.label}>AI Insight</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>NEW</Text>
                    </View>
                </View>
                <TouchableOpacity 
                    onPress={() => markRead(insight.id)} 
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={styles.closeBtn}
                >
                    <Ionicons name="close" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
            </View>
            <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => router.push('/(tabs)/assistant')}
            >
                <Text style={styles.content}>{insight.content}</Text>
                <View style={styles.readMoreRow}>
                    <Text style={styles.readMoreText}>Read more to view all insights</Text>
                    <Ionicons name="arrow-forward" size={14} color={theme.primary} />
                </View>
            </TouchableOpacity>
        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    card: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: theme.border,
        borderLeftWidth: 4,
        borderLeftColor: theme.primary,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        alignItems: 'center', 
        marginBottom: 12 
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    label: { 
        fontSize: 14, 
        fontWeight: '700', 
        color: theme.primary,
        letterSpacing: 0.3,
    },
    badge: {
        backgroundColor: theme.primary, 
        borderRadius: 12,
        paddingHorizontal: 8, 
        paddingVertical: 3,
        marginLeft: 4,
    },
    badgeText: { 
        color: '#fff', 
        fontSize: 10, 
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    closeBtn: {
        backgroundColor: theme.background,
        borderRadius: 12,
        padding: 4,
    },
    content: { 
        fontSize: 15, 
        color: theme.text, 
        lineHeight: 24,
        fontWeight: '500',
    },
    readMoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        gap: 4
    },
    readMoreText: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.primary,
    }
});