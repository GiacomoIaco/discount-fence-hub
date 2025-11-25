/**
 * Request Notification System
 *
 * Fire-and-forget notifications for request events.
 * All notifications are non-blocking and failures are logged but don't affect main operations.
 */

export type NotificationType = 'assignment' | 'watcher_added' | 'comment' | 'status_change' | 'attachment';

export interface NotificationPayload {
  type: NotificationType;
  requestId: string;
  requestTitle: string;
  requestType: string;
  urgency?: string;
  triggeredByUserId: string;
  triggeredByName: string;
  details?: {
    oldStatus?: string;
    newStatus?: string;
    commentPreview?: string;
    attachmentName?: string;
    newAssigneeId?: string;
  };
}

/**
 * Send a request notification (fire-and-forget)
 *
 * This function does not block the caller and catches all errors internally.
 * Call this after performing request operations to notify relevant users.
 *
 * @param payload - Notification details
 */
export function sendRequestNotification(payload: NotificationPayload): void {
  // Fire and forget - don't await, don't block
  fetch('/.netlify/functions/send-request-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(response => {
      if (!response.ok) {
        console.warn('Notification request failed:', response.status);
      }
    })
    .catch(error => {
      // Log but don't throw - notifications should never break main functionality
      console.error('Failed to send notification:', error);
    });
}

/**
 * Helper to build notification payload for assignment
 */
export function buildAssignmentNotification(
  requestId: string,
  requestTitle: string,
  requestType: string,
  urgency: string,
  triggeredByUserId: string,
  triggeredByName: string,
  newAssigneeId: string
): NotificationPayload {
  return {
    type: 'assignment',
    requestId,
    requestTitle,
    requestType,
    urgency,
    triggeredByUserId,
    triggeredByName,
    details: { newAssigneeId },
  };
}

/**
 * Helper to build notification payload for watcher added
 */
export function buildWatcherAddedNotification(
  requestId: string,
  requestTitle: string,
  requestType: string,
  triggeredByUserId: string,
  triggeredByName: string,
  newWatcherId: string
): NotificationPayload {
  return {
    type: 'watcher_added',
    requestId,
    requestTitle,
    requestType,
    triggeredByUserId,
    triggeredByName,
    details: { newAssigneeId: newWatcherId }, // Reusing field for consistency
  };
}

/**
 * Helper to build notification payload for new comment
 */
export function buildCommentNotification(
  requestId: string,
  requestTitle: string,
  requestType: string,
  triggeredByUserId: string,
  triggeredByName: string,
  commentContent: string
): NotificationPayload {
  // Send more content - truncation happens server-side for different channels
  const preview = commentContent.substring(0, 500) + (commentContent.length > 500 ? '...' : '');
  return {
    type: 'comment',
    requestId,
    requestTitle,
    requestType,
    triggeredByUserId,
    triggeredByName,
    details: { commentPreview: preview },
  };
}

/**
 * Helper to build notification payload for status change
 */
export function buildStatusChangeNotification(
  requestId: string,
  requestTitle: string,
  requestType: string,
  triggeredByUserId: string,
  triggeredByName: string,
  oldStatus: string,
  newStatus: string
): NotificationPayload {
  return {
    type: 'status_change',
    requestId,
    requestTitle,
    requestType,
    triggeredByUserId,
    triggeredByName,
    details: { oldStatus, newStatus },
  };
}

/**
 * Helper to build notification payload for new attachment
 */
export function buildAttachmentNotification(
  requestId: string,
  requestTitle: string,
  requestType: string,
  triggeredByUserId: string,
  triggeredByName: string,
  attachmentName: string
): NotificationPayload {
  return {
    type: 'attachment',
    requestId,
    requestTitle,
    requestType,
    triggeredByUserId,
    triggeredByName,
    details: { attachmentName },
  };
}
