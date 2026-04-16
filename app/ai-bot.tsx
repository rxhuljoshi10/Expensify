import { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from './../lib/supabase';
import { useAuthStore } from './../store/authStore';
import { useTheme, Theme } from './../lib/theme';
import { Ionicons } from '@expo/vector-icons';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

const SUGGESTIONS = [
    'How much did I spend on food last week?',
    'What is my top spending category?',
    'How much did I spend on travel last month',
    'How can i save more?',
];

export default function AIBotScreen() {
    const { user } = useAuthStore();
    const router = useRouter();
    const theme = useTheme();
    const styles = createStyles(theme);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const listRef = useRef<FlatList>(null);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text.trim(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const { data, error } = await supabase.functions.invoke('ai-assistant', {
                body: { question: text.trim(), userId: user!.id },
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.answer,
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (e: any) {
            console.error('AI assistant error:', e);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Sorry, I couldn't process that. Please try again.",
            }]);
        } finally {
            setIsLoading(false);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                         <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>AI Assistant</Text>
                        <Text style={styles.headerSubtitle}>Ask anything about your spending</Text>
                    </View>
                </View>

                {/* Messages */}
                <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={m => m.id}
                    contentContainerStyle={styles.messageList}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>🤖</Text>
                            <Text style={styles.emptyText}>Ask me anything about your expenses</Text>
                            <View style={styles.suggestions}>
                                {SUGGESTIONS.map(s => (
                                    <TouchableOpacity
                                        key={s}
                                        style={styles.suggestion}
                                        onPress={() => sendMessage(s)}
                                    >
                                        <Text style={styles.suggestionText}>{s}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={[
                            styles.bubble,
                            item.role === 'user' ? styles.userBubble : styles.assistantBubble,
                        ]}>
                            <Text style={[
                                styles.bubbleText,
                                item.role === 'user' ? styles.userText : styles.assistantText,
                            ]}>
                                {item.content}
                            </Text>
                        </View>
                    )}
                />

                {/* Typing indicator */}
                {isLoading && (
                    <View style={styles.typingIndicator}>
                        <ActivityIndicator size="small" color={theme.primary} />
                        <Text style={styles.typingText}>Thinking...</Text>
                    </View>
                )}

                {/* Input */}
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        placeholder="Ask about your spending..."
                        placeholderTextColor={theme.textSecondary}
                        value={input}
                        onChangeText={setInput}
                        multiline
                        returnKeyType="send"
                        onSubmitEditing={() => sendMessage(input)}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
                        onPress={() => sendMessage(input)}
                        disabled={!input.trim() || isLoading}
                    >
                        <Text style={styles.sendIcon}>↑</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        safe: { flex: 1, backgroundColor: theme.background },
        container: { flex: 1, backgroundColor: theme.background },
        headerRow: { 
            flexDirection: 'row', 
            alignItems: 'center',
            padding: 20, 
            paddingBottom: 12, 
            borderBottomWidth: 0.5, 
            borderColor: theme.border 
        },
        backButton: {
            marginRight: 16,
            padding: 4,
        },
        headerTextContainer: {
            flex: 1,
        },
        headerTitle: { fontSize: 20, fontWeight: '700', color: theme.text },
        headerSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
        messageList: { padding: 16, paddingBottom: 8 },
        emptyContainer: { alignItems: 'center', paddingTop: 40 },
        emptyIcon: { fontSize: 48, marginBottom: 12 },
        emptyText: { fontSize: 15, color: theme.textSecondary, marginBottom: 24 },
        suggestions: { width: '100%', gap: 8 },
        suggestion: {
            backgroundColor: theme.surface, borderRadius: 12,
            padding: 14, borderWidth: 1, borderColor: theme.border,
        },
        suggestionText: { fontSize: 14, color: theme.primary },
        bubble: { maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 8 },
        userBubble: { backgroundColor: theme.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
        assistantBubble: { backgroundColor: theme.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.border },
        bubbleText: { fontSize: 15, lineHeight: 22 },
        userText: { color: '#ffffff' },
        assistantText: { color: theme.text },
        typingIndicator: {
            flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingHorizontal: 20, paddingBottom: 8,
        },
        typingText: { fontSize: 13, color: theme.primary },
        inputRow: {
            flexDirection: 'row', alignItems: 'flex-end', gap: 8,
            padding: 12, borderTopWidth: 0.5, borderColor: theme.border,
            backgroundColor: theme.background,
        },
        input: {
            flex: 1, backgroundColor: theme.inputBg, borderRadius: 20,
            paddingHorizontal: 16, paddingVertical: 10,
            fontSize: 15, maxHeight: 100,
            color: theme.text,
            borderWidth: 1, borderColor: theme.border,
        },
        sendButton: {
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
        },
        sendButtonDisabled: { backgroundColor: theme.border },
        sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
    });
}
