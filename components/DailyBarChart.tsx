// components/DailyBarChart.tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export interface DailyData {
    date: string;
    total: number;
    label: string;
}

export interface WeeklyData {
    id: string;
    weekLabel: string;
    days: DailyData[];
    total: number;
    average: number;
}

interface Props {
    historicalWeeksData: WeeklyData[];
}

export default function DailyBarChart({ historicalWeeksData }: Props) {
    // Width used for snapping
    const [chartWidth, setChartWidth] = useState(0);
    const scrollRef = useRef<ScrollView>(null);
    const chartHeight = 180;

    useEffect(() => {
        if (chartWidth > 0 && historicalWeeksData.length > 0) {
            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: false });
            }, 100);
        }
    }, [chartWidth, historicalWeeksData.length]);

    const formatAxis = (val: number) => {
        if (val === 0) return '₹0';
        if (val >= 1000) return `₹${+(val / 1000).toFixed(1)}k`;
        return `₹${Math.round(val)}`;
    };

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Weekly Overview</Text>

            <View 
                style={[styles.chartContainer, { height: chartHeight }]}
                onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
            >
                {/* ScrollView matching the container perfectly for paging */}
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    bounces={false}
                    style={{ flex: 1 }}
                >
                    {historicalWeeksData.map((week) => {
                        const isAllZeros = week.days.every((d: any) => d.total <= 0);
                        const maxRupees = Math.max(...week.days.map((d: any) => (d.total > 0 ? d.total / 100 : 0)), 1);
                        
                        return (
                            <View key={week.id} style={{ width: chartWidth, position: 'relative' }}>
                                {/* Label for the specific week sliding with the chart */}
                                <Text style={styles.weekLabelTitle}>{week.weekLabel}</Text>

                                {/* Background Grid overlay (4 parts) */}
                                <View style={styles.gridContainer}>
                                    <View style={styles.gridRow}>
                                        <Text style={styles.gridLabel}>{formatAxis(maxRupees)}</Text>
                                        <View style={styles.gridLine} />
                                    </View>
                                    <View style={styles.gridRow}>
                                        <Text style={styles.gridLabel}>{formatAxis(maxRupees * 0.66)}</Text>
                                        <View style={styles.gridLine} />
                                    </View>
                                    <View style={styles.gridRow}>
                                        <Text style={styles.gridLabel}>{formatAxis(maxRupees * 0.33)}</Text>
                                        <View style={styles.gridLine} />
                                    </View>
                                    <View style={styles.gridRow}>
                                        <Text style={styles.gridLabel}>₹0</Text>
                                        <View style={styles.gridLine} />
                                    </View>
                                </View>

                                {/* Bars */}
                                <View style={styles.barsArea}>
                                    {week.days.map((d: any, index: number) => {
                                        const rupees = d.total > 0 ? d.total / 100 : 0;
                                        const isBlank = d.total === -1;
                                        const isToday = d.date === new Date().toISOString().split('T')[0];
                                        
                                        const maxBarHeight = chartHeight - 24; 
                                        const percentage = maxRupees > 0 ? (rupees / maxRupees) : 0;
                                        const barHeight = Math.max(percentage * maxBarHeight, rupees > 0 ? 4 : 0);

                                        return (
                                            <View key={d.date} style={styles.barItem}>
                                                <View style={styles.barTrack}>
                                                    {!isBlank && (
                                                        <View 
                                                            style={[
                                                                styles.barFill, 
                                                                { 
                                                                    height: barHeight, 
                                                                    backgroundColor: isToday ? '#6C63FF' : '#D4D0FF' 
                                                                }
                                                            ]} 
                                                        />
                                                    )}
                                                </View>
                                                <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>
                                                    {d.label}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
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
    heading: { 
        fontSize: 16, 
        fontWeight: '700', 
        color: '#1a1a1a', 
        marginBottom: 20 
    },
    weekLabelTitle: {
        position: 'absolute',
        top: -36,
        right: 0,
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
    },
    chartContainer: {
        position: 'relative',
        width: '100%',
        overflow: 'hidden', // to hide things spanning past width
    },
    gridContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 24, // Space for X-Axis labels
        justifyContent: 'space-between',
        pointerEvents: 'none',
    },
    gridRow: {
        flexDirection: 'row',
        alignItems: 'flex-end', // Align text to the line
    },
    gridLabel: {
        width: 36, // Fixed width for Y axis labels
        fontSize: 10,
        color: '#8E8E93',
        fontWeight: '500',
        marginBottom: -6, // Center label visually with the line
    },
    gridLine: {
        flex: 1,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F7',
    },
    
    // Bars
    barsArea: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginLeft: 40, // Space to not overlap Y-Axis labels
    },
    barItem: {
        alignItems: 'center',
        flex: 1,
    },
    barTrack: {
        flex: 1,
        justifyContent: 'flex-end',
        width: '100%',
        alignItems: 'center',
        paddingBottom: 4,
    },
    barFill: {
        width: 14,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        minHeight: 0,
    },
    dayLabel: {
        fontSize: 11,
        color: '#8E8E93',
        fontWeight: '500',
        marginTop: 6,
    },
    todayLabel: {
        color: '#6C63FF',
        fontWeight: '700',
    }
});