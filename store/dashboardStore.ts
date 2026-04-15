import { create } from 'zustand';

export type ViewMode = 'personal' | 'group';

interface DashboardState {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
    viewMode: 'personal',
    setViewMode: (mode) => set({ viewMode: mode }),
}));
