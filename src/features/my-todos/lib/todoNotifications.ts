/**
 * Todo Notification System
 *
 * Fire-and-forget notifications for todo events.
 * All notifications are non-blocking and failures are logged but don't affect main operations.
 */

export type TodoNotificationType = 'assignment' | 'mention' | 'comment';

export interface TodoNotificationPayload {
  type: TodoNotificationType;
  taskId: string;
  taskTitle: string;
  listId: string;
  listTitle: string;
  triggeredByUserId: string;
  triggeredByName: string;
  details?: {
    newAssigneeId?: string;
    commentPreview?: string;
    mentionedUserIds?: string[];
  };
}

/**
 * Send a todo notification (fire-and-forget)
 */
export function sendTodoNotification(payload: TodoNotificationPayload): void {
  fetch('/.netlify/functions/send-todo-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(response => {
      if (!response.ok) {
        console.warn('Todo notification request failed:', response.status);
      }
    })
    .catch(error => {
      console.error('Failed to send todo notification:', error);
    });
}
