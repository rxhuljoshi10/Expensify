// components/DashboardSkeleton.tsx
import { View, StyleSheet } from 'react-native';
import Skeleton from './SkeletonLoader';
import { useTheme } from '../lib/theme';

export default function DashboardSkeleton() {
    const theme = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Skeleton width="50%" height={24} style={styles.gap} />
            <Skeleton width="35%" height={14} style={styles.gap} />
            <View style={styles.row}>
                <Skeleton width="30%" height={72} borderRadius={14} />
                <Skeleton width="30%" height={72} borderRadius={14} />
                <Skeleton width="30%" height={72} borderRadius={14} />
            </View>
            <Skeleton height={120} borderRadius={16} style={styles.gap} />
            <Skeleton height={44} borderRadius={12} style={styles.gap} />
            <Skeleton height={240} borderRadius={16} style={styles.gap} />
            <Skeleton height={200} borderRadius={16} style={styles.gap} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 16 },
    gap: { marginBottom: 16 },
});