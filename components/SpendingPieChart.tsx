// components/SpendingPieChart.tsx
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { formatAmount } from '../lib/currency';

interface Props {
    data: { name: string; total: number; color: string; icon: string }[];
}

export default function SpendingPieChart({ data }: Props) {
    if (data.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.heading}>By category</Text>
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>No data for this period</Text>
                </View>
            </View>
        );
    }

    const total = data.reduce((s, d) => s + d.total, 0);

    // Donut Chart config
    const size = 200;
    const strokeWidth = 28;
    const center = size / 2;
    const radius = (size - strokeWidth) / 2;
    let currentAngle = 0;

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Distribution</Text>
            
            <View style={styles.chartWrapper}>
                <View style={styles.donutContainer}>
                    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                        <G rotation="-90" origin={`${center}, ${center}`}>
                            {data.map((slice, index) => {
                                if (slice.total === 0) return null;

                                const angle = (slice.total / total) * 360;
                                const startAngle = currentAngle;
                                const endAngle = currentAngle + angle;
                                currentAngle += angle;

                                const polarToCartesian = (cx: number, cy: number, r: number, angleDegrees: number) => {
                                    const angleRadians = (angleDegrees * Math.PI) / 180.0;
                                    return {
                                        x: cx + r * Math.cos(angleRadians),
                                        y: cy + r * Math.sin(angleRadians)
                                    };
                                };

                                if (angle >= 359.9) {
                                    return (
                                        <Circle 
                                            key={index}
                                            cx={center} cy={center} r={radius} 
                                            stroke={slice.color} strokeWidth={strokeWidth} fill="none"
                                        />
                                    );
                                }

                                const start = polarToCartesian(center, center, radius, startAngle);
                                const end = polarToCartesian(center, center, radius, endAngle);
                                const largeArcFlag = angle <= 180 ? "0" : "1";

                                // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
                                const d = [
                                    "M", start.x, start.y,
                                    "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y
                                ].join(" ");

                                return (
                                    <Path 
                                        key={index} 
                                        d={d} 
                                        fill="none" 
                                        stroke={slice.color} 
                                        strokeWidth={strokeWidth} 
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                );
                            })}
                        </G>
                    </Svg>
                    <View style={styles.centerTextContainer}>
                        <Text style={styles.centerLabel}>Total Spent</Text>
                        <Text style={styles.centerAmount}>{formatAmount(total)}</Text>
                    </View>
                </View>
            </View>

            {/* Modern Legend */}
            <View style={styles.legend}>
                {data.map(item => {
                    const percentage = Math.round((item.total / total) * 100);
                    return (
                        <View key={item.name} style={styles.legendItem}>
                            <View style={styles.legendLeft}>
                                <View style={[styles.iconBox, { backgroundColor: `${item.color}20` }]}>
                                    <Text style={styles.legendIcon}>{item.icon}</Text>
                                </View>
                                <Text style={styles.legendLabel} numberOfLines={1}>{item.name}</Text>
                            </View>
                            <View style={styles.legendRight}>
                                <Text style={styles.legendAmount}>{formatAmount(item.total)}</Text>
                                <Text style={[styles.legendPercent, { color: item.color }]}>{percentage}%</Text>
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        backgroundColor: '#fff', 
        borderRadius: 20, 
        padding: 20, 
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    heading: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
    empty: { alignItems: 'center', padding: 32 },
    emptyText: { color: '#aaa', fontSize: 14 },
    chartWrapper: {
        alignItems: 'center',
        marginBottom: 24,
    },
    donutContainer: {
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerTextContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerLabel: {
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '500',
        marginBottom: 4,
    },
    centerAmount: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    legend: { gap: 12 },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    legendLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    legendIcon: { fontSize: 16 },
    legendLabel: { 
        fontSize: 14, 
        color: '#1a1a1a', 
        fontWeight: '500' 
    },
    legendRight: {
        alignItems: 'flex-end',
    },
    legendAmount: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    legendPercent: {
        fontSize: 12,
        fontWeight: '700',
    }
});