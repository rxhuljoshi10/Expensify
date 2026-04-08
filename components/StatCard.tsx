// components/StatCard.tsx
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { formatAmount } from '../lib/currency';
import { useTheme, Theme } from '../lib/theme';

interface Props { label: string; amount: number; highlight?: boolean; onPress?: () => void; }

export default function StatCard({ label, amount, highlight, onPress }: Props) {
    const theme = useTheme();
    const styles = createStyles(theme);

    return (
        <TouchableOpacity style={[styles.card, highlight && styles.cardHighlight]} onPress={onPress} activeOpacity={0.8} disabled={!onPress}>
            <Text style={[styles.label, highlight && styles.labelHighlight]}>{label}</Text>
            <Text style={[styles.amount, highlight && styles.amountHighlight]}>{formatAmount(amount)}</Text>
        </TouchableOpacity>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        card: { flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginHorizontal: 4 },
        cardHighlight: { backgroundColor: theme.primary },
        label: { fontSize: 12, color: theme.textSecondary, marginBottom: 6, fontWeight: '500', textAlign: 'center' },
        labelHighlight: { color: 'rgba(255,255,255,0.8)' },
        amount: { fontSize: 18, fontWeight: '700', color: theme.text, textAlign: 'center' },
        amountHighlight: { color: '#fff' },
    });
}