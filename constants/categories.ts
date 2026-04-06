// constants/categories.ts
import { Category } from '../types/expense';

export const CATEGORIES: {
    name: Category;
    icon: string;
    color: string;
}[] = [
        { name: 'Food', icon: '🍔', color: '#FF6B6B' },
        { name: 'Transport', icon: '🚗', color: '#4ECDC4' },
        { name: 'Shopping', icon: '🛍️', color: '#45B7D1' },
        { name: 'Health', icon: '💊', color: '#96CEB4' },
        { name: 'Entertainment', icon: '🎬', color: '#FFEAA7' },
        { name: 'Home', icon: '🏠', color: '#DDA0DD' },
        { name: 'Education', icon: '📚', color: '#98D8C8' },
        { name: 'Bills', icon: '📄', color: '#F0A500' },
        { name: 'Personal', icon: '👤', color: '#C9B1FF' },
        { name: 'Travel', icon: '✈️', color: '#FFB347' },
        { name: 'Fitness', icon: '💪', color: '#87CEEB' },
        { name: 'Other', icon: '📌', color: '#D3D3D3' },
    ];

export const getCategoryMeta = (name: Category) =>
    CATEGORIES.find(c => c.name === name) ?? CATEGORIES[11];