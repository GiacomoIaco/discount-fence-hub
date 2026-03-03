/**
 * useInboxPeek - Realtime listener that shows a peek toast when new messages arrive.
 * Only triggers when the right pane is closed (desktop only).
 */

import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useRightPane } from '../context/RightPaneContext';
import type { PeekMessage } from '../context/RightPaneContext';

export function useInboxPeek() {
  const { user } = useAuth();
  const { isOpen, showPeek } = useRightPane();
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('inbox_peek_notifications')
      // Team chat messages (direct_messages)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        async (payload) => {
          if (isOpenRef.current) return;
          const msg = payload.new as { id: string; sender_id: string; content: string; conversation_id: string; created_at: string };
          // Don't peek for own messages
          if (msg.sender_id === user.id) return;

          // Get sender name
          const { data: sender } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', msg.sender_id)
            .single();

          const peek: PeekMessage = {
            id: `team-chat-${msg.id}`,
            senderName: sender?.full_name || 'Team member',
            preview: msg.content?.substring(0, 120) || 'New message',
            type: 'team_chat',
            timestamp: msg.created_at,
          };
          showPeek(peek);
        }
      )
      // SMS messages (mc_messages) — only for conversations user participates in
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mc_messages',
        },
        async (payload) => {
          if (isOpenRef.current) return;
          const msg = payload.new as { id: string; direction: string; body: string; conversation_id: string; created_at: string; sender_contact_id: string };
          // Only show inbound SMS
          if (msg.direction !== 'inbound') return;

          // Check if user is a participant of this conversation
          const { data: userContact } = await supabase
            .from('mc_contacts')
            .select('id')
            .eq('employee_id', user.id)
            .single();

          if (!userContact) return;

          const { data: participation } = await supabase
            .from('mc_conversation_participants')
            .select('id')
            .eq('conversation_id', msg.conversation_id)
            .eq('contact_id', userContact.id)
            .is('left_at', null)
            .maybeSingle();

          // Also check if user is direct contact
          const { data: directConv } = await supabase
            .from('mc_conversations')
            .select('id')
            .eq('id', msg.conversation_id)
            .eq('contact_id', userContact.id)
            .maybeSingle();

          if (!participation && !directConv) return;

          // Get sender contact name
          const { data: senderContact } = await supabase
            .from('mc_contacts')
            .select('display_name, first_name, last_name')
            .eq('id', msg.sender_contact_id)
            .single();

          const senderName = senderContact?.display_name
            || [senderContact?.first_name, senderContact?.last_name].filter(Boolean).join(' ')
            || 'Unknown';

          const peek: PeekMessage = {
            id: `sms-${msg.id}`,
            senderName,
            preview: msg.body?.substring(0, 120) || 'New SMS',
            type: 'sms',
            timestamp: msg.created_at,
          };
          showPeek(peek);
        }
      )
      // Announcements
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_messages',
        },
        async (payload) => {
          if (isOpenRef.current) return;
          const msg = payload.new as { id: string; created_by: string; title: string; body: string; status: string; created_at: string };
          // Only show published announcements, not drafts
          if (msg.status !== 'published') return;
          // Don't peek for own announcements
          if (msg.created_by === user.id) return;

          const { data: sender } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', msg.created_by)
            .single();

          const peek: PeekMessage = {
            id: `announcement-${msg.id}`,
            senderName: sender?.full_name || 'Admin',
            preview: msg.title || msg.body?.substring(0, 120) || 'New announcement',
            type: 'team_announcement',
            timestamp: msg.created_at,
          };
          showPeek(peek);
        }
      )
      // Ticket comments (request_notes)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'request_notes',
        },
        async (payload) => {
          if (isOpenRef.current) return;
          const note = payload.new as { id: string; user_id: string; content: string; note_type: string; request_id: string; created_at: string };
          // Only comments, not internal notes or status changes
          if (note.note_type !== 'comment') return;
          // Don't peek for own comments
          if (note.user_id === user.id) return;

          const { data: sender } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', note.user_id)
            .single();

          const peek: PeekMessage = {
            id: `ticket-${note.id}`,
            senderName: sender?.full_name || 'Team member',
            preview: note.content?.substring(0, 120) || 'New comment',
            type: 'ticket_chat',
            timestamp: note.created_at,
          };
          showPeek(peek);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, showPeek]);
}
