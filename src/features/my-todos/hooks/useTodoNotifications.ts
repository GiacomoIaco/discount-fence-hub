import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { sendTodoNotification } from '../lib/todoNotifications';

type TodoNotificationType = 'mention' | 'assignment' | 'reminder';

interface CreateTodoNotificationParams {
  type: TodoNotificationType;
  title: string;
  body: string;
  targetUserId: string;
  listId: string;
  taskId: string;
  commentId?: string;
}

export function useCreateTodoNotification() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: CreateTodoNotificationParams) => {
      // Don't notify yourself
      if (params.targetUserId === user?.id) return null;

      const { data, error } = await supabase
        .from('mc_system_notifications')
        .insert({
          notification_type: params.type,
          title: params.title,
          body: params.body,
          target_user_id: params.targetUserId,
          action_url: `/todos?list=${params.listId}&task=${params.taskId}`,
          metadata: {
            list_id: params.listId,
            task_id: params.taskId,
            ...(params.commentId ? { comment_id: params.commentId } : {}),
          },
        })
        .select()
        .single();

      if (error) {
        console.warn('Failed to create todo notification:', error);
        return null;
      }
      return data;
    },
  });
}

/**
 * Helper to notify on assignment change
 */
export function useNotifyAssignment() {
  const createNotification = useCreateTodoNotification();
  const { user } = useAuth();

  return {
    notify: async (params: {
      newAssigneeId: string;
      taskTitle: string;
      listId: string;
      taskId: string;
      listTitle?: string;
    }) => {
      // In-app notification
      await createNotification.mutateAsync({
        type: 'assignment',
        title: `You were assigned: ${params.taskTitle}`,
        body: `A task has been assigned to you.`,
        targetUserId: params.newAssigneeId,
        listId: params.listId,
        taskId: params.taskId,
      });

      // External notifications (email + SMS + push) — fire-and-forget
      if (user && params.newAssigneeId !== user.id) {
        sendTodoNotification({
          type: 'assignment',
          taskId: params.taskId,
          taskTitle: params.taskTitle,
          listId: params.listId,
          listTitle: params.listTitle || '',
          triggeredByUserId: user.id,
          triggeredByName: user.user_metadata?.full_name || user.email || 'Someone',
          details: { newAssigneeId: params.newAssigneeId },
        });
      }
    },
  };
}

/**
 * Helper to notify on mentions in comments
 */
export function useNotifyMention() {
  const createNotification = useCreateTodoNotification();
  const { user } = useAuth();

  return {
    notify: async (params: {
      mentionedUserIds: string[];
      taskTitle: string;
      commentExcerpt: string;
      listId: string;
      taskId: string;
      commentId?: string;
      listTitle?: string;
    }) => {
      // In-app notifications
      for (const userId of params.mentionedUserIds) {
        await createNotification.mutateAsync({
          type: 'mention',
          title: `You were mentioned in: ${params.taskTitle}`,
          body: params.commentExcerpt.substring(0, 200),
          targetUserId: userId,
          listId: params.listId,
          taskId: params.taskId,
          commentId: params.commentId,
        });
      }

      // External notifications — fire-and-forget
      if (user) {
        sendTodoNotification({
          type: 'mention',
          taskId: params.taskId,
          taskTitle: params.taskTitle,
          listId: params.listId,
          listTitle: params.listTitle || '',
          triggeredByUserId: user.id,
          triggeredByName: user.user_metadata?.full_name || user.email || 'Someone',
          details: {
            mentionedUserIds: params.mentionedUserIds,
            commentPreview: params.commentExcerpt,
          },
        });
      }
    },
  };
}

/**
 * Helper to notify followers/assignee on new comments
 */
export function useNotifyComment() {
  const createNotification = useCreateTodoNotification();
  const { user } = useAuth();

  return {
    notify: async (params: {
      followerIds: string[];
      assigneeId: string | null;
      taskTitle: string;
      commentExcerpt: string;
      listId: string;
      taskId: string;
      listTitle?: string;
    }) => {
      // Combine assignee + followers, deduplicate
      const userIds = new Set<string>();
      if (params.assigneeId) userIds.add(params.assigneeId);
      params.followerIds.forEach(id => userIds.add(id));

      // In-app notifications
      for (const userId of userIds) {
        await createNotification.mutateAsync({
          type: 'reminder', // Using 'reminder' for general comment notifications
          title: `New comment on: ${params.taskTitle}`,
          body: params.commentExcerpt.substring(0, 200),
          targetUserId: userId,
          listId: params.listId,
          taskId: params.taskId,
        });
      }

      // External notifications — fire-and-forget
      if (user) {
        sendTodoNotification({
          type: 'comment',
          taskId: params.taskId,
          taskTitle: params.taskTitle,
          listId: params.listId,
          listTitle: params.listTitle || '',
          triggeredByUserId: user.id,
          triggeredByName: user.user_metadata?.full_name || user.email || 'Someone',
          details: { commentPreview: params.commentExcerpt },
        });
      }
    },
  };
}
