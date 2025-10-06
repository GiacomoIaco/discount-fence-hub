import { useState, useEffect } from 'react';
import type {
  Request,
  RequestStage,
  RequestType,
  CreateRequestInput,
  QuoteStatus,
  SLAStatus
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

// ============================================
// HOOKS
// ============================================

/**
 * Hook to get requests for current user
 */
export function useMyRequests(filters?: {
  stage?: RequestStage;
  request_type?: RequestType;
  search?: string;
}) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await getMyRequests(filters);
      setRequests(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [filters?.stage, filters?.request_type, filters?.search]);

  // Subscribe to realtime updates
  useEffect(() => {
    const unsubscribe = subscribeToRequests(() => {
      loadRequests();
    });

    return unsubscribe;
  }, []);

  return {
    requests,
    loading,
    error,
    refresh: loadRequests
  };
}

/**
 * Hook to get all requests (operations view)
 */
export function useAllRequests(filters?: {
  stage?: RequestStage;
  request_type?: RequestType;
  assigned_to?: string;
  submitter_id?: string;
  sla_status?: SLAStatus;
  search?: string;
}) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await getAllRequests(filters);
      setRequests(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [filters?.stage, filters?.request_type, filters?.assigned_to, filters?.submitter_id, filters?.sla_status, filters?.search]);

  // Subscribe to realtime updates
  useEffect(() => {
    const unsubscribe = subscribeToRequests(() => {
      loadRequests();
    });

    return unsubscribe;
  }, []);

  return {
    requests,
    loading,
    error,
    refresh: loadRequests
  };
}

/**
 * Hook to get single request
 */
export function useRequest(id: string | null) {
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadRequest = async () => {
    if (!id) {
      setRequest(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getRequestById(id);
      setRequest(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequest();
  }, [id]);

  return {
    request,
    loading,
    error,
    refresh: loadRequest
  };
}

/**
 * Hook to create request
 */
export function useCreateRequest() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = async (data: CreateRequestInput) => {
    try {
      setCreating(true);
      setError(null);
      const request = await createRequest(data);
      return request;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setCreating(false);
    }
  };

  return {
    create,
    creating,
    error
  };
}

/**
 * Hook to update request
 */
export function useUpdateRequest() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = async (id: string, updates: Partial<Request>) => {
    try {
      setUpdating(true);
      setError(null);
      const request = await updateRequest(id, updates);
      return request;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  return {
    update,
    updating,
    error
  };
}

/**
 * Hook to assign request
 */
export function useAssignRequest() {
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const assign = async (requestId: string, assigneeId: string) => {
    try {
      setAssigning(true);
      setError(null);
      const request = await assignRequest(requestId, assigneeId);
      return request;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setAssigning(false);
    }
  };

  return {
    assign,
    assigning,
    error
  };
}

/**
 * Hook to update request stage
 */
export function useUpdateRequestStage() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateStage = async (requestId: string, stage: RequestStage, quoteStatus?: QuoteStatus) => {
    try {
      setUpdating(true);
      setError(null);
      const request = await updateRequestStage(requestId, stage, quoteStatus);
      return request;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  return {
    updateStage,
    updating,
    error
  };
}

/**
 * Hook to add quote
 */
export function useAddQuote() {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const quote = async (requestId: string, quotedPrice: number) => {
    try {
      setAdding(true);
      setError(null);
      const request = await addQuote(requestId, quotedPrice);
      return request;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setAdding(false);
    }
  };

  return {
    quote,
    adding,
    error
  };
}

/**
 * Hook to archive request
 */
export function useArchiveRequest() {
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const archive = async (requestId: string, reason?: string) => {
    try {
      setArchiving(true);
      setError(null);
      const request = await archiveRequest(requestId, reason);
      return request;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setArchiving(false);
    }
  };

  return {
    archive,
    archiving,
    error
  };
}

/**
 * Hook to get request notes
 */
export function useRequestNotes(requestId: string | null) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadNotes = async () => {
    if (!requestId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getRequestNotes(requestId);
      setNotes(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [requestId]);

  const addNote = async (content: string, noteType: 'comment' | 'internal' | 'status_change' = 'comment') => {
    if (!requestId) return;

    try {
      await addRequestNote(requestId, content, noteType);
      await loadNotes();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    notes,
    loading,
    error,
    addNote,
    refresh: loadNotes
  };
}

/**
 * Hook to get request activity
 */
export function useRequestActivity(requestId: string | null) {
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadActivity = async () => {
    if (!requestId) {
      setActivity([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getRequestActivity(requestId);
      setActivity(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, [requestId]);

  return {
    activity,
    loading,
    error,
    refresh: loadActivity
  };
}

/**
 * Hook to get calculated request age
 */
export function useRequestAge(request: Request | null) {
  const [age, setAge] = useState({ hours: 0, days: 0, color: 'green' });

  useEffect(() => {
    if (!request) return;

    const calculateAge = () => {
      const created = new Date(request.created_at).getTime();
      const now = Date.now();
      const ageMs = now - created;
      const hours = Math.floor(ageMs / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);

      let color = 'green';
      if (request.sla_status === 'breached') color = 'red';
      else if (request.sla_status === 'at_risk') color = 'yellow';

      setAge({ hours, days, color });
    };

    calculateAge();
    const interval = setInterval(calculateAge, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [request]);

  return age;
}
