import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { registerForPushNotifications } from '../lib/notifications';

interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    setSession: (session: Session | null) => void;
    signOut: () => Promise<void>;
    initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    isLoading: true,

    setSession: (session) =>
        set({ session, user: session?.user ?? null, isLoading: false }),

    signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, session: null });
    },

    initialize: () => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            set({ session, user: session?.user ?? null, isLoading: false });
        });

        // Listen for auth changes (login, logout, token refresh)
        supabase.auth.onAuthStateChange(async (_event, session) => {
            set({ session, user: session?.user ?? null, isLoading: false });
            
            if (_event === 'SIGNED_IN' && session?.user) {
                // Register push token in background — don't await
                registerForPushNotifications(session.user.id).catch(console.error);
            }
        });
    },
}));