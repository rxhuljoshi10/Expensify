// hooks/useFamilyGroup.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { FamilyGroup, GroupMember } from '../types/expense';

const QUERY_KEY = ['family-group'];

export const useFamilyGroup = () => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<FamilyGroup | null> => {
      // Check if user owns a group
      const { data: owned } = await supabase
        .from('family_groups')
        .select('*')
        .eq('owner_id', user!.id)
        .maybeSingle();

      if (owned) return owned;

      // Check if user is a member of a group
      const { data: all } = await supabase
        .from('family_groups')
        .select('*');

      if (!all) return null;

      const memberOf = all.find((g: FamilyGroup) =>
        g.members?.some((m: GroupMember) => m.user_id === user!.id)
      );

      return memberOf ?? null;
    },
    enabled: !!user,
  });
};

// Create a new group
export const useCreateGroup = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      // Generate a random 6-character uppercase alphanumeric code
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase().padStart(6, '0');

      const { data, error } = await supabase
        .from('family_groups')
        .insert({
          owner_id: user!.id,
          name,
          invite_code: inviteCode,
          members: [],  // owner is not in members array — tracked via owner_id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

// Join a group via invite code
export const useJoinGroup = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      // Find the group by invite code
      const { data: group, error: findError } = await supabase
        .from('family_groups')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();

      if (findError || !group) throw new Error('Invalid invite code');
      if (group.owner_id === user!.id) throw new Error("You already own this group");

      const alreadyMember = group.members?.some(
        (m: GroupMember) => m.user_id === user!.id
      );
      if (alreadyMember) throw new Error('You are already in this group');

      // Get current user's profile
      const { data: profile } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', user!.id)
        .single();

      // Add user to members array
      const newMember: GroupMember = {
        user_id: user!.id,
        name: profile?.name ?? user!.email ?? '',
        email: profile?.email ?? user!.email ?? '',
        role: 'member',
        joined_at: new Date().toISOString(),
      };

      const { data: updatedGroup, error: updateError } = await supabase
        .from('family_groups')
        .update({
          members: [...(group.members ?? []), newMember],
        })
        .eq('id', group.id)
        .select()
        .single();

      if (updateError) throw new Error('Failed to join group. Update blocked by RLS policies.');
      return updatedGroup;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

// Remove a member (owner only)
export const useRemoveMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
      currentMembers,
    }: {
      groupId: string;
      userId: string;
      currentMembers: GroupMember[];
    }) => {
      const updated = currentMembers.filter(m => m.user_id !== userId);
      const { error } = await supabase
        .from('family_groups')
        .update({ members: updated })
        .eq('id', groupId);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

// Leave a group (member only)
export const useLeaveGroup = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      currentMembers,
    }: {
      groupId: string;
      currentMembers: GroupMember[];
    }) => {
      const updated = currentMembers.filter(m => m.user_id !== user!.id);
      const { error } = await supabase
        .from('family_groups')
        .update({ members: updated })
        .eq('id', groupId);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};