import { supabase } from './supabase';

// ============================================
// TYPES
// ============================================

export type RequestType = 'pricing' | 'material' | 'support' | 'new_builder' | 'warranty' | 'other';
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
}

export interface RequestNote {
  id: string;
  request_id: string;
  user_id: string;
  note_type: 'comment' | 'internal' | 'status_change';
  content: string;
  created_at: string;
}

export interface RequestActivity {
  id: string;
  request_id: string;
  user_id?: string;
  action: string;
  details?: any;
  created_at: string;
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
 */
export async function createRequest(data: CreateRequestInput) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: request, error } = await supabase
    .from('requests')
    .insert({
      ...data,
      submitter_id: user.id,
      stage: 'new'
    })
    .select()
    .single();

  if (error) throw error;

  // Log creation activity
  await logActivity(request.id, 'created', { request_type: data.request_type });

  // Auto-assign based on rules
  await applyAssignmentRules(request);

  return request as Request;
}

/**
 * Apply assignment rules to a request
 */
async function applyAssignmentRules(request: Request) {
  try {
    // Find active assignment rules for this request type, ordered by priority
    const { data: rules, error } = await supabase
      .from('request_assignment_rules')
      .select('*')
      .eq('request_type', request.request_type)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1);

    if (error) throw error;

    // If a rule exists, auto-assign (keep in 'new' stage until assignee views it)
    if (rules && rules.length > 0) {
      const rule = rules[0];
      await supabase
        .from('requests')
        .update({
          assigned_to: rule.assignee_id,
          assigned_at: new Date().toISOString(),
          stage: 'new'  // Stay in 'new' until assignee views it
        })
        .eq('id', request.id);

      // Log auto-assignment
      await logActivity(request.id, 'auto_assigned', {
        assignee_id: rule.assignee_id,
        rule_id: rule.id,
        rule_priority: rule.priority
      });
    }
  } catch (err) {
    // Log error but don't fail request creation
    console.error('Auto-assignment failed:', err);
  }
}

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
  const request = await updateRequest(requestId, {
    assigned_to: assigneeId,
    assigned_at: new Date().toISOString(),
    stage: 'new'  // Will auto-transition to 'pending' when assignee views it
  });

  await logActivity(requestId, 'assigned', { assignee_id: assigneeId });

  return request;
}

/**
 * Update request stage
 */
export async function updateRequestStage(requestId: string, stage: RequestStage, quoteStatus?: QuoteStatus) {
  const updates: Partial<Request> = { stage };

  if (stage === 'completed') {
    updates.completed_at = new Date().toISOString();
  }

  if (quoteStatus) {
    updates.quote_status = quoteStatus;
  }

  const request = await updateRequest(requestId, updates);

  await logActivity(requestId, 'status_changed', { to: stage, quote_status: quoteStatus });

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
 */
export async function addRequestNote(
  requestId: string,
  content: string,
  noteType: 'comment' | 'internal' | 'status_change' = 'comment'
) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('request_notes')
    .insert({
      request_id: requestId,
      user_id: user.id,
      note_type: noteType,
      content
    })
    .select()
    .single();

  if (error) throw error;

  await logActivity(requestId, 'note_added', { note_type: noteType });

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
 * Get unread counts for multiple requests
 */
export async function getUnreadCounts(requestIds: string[], userId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  // Batch fetch unread counts
  await Promise.all(
    requestIds.map(async (requestId) => {
      const count = await getUnreadCount(requestId, userId);
      if (count > 0) {
        counts.set(requestId, count);
      }
    })
  );

  return counts;
}
