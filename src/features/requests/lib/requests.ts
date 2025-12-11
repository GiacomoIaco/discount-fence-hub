import { supabase } from '../../../lib/supabase';
import { CreateRequestSchema, RequestNoteSchema, validateOrThrow } from '../../../lib/validation';
import {
  sendRequestNotification,
  buildAssignmentNotification,
  buildWatcherAddedNotification,
  buildCommentNotification,
  buildStatusChangeNotification,
  buildAttachmentNotification
} from './notifications';

// ============================================
// TYPES
// ============================================

export type RequestType =
  | 'pricing' | 'material' | 'support' | 'new_builder' | 'warranty' | 'other'
  // Client Hub types:
  | 'new_client' | 'new_community' | 'pricing_change' | 'contact_update';
export type RequestStage = 'new' | 'pending' | 'completed' | 'archived';
export type QuoteStatus = 'won' | 'lost' | 'awaiting' | null;
export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export type SLAStatus = 'on_track' | 'at_risk' | 'breached';

export interface Request {
  id: string;
  request_type: RequestType;
  title: string;
  description?: string;

  // Submitter
  submitter_id: string;
  submitted_at: string;

  // Customer
  customer_name?: string;
  customer_address?: string;
  customer_phone?: string;
  customer_email?: string;

  // Project details
  project_number?: string;
  fence_type?: string;
  linear_feet?: number;
  square_footage?: number;

  // Request specifics
  urgency: Urgency;
  expected_value?: number;
  deadline?: string;
  special_requirements?: string;

  // Voice & AI
  voice_recording_url?: string;
  voice_duration?: number;
  transcript?: string;
  transcript_confidence?: number;

  // Photos
  photo_urls?: string[];

  // Status
  stage: RequestStage;
  sub_status?: string;
  quote_status?: QuoteStatus;

  // Assignment
  assigned_to?: string;
  assigned_at?: string;

  // SLA
  first_response_at?: string;
  completed_at?: string;
  sla_target_hours?: number;
  sla_status?: SLAStatus;

  // Pricing (for pricing requests)
  pricing_quote?: number;
  quoted_at?: string;
  quoted_by?: string;

  // Operations
  internal_notes?: string;
  operations_attachments?: string[];
  priority_score?: number;

  // Client Hub links
  client_id?: string;
  community_id?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CreateRequestInput {
  request_type: RequestType;
  title: string;
  description?: string;
  customer_name?: string;
  customer_address?: string;
  customer_phone?: string;
  customer_email?: string;
  project_number?: string;
  fence_type?: string;
  linear_feet?: number;
  square_footage?: number;
  urgency: Urgency;
  expected_value?: number;
  deadline?: string;
  special_requirements?: string;
  voice_recording_url?: string;
  voice_duration?: number;
  transcript?: string;
  transcript_confidence?: number;
  photo_urls?: string[];
  // Client Hub links
  client_id?: string;
  community_id?: string;
}

export interface RequestNote {
  id: string;
  request_id: string;
  user_id: string;
  note_type: 'comment' | 'internal' | 'status_change';
  content: string;
  created_at: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
}

export interface RequestActivity {
  id: string;
  request_id: string;
  user_id?: string;
  action: string;
  details?: any;
  created_at: string;
}

export interface RequestAttachment {
  id: string;
  request_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: 'image' | 'document' | 'audio' | 'video' | 'other';
  file_size?: number;
  mime_type?: string;
  uploaded_at: string;
  description?: string;
}

export interface AssignmentRule {
  id: string;
  request_type: RequestType;
  assignee_id: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SLADefault {
  request_type: RequestType;
  target_hours: number;
  urgent_target_hours?: number;
  critical_target_hours?: number;
}

// ============================================
// REQUESTS CRUD
// ============================================

/**
 * Create a new request
 * @throws Error if validation fails or user not authenticated
 */
export async function createRequest(data: unknown) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // ✅ VALIDATE INPUT DATA
  const validatedData = validateOrThrow(CreateRequestSchema, data, 'Request data');

  const { data: request, error } = await supabase
    .from('requests')
    .insert({
      ...validatedData,
      submitter_id: user.id,
      stage: 'new'
    })
    .select()
    .single();

  if (error) throw error;

  // Log creation activity
  await logActivity(request.id, 'created', { request_type: validatedData.request_type });

  // Note: Auto-assignment is now handled by database trigger (trigger_auto_assign_on_insert)
  // The request returned already has assigned_to set if a matching rule exists

  return request as Request;
}

// Note: applyAssignmentRules is now handled by database trigger (trigger_auto_assign_on_insert)
// The trigger automatically sets assigned_to based on request_assignment_rules on INSERT

/**
 * Get all requests for current user
 */
export async function getMyRequests(filters?: {
  stage?: RequestStage;
  request_type?: RequestType;
  search?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  let query = supabase
    .from('requests')
    .select('*')
    .eq('submitter_id', user.id)
    .order('created_at', { ascending: false });

  if (filters?.stage) {
    query = query.eq('stage', filters.stage);
  }

  if (filters?.request_type) {
    query = query.eq('request_type', filters.request_type);
  }

  if (filters?.search) {
    query = query.or(`customer_name.ilike.%${filters.search}%,project_number.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data as Request[];
}

/**
 * Get all requests (operations/admin view)
 */
export async function getAllRequests(filters?: {
  stage?: RequestStage;
  request_type?: RequestType;
  assigned_to?: string;
  submitter_id?: string;
  sla_status?: SLAStatus;
  search?: string;
}) {
  let query = supabase
    .from('requests')
    .select('*')
    .order('priority_score', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.stage) {
    query = query.eq('stage', filters.stage);
  }

  if (filters?.request_type) {
    query = query.eq('request_type', filters.request_type);
  }

  if (filters?.assigned_to) {
    if (filters.assigned_to === 'unassigned') {
      query = query.is('assigned_to', null);
    } else {
      query = query.eq('assigned_to', filters.assigned_to);
    }
  }

  if (filters?.submitter_id) {
    query = query.eq('submitter_id', filters.submitter_id);
  }

  if (filters?.sla_status) {
    query = query.eq('sla_status', filters.sla_status);
  }

  if (filters?.search) {
    query = query.or(`customer_name.ilike.%${filters.search}%,project_number.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data as Request[];
}

/**
 * Get single request by ID
 */
export async function getRequestById(id: string) {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  return data as Request;
}

/**
 * Update request
 */
export async function updateRequest(id: string, updates: Partial<Request>) {
  const { data, error } = await supabase
    .from('requests')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return data as Request;
}

/**
 * Assign request to user
 * Sets stage to 'new' until assignee views the request
 */
export async function assignRequest(requestId: string, assigneeId: string) {
  const { data: { user } } = await supabase.auth.getUser();

  const request = await updateRequest(requestId, {
    assigned_to: assigneeId,
    assigned_at: new Date().toISOString(),
    stage: 'new'  // Will auto-transition to 'pending' when assignee views it
  });

  await logActivity(requestId, 'assigned', { assignee_id: assigneeId });

  // Send notification to assignee (fire-and-forget)
  if (user && assigneeId !== user.id) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    sendRequestNotification(buildAssignmentNotification(
      requestId,
      request.title,
      request.request_type,
      request.urgency || 'medium',
      user.id,
      profile?.full_name || 'Someone',
      assigneeId
    ));
  }

  return request;
}

/**
 * Update request stage
 */
export async function updateRequestStage(requestId: string, stage: RequestStage, quoteStatus?: QuoteStatus) {
  const { data: { user } } = await supabase.auth.getUser();

  // Get current request to know old stage
  const { data: currentRequest } = await supabase
    .from('requests')
    .select('stage, title, request_type')
    .eq('id', requestId)
    .single();

  const oldStage = currentRequest?.stage || 'unknown';

  const updates: Partial<Request> = { stage };

  if (stage === 'completed') {
    updates.completed_at = new Date().toISOString();
  }

  if (quoteStatus) {
    updates.quote_status = quoteStatus;
  }

  const request = await updateRequest(requestId, updates);

  await logActivity(requestId, 'status_changed', { to: stage, quote_status: quoteStatus });

  // Send notification for status change (fire-and-forget)
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    sendRequestNotification(buildStatusChangeNotification(
      requestId,
      request.title,
      request.request_type,
      user.id,
      profile?.full_name || 'Someone',
      oldStage,
      stage
    ));
  }

  return request;
}

/**
 * Add quote to pricing request
 */
export async function addQuote(requestId: string, quotedPrice: number) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const request = await updateRequest(requestId, {
    pricing_quote: quotedPrice,
    quoted_at: new Date().toISOString(),
    quoted_by: user.id,
    stage: 'completed',
    quote_status: 'awaiting'
  });

  await logActivity(requestId, 'quoted', { quoted_price: quotedPrice });

  return request;
}

/**
 * Delete request (archive)
 */
export async function archiveRequest(requestId: string, reason?: string) {
  const request = await updateRequest(requestId, {
    stage: 'archived'
  });

  await logActivity(requestId, 'archived', { reason });

  return request;
}

// ============================================
// REQUEST NOTES
// ============================================

/**
 * Add note to request
 * @throws Error if validation fails or user not authenticated
 */
export async function addRequestNote(
  requestId: string,
  content: string,
  noteType: 'comment' | 'internal' | 'status_change' = 'comment',
  fileInfo?: { fileUrl?: string; fileName?: string; fileType?: string }
) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // ✅ VALIDATE NOTE DATA
  const validatedNote = validateOrThrow(
    RequestNoteSchema,
    { request_id: requestId, note_type: noteType, content },
    'Note'
  );

  const { data, error } = await supabase
    .from('request_notes')
    .insert({
      request_id: validatedNote.request_id,
      user_id: user.id,
      note_type: validatedNote.note_type,
      content: validatedNote.content,
      ...(fileInfo?.fileUrl && { file_url: fileInfo.fileUrl }),
      ...(fileInfo?.fileName && { file_name: fileInfo.fileName }),
      ...(fileInfo?.fileType && { file_type: fileInfo.fileType })
    })
    .select()
    .single();

  if (error) throw error;

  // Update the request's updated_at timestamp to reflect this activity
  await supabase
    .from('requests')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', requestId);

  await logActivity(requestId, 'note_added', { note_type: noteType });

  // Send notification for comments only (not internal notes)
  if (noteType === 'comment') {
    const { data: request } = await supabase
      .from('requests')
      .select('title, request_type')
      .eq('id', requestId)
      .single();

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    if (request) {
      sendRequestNotification(buildCommentNotification(
        requestId,
        request.title,
        request.request_type,
        user.id,
        profile?.full_name || 'Someone',
        content
      ));
    }
  }

  return data as RequestNote;
}

/**
 * Get notes for request
 */
export async function getRequestNotes(requestId: string) {
  const { data, error } = await supabase
    .from('request_notes')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data as RequestNote[];
}

// ============================================
// REQUEST ACTIVITY
// ============================================

/**
 * Log activity
 */
export async function logActivity(requestId: string, action: string, details?: any) {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('request_activity_log')
    .insert({
      request_id: requestId,
      user_id: user?.id,
      action,
      details
    });

  if (error) console.error('Failed to log activity:', error);
}

/**
 * Get activity log for request
 */
export async function getRequestActivity(requestId: string) {
  const { data, error } = await supabase
    .from('request_activity_log')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data as RequestActivity[];
}

// ============================================
// ASSIGNMENT RULES
// ============================================

/**
 * Get assignment rule for request type
 */
export async function getAssignmentRule(requestType: RequestType) {
  const { data, error } = await supabase
    .from('request_assignment_rules')
    .select('*')
    .eq('request_type', requestType)
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data as AssignmentRule | null;
}

/**
 * Auto-assign request based on rules
 */
export async function autoAssignRequest(requestId: string, requestType: RequestType) {
  const rule = await getAssignmentRule(requestType);

  if (rule) {
    return await assignRequest(requestId, rule.assignee_id);
  }

  return null; // No rule found, leave unassigned
}

/**
 * Get all assignment rules
 */
export async function getAllAssignmentRules() {
  const { data, error } = await supabase
    .from('request_assignment_rules')
    .select('*')
    .order('request_type')
    .order('priority', { ascending: false });

  if (error) throw error;

  return data as AssignmentRule[];
}

/**
 * Create or update assignment rule
 */
export async function upsertAssignmentRule(rule: Partial<AssignmentRule> & { request_type: RequestType; assignee_id: string }) {
  const { data, error } = await supabase
    .from('request_assignment_rules')
    .upsert(rule)
    .select()
    .single();

  if (error) throw error;

  return data as AssignmentRule;
}

// ============================================
// SLA DEFAULTS
// ============================================

/**
 * Get SLA defaults
 */
export async function getSLADefaults() {
  const { data, error } = await supabase
    .from('request_sla_defaults')
    .select('*');

  if (error) throw error;

  return data as SLADefault[];
}

/**
 * Update SLA default
 */
export async function updateSLADefault(sla: SLADefault) {
  const { data, error } = await supabase
    .from('request_sla_defaults')
    .upsert(sla)
    .select()
    .single();

  if (error) throw error;

  return data as SLADefault;
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Get request counts by stage
 */
export async function getRequestCountsByStage() {
  const { data, error } = await supabase
    .rpc('get_request_counts_by_stage');

  if (error) {
    // Fallback if RPC doesn't exist yet
    const requests = await getAllRequests();
    const counts = requests.reduce((acc, req) => {
      acc[req.stage] = (acc[req.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return counts;
  }

  return data;
}

/**
 * Get average response time
 */
export async function getAverageResponseTime() {
  const { data, error } = await supabase
    .from('requests')
    .select('created_at, first_response_at')
    .not('first_response_at', 'is', null);

  if (error) throw error;

  if (!data || data.length === 0) return 0;

  const totalHours = data.reduce((sum, req) => {
    const created = new Date(req.created_at).getTime();
    const responded = new Date(req.first_response_at!).getTime();
    return sum + (responded - created) / (1000 * 60 * 60);
  }, 0);

  return totalHours / data.length;
}

/**
 * Get SLA compliance percentage
 */
export async function getSLACompliance() {
  const { data, error } = await supabase
    .from('requests')
    .select('sla_status')
    .in('stage', ['completed', 'archived']);

  if (error) throw error;

  if (!data || data.length === 0) return 100;

  const onTrack = data.filter(r => r.sla_status === 'on_track').length;
  return (onTrack / data.length) * 100;
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to request changes
 */
export function subscribeToRequests(
  callback: (payload: any) => void,
  filters?: { submitter_id?: string; assigned_to?: string }
) {
  let channel = supabase
    .channel('requests_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'requests',
        filter: filters?.submitter_id ? `submitter_id=eq.${filters.submitter_id}` : undefined
      },
      callback
    );

  if (filters?.assigned_to) {
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'requests',
        filter: `assigned_to=eq.${filters.assigned_to}`
      },
      callback
    );
  }

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================
// UNREAD MESSAGE TRACKING
// ============================================

/**
 * Mark request as viewed by current user
 * Also auto-transitions "new" stage to "pending" if the viewer is the assignee
 */
export async function markRequestAsViewed(requestId: string) {
  const { error } = await supabase.rpc('mark_request_viewed', {
    req_id: requestId
  });

  if (error) console.error('Failed to mark request as viewed:', error);

  // Auto-transition from "new" to "pending" if viewer is the assignee
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get the request
    const { data: request } = await supabase
      .from('requests')
      .select('id, stage, assigned_to')
      .eq('id', requestId)
      .single();

    // If request is "new" and current user is the assignee, move to "pending"
    if (request && request.stage === 'new' && request.assigned_to === user.id) {
      await supabase
        .from('requests')
        .update({ stage: 'pending' })
        .eq('id', requestId);

      await logActivity(requestId, 'status_changed', {
        from: 'new',
        to: 'pending',
        reason: 'Auto-transitioned when assignee viewed request'
      });
    }
  } catch (err) {
    console.error('Failed to auto-transition request:', err);
  }
}

/**
 * Get unread count for a request
 */
export async function getUnreadCount(requestId: string, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_count', {
    req_id: requestId,
    usr_id: userId
  });

  if (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Get unread counts for multiple requests (OPTIMIZED - single query)
 */
export async function getUnreadCounts(requestIds: string[], userId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (requestIds.length === 0) {
    return counts;
  }

  // Use batch RPC function to get all counts in one query
  const { data, error } = await supabase.rpc('get_unread_counts_batch', {
    req_ids: requestIds,
    usr_id: userId
  });

  if (error) {
    console.error('Failed to get unread counts batch:', error);
    return counts;
  }

  // Convert array of {request_id, unread_count} to Map
  data?.forEach((row: { request_id: string; unread_count: number }) => {
    if (row.unread_count > 0) {
      counts.set(row.request_id, row.unread_count);
    }
  });

  return counts;
}

/**
 * Get view status for multiple requests (which ones have been viewed by user)
 */
export async function getRequestViewStatus(requestIds: string[], userId: string): Promise<Set<string>> {
  const viewedIds = new Set<string>();

  const { data, error } = await supabase
    .from('request_views')
    .select('request_id')
    .eq('user_id', userId)
    .in('request_id', requestIds);

  if (error) {
    console.error('Failed to get request view status:', error);
    return viewedIds;
  }

  data?.forEach(view => viewedIds.add(view.request_id));

  return viewedIds;
}

// ============================================
// REQUEST PINS
// ============================================

/**
 * Toggle pin status for a request
 */
export async function toggleRequestPin(requestId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_request_pin', {
    req_id: requestId
  });

  if (error) {
    console.error('Failed to toggle request pin:', error);
    throw error;
  }

  return data as boolean; // Returns true if pinned, false if unpinned
}

/**
 * Get pinned request IDs for current user
 */
export async function getPinnedRequestIds(userId: string): Promise<Set<string>> {
  const pinnedIds = new Set<string>();

  const { data, error } = await supabase
    .from('request_pins')
    .select('request_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to get pinned requests:', error);
    return pinnedIds;
  }

  data?.forEach(pin => pinnedIds.add(pin.request_id));

  return pinnedIds;
}

// ============================================
// REQUEST ATTACHMENTS
// ============================================

/**
 * Upload file to Supabase Storage
 */
export async function uploadRequestFile(
  file: File,
  requestId: string
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Generate unique file name
  const fileExt = file.name.split('.').pop();
  const fileName = `${requestId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  // Upload to storage
  const { data, error } = await supabase.storage
    .from('request-attachments')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('File upload error:', error);
    throw error;
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('request-attachments')
    .getPublicUrl(data.path);

  return publicUrl;
}

/**
 * Determine file type from MIME type
 */
function getFileType(mimeType: string): 'image' | 'document' | 'audio' | 'video' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
  return 'other';
}

/**
 * Add attachment to request
 */
export async function addRequestAttachment(
  requestId: string,
  file: File,
  description?: string
): Promise<RequestAttachment> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Upload file first
  const fileUrl = await uploadRequestFile(file, requestId);

  // Save attachment metadata to database
  const { data, error } = await supabase
    .from('request_attachments')
    .insert({
      request_id: requestId,
      user_id: user.id,
      file_name: file.name,
      file_url: fileUrl,
      file_type: getFileType(file.type),
      file_size: file.size,
      mime_type: file.type,
      description
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save attachment metadata:', error);
    throw error;
  }

  // Log activity
  await logActivity(requestId, 'attachment_added', {
    file_name: file.name,
    file_type: getFileType(file.type)
  });

  // Send notification for new attachment (fire-and-forget)
  const { data: request } = await supabase
    .from('requests')
    .select('title, request_type')
    .eq('id', requestId)
    .single();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  if (request) {
    sendRequestNotification(buildAttachmentNotification(
      requestId,
      request.title,
      request.request_type,
      user.id,
      profile?.full_name || 'Someone',
      file.name
    ));
  }

  return data as RequestAttachment;
}

/**
 * Get attachments for a request
 */
export async function getRequestAttachments(requestId: string): Promise<RequestAttachment[]> {
  const { data, error } = await supabase
    .from('request_attachments')
    .select('*')
    .eq('request_id', requestId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('Failed to get attachments:', error);
    throw error;
  }

  return data as RequestAttachment[];
}

// ============================================
// REQUEST WATCHERS
// ============================================

export interface RequestWatcher {
  id: string;
  request_id: string;
  user_id: string;
  added_by: string | null;
  added_at: string;
  notify_on_comments: boolean;
  notify_on_status_change: boolean;
  notify_on_assignment: boolean;
  // Joined fields
  user?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url?: string | null;
  };
}

/**
 * Get watchers for a request
 */
export async function getRequestWatchers(requestId: string): Promise<RequestWatcher[]> {
  const { data, error } = await supabase
    .from('request_watchers')
    .select('*')
    .eq('request_id', requestId)
    .order('added_at', { ascending: true });

  if (error) {
    console.error('Failed to get watchers:', error);
    throw error;
  }

  if (!data || data.length === 0) return [];

  // Fetch user profiles separately
  const userIds = [...new Set(data.map(w => w.user_id))];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, avatar_url')
    .in('id', userIds);

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

  return data.map(watcher => ({
    ...watcher,
    user: profileMap.get(watcher.user_id) || undefined
  })) as RequestWatcher[];
}

/**
 * Add a watcher to a request
 */
export async function addRequestWatcher(requestId: string, userId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('add_request_watcher', {
    req_id: requestId,
    watcher_id: userId
  });

  if (error) {
    console.error('Failed to add watcher:', error);
    throw error;
  }

  // Log activity
  await logActivity(requestId, 'watcher_added', { user_id: userId });

  // Send notification to new watcher (if not adding self)
  if (user && userId !== user.id) {
    const { data: request } = await supabase
      .from('requests')
      .select('title, request_type')
      .eq('id', requestId)
      .single();

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    if (request) {
      sendRequestNotification(buildWatcherAddedNotification(
        requestId,
        request.title,
        request.request_type,
        user.id,
        profile?.full_name || 'Someone',
        userId
      ));
    }
  }

  return data as boolean;
}

/**
 * Remove a watcher from a request
 */
export async function removeRequestWatcher(requestId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('remove_request_watcher', {
    req_id: requestId,
    watcher_id: userId
  });

  if (error) {
    console.error('Failed to remove watcher:', error);
    throw error;
  }

  // Log activity
  await logActivity(requestId, 'watcher_removed', { user_id: userId });

  return data as boolean;
}

/**
 * Get request IDs that the current user is watching
 */
export async function getWatchedRequestIds(userId: string): Promise<Set<string>> {
  const watchedIds = new Set<string>();

  const { data, error } = await supabase
    .from('request_watchers')
    .select('request_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to get watched requests:', error);
    return watchedIds;
  }

  data?.forEach(w => watchedIds.add(w.request_id));

  return watchedIds;
}

// ============================================
// REQUEST ATTACHMENTS
// ============================================

/**
 * Delete attachment
 */
export async function deleteRequestAttachment(attachmentId: string): Promise<void> {
  // Get attachment details first
  const { data: attachment, error: fetchError } = await supabase
    .from('request_attachments')
    .select('*')
    .eq('id', attachmentId)
    .single();

  if (fetchError) {
    console.error('Failed to fetch attachment:', fetchError);
    throw fetchError;
  }

  // Extract file path from URL
  const url = new URL(attachment.file_url);
  const pathParts = url.pathname.split('/');
  const filePath = pathParts.slice(pathParts.indexOf('request-attachments') + 1).join('/');

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('request-attachments')
    .remove([filePath]);

  if (storageError) {
    console.error('Failed to delete from storage:', storageError);
    // Continue anyway to delete database record
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('request_attachments')
    .delete()
    .eq('id', attachmentId);

  if (dbError) {
    console.error('Failed to delete attachment record:', dbError);
    throw dbError;
  }

  // Log activity
  await logActivity(attachment.request_id, 'attachment_deleted', {
    file_name: attachment.file_name
  });
}
