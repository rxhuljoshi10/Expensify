// components/DailyBarChart.tsx
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';

interface Props {
    data: { date: string; total: number; label: string }[];
}

const screenWidth = Dimensions.get('window').width;

export default function DailyBarChart({ data }: Props) {
    const isAllZeros = data.every(d => d.total === 0);

    const labels = data.map(d => d.label);
    const totals = data.map(d => d.total / 100);

    const chartData = {
        labels,
        datasets: [
            {
                data: totals,
            }
        ]
    };

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Last 7 days</Text>
            {isAllZeros ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>No spending this week</Text>
                </View>
            ) : (
                <BarChart
                    data={chartData}
                    width={screenWidth - 32}
                    height={220}
                    yAxisLabel="₹"
                    yAxisSuffix=""
                    chartConfig={{
                        backgroundColor: '#fff',
                        backgroundGradientFrom: '#fff',
                        backgroundGradientTo: '#fff',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(108, 99, 255, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        barPercentage: 0.6,
                        propsForLabels: {
                            fontSize: 10,
                        }
                    }}
                    style={{
                        marginVertical: 8,
                        borderRadius: 16
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
    heading: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
    empty: { alignItems: 'center', padding: 32 },
    emptyText: { color: '#aaa', fontSize: 14 },
});