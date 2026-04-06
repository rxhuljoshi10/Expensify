// components/StatCard.tsx
import { View, Text, StyleSheet } from 'react-native';
import { formatAmount } from '../lib/currency';

interface Props {
    label: string;
    amount: number;
    highlight?: boolean;
}

export default function StatCard({ label, amount, highlight }: Props) {
    return (
        <View style={[styles.card, highlight && styles.cardHighlight]}>
            <Text style={[styles.label, highlight && styles.labelHighlight]}>
                {label}
            </Text>
            <Text style={[styles.amount, highlight && styles.amountHighlight]}>
                {formatAmount(amount)}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        backgroundColor: '#f7f7ff',
        borderRadius: 14,
        padding: 14,
        marginHorizontal: 4,
    },
    cardHighlight: {
        backgroundColor: '#6C63FF',
    },
    label: {
        fontSize: 12,
        color: '#888',
        marginBottom: 6,
        fontWeight: '500',
    },
    labelHighlight: { color: 'rgba(255,255,255,0.8)' },
    amount: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    amountHighlight: { color: '#fff' },
});