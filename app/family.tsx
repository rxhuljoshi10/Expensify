// app/family.tsx
import { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Alert, Share, ScrollView,
    ActivityIndicator,
} from 'react-native';
import {
    useFamilyGroup, useCreateGroup,
    useJoinGroup, useRemoveMember, useLeaveGroup,
} from '../hooks/useFamilyGroup';
import { useAuthStore } from '../store/authStore';
import { GroupMember } from '../types/expense';
import { toast } from '../lib/toast';

export default function FamilyScreen() {
    const { user } = useAuthStore();
    const { data: group, isLoading } = useFamilyGroup();
    const { mutate: createGroup, isPending: isCreating } = useCreateGroup();
    const { mutate: joinGroup, isPending: isJoining } = useJoinGroup();
    const { mutate: removeMember } = useRemoveMember();
    const { mutate: leaveGroup } = useLeaveGroup();

    const [groupName, setGroupName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [mode, setMode] = useState<'none' | 'create' | 'join'>('none');

    const isOwner = group?.owner_id === user?.id;

    const handleCreate = () => {
        if (!groupName.trim()) {
            toast.error('Please enter a group name');
            return;
        }
        createGroup(groupName.trim(), {
            onSuccess: () => {
                toast.success('Group created!');
                setGroupName('');
                setMode('none');
            },
            onError: (e) => toast.error(e.message),
        });
    };

    const handleJoin = () => {
        if (inviteCode.trim().length < 6) {
            toast.error('Please enter a valid 6-character invite code');
            return;
        }
        joinGroup(inviteCode.trim(), {
            onSuccess: () => {
                toast.success('Joined group!');
                setInviteCode('');
                setMode('none');
            },
            onError: (e) => toast.error(e.message),
        });
    };

    const handleShareInvite = async () => {
        if (!group) return;
        await Share.share({
            message: `Join my family group on Expensify!\n\nGroup: ${group.name}\nInvite code: ${group.invite_code}\n\nDownload Expensify and enter this code to join.`,
        });
    };

    const handleRemoveMember = (member: GroupMember) => {
        Alert.alert(
            'Remove member',
            `Remove ${member.name} from the group?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove', style: 'destructive',
                    onPress: () => {
                        removeMember({
                            groupId: group!.id,
                            userId: member.user_id,
                            currentMembers: group!.members,
                        }, {
                            onSuccess: () => toast.success('Member removed'),
                            onError: (e) => toast.error(e.message),
                        });
                    },
                },
            ]
        );
    };

    const handleLeave = () => {
        Alert.alert(
            'Leave group',
            'Are you sure you want to leave this group?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave', style: 'destructive',
                    onPress: () => {
                        leaveGroup({
                            groupId: group!.id,
                            currentMembers: group!.members,
                        }, {
                            onSuccess: () => toast.success('Left group'),
                            onError: (e) => toast.error(e.message),
                        });
                    },
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color="#6C63FF" />
            </View>
        );
    }

    // ── User is in a group ────────────────────────────────────────────
    if (group) {
        return (
            <ScrollView style={styles.container}>
                <Text style={styles.heading}>{group.name}</Text>

                {/* Invite code card — owner only */}
                {isOwner && (
                    <View style={styles.inviteCard}>
                        <Text style={styles.inviteLabel}>Invite code</Text>
                        <Text style={styles.inviteCode}>{group.invite_code}</Text>
                        <TouchableOpacity style={styles.shareButton} onPress={handleShareInvite}>
                            <Text style={styles.shareButtonText}>Share invite link</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Members list */}
                <Text style={styles.sectionTitle}>
                    Members ({(group.members?.length ?? 0) + 1})
                </Text>

                {/* Owner row */}
                <View style={styles.memberRow}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {(group.members?.find(m => m.user_id === group.owner_id)?.name?.[0]
                                ?? user?.email?.[0] ?? '?').toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                            {group.owner_id === user?.id ? 'You' : 'Owner'}
                        </Text>
                        <Text style={styles.memberRole}>Owner</Text>
                    </View>
                </View>

                {/* Member rows */}
                {group.members?.map(member => (
                    <View key={member.user_id} style={styles.memberRow}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {(member.name?.[0] ?? '?').toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.memberInfo}>
                            <Text style={styles.memberName}>
                                {member.user_id === user?.id ? 'You' : member.name}
                            </Text>
                            <Text style={styles.memberRole}>{member.email}</Text>
                        </View>
                        {isOwner && member.user_id !== user?.id && (
                            <TouchableOpacity onPress={() => handleRemoveMember(member)}>
                                <Text style={styles.removeText}>Remove</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}

                {/* Leave button — members only */}
                {!isOwner && (
                    <TouchableOpacity style={styles.leaveButton} onPress={handleLeave}>
                        <Text style={styles.leaveButtonText}>Leave group</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        );
    }

    // ── User is not in a group ────────────────────────────────────────
    return (
        <ScrollView style={styles.container}>
            <Text style={styles.heading}>Family groups</Text>
            <Text style={styles.subheading}>
                Track expenses together with your family or partner
            </Text>

            {mode === 'none' && (
                <View style={styles.optionsContainer}>
                    <TouchableOpacity
                        style={styles.optionCard}
                        onPress={() => setMode('create')}
                    >
                        <Text style={styles.optionIcon}>👨‍👩‍👧‍👦</Text>
                        <Text style={styles.optionTitle}>Create a group</Text>
                        <Text style={styles.optionSubtext}>
                            Start a new family group and invite members
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.optionCard}
                        onPress={() => setMode('join')}
                    >
                        <Text style={styles.optionIcon}>🔗</Text>
                        <Text style={styles.optionTitle}>Join a group</Text>
                        <Text style={styles.optionSubtext}>
                            Enter an invite code from a family member
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {mode === 'create' && (
                <View style={styles.formCard}>
                    <Text style={styles.formTitle}>Create a group</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Group name (e.g. The Sharmas)"
                        value={groupName}
                        onChangeText={setGroupName}
                        autoFocus
                    />
                    <TouchableOpacity
                        style={[styles.primaryButton, isCreating && styles.disabled]}
                        onPress={handleCreate}
                        disabled={isCreating}
                    >
                        <Text style={styles.primaryButtonText}>
                            {isCreating ? 'Creating...' : 'Create group'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setMode('none')} style={styles.cancelLink}>
                        <Text style={styles.cancelLinkText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            )}

            {mode === 'join' && (
                <View style={styles.formCard}>
                    <Text style={styles.formTitle}>Join a group</Text>
                    <TextInput
                        style={[styles.input, styles.codeInput]}
                        placeholder="Enter 6-character code"
                        value={inviteCode}
                        onChangeText={v => setInviteCode(v.toUpperCase())}
                        autoCapitalize="characters"
                        maxLength={6}
                        autoFocus
                    />
                    <TouchableOpacity
                        style={[styles.primaryButton, isJoining && styles.disabled]}
                        onPress={handleJoin}
                        disabled={isJoining}
                    >
                        <Text style={styles.primaryButtonText}>
                            {isJoining ? 'Joining...' : 'Join group'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setMode('none')} style={styles.cancelLink}>
                        <Text style={styles.cancelLinkText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 24 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    heading: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginTop: 16, marginBottom: 8 },
    subheading: { fontSize: 15, color: '#888', marginBottom: 32, lineHeight: 22 },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 12, marginTop: 8 },

    inviteCard: {
        backgroundColor: '#f0f0ff', borderRadius: 16, padding: 20,
        marginBottom: 24, alignItems: 'center',
    },
    inviteLabel: { fontSize: 13, color: '#6C63FF', fontWeight: '500', marginBottom: 8 },
    inviteCode: {
        fontSize: 36, fontWeight: '800', color: '#1a1a1a',
        letterSpacing: 8, marginBottom: 16,
    },
    shareButton: {
        backgroundColor: '#6C63FF', borderRadius: 12,
        paddingHorizontal: 24, paddingVertical: 12,
    },
    shareButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

    memberRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, borderBottomWidth: 0.5, borderColor: '#f0f0f0', gap: 12,
    },
    avatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#e8e7ff', alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '700', color: '#6C63FF' },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 15, fontWeight: '500', color: '#1a1a1a' },
    memberRole: { fontSize: 13, color: '#aaa', marginTop: 2 },
    removeText: { fontSize: 13, color: '#ff4444' },

    leaveButton: {
        borderWidth: 1, borderColor: '#ff4444', borderRadius: 12,
        padding: 16, alignItems: 'center', marginTop: 32,
    },
    leaveButtonText: { color: '#ff4444', fontSize: 15, fontWeight: '500' },

    optionsContainer: { gap: 16 },
    optionCard: {
        borderWidth: 1.5, borderColor: '#e0deff', borderRadius: 16,
        padding: 20, alignItems: 'center',
    },
    optionIcon: { fontSize: 40, marginBottom: 12 },
    optionTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
    optionSubtext: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },

    formCard: {
        backgroundColor: '#f8f8ff', borderRadius: 16, padding: 20,
    },
    formTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 16 },
    input: {
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0',
        borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16,
    },
    codeInput: {
        fontSize: 24, fontWeight: '700', letterSpacing: 6,
        textAlign: 'center',
    },
    primaryButton: {
        backgroundColor: '#6C63FF', borderRadius: 12,
        padding: 16, alignItems: 'center', marginBottom: 12,
    },
    disabled: { opacity: 0.6 },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    cancelLink: { alignItems: 'center', padding: 8 },
    cancelLinkText: { color: '#888', fontSize: 15 },
});