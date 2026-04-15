// lib/theme.ts
import { useColorScheme } from 'react-native';

export const lightTheme = {
    background: '#f8f8ff',
    surface: '#ffffff',
    text: '#1a1a1a',
    textSecondary: '#888888',
    border: '#f0f0f0',
    primary: '#6C63FF',
    inputBg: '#fafafa',
    cardBg: '#ffffff',
    skeletonBg: '#e0e0e0',
    separator: '#f0f0f0',
    danger: '#ff4444',
    success: '#28A745',
};

export const darkTheme = {
    background: '#0f0f13',
    surface: '#1c1c24',
    text: '#f0f0f0',
    textSecondary: '#aaaaaa',
    border: '#2a2a35',
    primary: '#8B83FF',
    inputBg: '#1c1c24',
    cardBg: '#1c1c24',
    skeletonBg: '#2a2a35',
    separator: '#2a2a35',
    danger: '#ff6b6b',
    success: '#4ECDC4',
};

export type Theme = typeof lightTheme;

export const useTheme = (): Theme => {
    // const scheme = useColorScheme();
    const scheme = 'dark';
    return scheme === 'dark' ? darkTheme : lightTheme;
};