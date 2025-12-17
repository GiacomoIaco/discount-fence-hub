import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { scheduleKeys } from './useScheduleEntries';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// REAL-TIME SCHEDULE UPDATES
// ============================================

/**
 * Subscribe to real-time updates for schedule entries.
 * When any user creates, updates, or deletes a schedule entry,
 * all connected clients will see the change immediately.
 */
export function useScheduleRealtime() {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Create channel for schedule changes
    const channel = supabase
      .channel('schedule_realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'schedule_entries',
        },
        (payload) => {
          console.log('[Realtime] Schedule change:', payload.eventType, payload);

          // Invalidate all schedule entry queries
          // This triggers a refetch for any components using these queries
          queryClient.invalidateQueries({ queryKey: scheduleKeys.entries() });
          queryClient.invalidateQueries({ queryKey: scheduleKeys.capacity() });

          // If it's an update or delete, also invalidate the specific entry
          if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            const oldRecord = payload.old as { id?: string } | undefined;
            const newRecord = payload.new as { id?: string } | undefined;
            const entryId = oldRecord?.id || newRecord?.id;
            if (entryId) {
              queryClient.invalidateQueries({ queryKey: scheduleKeys.entry(entryId) });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crew_daily_capacity',
        },
        (payload) => {
          console.log('[Realtime] Capacity change:', payload.eventType);
          // Invalidate capacity queries when capacity data changes
          queryClient.invalidateQueries({ queryKey: scheduleKeys.capacity() });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient]);

  return null;
}

// ============================================
// CREW CAPACITY REAL-TIME
// ============================================

/**
 * Subscribe to real-time updates for crew capacity.
 * Useful if you want more granular control over capacity updates.
 */
export function useCapacityRealtime() {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel('capacity_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crew_daily_capacity',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: scheduleKeys.capacity() });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient]);

  return null;
}
