// components/InsightCard.tsx
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    const theme = useTheme();
    const styles = createStyles(theme);

    const { data: insight } = useQuery({
        queryKey: ['insight', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('insights')
                .select('*')
                .eq('user_id', user!.id)
                .eq('type', 'monthly_summary')
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

    if (!insight) return null;

    return (
        <View style={[styles.card, insight.is_read && styles.cardRead]}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Ionicons name="sparkles" size={18} color={theme.primary} />
                    <Text style={styles.label}>AI Insight</Text>
                    {!insight.is_read && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>NEW</Text>
                        </View>
                    )}
                </View>
                {!insight.is_read && (
                    <TouchableOpacity 
                        onPress={() => markRead(insight.id)} 
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Ionicons name="close" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.content}>{insight.content}</Text>
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
    cardRead: { 
        opacity: 0.6,
        shadowOpacity: 0,
        elevation: 0,
        borderLeftColor: theme.border, 
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
    content: { 
        fontSize: 15, 
        color: theme.text, 
        lineHeight: 24,
        fontWeight: '500',
    },
});