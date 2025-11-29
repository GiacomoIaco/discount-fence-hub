import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type {
  Request,
  RequestStage,
  RequestType,
  CreateRequestInput,
  QuoteStatus,
  SLAStatus,
  RequestNote
} from '../lib/requests';
import {
  getMyRequests,
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequest,
  assignRequest,
  updateRequestStage,
  addQuote,
  archiveRequest,
  getRequestNotes,
  addRequestNote,
  getRequestActivity,
  subscribeToRequests
} from '../lib/requests';
import { queryKeys } from '../../../lib/queryClient';

// ============================================
// QUERY HOOKS
// ============================================

/**
 * Query hook to get requests for current user
 */
export function useMyRequestsQuery(filters?: {
  stage?: RequestStage;
  request_type?: RequestType;
  search?: string;
}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.requests.myRequests(filters),
    queryFn: () => getMyRequests(filters),
    staleTime: 1000 * 5, // 5 seconds - requests need to be fresh
    refetchOnMount: 'always', // Always refetch when component mounts (tab changes)
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const unsubscribe = subscribeToRequests(() => {
      // Invalidate and refetch on realtime changes
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    });

    return unsubscribe;
  }, [queryClient]);

  return query;
}

/**
 * Query hook to get all requests (operations view)
 */
export function useAllRequestsQuery(filters?: {
  stage?: RequestStage;
  request_type?: RequestType;
  assigned_to?: string;
  submitter_id?: string;
  sla_status?: SLAStatus;
  search?: string;
}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.requests.allRequests(filters),
    queryFn: () => getAllRequests(filters),
    staleTime: 1000 * 5, // 5 seconds - requests need to be fresh
    refetchOnMount: 'always', // Always refetch when component mounts (tab changes)
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const unsubscribe = subscribeToRequests(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    });

    return unsubscribe;
  }, [queryClient]);

  return query;
}

/**
 * Query hook to get single request by ID
 */
export function useRequestQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.requests.detail(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('Request ID is required');
      return getRequestById(id);
    },
    enabled: !!id, // Only run query if id exists
    staleTime: 1000 * 60, // 1 minute - individual request data is less volatile
  });
}

/**
 * Query hook to get request notes
 */
export function useRequestNotesQuery(requestId: string | null) {
  return useQuery({
    queryKey: queryKeys.requests.notes(requestId ?? ''),
    queryFn: () => {
      if (!requestId) return [];
      return getRequestNotes(requestId);
    },
    enabled: !!requestId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Query hook to get request activity
 */
export function useRequestActivityQuery(requestId: string | null) {
  return useQuery({
    queryKey: queryKeys.requests.activity(requestId ?? ''),
    queryFn: () => {
      if (!requestId) return [];
      return getRequestActivity(requestId);
    },
    enabled: !!requestId,
    staleTime: 1000 * 60, // 1 minute
  });
}

// ============================================
// MUTATION HOOKS
// ============================================

/**
 * Mutation hook to create a request
 */
export function useCreateRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRequestInput) => createRequest(data),
    onSuccess: (newRequest) => {
      // Invalidate and refetch request lists
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });

      // Optimistically add to cache
      queryClient.setQueryData(
        queryKeys.requests.detail(newRequest.id),
        newRequest
      );
    },
  });
}

/**
 * Mutation hook to update a request
 */
export function useUpdateRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Request> }) =>
      updateRequest(id, updates),
    onSuccess: (updatedRequest, variables) => {
      // Update the specific request in cache
      queryClient.setQueryData(
        queryKeys.requests.detail(variables.id),
        updatedRequest
      );

      // Invalidate lists to reflect changes
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });
}

/**
 * Mutation hook to assign a request
 */
export function useAssignRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, assigneeId }: { requestId: string; assigneeId: string }) =>
      assignRequest(requestId, assigneeId),
    onSuccess: (updatedRequest, variables) => {
      queryClient.setQueryData(
        queryKeys.requests.detail(variables.requestId),
        updatedRequest
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });
}

/**
 * Mutation hook to update request stage
 */
export function useUpdateRequestStageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      stage,
      quoteStatus,
    }: {
      requestId: string;
      stage: RequestStage;
      quoteStatus?: QuoteStatus;
    }) => updateRequestStage(requestId, stage, quoteStatus),
    onSuccess: (updatedRequest, variables) => {
      queryClient.setQueryData(
        queryKeys.requests.detail(variables.requestId),
        updatedRequest
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });
}

/**
 * Mutation hook to add a quote
 */
export function useAddQuoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, quotedPrice }: { requestId: string; quotedPrice: number }) =>
      addQuote(requestId, quotedPrice),
    onSuccess: (updatedRequest, variables) => {
      queryClient.setQueryData(
        queryKeys.requests.detail(variables.requestId),
        updatedRequest
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });
}

/**
 * Mutation hook to archive a request
 */
export function useArchiveRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) =>
      archiveRequest(requestId, reason),
    onSuccess: (updatedRequest, variables) => {
      queryClient.setQueryData(
        queryKeys.requests.detail(variables.requestId),
        updatedRequest
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });
}

/**
 * Mutation hook to add a note to a request
 */
export function useAddRequestNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      content,
      noteType = 'comment',
    }: {
      requestId: string;
      content: string;
      noteType?: 'comment' | 'internal' | 'status_change';
    }) => addRequestNote(requestId, content, noteType),
    onSuccess: (newNote, variables) => {
      // Add the new note to the cache
      queryClient.setQueryData<RequestNote[]>(
        queryKeys.requests.notes(variables.requestId),
        (old) => [...(old ?? []), newNote]
      );

      // Invalidate request to update its updated_at timestamp
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.detail(variables.requestId),
      });
    },
  });
}
