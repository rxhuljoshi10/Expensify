// constants/categories.ts
import { Category } from '../types/expense';

export const CATEGORIES: {
    name: Category;
    icon: string; // Ionicons icon name
    color: string;
}[] = [
    { name: 'Food',          icon: 'fast-food',          color: '#FF6B6B' },
    { name: 'Transport',     icon: 'car',                color: '#4ECDC4' },
    { name: 'Shopping',      icon: 'bag-handle',         color: '#45B7D1' },
    { name: 'Health',        icon: 'medkit',             color: '#96CEB4' },
    { name: 'Entertainment', icon: 'film',               color: '#FFEAA7' },
    { name: 'Home',          icon: 'home',               color: '#DDA0DD' },
    { name: 'Education',     icon: 'school',             color: '#98D8C8' },
    { name: 'Bills',         icon: 'receipt',            color: '#F0A500' },
    { name: 'Personal',      icon: 'person',             color: '#C9B1FF' },
    { name: 'Travel',        icon: 'airplane',           color: '#FFB347' },
    { name: 'Fitness',       icon: 'barbell',            color: '#87CEEB' },
    { name: 'Other',         icon: 'ellipsis-horizontal',color: '#D3D3D3' },
];

export const getCategoryMeta = (name: Category) =>
    CATEGORIES.find(c => c.name === name) ?? CATEGORIES[11];