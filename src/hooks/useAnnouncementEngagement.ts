import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for tracking admin engagement notifications on announcements
 *
 * Tracks:
 * - New comments on announcements the admin sent
 * - Survey responses that need review
 * - Reactions to announcements
 *
 * Only active for users who have permission to send announcements (admins)
 */
export const useAnnouncementEngagement = () => {
  const { user, profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    loadEngagementCount();

    // Subscribe to real-time changes on message_responses table
    const responsesSubscription = supabase
      .channel('message-responses-engagement')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_responses',
        },
        () => {
          loadEngagementCount();
        }
      )
      .subscribe();

    // Subscribe to real-time changes on company_messages table
    const messagesSubscription = supabase
      .channel('company-messages-engagement')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_messages',
          filter: `created_by=eq.${user.id}`,
        },
        () => {
          loadEngagementCount();
        }
      )
      .subscribe();

    return () => {
      responsesSubscription.unsubscribe();
      messagesSubscription.unsubscribe();
    };
  }, [user, profile]);

  const loadEngagementCount = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get all messages created by the current user
      const { data: myMessages, error: messagesError } = await supabase
        .from('company_messages')
        .select('id, created_at')
        .eq('created_by', user.id)
        .eq('is_archived', false);

      if (messagesError) throw messagesError;

      if (!myMessages || myMessages.length === 0) {
        setUnreadCount(0);
        return;
      }

      const messageIds = myMessages.map(m => m.id);

      // Get all comments and survey responses on those messages
      // We're interested in comments and survey_answer responses
      const { data: responses, error: responsesError } = await supabase
        .from('message_responses')
        .select('id, message_id, response_type, created_at, user_id')
        .in('message_id', messageIds)
        .in('response_type', ['comment', 'survey_answer']);

      if (responsesError) throw responsesError;

      // Filter out responses created by the admin themselves
      const engagementResponses = responses?.filter(r => r.user_id !== user.id) || [];

      // For now, we'll count all engagement responses as "new"
      // In the future, we could track which responses the admin has viewed
      // by creating an admin_engagement_views table similar to request_views
      const count = engagementResponses.length;

      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading engagement count:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    unreadCount,
    loading,
    refreshEngagementCount: loadEngagementCount,
  };
};
