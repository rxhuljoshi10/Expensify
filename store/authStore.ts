import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useDashboardStore } from './dashboardStore';

interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    setSession: (session: Session | null) => void;
    signOut: () => Promise<void>;
    initialize: () => (() => void);
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    isLoading: true,

    setSession: (session) =>
        set({ session, user: session?.user ?? null, isLoading: false }),

    signOut: async () => {
        await supabase.auth.signOut();
        useDashboardStore.getState().setViewMode('personal');
        set({ user: null, session: null });
    },

    initialize: () => {
        console.log("[Auth] initialize() called");
        // Get initial session
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                console.log("[Auth] getSession() successful. Session:", !!session);
                set({ session, user: session?.user ?? null, isLoading: false });
            })
            .catch((error) => {
                console.error("[Auth] Auth session error:", error);
                set({ isLoading: false });
            });

        // Listen for auth changes (login, logout, token refresh)
        console.log("[Auth] setting up onAuthStateChange");
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log("[Auth] onAuthStateChange event:", _event);
            set({ session, user: session?.user ?? null, isLoading: false });
        });

        // Return unsubscribe so the caller can clean up
        return () => subscription.unsubscribe();
    },
}));