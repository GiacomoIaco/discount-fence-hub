/**
 * Hook for managing per-user conversation preferences (pin/mute)
 * Uses conversation_preferences table with RLS
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface ConversationPreference {
  conversation_ref: string;
  is_pinned: boolean;
  is_muted: boolean;
  pinned_at: string | null;
  translations_off: boolean;
}

export function useConversationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences = [] } = useQuery({
    queryKey: ['conversation_preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('conversation_preferences')
        .select('conversation_ref, is_pinned, is_muted, pinned_at, translations_off')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data || []) as ConversationPreference[];
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const prefsMap = new Map(
    preferences.map((p) => [p.conversation_ref, p])
  );

  const togglePin = useMutation({
    mutationFn: async (conversationRef: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const existing = prefsMap.get(conversationRef);
      const newPinned = !existing?.is_pinned;

      const { error } = await supabase
        .from('conversation_preferences')
        .upsert({
          user_id: user.id,
          conversation_ref: conversationRef,
          is_pinned: newPinned,
          is_muted: existing?.is_muted ?? false,
          pinned_at: newPinned ? new Date().toISOString() : null,
        }, { onConflict: 'user_id,conversation_ref' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation_preferences'] });
      queryClient.invalidateQueries({ queryKey: ['unified_messages'] });
    },
  });

  const toggleMute = useMutation({
    mutationFn: async (conversationRef: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const existing = prefsMap.get(conversationRef);
      const newMuted = !existing?.is_muted;

      const { error } = await supabase
        .from('conversation_preferences')
        .upsert({
          user_id: user.id,
          conversation_ref: conversationRef,
          is_muted: newMuted,
          is_pinned: existing?.is_pinned ?? false,
          pinned_at: existing?.pinned_at ?? null,
        }, { onConflict: 'user_id,conversation_ref' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation_preferences'] });
      queryClient.invalidateQueries({ queryKey: ['unified_messages'] });
    },
  });

  const toggleTranslations = useMutation({
    mutationFn: async (conversationRef: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const existing = prefsMap.get(conversationRef);
      const newOff = !(existing?.translations_off ?? false);

      const { error } = await supabase
        .from('conversation_preferences')
        .upsert({
          user_id: user.id,
          conversation_ref: conversationRef,
          translations_off: newOff,
          is_pinned: existing?.is_pinned ?? false,
          is_muted: existing?.is_muted ?? false,
          pinned_at: existing?.pinned_at ?? null,
        }, { onConflict: 'user_id,conversation_ref' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation_preferences'] });
    },
  });

  return {
    preferences,
    prefsMap,
    isPinned: (ref: string) => prefsMap.get(ref)?.is_pinned ?? false,
    isMuted: (ref: string) => prefsMap.get(ref)?.is_muted ?? false,
    isTranslationsOff: (ref: string) => prefsMap.get(ref)?.translations_off ?? false,
    togglePin,
    toggleMute,
    toggleTranslations,
  };
}
