// components/SpendingPieChart.tsx
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { formatAmount } from '../lib/currency';
import { useTheme, Theme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    data: { name: string; total: number; color: string; icon: string }[];
}

export default function SpendingPieChart({ data }: Props) {
    const theme = useTheme();
    const styles = createStyles(theme);
    const [expanded, setExpanded] = useState(false);

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

    // Sort data from highest to lowest
    const sortedData = [...data]
        .filter(d => d.total > 0)
        .sort((a, b) => b.total - a.total);

    const displayData = expanded ? sortedData : sortedData.slice(0, 3);

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
                            {sortedData.map((slice, index) => {
                                const angle = (slice.total / total) * 360;
                                const startAngle = currentAngle;
                                const endAngle = currentAngle + angle;
                                currentAngle += angle;

                                const polarToCartesian = (cx: number, cy: number, r: number, angleDegrees: number) => {
                                    const angleRadians = (angleDegrees * Math.PI) / 180.0;
                                    return { x: cx + r * Math.cos(angleRadians), y: cy + r * Math.sin(angleRadians) };
                                };

                                if (angle >= 359.9) {
                                    return <Circle key={index} cx={center} cy={center} r={radius} stroke={slice.color} strokeWidth={strokeWidth} fill="none" />;
                                }

                                const start = polarToCartesian(center, center, radius, startAngle);
                                const end = polarToCartesian(center, center, radius, endAngle);
                                const largeArcFlag = angle <= 180 ? "0" : "1";
                                const d = ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y].join(" ");

                                return <Path key={index} d={d} fill="none" stroke={slice.color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
                            })}
                        </G>
                    </Svg>
                    <View style={styles.centerTextContainer}>
                        <Text style={styles.centerLabel}>Total Spent</Text>
                        <Text style={styles.centerAmount}>{formatAmount(total)}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.legend}>
                {displayData.map(item => {
                    const percentage = Math.round((item.total / total) * 100);
                    return (
                        <View key={item.name} style={styles.legendItem}>
                            <View style={styles.legendLeft}>
                                <View style={[styles.iconBox, { backgroundColor: `${item.color}20` }]}>
                                    <Ionicons name={item.icon as any} size={16} color={item.color} />
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

            {sortedData.length > 3 && (
                <TouchableOpacity 
                    style={styles.seeMoreButton} 
                    onPress={() => setExpanded(!expanded)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.seeMoreText}>
                        {expanded ? 'See less' : `See all categories (${sortedData.length})`}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            backgroundColor: theme.cardBg,
            borderRadius: 20, padding: 20, marginBottom: 16,
            shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 }, elevation: 2,
        },
        heading: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 20 },
        empty: { alignItems: 'center', padding: 32 },
        emptyText: { color: theme.textSecondary, fontSize: 14 },
        chartWrapper: { alignItems: 'center', marginBottom: 24 },
        donutContainer: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
        centerTextContainer: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
        centerLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: '500', marginBottom: 4 },
        centerAmount: { fontSize: 18, fontWeight: '700', color: theme.text },
        legend: { gap: 12 },
        legendItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
        legendLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
        iconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
        legendIcon: { fontSize: 16 },
        legendLabel: { fontSize: 14, color: theme.text, fontWeight: '500' },
        legendRight: { alignItems: 'flex-end' },
        legendAmount: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 2 },
        legendPercent: { fontSize: 12, fontWeight: '700' },
        seeMoreButton: {
            marginTop: 16,
            paddingTop: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderTopWidth: 1,
            borderColor: theme.border,
        },
        seeMoreText: {
            color: theme.primary,
            fontSize: 14,
            fontWeight: '600',
        }
    });
}