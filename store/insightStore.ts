import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface InsightState {
    isGenerating: boolean;
    liveBriefing: string | null;
    lastGeneratedAt: string | null;
    triggerGeneration: (userId: string) => Promise<void>;
    clearLiveBriefing: () => void;
}

export const useInsightStore = create<InsightState>((set) => ({
    isGenerating: false,
    liveBriefing: null,
    lastGeneratedAt: null,
    clearLiveBriefing: () => set({ liveBriefing: null }),
    triggerGeneration: async (userId: string) => {
        set({ isGenerating: true, liveBriefing: null });
        try {
            console.log('Generating AI Insight globally for user:', userId);
            const { data, error } = await supabase.functions.invoke('generate-insights', {
                body: { userId }
            });

            if (error) {
                console.error('Global generation failed:', error);
                throw error;
            }
            console.log('Global generation succeeded:', data);

            // Assuming the function returns something like { success: true, processed: 1 }
            // The actual content is in the DB, but we want to simulate real-time reflection.
            // We'll fetch the latest coaching_briefing from the DB immediately.
            const { data: latest } = await supabase
                .from('insights')
                .select('*')
                .eq('user_id', userId)
                .order('generated_at', { ascending: false })
                .limit(1)
                .single();

            if (latest) {
                set({ 
                    liveBriefing: latest.content, 
                    lastGeneratedAt: latest.generated_at,
                    isGenerating: false 
                });
            } else {
                set({ isGenerating: false });
            }
        } catch (error) {
            console.error('Global generation failed:', error);
            set({ isGenerating: false });
        }
    },
}));
