import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useRequestNotifications = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    loadUnreadCount();

    // Subscribe to real-time changes on requests table
    const requestsSubscription = supabase
      .channel('requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    // Subscribe to real-time changes on request_views table
    const viewsSubscription = supabase
      .channel('request-views-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'request_views',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      requestsSubscription.unsubscribe();
      viewsSubscription.unsubscribe();
    };
  }, [user]);

  const loadUnreadCount = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get only ACTIVE requests (new or pending) assigned to or created by the current user
      const { data: requests, error: requestsError } = await supabase
        .from('requests')
        .select('id, updated_at, stage')
        .or(`assigned_to.eq.${user.id},submitter_id.eq.${user.id}`)
        .in('stage', ['new', 'pending']);

      if (requestsError) throw requestsError;

      if (!requests || requests.length === 0) {
        setUnreadCount(0);
        updateBadge(0);
        return;
      }

      // Get all request views for current user
      const { data: views, error: viewsError } = await supabase
        .from('request_views')
        .select('request_id, last_viewed_at')
        .eq('user_id', user.id);

      if (viewsError) throw viewsError;

      // Create a map of request_id -> last_viewed_at
      const viewsMap = new Map(
        views?.map(v => [v.request_id, new Date(v.last_viewed_at)]) || []
      );

      // Count ACTIVE requests that need attention (unread or updated)
      let count = 0;
      for (const request of requests) {
        const lastViewed = viewsMap.get(request.id);
        const updatedAt = new Date(request.updated_at);

        // Request needs attention if:
        // 1. Never viewed before (new assignment or new request), OR
        // 2. Updated after last viewed (new messages, status changes, etc.)
        // Note: Only counts active requests (new/pending stage) for relevance
        if (!lastViewed || updatedAt > lastViewed) {
          count++;
        }
      }

      setUnreadCount(count);
      updateBadge(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateBadge = async (count: number) => {
    // Update PWA badge using the Badge API
    if ('setAppBadge' in navigator) {
      try {
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
        } else {
          await (navigator as any).clearAppBadge();
        }
      } catch (error) {
        console.log('Badge API not supported:', error);
      }
    }
  };

  const markRequestAsRead = async (requestId: string) => {
    if (!user) return false;

    try {
      // Upsert to request_views table
      const { error } = await supabase
        .from('request_views')
        .upsert(
          {
            request_id: requestId,
            user_id: user.id,
            last_viewed_at: new Date().toISOString(),
          },
          {
            onConflict: 'request_id,user_id',
          }
        );

      if (error) throw error;

      // Reload unread count
      await loadUnreadCount();
      return true;
    } catch (error) {
      console.error('Error marking request as read:', error);
      return false;
    }
  };

  return {
    unreadCount,
    loading,
    markRequestAsRead,
    refreshUnreadCount: loadUnreadCount,
  };
};
