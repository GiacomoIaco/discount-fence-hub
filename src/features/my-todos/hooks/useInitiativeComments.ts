import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

export interface InitiativeComment {
  id: string;
  initiative_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

/**
 * Fetch comments for an initiative
 */
export function useInitiativeCommentsQuery(initiativeId: string | undefined) {
  return useQuery({
    queryKey: ['initiative-comments', initiativeId],
    queryFn: async (): Promise<InitiativeComment[]> => {
      if (!initiativeId) return [];

      const { data, error } = await supabase
        .from('initiative_comments')
        .select(`
          *,
          user:user_profiles!initiative_comments_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('initiative_id', initiativeId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!initiativeId,
  });
}

/**
 * Add a comment to an initiative
 */
export function useAddComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ initiativeId, content }: { initiativeId: string; content: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('initiative_comments')
        .insert({
          initiative_id: initiativeId,
          user_id: user.id,
          content,
        })
        .select(`
          *,
          user:user_profiles!initiative_comments_user_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Send notification (fire and forget)
      try {
        await sendCommentNotification(initiativeId, content, user.id);
      } catch (notifyError) {
        console.warn('Failed to send comment notification:', notifyError);
      }

      return data;
    },
    onSuccess: (_, { initiativeId }) => {
      queryClient.invalidateQueries({ queryKey: ['initiative-comments', initiativeId] });
    },
  });
}

/**
 * Delete a comment
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, initiativeId }: { commentId: string; initiativeId: string }) => {
      const { error } = await supabase
        .from('initiative_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      return { commentId, initiativeId };
    },
    onSuccess: (_, { initiativeId }) => {
      queryClient.invalidateQueries({ queryKey: ['initiative-comments', initiativeId] });
    },
  });
}

/**
 * Send notification for new comment
 */
async function sendCommentNotification(initiativeId: string, commentContent: string, triggeredByUserId: string) {
  // Get initiative details
  const { data: initiative } = await supabase
    .from('project_initiatives')
    .select('title, assigned_to, created_by')
    .eq('id', initiativeId)
    .single();

  if (!initiative) return;

  // Get user name
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', triggeredByUserId)
    .single();

  const triggeredByName = userProfile?.full_name || 'Someone';

  // Call notification function
  await fetch('/.netlify/functions/send-initiative-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'comment',
      initiativeId,
      initiativeTitle: initiative.title,
      triggeredByUserId,
      triggeredByName,
      details: {
        commentPreview: commentContent.substring(0, 100),
      },
    }),
  });
}
