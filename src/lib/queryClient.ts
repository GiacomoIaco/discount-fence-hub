/**
 * React Query Configuration
 *
 * Centralizes React Query setup with optimized defaults for the application
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Create and configure the React Query client
 *
 * Default configuration optimized for this application:
 * - Caching: 5 minutes for most queries
 * - Stale time: 1 minute (data considered fresh)
 * - Retries: 1 retry on failure
 * - Refetch: On window focus for fresh data
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // How long data stays in cache before being garbage collected
      gcTime: 1000 * 60 * 5, // 5 minutes (was 'cacheTime' in v4)

      // How long data is considered fresh (no refetch needed)
      staleTime: 1000 * 60 * 1, // 1 minute

      // Retry failed requests once
      retry: 1,

      // Refetch on window focus to keep data fresh
      refetchOnWindowFocus: true,

      // Refetch when reconnecting to network
      refetchOnReconnect: true,

      // Don't refetch on mount if data is still fresh
      refetchOnMount: false,
    },
    mutations: {
      // Retry mutations once on network errors
      retry: 1,

      // Network mode - fail fast on offline
      networkMode: 'online',
    },
  },
});

/**
 * Common query keys used throughout the application
 *
 * Centralized query keys help with:
 * - Consistency across components
 * - Type safety
 * - Easy invalidation/refetching
 * - Cache management
 */
export const queryKeys = {
  // User-related queries
  user: {
    current: ['user', 'current'] as const,
    profile: (id: string) => ['user', 'profile', id] as const,
    profiles: () => ['user', 'profiles'] as const,
  },

  // Request-related queries
  requests: {
    all: ['requests'] as const,
    list: (filters?: Record<string, any>) => ['requests', 'list', filters] as const,
    myRequests: (filters?: Record<string, any>) => ['requests', 'my', filters] as const,
    allRequests: (filters?: Record<string, any>) => ['requests', 'all', filters] as const,
    detail: (id: string) => ['requests', 'detail', id] as const,
    notes: (requestId: string) => ['requests', 'notes', requestId] as const,
    activity: (requestId: string) => ['requests', 'activity', requestId] as const,
    mine: (userId: string) => ['requests', 'mine', userId] as const,
    assigned: (userId: string) => ['requests', 'assigned', userId] as const,
    pinned: () => ['requests', 'pinned'] as const,
  },

  // Request notes/comments
  requestNotes: {
    all: ['requestNotes'] as const,
    list: (requestId: string) => ['requestNotes', 'list', requestId] as const,
    unreadCounts: (requestIds: string[], userId: string) =>
      ['requestNotes', 'unreadCounts', requestIds, userId] as const,
  },

  // Messages and conversations
  messages: {
    all: ['messages'] as const,
    conversation: (conversationId: string) => ['messages', 'conversation', conversationId] as const,
    conversations: () => ['messages', 'conversations'] as const,
    unreadCount: (userId: string) => ['messages', 'unreadCount', userId] as const,
  },

  // Sales Coach / Recordings
  recordings: {
    all: ['recordings'] as const,
    list: (userId: string) => ['recordings', 'list', userId] as const,
    detail: (id: string) => ['recordings', 'detail', id] as const,
    stats: (userId: string) => ['recordings', 'stats', userId] as const,
    leaderboard: (timeframe: string) => ['recordings', 'leaderboard', timeframe] as const,
  },

  // Activity logs
  activityLogs: {
    request: (requestId: string) => ['activityLogs', 'request', requestId] as const,
  },

  // Attachments
  attachments: {
    request: (requestId: string) => ['attachments', 'request', requestId] as const,
  },
} as const;

/**
 * Helper function to invalidate all related queries after a mutation
 *
 * Example usage:
 * ```typescript
 * const { mutate } = useMutation({
 *   mutationFn: updateRequest,
 *   onSuccess: () => {
 *     invalidateRequestQueries(queryClient, requestId);
 *   }
 * });
 * ```
 */
export function invalidateRequestQueries(client: QueryClient, requestId: string) {
  // Invalidate the specific request
  client.invalidateQueries({ queryKey: queryKeys.requests.detail(requestId) });

  // Invalidate request lists (they might include this request)
  client.invalidateQueries({ queryKey: queryKeys.requests.all });

  // Invalidate notes for this request
  client.invalidateQueries({ queryKey: queryKeys.requestNotes.list(requestId) });

  // Invalidate activity logs
  client.invalidateQueries({ queryKey: queryKeys.activityLogs.request(requestId) });
}

/**
 * Helper function to invalidate message queries after sending/receiving messages
 */
export function invalidateMessageQueries(client: QueryClient, conversationId: string) {
  // Invalidate the specific conversation
  client.invalidateQueries({ queryKey: queryKeys.messages.conversation(conversationId) });

  // Invalidate conversation list (update timestamps, unread counts)
  client.invalidateQueries({ queryKey: queryKeys.messages.conversations() });

  // Invalidate unread counts
  client.invalidateQueries({ queryKey: ['messages', 'unreadCount'] });
}

/**
 * Helper function to prefetch data before navigation
 *
 * Example usage:
 * ```typescript
 * // Prefetch request details when hovering over a link
 * const handleMouseEnter = () => {
 *   prefetchRequest(queryClient, requestId);
 * };
 * ```
 */
export async function prefetchRequest(client: QueryClient, requestId: string) {
  await client.prefetchQuery({
    queryKey: queryKeys.requests.detail(requestId),
    queryFn: () => import('../features/requests/lib/requests').then(m => m.getRequestById(requestId)),
  });
}
