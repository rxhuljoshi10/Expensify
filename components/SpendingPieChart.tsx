// components/SpendingPieChart.tsx
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

interface Props {
    data: { name: string; total: number; color: string; icon: string }[];
}

const screenWidth = Dimensions.get('window').width;

export default function SpendingPieChart({ data }: Props) {
    if (data.length === 0) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>No data for this period</Text>
            </View>
        );
    }

    const total = data.reduce((s, d) => s + d.total, 0);

    const chartData = data.map(d => ({
        name: d.name,
        population: d.total,
        color: d.color,
        legendFontColor: '#444',
        legendFontSize: 12
    }));

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>By category</Text>
            <PieChart
                data={chartData}
                width={screenWidth - 32}
                height={200}
                chartConfig={{
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                absolute
                hasLegend={false}
            />
            {/* Legend */}
            <View style={styles.legend}>
                {data.map(item => (
                    <View key={item.name} style={styles.legendRow}>
                        <View style={[styles.dot, { backgroundColor: item.color }]} />
                        <Text style={styles.legendLabel} numberOfLines={1}>
                            {item.icon} {item.name}
                        </Text>
                        <Text style={styles.legendAmount}>
                            {Math.round((item.total / total) * 100)}%
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
    heading: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
    empty: { alignItems: 'center', padding: 32 },
    emptyText: { color: '#aaa', fontSize: 14 },
    legend: { marginTop: 8 },
    legendRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 5, gap: 8,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { flex: 1, fontSize: 13, color: '#444' },
    legendAmount: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
});