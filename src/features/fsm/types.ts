// FSM Types - Field Service Management

// ============================================
// STATUS ENUMS
// ============================================

export type RequestStatus =
  | 'pending'           // New request awaiting review
  | 'assessment_scheduled'  // Site visit scheduled
  | 'assessment_today'  // Assessment is today
  | 'assessment_overdue' // Assessment date passed
  | 'assessment_completed' // Site visit done
  | 'converted'         // Converted to quote
  | 'archived';         // Closed without conversion

export type QuoteStatus =
  | 'draft'             // Being prepared
  | 'pending_approval'  // Waiting for manager approval
  | 'sent'              // Sent to client
  | 'follow_up'         // Follow-up needed (3+ days since sent)
  | 'changes_requested' // Client requested changes
  | 'approved'          // Client approved
  | 'converted'         // Converted to job
  | 'lost';             // Deal lost

export type JobStatus =
  | 'won'               // Job created from quote
  | 'scheduled'         // Date and crew assigned
  | 'ready_for_yard'    // Ready for material prep (2 days before)
  | 'picking'           // Yard is pulling materials
  | 'staged'            // Materials staged
  | 'loaded'            // Truck loaded
  | 'in_progress'       // Work started
  | 'completed'         // Work done
  | 'requires_invoicing'; // Ready to invoice

export type InvoiceStatus =
  | 'draft'             // Not sent yet
  | 'sent'              // Awaiting payment
  | 'past_due'          // Payment overdue
  | 'paid'              // Fully paid
  | 'bad_debt';         // Written off

export type VisitStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type RequestSource = 'phone' | 'web' | 'referral' | 'walk_in' | 'builder_portal';
export type RequestType = 'new_quote' | 'repair' | 'warranty';
export type PaymentMethod = 'card' | 'check' | 'cash' | 'ach' | 'qbo_payment';
export type VisitType = 'installation' | 'followup' | 'warranty' | 'inspection';
export type ProjectStatus = 'active' | 'complete' | 'on_hold' | 'cancelled' | 'warranty';

// ============================================
// ENTITIES
// ============================================

export interface Territory {
  id: string;
  name: string;
  code: string;
  zip_codes: string[];
  business_unit_id: string | null; // Legacy - use location_code instead
  location_code: string | null; // 'ATX', 'SA', 'HOU'
  disabled_qbo_class_ids: string[]; // QBO class IDs disabled for this territory
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalesRep {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  territory_ids: string[];
  product_skills: string[];
  max_daily_assessments: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// User profile for rep joins (replaces SalesRep in new code)
export interface RepUser {
  id: string;  // user_id from auth.users
  full_name: string | null;
  email: string;
  phone: string | null;
}

export interface Crew {
  id: string;
  name: string;
  code: string;
  crew_size: number;
  max_daily_lf: number;
  product_skills: string[];
  business_unit_id: string | null; // Legacy - use location_code instead
  location_code: string | null; // 'ATX', 'SA', 'HOU'
  home_territory_id: string | null;
  crew_type: CrewType;
  lead_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Subcontractor support (from migration 182)
  is_subcontractor: boolean;
  lead_name: string | null;
  lead_phone: string | null;
  // Geocoding (from migration 178)
  home_latitude?: number | null;
  home_longitude?: number | null;
  home_address?: string | null;
  // Joined
  members?: CrewMember[];
  territory?: Territory;
  lead_user?: { id: string; email: string; full_name: string | null };
  location?: { code: string; name: string }; // Location info from locations table
  // Assignment summary (from view)
  aligned_reps_count?: number;
  preferred_by_clients?: number;
  preferred_by_communities?: number;
  total_assignments?: number;
}

export interface CrewMember {
  id: string;
  crew_id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  is_lead: boolean;
  is_active: boolean;
  joined_at: string;
}

export interface Project {
  id: string;
  project_number: string;
  // Customer
  client_id: string | null;
  community_id: string | null;
  property_id: string | null;
  // Info
  name: string | null;
  description: string | null;
  product_type: string | null;
  // Address
  address_line1: string | null;
  city: string | null;
  state: string;
  zip: string | null;
  // Assignment
  territory_id: string | null;
  assigned_rep_id: string | null;
  // Status
  status: ProjectStatus;
  // Financials
  total_quoted: number;
  total_invoiced: number;
  total_paid: number;
  // Timestamps
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined
  client?: { id: string; name: string };
  community?: { id: string; name: string };
  property?: { id: string; address_line1: string };
  territory?: { id: string; name: string; code: string };
  assigned_rep?: SalesRep;
  // Related entities
  requests?: ServiceRequest[];
  quotes?: Quote[];
  jobs?: Job[];
  invoices?: Invoice[];
}

export interface ServiceRequest {
  id: string;
  request_number: string;
  // Project
  project_id: string | null;
  // Customer
  client_id: string | null;
  community_id: string | null;
  property_id: string | null;
  // Contact
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  // Address
  address_line1: string | null;
  city: string | null;
  state: string;
  zip: string | null;
  // Geocoding (from migration 178)
  latitude: number | null;
  longitude: number | null;
  // Details
  source: RequestSource;
  request_type: RequestType;
  product_type: string | null;  // Deprecated: use product_types
  product_types: string[];      // Multi-select product types
  linear_feet_estimate: number | null;
  description: string | null;
  notes: string | null;
  // Assessment
  requires_assessment: boolean;
  assessment_scheduled_at: string | null;
  assessment_completed_at: string | null;
  assessment_rep_id: string | null;      // Legacy - use assessment_rep_user_id
  assessment_rep_user_id: string | null; // FK to auth.users
  assessment_notes: string | null;
  // Status
  status: RequestStatus;
  status_changed_at: string;
  // Assignment
  assigned_rep_id: string | null;        // Legacy - use assigned_rep_user_id
  assigned_rep_user_id: string | null;   // FK to auth.users
  territory_id: string | null;
  business_unit_id: string | null;  // Legacy - use qbo_class_id instead
  qbo_class_id: string | null;      // QBO Class for accounting (e.g., "588451" = Austin Residential)
  // Priority
  priority: Priority;
  // Conversion
  converted_to_quote_id: string | null;
  converted_to_job_id: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined
  client?: { id: string; name: string };
  community?: { id: string; name: string };
  property?: { id: string; address_line1: string };
  assigned_rep?: SalesRep;           // Legacy - use assigned_rep_user
  assessment_rep?: SalesRep;         // Legacy - use assessment_rep_user
  assigned_rep_user?: RepUser;       // New: joined from user_profiles
  assessment_rep_user?: RepUser;     // New: joined from user_profiles
  territory?: { id: string; name: string; code: string };
  project?: { id: string; project_number: string };
  qbo_class?: { id: string; name: string; bu_type: string; location_code: string | null };
}

export interface Quote {
  id: string;
  quote_number: string;
  // Project
  project_id: string | null;
  // Source
  request_id: string | null;
  bom_project_id: string | null;
  // Customer
  client_id: string;
  community_id: string | null;
  property_id: string | null;
  billing_address: AddressSnapshot | null;
  job_address: AddressSnapshot | null;
  // Pricing
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  discount_percent: number;
  total: number;
  // Cost tracking
  total_material_cost: number;
  total_labor_cost: number;
  margin_percent: number | null;
  // Terms
  valid_until: string | null;
  payment_terms: string;
  deposit_required: number;
  deposit_percent: number;
  // Scope
  product_type: string | null;
  linear_feet: number | null;
  scope_summary: string | null;
  // Approval
  requires_approval: boolean;
  approval_status: 'pending' | 'approved' | 'rejected' | null;
  approval_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  // Status
  status: QuoteStatus;
  status_changed_at: string;
  // Communication
  sent_at: string | null;
  sent_method: string | null;
  sent_to_email: string | null;
  viewed_at: string | null;
  // Client response
  client_approved_at: string | null;
  client_signature: string | null;
  client_po_number: string | null;
  lost_reason: string | null;
  lost_to_competitor: string | null;
  // Conversion
  converted_to_job_id: string | null;
  // Assignment
  sales_rep_id: string | null;       // Legacy - use sales_rep_user_id
  sales_rep_user_id: string | null;  // FK to auth.users
  qbo_class_id: string | null;       // QBO Class for accounting
  created_by: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  // Joined
  client?: {
    id: string;
    name: string;
    code?: string;
    billing_address_line1?: string;
    billing_city?: string;
    billing_state?: string;
    billing_zip?: string;
    primary_contact_email?: string;
    primary_contact_phone?: string;
    primary_contact_name?: string;
  };
  community?: { id: string; name: string };
  property?: { id: string; address_line1: string; city?: string; state?: string; zip?: string };
  line_items?: QuoteLineItem[];
  sales_rep?: SalesRep;              // Legacy - use sales_rep_user
  sales_rep_user?: RepUser;          // New: joined from user_profiles
  request?: { id: string; request_number: string };
  qbo_class?: { id: string; name: string; bu_type: string; location_code: string | null };
}

export interface QuoteLineItem {
  id: string;
  quote_id: string;
  line_type: 'material' | 'labor' | 'service' | 'adjustment' | 'discount';
  description: string;
  quantity: number;
  unit_type: string | null;
  unit_price: number;
  unit_cost: number | null;
  total_price: number;
  material_id: string | null;
  labor_code_id: string | null;
  sku_id: string | null;
  bom_line_item_id: string | null;
  sort_order: number;
  is_visible_to_client: boolean;
  group_name: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  job_number: string;
  // Project
  project_id: string | null;
  // Source
  quote_id: string | null;
  request_id: string | null;  // Direct from request (no quote)
  // Warranty
  is_warranty: boolean;
  // Customer
  client_id: string;
  community_id: string | null;
  property_id: string | null;
  job_address: AddressSnapshot;
  // Geocoding (from migration 178)
  site_latitude?: number | null;
  site_longitude?: number | null;
  geocoded_at?: string | null;
  // Scope
  product_type: string | null;
  linear_feet: number | null;
  description: string | null;
  special_instructions: string | null;
  // Pricing
  quoted_total: number | null;
  // Schedule
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  estimated_duration_hours: number | null;
  // Assignment
  assigned_crew_id: string | null;
  assigned_rep_id: string | null;        // Legacy - use assigned_rep_user_id
  assigned_rep_user_id: string | null;   // FK to auth.users
  territory_id: string | null;
  qbo_class_id: string | null;  // QBO Class for accounting
  // Status
  status: JobStatus;
  status_changed_at: string;
  // Yard workflow
  ready_for_yard_at: string | null;
  picking_started_at: string | null;
  picking_completed_at: string | null;
  staging_completed_at: string | null;
  // Field workflow
  loaded_at: string | null;
  work_started_at: string | null;
  work_completed_at: string | null;
  // Completion
  completion_photos: string[];
  completion_signature: string | null;
  completion_notes: string | null;
  completed_by: string | null;
  // References
  invoice_id: string | null;
  bom_project_id: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined
  client?: { id: string; name: string };
  community?: { id: string; name: string };
  property?: { id: string; address_line1: string };
  assigned_crew?: Crew;
  assigned_rep_user?: RepUser;  // New: joined from user_profiles
  visits?: JobVisit[];
  qbo_class?: { id: string; name: string; bu_type: string; location_code: string | null };
}

export interface JobVisit {
  id: string;
  job_id: string;
  visit_number: number;
  visit_type: VisitType;
  scheduled_date: string;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  assigned_crew_id: string | null;
  status: VisitStatus;
  completed_at: string | null;
  notes: string | null;
  photos: string[];
  created_at: string;
  // Joined
  assigned_crew?: Crew;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  // Project
  project_id: string | null;
  // Source
  job_id: string | null;
  quote_id: string | null;
  // Customer
  client_id: string;
  billing_address: AddressSnapshot;
  // Amounts
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  // Terms
  invoice_date: string;
  due_date: string | null;
  payment_terms: string;
  po_number: string | null;
  // Status
  status: InvoiceStatus;
  status_changed_at: string;
  // Communication
  sent_at: string | null;
  sent_method: string | null;
  sent_to_email: string | null;
  // QBO
  qbo_invoice_id: string | null;
  qbo_sync_status: 'pending' | 'synced' | 'error' | null;
  qbo_synced_at: string | null;
  qbo_sync_error: string | null;
  qbo_class_id: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined
  client?: { id: string; name: string };
  job?: Job;
  line_items?: InvoiceLineItem[];
  payments?: Payment[];
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  quote_line_item_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  payment_date: string;
  notes: string | null;
  qbo_payment_id: string | null;
  created_at: string;
  recorded_by: string | null;
}

export interface AddressSnapshot {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface StatusHistoryEntry {
  id: string;
  entity_type: 'request' | 'quote' | 'job' | 'invoice';
  entity_id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by: string | null;
  notes: string | null;
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface TerritoryFormData {
  name: string;
  code: string;
  zip_codes: string;  // Comma-separated for input
  business_unit_id: string; // Legacy - use location_code instead
  location_code: string; // 'ATX', 'SA', 'HOU'
  disabled_qbo_class_ids: string[]; // QBO class IDs disabled for this territory
  is_active: boolean;
}

export interface SalesRepFormData {
  name: string;
  email: string;
  phone: string;
  user_id: string;
  territory_ids: string[];
  product_skills: string[];
  max_daily_assessments: number;
  is_active: boolean;
}

export interface CrewFormData {
  name: string;
  code: string;
  crew_size: number;
  max_daily_lf: number;
  product_skills: string[];
  business_unit_id: string; // Legacy - use location_code instead
  location_code: string; // 'ATX', 'SA', 'HOU'
  home_territory_id: string;
  crew_type: CrewType;
  lead_user_id: string;
  is_active: boolean;
  // Subcontractor support
  is_subcontractor: boolean;
  lead_name: string;
  lead_phone: string;
}

// ============================================
// REP-CREW ALIGNMENT TYPES
// ============================================

export interface RepCrewAlignment {
  id: string;
  rep_user_id: string;
  crew_id: string;
  skill_categories: string[];
  priority: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  crew?: Crew;
  rep_user?: { id: string; email: string; full_name?: string };
}

export interface RepCrewAlignmentFormData {
  crew_id: string;
  skill_categories: string[];
  priority: number;
  notes: string;
}

// ============================================
// COMMUNITY CREW PREFERENCE TYPES
// ============================================

export interface CommunityCrewPreference {
  id: string;
  community_id: string;
  crew_id: string;
  skill_categories: string[];
  priority: number;
  inherited_from_rep_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  crew?: Crew;
}

export interface ClientCrewPreference {
  id: string;
  client_id: string;
  crew_id: string;
  skill_categories: string[];
  priority: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  crew?: Crew;
}

export interface RequestFormData {
  // Customer selection
  client_id: string;
  community_id: string;
  property_id: string;
  // Contact (for non-clients / quick-add leads)
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  // Address
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  // Geocoding (from migration 178)
  latitude?: number | null;
  longitude?: number | null;
  // Details
  source: RequestSource;
  request_type: RequestType;
  product_types: string[];  // Multi-select product types
  linear_feet_estimate: string;
  description: string;
  notes: string;
  // Assessment
  requires_assessment: boolean;
  assessment_scheduled_at: string;
  // Assignment
  business_unit_id: string;  // BU for rep filtering
  assigned_rep_id: string;
  territory_id: string;
  priority: Priority;
}

// ============================================
// STATUS CONFIGURATION
// ============================================

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending',
  assessment_scheduled: 'Assessment Scheduled',
  assessment_today: 'Assessment Today',
  assessment_overdue: 'Assessment Overdue',
  assessment_completed: 'Assessment Completed',
  converted: 'Converted',
  archived: 'Archived',
};

export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  assessment_scheduled: 'bg-blue-100 text-blue-700',
  assessment_today: 'bg-amber-100 text-amber-700',
  assessment_overdue: 'bg-red-100 text-red-700',
  assessment_completed: 'bg-green-100 text-green-700',
  converted: 'bg-purple-100 text-purple-700',
  archived: 'bg-gray-100 text-gray-500',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  sent: 'Sent',
  follow_up: 'Follow-up Needed',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  converted: 'Converted to Job',
  lost: 'Lost',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  sent: 'bg-blue-100 text-blue-700',
  follow_up: 'bg-orange-100 text-orange-700',
  changes_requested: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  converted: 'bg-purple-100 text-purple-700',
  lost: 'bg-red-100 text-red-700',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  won: 'Won',
  scheduled: 'Scheduled',
  ready_for_yard: 'Ready for Yard',
  picking: 'Picking',
  staged: 'Staged',
  loaded: 'Loaded',
  in_progress: 'In Progress',
  completed: 'Completed',
  requires_invoicing: 'Requires Invoicing',
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  won: 'bg-green-100 text-green-700',
  scheduled: 'bg-blue-100 text-blue-700',
  ready_for_yard: 'bg-amber-100 text-amber-700',
  picking: 'bg-orange-100 text-orange-700',
  staged: 'bg-yellow-100 text-yellow-700',
  loaded: 'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  requires_invoicing: 'bg-purple-100 text-purple-700',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  past_due: 'Past Due',
  paid: 'Paid',
  bad_debt: 'Bad Debt',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  past_due: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
  bad_debt: 'bg-gray-100 text-gray-500',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

export const SOURCE_LABELS: Record<RequestSource, string> = {
  phone: 'Phone',
  web: 'Website',
  referral: 'Referral',
  walk_in: 'Walk-in',
  builder_portal: 'Builder Portal',
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  new_quote: 'New Quote',
  repair: 'Repair',
  warranty: 'Warranty',
};

export const REQUEST_TYPE_COLORS: Record<RequestType, string> = {
  new_quote: 'bg-blue-100 text-blue-700',
  repair: 'bg-orange-100 text-orange-700',
  warranty: 'bg-purple-100 text-purple-700',
};

// ============================================
// STATUS TRANSITIONS
// ============================================

export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ['assessment_scheduled', 'converted', 'archived'],
  assessment_scheduled: ['assessment_today', 'assessment_completed', 'archived'],
  assessment_today: ['assessment_completed', 'assessment_overdue'],
  assessment_overdue: ['assessment_completed', 'archived'],
  assessment_completed: ['converted', 'archived'],
  converted: [], // Terminal
  archived: ['pending'], // Can reopen
};

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['pending_approval', 'sent', 'lost'],
  pending_approval: ['sent', 'draft', 'lost'],
  sent: ['follow_up', 'changes_requested', 'approved', 'lost'],
  follow_up: ['sent', 'changes_requested', 'approved', 'lost'],
  changes_requested: ['draft', 'sent', 'lost'],
  approved: ['converted', 'lost'],
  converted: [], // Terminal
  lost: ['draft'], // Can revive
};

export const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  won: ['scheduled'],
  scheduled: ['ready_for_yard', 'won'],
  ready_for_yard: ['picking', 'scheduled'],
  picking: ['staged', 'ready_for_yard'],
  staged: ['loaded', 'picking'],
  loaded: ['in_progress', 'staged'],
  in_progress: ['completed', 'loaded'],
  completed: ['requires_invoicing'],
  requires_invoicing: [], // Terminal (creates invoice)
};

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent'],
  sent: ['past_due', 'paid', 'bad_debt'],
  past_due: ['paid', 'bad_debt'],
  paid: [], // Terminal
  bad_debt: [], // Terminal
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Credit/Debit Card',
  check: 'Check',
  cash: 'Cash',
  ach: 'ACH Transfer',
  qbo_payment: 'QBO Payment',
};

// ============================================
// PRODUCT TYPES (shared across system)
// ============================================

export const PRODUCT_TYPES = [
  'Wood Vertical',
  'Wood Horizontal',
  'Iron',
  'Chain Link',
  'Vinyl',
  'Gate',
  'Deck',
  'Glass Railing',
] as const;

export type ProductType = typeof PRODUCT_TYPES[number];

// ============================================
// APPROVAL THRESHOLDS
// ============================================

export const APPROVAL_THRESHOLDS = {
  QUOTE_TOTAL: 25000,        // Quotes > $25K need approval
  MARGIN_MINIMUM: 15,        // Quotes < 15% margin need approval
  DISCOUNT_MAXIMUM: 10,      // Quotes with > 10% discount need approval
};

// ============================================
// FSM TEAM PROFILE TYPES (Person-Centric Model)
// ============================================

export type FsmRole = 'rep' | 'project_manager' | 'crew_lead' | 'dispatcher' | 'manager';
export type CrewType = 'standard' | 'internal' | 'small_jobs';
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type SkillProficiency = 'trainee' | 'basic' | 'standard' | 'expert';

export const FSM_ROLE_LABELS: Record<FsmRole, string> = {
  rep: 'Sales Rep',
  project_manager: 'Project Manager',
  crew_lead: 'Crew Lead',
  dispatcher: 'Dispatcher',
  manager: 'Manager',
};

export const CREW_TYPE_LABELS: Record<CrewType, string> = {
  standard: 'Standard Crew',
  internal: 'Internal Crew',
  small_jobs: 'Small Jobs Crew',
};

export const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export const PROFICIENCY_LABELS: Record<SkillProficiency, string> = {
  trainee: 'Trainee',
  basic: 'Basic',
  standard: 'Standard',
  expert: 'Expert',
};

export const PROFICIENCY_MULTIPLIERS: Record<SkillProficiency, number> = {
  trainee: 1.30,
  basic: 1.15,
  standard: 1.00,
  expert: 0.85,
};

export const PROFICIENCY_COLORS: Record<SkillProficiency, string> = {
  trainee: 'bg-orange-100 text-orange-700',
  basic: 'bg-yellow-100 text-yellow-700',
  standard: 'bg-blue-100 text-blue-700',
  expert: 'bg-green-100 text-green-700',
};

// ============================================
// PROJECT TYPES (BU-specific reference data)
// ============================================

export interface ProjectType {
  id: string;
  name: string;
  code: string;
  business_unit_id: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  // Joined
  business_unit?: { id: string; name: string };
}

// ============================================
// FSM TEAM PROFILE
// ============================================

export interface FsmTeamProfile {
  id: string;
  user_id: string;
  fsm_roles: FsmRole[];
  business_unit_ids: string[];
  max_daily_assessments: number;
  crew_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // BU assignments for rep filtering (from migration 182)
  assigned_qbo_class_ids: string[];
  // Joined from auth.users
  user?: {
    id: string;
    email: string;
    raw_user_meta_data?: {
      full_name?: string;
    };
  };
  // Joined crew
  crew?: Crew;
  // Joined crew alignments
  crew_alignments?: RepCrewAlignment[];
}

// ============================================
// TERRITORY COVERAGE
// ============================================

export interface FsmTerritoryCoverage {
  id: string;
  user_id: string;
  territory_id: string;
  coverage_days: DayOfWeek[] | null;  // null = all days
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  territory?: Territory;
}

// ============================================
// WORK SCHEDULE
// ============================================

export interface FsmWorkSchedule {
  id: string;
  user_id: string;
  day_of_week: DayOfWeek;
  start_time: string;  // TIME as string "HH:MM:SS"
  end_time: string;
  created_at: string;
}

// ============================================
// PERSON SKILLS
// ============================================

export interface FsmPersonSkill {
  id: string;
  user_id: string;
  project_type_id: string;
  proficiency: SkillProficiency;
  duration_multiplier: number;
  certified_at: string | null;
  certification_expires: string | null;
  certified_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  project_type?: ProjectType;
}

// ============================================
// FULL TEAM MEMBER VIEW (from fsm_team_full view)
// ============================================

export interface FsmTeamMember {
  user_id: string;
  email: string;
  name: string;
  profile_id: string | null;
  fsm_roles: FsmRole[];
  business_unit_ids: string[];
  max_daily_assessments: number;
  crew_id: string | null;
  crew_name: string | null;
  is_active: boolean;
  // BU assignments for rep filtering (from migration 182)
  assigned_qbo_class_ids?: string[];
  // Aggregated data
  territories: {
    territory_id: string;
    territory_name: string;
    coverage_days: DayOfWeek[] | null;
    is_primary: boolean;
  }[];
  skills: {
    project_type_id: string;
    project_type_name: string;
    proficiency: SkillProficiency;
    duration_multiplier: number;
  }[];
  work_schedule: {
    day: DayOfWeek;
    start: string;
    end: string;
  }[];
}

// ============================================
// FORM DATA TYPES FOR NEW ENTITIES
// ============================================

export interface ProjectTypeFormData {
  name: string;
  code: string;
  business_unit_id: string;
  description: string;
  display_order: number;
  is_active: boolean;
}

export interface FsmTeamProfileFormData {
  user_id: string;
  fsm_roles: FsmRole[];
  assigned_qbo_class_ids: string[];  // QBO Classes this team member handles
  max_daily_assessments: number;
  crew_id: string;
  is_active: boolean;
  // Sub-forms
  territory_coverage: {
    territory_id: string;
    coverage_days: DayOfWeek[];
    is_primary: boolean;
  }[];
  work_schedule: {
    day_of_week: DayOfWeek;
    start_time: string;
    end_time: string;
  }[];
  skills: {
    project_type_id: string;
    proficiency: SkillProficiency;
  }[];
}


// ============================================
// SKILL TAGS (User-Definable)
// ============================================

export interface SkillTag {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  color: string;
  triggers_pm: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrewSkillTag {
  id: string;
  crew_id: string;
  skill_tag_id: string;
  proficiency: SkillProficiency;
  created_at: string;
  // Joined
  skill_tag?: SkillTag;
}

export interface SkillTagFormData {
  name: string;
  code: string;
  description: string;
  color: string;
  triggers_pm: boolean;
  display_order: number;
  is_active: boolean;
}

// ============================================
// INVOICE GROUPS (For Combined Invoicing)
// ============================================

export type InvoiceGroupStatus = 'pending' | 'ready' | 'invoiced' | 'partial';

export interface InvoiceGroup {
  id: string;
  group_number: string;
  project_id: string;
  total_value: number;
  status: InvoiceGroupStatus;
  invoice_id: string | null;
  invoiced_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  project?: Project;
  invoice?: Invoice;
  jobs?: Job[];
}

export const INVOICE_GROUP_STATUS_LABELS: Record<InvoiceGroupStatus, string> = {
  pending: 'Pending',
  ready: 'Ready to Invoice',
  invoiced: 'Invoiced',
  partial: 'Partial',
};

export const INVOICE_GROUP_STATUS_COLORS: Record<InvoiceGroupStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  ready: 'bg-green-100 text-green-700',
  invoiced: 'bg-blue-100 text-blue-700',
  partial: 'bg-amber-100 text-amber-700',
};

// ============================================
// EXTENDED JOB (with multi-job project support)
// ============================================

export interface JobWithContext extends Job {
  // New multi-job fields
  name: string | null;
  project_type_id: string | null;
  skill_tag_ids: string[];
  quote_line_item_ids: string[];
  sequence_order: number;
  depends_on_job_id: string | null;
  estimated_value: number | null;
  invoice_group_id: string | null;
  pm_required: boolean;
  pm_id: string | null;
  // Additional joins
  project?: ProjectWithJobs;
  project_type?: ProjectType;
  invoice_group?: InvoiceGroup;
  depends_on_job?: Job;
  skill_tags?: SkillTag[];
  quote_line_items?: QuoteLineItem[];
  pm?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

export interface JobFormData {
  name: string;
  project_id: string;
  project_type_id: string;
  skill_tag_ids: string[];
  quote_line_item_ids: string[];
  sequence_order: number;
  depends_on_job_id: string;
  estimated_value: string;  // String for form input
  assigned_crew_id: string;
  scheduled_date: string;
  pm_required: boolean;
  pm_id: string;
  description: string;
  special_instructions: string;
}

// ============================================
// EXTENDED PROJECT (with jobs and invoice grouping)
// ============================================

export interface ProjectWithJobs extends Project {
  // New fields
  default_invoice_together: boolean;
  job_count: number;
  // Extended joins
  jobs?: JobWithContext[];
  invoice_groups?: InvoiceGroup[];
}

export interface ProjectFormData {
  name: string;
  client_id: string;
  community_id: string;
  property_id: string;
  product_type: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  territory_id: string;
  assigned_rep_id: string;
  default_invoice_together: boolean;
}

// ============================================
// QUOTE TO PROJECT CONVERSION
// ============================================

export interface QuoteToJobConfig {
  name: string;
  project_type_id: string;
  skill_tag_ids: string[];
  quote_line_item_ids: string[];
  assigned_crew_id: string;
  scheduled_date: string;
  sequence_order: number;
  depends_on_previous: boolean;
}

export interface QuoteToProjectConversion {
  quote_id: string;
  project_name: string;
  invoice_together: boolean;
  jobs: QuoteToJobConfig[];
}
