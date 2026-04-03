// store/authStore.ts
import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
        supabase.auth.onAuthStateChange((_event, session) => {
            set({ session, user: session?.user ?? null, isLoading: false });

            // When a new user signs up, create their row in the users table
            if (_event === 'SIGNED_IN' && session?.user) {
                supabase.from('users').upsert({
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.user_metadata?.full_name ?? '',
                    avatar_url: session.user.user_metadata?.avatar_url ?? '',
                }, { onConflict: 'id' });
            }
        });
    },
}));