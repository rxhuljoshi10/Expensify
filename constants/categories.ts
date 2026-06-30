// constants/categories.ts
import { UserCategory } from '../types/expense';

export const DEFAULT_CATEGORIES: {
    name: string;
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

export const COLOR_CHOICES = [
    '#FF6B6B', '#FF8E53', '#FF4757', '#FD79A8',
    '#FFA502', '#FFBE76', '#FFEAA7', '#2ED573',
    '#1DD1A1', '#20BF6B', '#1E90FF', '#70A1FF',
    '#4ECDC4', '#45B7D1', '#9B5DE5', '#A29BFE',
];

const RAW_ICON_CHOICES = [
    // 🍽️ Food & Dining
    'fast-food', 'pizza', 'cafe', 'restaurant', 'beer-outline', 'wine', 'ice-cream',
    'nutrition', 'flask', 'fish', 'flame', 'basket', 'water',

    // 🚗 Transport & Commute
    'car', 'airplane', 'bicycle', 'bus', 'boat', 'train', 'walk', 'subway',
    'speedometer', 'navigate', 'location', 'map', 'compass',

    // 🛍️ Shopping & Retail
    'bag-handle', 'cart', 'gift', 'pricetag', 'pricetag-outline', 'card', 'cash', 'wallet',
    'storefront', 'bag', 'barcode', 'receipt', 'business', 'briefcase',

    // 🏥 Health & Medical
    'medkit', 'heart', 'heart-circle', 'bandage', 'fitness', 'pulse', 'thermometer',
    'eye', 'body', 'medical', 'shield-checkmark', 'accessibility',

    // 💪 Fitness & Sports
    'barbell', 'golf', 'trophy', 'basketball', 'footsteps', 'bicycle',
    'partly-sunny', 'umbrella',

    // 💆 Personal Care & Beauty
    'flower', 'color-wand', 'cut', 'happy', 'ribbon',

    // 🐾 Pets & Animals
    'paw',

    // 🎬 Entertainment & Leisure
    'film', 'game-controller', 'musical-notes', 'musical-note', 'book', 'camera',
    'headset', 'radio', 'images', 'ticket', 'dice', 'star', 'glasses', 'watch',
    'videocam', 'volume-high', 'mic', 'play',

    // 🏠 Home & Living
    'home', 'bed', 'key', 'flash', 'bulb', 'wifi', 'call', 'tv', 'mail',
    'build', 'hammer', 'construct', 'print', 'document', 'folder', 'cloud',
    'trash', 'save', 'lock-closed', 'shield',

    // 💼 Work & Business
    'laptop', 'desktop', 'analytics', 'calculator', 'bar-chart', 'pie-chart',
    'trending-up', 'trending-down', 'clipboard', 'layers', 'briefcase-outline',
    'server', 'hardware-chip',

    // 📚 Education & Learning
    'school', 'library', 'pencil', 'brush', 'color-palette', 'reader', 'journal',
    'timer', 'alarm', 'hourglass', 'bulb-outline',

    // 📱 Tech & Gadgets
    'phone-portrait', 'tablet-portrait',

    // 🎮 Streaming & Subscriptions — Brand Logos
    'logo-youtube', 'logo-google', 'logo-apple', 'logo-amazon',
    'logo-playstation', 'logo-xbox', 'logo-steam', 'logo-discord', 'logo-whatsapp',
    'logo-facebook', 'logo-instagram', 'logo-twitter', 'logo-twitch', 'logo-linkedin',
    'logo-android', 'logo-windows', 'logo-github',

    // ✈️ Travel & Outdoors
    'earth', 'globe', 'planet', 'moon', 'sunny', 'rainy', 'snow', 'flag',

    // 🎉 Social, Events & Celebrations
    'calendar', 'today', 'chatbubbles', 'chatbubble', 'megaphone', 'newspaper',
    'people', 'people-circle', 'person', 'man', 'woman', 'id-card',

    // ⚙️ Subscriptions & Recurring Services
    'sync', 'refresh', 'cog', 'notifications', 'bookmark',

    // 🌿 Wellbeing & Lifestyle
    'leaf', 'heart-outline', 'happy-outline',

    // 🧳 Other / Catch-All
    'ellipsis-horizontal',
];

export const ICON_CHOICES = Array.from(new Set(RAW_ICON_CHOICES));

export const getCategoryMeta = (name: string, customCategories?: UserCategory[]) => {
    if (customCategories) {
        const found = customCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (found) {
            return { name: found.name, icon: found.icon, color: found.color };
        }
    }
    const foundDefault = DEFAULT_CATEGORIES.find(c => c.name.toLowerCase() === name.toLowerCase());
    return foundDefault ?? DEFAULT_CATEGORIES[11]; // default to "Other"
};