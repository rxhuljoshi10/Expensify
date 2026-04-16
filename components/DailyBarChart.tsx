// components/DailyBarChart.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTheme, Theme } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { formatAmount } from '../lib/currency';
import { getCategoryMeta } from '../constants/categories';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

function CompactExpenseRow({ expense, theme }: { expense: any; theme: Theme }) {
    const cat = getCategoryMeta(expense.category);
    const memberName = expense.member_name;
    return (
        <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingVertical: 8, paddingHorizontal: 4,
            borderBottomWidth: 0.5, borderColor: theme.border,
        }}>
            <View style={{
                width: 30, height: 30, borderRadius: 8,
                backgroundColor: cat.color + '22',
                alignItems: 'center', justifyContent: 'center', marginRight: 10,
            }}>
                <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '500', color: theme.text }} numberOfLines={1}>{expense.merchant}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>{expense.category}</Text>
                    {memberName && (
                        <>
                            <Text style={{ fontSize: 10, color: theme.textSecondary }}>•</Text>
                            <Text style={{ fontSize: 11, fontWeight: '500', color: theme.primary }}>👤 {memberName}</Text>
                        </>
                    )}
                </View>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{formatAmount(expense.amount)}</Text>
        </View>
    );
}

export interface DailyData { date: string; total: number; label: string; expenses?: any[]; }
export interface WeeklyData { id: string; weekLabel: string; days: DailyData[]; total: number; average: number; }

interface Props { historicalWeeksData: WeeklyData[]; }

export default function DailyBarChart({ historicalWeeksData }: Props) {
    const theme = useTheme();
    const styles = createStyles(theme);

    const [chartWidth, setChartWidth] = useState(0);
    const scrollRef = useRef<ScrollView>(null);
    const chartHeight = 180;
    const chartTopPad = 28; // space for floating total label above tallest bar
    
    const [currentIndex, setCurrentIndex] = useState(historicalWeeksData.length - 1);
    
    // Default active date to today
    const [activeDate, setActiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isExpensesExpanded, setIsExpensesExpanded] = useState(false);
    
    const hasInitialized = useRef(false);

    useEffect(() => {
        if (chartWidth > 0 && historicalWeeksData.length > 0 && !hasInitialized.current) {
            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: false });
                setCurrentIndex(historicalWeeksData.length - 1);
                hasInitialized.current = true;
            }, 100);
        }
    }, [chartWidth, historicalWeeksData.length]);

    const handleScrollEnd = (event: any) => {
        if (chartWidth > 0) {
            const x = event.nativeEvent.contentOffset.x;
            const index = Math.round(x / chartWidth);
            if (index !== currentIndex) {
                setCurrentIndex(index);
                setActiveDate(historicalWeeksData[index].days[0].date);
                setIsExpensesExpanded(false);
            }
        }
    };

    const goToPrev = () => {
        if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            setCurrentIndex(newIndex);
            setActiveDate(historicalWeeksData[newIndex].days[0].date);
            setIsExpensesExpanded(false);
            scrollRef.current?.scrollTo({ x: newIndex * chartWidth, animated: true });
        }
    };

    const goToNext = () => {
        if (currentIndex < historicalWeeksData.length - 1) {
            const newIndex = currentIndex + 1;
            setCurrentIndex(newIndex);
            setActiveDate(historicalWeeksData[newIndex].days[0].date);
            setIsExpensesExpanded(false);
            scrollRef.current?.scrollTo({ x: newIndex * chartWidth, animated: true });
        }
    };

    const formatAxis = (val: number) => {
        if (val === 0) return '₹0';
        if (val >= 1000) return `₹${+(val / 1000).toFixed(1)}k`;
        return `₹${Math.round(val)}`;
    };

    const handleBarPress = (dateStr: string, isBlank: boolean) => {
        if (isBlank) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveDate(dateStr);
    };

    const barInactiveColor = theme.primary + '44';

    // Find active day data
    const activeDayData = useMemo(() => {
        for (const week of historicalWeeksData) {
            const day = week.days.find(d => d.date === activeDate);
            if (day) return day;
        }
        return null;
    }, [historicalWeeksData, activeDate]);

    const formattedActiveDate = useMemo(() => {
        if (!activeDate) return '';
        const d = new Date(activeDate);
        return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    }, [activeDate]);

    const activeExpenses = activeDayData?.expenses || [];
    const displayedExpenses = isExpensesExpanded ? activeExpenses : activeExpenses.slice(0, 3);

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Weekly Overview</Text>

            <View
                style={[styles.chartContainer, { height: chartHeight + chartTopPad }]}
                onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
            >
                <ScrollView 
                    ref={scrollRef} 
                    horizontal 
                    pagingEnabled 
                    showsHorizontalScrollIndicator={false} 
                    bounces={false} 
                    style={{ flex: 1 }}
                    onMomentumScrollEnd={handleScrollEnd}
                >
                    {historicalWeeksData.map((week) => {
                        const maxRupees = Math.max(...week.days.map((d: any) => (d.total > 0 ? d.total / 100 : 0)), 1);

                        return (
                            <View key={week.id} style={{ width: chartWidth, position: 'relative', paddingTop: chartTopPad }}>
                                <Text style={styles.weekLabelTitle}>{week.weekLabel}</Text>

                                <View style={[styles.gridContainer, { top: chartTopPad }]}>
                                    {[maxRupees, maxRupees * 0.66, maxRupees * 0.33, 0].map((val, i) => (
                                        <View key={i} style={styles.gridRow}>
                                            <Text style={styles.gridLabel}>{formatAxis(val)}</Text>
                                            <View style={styles.gridLine} />
                                        </View>
                                    ))}
                                </View>

                                <View style={[styles.barsArea, { marginTop: chartTopPad }]}>
                                    {week.days.map((d: any) => {
                                        const rupees = d.total > 0 ? d.total / 100 : 0;
                                        const isBlank = d.total === -1;
                                        const isActive = d.date === activeDate;
                                        const maxBarHeight = chartHeight - 36; // leave buffer so tallest bar sits at top gridline
                                        const percentage = maxRupees > 0 ? (rupees / maxRupees) : 0;
                                        const barHeight = Math.max(percentage * maxBarHeight, rupees > 0 ? 4 : 0);

                                        return (
                                            <TouchableOpacity 
                                                key={d.date} 
                                                style={styles.barItem}
                                                activeOpacity={0.7}
                                                onPress={() => handleBarPress(d.date, isBlank)}
                                            >
                                                <View style={styles.barTrack}>
                                                    {isActive && !isBlank && rupees > 0 && (
                                                        <Text style={styles.floatingTotal} numberOfLines={1} adjustsFontSizeToFit>
                                                            {formatAmount(d.total)}
                                                        </Text>
                                                    )}
                                                    {!isBlank && (
                                                        <View style={[
                                                            styles.barFill, 
                                                            { height: barHeight, backgroundColor: isActive ? theme.primary : barInactiveColor }
                                                        ]} />
                                                    )}
                                                </View>
                                                <Text style={[styles.dayLabel, isActive && { color: theme.primary, fontWeight: '700' }]}>
                                                    {d.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Pagination Controls */}
            <View style={styles.paginationRow}>
                <TouchableOpacity 
                    onPress={goToPrev} 
                    disabled={currentIndex === 0}
                    style={styles.arrowButton}
                >
                    <Ionicons 
                        name="chevron-back" 
                        size={20} 
                        color={currentIndex === 0 ? theme.border : theme.primary} 
                    />
                </TouchableOpacity>

                <View style={styles.activeDateContainer}>
                    <Text style={styles.activeDateText}>{formattedActiveDate}</Text>
                </View>

                <TouchableOpacity 
                    onPress={goToNext} 
                    disabled={currentIndex === historicalWeeksData.length - 1}
                    style={styles.arrowButton}
                >
                    <Ionicons 
                        name="chevron-forward" 
                        size={20} 
                        color={currentIndex === historicalWeeksData.length - 1 ? theme.border : theme.primary} 
                    />
                </TouchableOpacity>
            </View>

            {/* Expenses for the active day */}
            {activeDayData && activeDayData.total > 0 && (
                <View style={styles.activeDayExpenses}>
                    {displayedExpenses.map((expense: any) => (
                        <CompactExpenseRow key={expense.id} expense={expense} theme={theme} />
                    ))}
                    
                    {activeExpenses.length > 3 && (
                        <TouchableOpacity 
                            style={styles.seeMoreButton} 
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setIsExpensesExpanded(!isExpensesExpanded);
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.seeMoreText}>
                                {isExpensesExpanded ? 'See less' : `View all expenses (${activeExpenses.length})`}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
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
        weekLabelTitle: { position: 'absolute', top: -36, right: 0, fontSize: 12, fontWeight: '600', color: theme.textSecondary },
        chartContainer: { position: 'relative', width: '100%', overflow: 'hidden' },
        gridContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 24, justifyContent: 'space-between', pointerEvents: 'none' },
        gridRow: { flexDirection: 'row', alignItems: 'flex-end' },
        gridLabel: { width: 36, fontSize: 10, color: theme.textSecondary, fontWeight: '500', marginBottom: -6 },
        gridLine: { flex: 1, borderBottomWidth: 1, borderBottomColor: theme.border },
        barsArea: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginLeft: 40 },
        barItem: { alignItems: 'center', flex: 1 },
        barTrack: { flex: 1, justifyContent: 'flex-end', width: '100%', alignItems: 'center', paddingBottom: 4 },
        barFill: { width: 14, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, minHeight: 0 },
        floatingTotal: {
            fontSize: 9,
            color: theme.text,
            fontWeight: '800',
            textAlign: 'center',
            width: 50,
            marginBottom: 4,
        },
        dayLabel: { fontSize: 11, color: theme.textSecondary, fontWeight: '500', marginTop: 6 },
        paginationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 16,
            gap: 16,
        },
        arrowButton: {
            padding: 8,
        },
        activeDateContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 140,
        },
        activeDateText: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.primary,
        },
        activeDayExpenses: {
            marginTop: 20,
            paddingTop: 8,
            borderTopWidth: 1,
            borderColor: theme.border,
        },
        seeMoreButton: {
            marginTop: 8,
            paddingVertical: 10,
            alignItems: 'center',
            justifyContent: 'center',
        },
        seeMoreText: {
            color: theme.primary,
            fontSize: 13,
            fontWeight: '600',
        }
    });
}