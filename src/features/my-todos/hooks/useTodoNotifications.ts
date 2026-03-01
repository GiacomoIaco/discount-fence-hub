import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

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

  return {
    notify: async (params: {
      newAssigneeId: string;
      taskTitle: string;
      listId: string;
      taskId: string;
    }) => {
      await createNotification.mutateAsync({
        type: 'assignment',
        title: `You were assigned: ${params.taskTitle}`,
        body: `A task has been assigned to you.`,
        targetUserId: params.newAssigneeId,
        listId: params.listId,
        taskId: params.taskId,
      });
    },
  };
}

/**
 * Helper to notify on mentions in comments
 */
export function useNotifyMention() {
  const createNotification = useCreateTodoNotification();

  return {
    notify: async (params: {
      mentionedUserIds: string[];
      taskTitle: string;
      commentExcerpt: string;
      listId: string;
      taskId: string;
      commentId?: string;
    }) => {
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
    },
  };
}

/**
 * Helper to notify followers/assignee on new comments
 */
export function useNotifyComment() {
  const createNotification = useCreateTodoNotification();

  return {
    notify: async (params: {
      followerIds: string[];
      assigneeId: string | null;
      taskTitle: string;
      commentExcerpt: string;
      listId: string;
      taskId: string;
    }) => {
      // Combine assignee + followers, deduplicate
      const userIds = new Set<string>();
      if (params.assigneeId) userIds.add(params.assigneeId);
      params.followerIds.forEach(id => userIds.add(id));

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
    },
  };
}
