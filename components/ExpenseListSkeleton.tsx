// components/ExpenseListSkeleton.tsx
import { View, StyleSheet } from 'react-native';
import Skeleton from './SkeletonLoader';
import { useTheme } from '../lib/theme';

export default function ExpenseListSkeleton() {
    const theme = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {[...Array(6)].map((_, i) => (
                <View key={i} style={[styles.row, { borderColor: theme.border }]}>
                    <Skeleton width={44} height={44} borderRadius={12} />
                    <View style={styles.info}>
                        <Skeleton width="55%" height={14} style={{ marginBottom: 6 }} />
                        <Skeleton width="35%" height={12} />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Skeleton width={60} height={14} style={{ marginBottom: 6 }} />
                        <Skeleton width={40} height={12} />
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12, borderBottomWidth: 0.5 },
    info: { flex: 1 },
});