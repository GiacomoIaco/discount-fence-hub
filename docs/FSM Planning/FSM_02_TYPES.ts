// ============================================================================
// FSM_02_TYPES.ts
// TypeScript Type Definitions for FSM (Field Service Management)
// ============================================================================
// Version: 1.0
// For: Claude Code Implementation
// Location: src/features/fsm/types.ts
// ============================================================================

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type RequestType = 
  | 'new_fence' 
  | 'repair' 
  | 'gate_only' 
  | 'consultation' 
  | 'warranty' 
  | 'other';

export type RequestSource = 
  | 'phone' 
  | 'website' 
  | 'walk_in' 
  | 'project_radar' 
  | 'referral' 
  | 'other';

export type RequestStatus = 
  | 'new' 
  | 'contacted' 
  | 'site_visit_scheduled' 
  | 'qualified' 
  | 'converted' 
  | 'declined' 
  | 'duplicate';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export type QuoteStatus = 
  | 'draft' 
  | 'pending_approval' 
  | 'approved' 
  | 'sent' 
  | 'viewed' 
  | 'accepted' 
  | 'rejected' 
  | 'expired' 
  | 'revised';

export type QuoteSentVia = 'email' | 'sms' | 'in_person' | 'portal';

export type JobType = 
  | 'installation' 
  | 'repair' 
  | 'warranty' 
  | 'service' 
  | 'inspection';

export type JobStatus = 
  | 'scheduled' 
  | 'confirmed' 
  | 'en_route' 
  | 'arrived' 
  | 'in_progress' 
  | 'completed' 
  | 'partial' 
  | 'rescheduled' 
  | 'cancelled' 
  | 'no_show';

export type InvoiceStatus = 
  | 'draft' 
  | 'pending_approval' 
  | 'approved' 
  | 'sent' 
  | 'viewed' 
  | 'partial' 
  | 'paid' 
  | 'overdue' 
  | 'void' 
  | 'disputed';

export type ScheduleEntryType = 
  | 'job' 
  | 'travel' 
  | 'break' 
  | 'blocked' 
  | 'meeting' 
  | 'training';

export type ScheduleEntryStatus = 
  | 'scheduled' 
  | 'confirmed' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export type CrewMemberRole = 'lead' | 'member' | 'helper';

export type AvailabilityType = 'available' | 'unavailable' | 'limited';

export type DiscountType = 'percentage' | 'fixed';

export type InvoiceLineItemType = 'material' | 'labor' | 'other' | 'discount';

export type PriceChangeType = 'percentage' | 'fixed' | 'csv' | 'manual';


// ============================================================================
// RESOURCE MANAGEMENT TYPES
// ============================================================================

/**
 * Territory - Geographic zone for assignment optimization
 */
export interface Territory {
  id: string;
  code: string;                         // 'ATX-NORTH', 'SA-DOWNTOWN'
  name: string;                         // 'Austin North'
  business_unit_id: string | null;
  
  // Geographic Bounds
  bounds: GeoJSON | null;               // GeoJSON polygon
  center_lat: number | null;
  center_lng: number | null;
  
  // Zip Code Coverage
  zip_codes: string[];                  // ['78701', '78702', '78703']
  
  // Default Assignments
  primary_crew_id: string | null;
  backup_crew_ids: string[];
  primary_rep_id: string | null;
  
  // Metrics
  avg_jobs_per_week: number;
  avg_revenue_per_week: number;
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Joined data
  business_unit?: BusinessUnit;
  primary_crew?: Crew;
  primary_rep?: UserProfile;
}

export interface TerritoryFormData {
  code: string;
  name: string;
  business_unit_id: string | null;
  zip_codes: string[];
  primary_crew_id: string | null;
  backup_crew_ids: string[];
  primary_rep_id: string | null;
  is_active: boolean;
}

/**
 * Crew - Installation team
 */
export interface Crew {
  id: string;
  crew_code: string;                    // 'ATX-CREW-01'
  crew_name: string;                    // 'Austin Team Alpha'
  
  business_unit_id: string;
  territory_id: string | null;
  lead_tech_id: string | null;
  
  // Capabilities
  skill_tags: string[];                 // ['wood_vertical', 'iron', 'commercial']
  max_daily_footage: number;            // Capacity planning
  
  contact_phone: string | null;
  is_active: boolean;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  business_unit?: BusinessUnit;
  territory?: Territory;
  lead_tech?: UserProfile;
  members?: CrewMember[];
}

export interface CrewFormData {
  crew_code: string;
  crew_name: string;
  business_unit_id: string;
  territory_id: string | null;
  lead_tech_id: string | null;
  skill_tags: string[];
  max_daily_footage: number;
  contact_phone: string | null;
  is_active: boolean;
}

/**
 * Crew Member - Junction table for crew composition
 */
export interface CrewMember {
  id: string;
  crew_id: string;
  user_id: string;
  role: CrewMemberRole;
  is_primary: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
  
  // Joined data
  user?: UserProfile;
}

/**
 * Sales Rep - Extended user data for sales representatives
 */
export interface SalesRep {
  id: string;
  user_id: string;
  
  business_unit_id: string | null;
  territory_ids: string[];
  
  // Capabilities
  handles_residential: boolean;
  handles_commercial: boolean;
  handles_builders: boolean;
  specialties: string[];
  
  // Performance Metrics
  ytd_quotes_sent: number;
  ytd_quotes_won: number;
  ytd_revenue: number;
  win_rate: number | null;
  avg_response_time_hours: number | null;
  
  // QUO Integration
  quo_user_id: string | null;
  quo_phone_numbers: string[];
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Joined data
  user?: UserProfile;
  business_unit?: BusinessUnit;
}

/**
 * Crew Availability - Block time, vacations, limited availability
 */
export interface CrewAvailability {
  id: string;
  crew_id: string;
  
  date_start: string;
  date_end: string | null;
  
  availability_type: AvailabilityType;
  reason: string | null;
  
  max_hours: number | null;
  max_footage: number | null;
  
  notes: string | null;
  created_at: string;
}


// ============================================================================
// FSM PIPELINE TYPES
// ============================================================================

/**
 * Service Request - Initial inquiry before estimate
 */
export interface ServiceRequest {
  id: string;
  request_number: string;               // 'REQ-2024-001234'
  
  request_type: RequestType;
  title: string;
  description: string | null;
  
  // Customer (may not be in Client Hub yet)
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  
  // Client Hub Links
  client_id: string | null;
  community_id: string | null;
  property_id: string | null;
  
  // Fence Details
  estimated_footage: number | null;
  fence_type_preference: string | null;
  
  // Source & Assignment
  source: RequestSource;
  source_reference: string | null;
  source_conversation_id: string | null;
  received_by: string | null;
  assigned_to: string | null;
  
  business_unit_id: string | null;
  
  // Status
  status: RequestStatus;
  priority: Priority;
  decline_reason: string | null;
  
  // Timestamps
  received_at: string;
  first_contact_at: string | null;
  site_visit_at: string | null;
  converted_at: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  client?: Client;
  community?: Community;
  property?: Property;
  business_unit?: BusinessUnit;
  assigned_user?: UserProfile;
  received_user?: UserProfile;
}

export interface ServiceRequestFormData {
  request_type: RequestType;
  title: string;
  description: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  client_id: string | null;
  community_id: string | null;
  property_id: string | null;
  estimated_footage: number | null;
  fence_type_preference: string | null;
  source: RequestSource;
  source_reference: string;
  business_unit_id: string | null;
  priority: Priority;
  assigned_to: string | null;
}

/**
 * Quote - Estimate/Proposal
 */
export interface Quote {
  id: string;
  
  project_id: string | null;
  request_id: string | null;
  
  quote_number: string;                 // 'QUO-2024-001234'
  version: number;
  is_active: boolean;
  parent_quote_id: string | null;
  
  // Customer
  client_id: string | null;
  community_id: string | null;
  property_id: string | null;
  
  // Site Info
  site_address: string;
  site_contact_name: string | null;
  site_contact_phone: string | null;
  
  // Business Context
  business_unit_id: string;
  rate_sheet_id: string | null;
  
  // Pricing Summary
  material_total: number;
  labor_total: number;
  subtotal: number;
  
  // Tax & Discounts
  tax_rate: number;
  tax_amount: number;
  discount_type: DiscountType | null;
  discount_value: number;
  discount_amount: number;
  discount_reason: string | null;
  
  grand_total: number;
  
  // Margin Tracking
  cost_total: number | null;
  margin_amount: number | null;
  margin_percent: number | null;
  
  // Validity
  valid_from: string;
  valid_until: string | null;
  
  // Status
  status: QuoteStatus;
  
  // Delivery Tracking
  sent_at: string | null;
  sent_via: QuoteSentVia | null;
  sent_to_email: string | null;
  sent_to_phone: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  
  // Customer Response
  customer_notes: string | null;
  rejection_reason: string | null;
  
  internal_notes: string | null;
  
  // Creator & Approver
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  client?: Client;
  business_unit?: BusinessUnit;
  project?: BOMProject;
  request?: ServiceRequest;
  line_items?: QuoteLineItem[];
  created_user?: UserProfile;
}

export interface QuoteFormData {
  project_id: string | null;
  request_id: string | null;
  client_id: string | null;
  community_id: string | null;
  property_id: string | null;
  site_address: string;
  site_contact_name: string;
  site_contact_phone: string;
  business_unit_id: string;
  rate_sheet_id: string | null;
  tax_rate: number;
  discount_type: DiscountType | null;
  discount_value: number;
  discount_reason: string;
  valid_until: string | null;
  internal_notes: string;
}

/**
 * Quote Line Item - Individual product/service in quote
 */
export interface QuoteLineItem {
  id: string;
  quote_id: string;
  
  bom_line_item_id: string | null;
  
  product_type: string;                 // 'wood_vertical', 'wood_horizontal', 'iron'
  product_id: string | null;
  sku_code: string;
  sku_name: string;
  
  // Specifications
  linear_feet: number;
  height_ft: number;
  style: string | null;
  post_type: string | null;             // 'WOOD', 'STEEL'
  
  // Gates
  gate_count: number;
  gate_details: GateDetail[] | null;
  
  // Calculated Quantities
  calculated_materials: Record<string, number> | null;
  calculated_labor: Record<string, number> | null;
  
  // Pricing
  material_cost: number;
  labor_cost: number;
  unit_price: number | null;
  line_total: number;
  
  // Display
  display_order: number;
  description: string | null;
  notes: string | null;
  
  created_at: string;
}

export interface GateDetail {
  type: 'single' | 'double' | 'sliding';
  width: number;
  notes?: string;
}

/**
 * Job - Scheduled work
 */
export interface Job {
  id: string;
  
  project_id: string | null;
  quote_id: string | null;
  request_id: string | null;
  
  job_number: string;                   // 'JOB-2024-001234'
  job_type: JobType;
  
  // Customer
  client_id: string | null;
  community_id: string | null;
  property_id: string | null;
  
  // Scheduling
  scheduled_date: string;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  estimated_duration_hours: number | null;
  
  // Assignment
  assigned_crew_id: string | null;
  assigned_techs: string[];
  
  // Location
  site_address: string;
  site_lat: number | null;
  site_lng: number | null;
  site_access_notes: string | null;
  site_contact_name: string | null;
  site_contact_phone: string | null;
  gate_code: string | null;
  
  business_unit_id: string;
  
  // Status
  status: JobStatus;
  
  // Execution Tracking
  confirmed_at: string | null;
  confirmed_by: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  
  // Completion Details
  completion_notes: string | null;
  completion_photos: string[];
  customer_signature_url: string | null;
  actual_duration_hours: number | null;
  actual_footage_installed: number | null;
  
  // Issues
  has_issues: boolean;
  issue_notes: string | null;
  requires_return_visit: boolean;
  return_visit_reason: string | null;
  
  // Rescheduling
  original_date: string | null;
  reschedule_reason: string | null;
  rescheduled_by: string | null;
  
  internal_notes: string | null;
  priority: Priority;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  client?: Client;
  crew?: Crew;
  quote?: Quote;
  project?: BOMProject;
  business_unit?: BusinessUnit;
}

export interface JobFormData {
  project_id: string | null;
  quote_id: string | null;
  job_type: JobType;
  client_id: string | null;
  community_id: string | null;
  property_id: string | null;
  scheduled_date: string;
  scheduled_time_start: string;
  scheduled_time_end: string;
  estimated_duration_hours: number;
  assigned_crew_id: string | null;
  assigned_techs: string[];
  site_address: string;
  site_access_notes: string;
  site_contact_name: string;
  site_contact_phone: string;
  gate_code: string;
  business_unit_id: string;
  priority: Priority;
  internal_notes: string;
}

/**
 * Invoice - Bill for completed work
 */
export interface Invoice {
  id: string;
  
  project_id: string | null;
  job_id: string | null;
  quote_id: string | null;
  
  invoice_number: string;
  
  // Customer/Billing
  client_id: string;
  billing_address: BillingAddress | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  po_number: string | null;
  
  business_unit_id: string;
  
  // Amounts
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  
  // Dates
  invoice_date: string;
  due_date: string | null;
  
  // Status
  status: InvoiceStatus;
  
  // Delivery
  sent_at: string | null;
  sent_via: string | null;
  sent_to_email: string | null;
  viewed_at: string | null;
  
  // Payment
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  
  // Integration
  qbo_invoice_id: string | null;
  service_titan_invoice_id: string | null;
  
  internal_notes: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  client?: Client;
  job?: Job;
  quote?: Quote;
  line_items?: InvoiceLineItem[];
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  
  item_type: InvoiceLineItemType;
  description: string;
  sku_code: string | null;
  
  quantity: number;
  unit_price: number;
  line_total: number;
  
  is_taxable: boolean;
  display_order: number;
  
  created_at: string;
}


// ============================================================================
// SCHEDULING TYPES
// ============================================================================

/**
 * Schedule Entry - Calendar block
 */
export interface ScheduleEntry {
  id: string;
  
  job_id: string | null;
  crew_id: string;
  
  entry_date: string;
  start_time: string;
  end_time: string;
  
  entry_type: ScheduleEntryType;
  status: ScheduleEntryStatus;
  
  // Location
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  
  estimated_footage: number | null;
  
  title: string | null;
  notes: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  job?: Job;
  crew?: Crew;
}

/**
 * Crew Day Availability - Computed availability for a day
 */
export interface CrewDayAvailability {
  date: string;
  availability_type: AvailabilityType;
  reason: string | null;
  scheduled_hours: number;
  scheduled_footage: number;
  available_hours: number;
  available_footage: number;
}


// ============================================================================
// HISTORY & AUDIT TYPES
// ============================================================================

export interface LaborRateHistory {
  id: string;
  labor_code_id: string;
  business_unit_id: string;
  old_rate: number | null;
  new_rate: number;
  effective_date: string;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
  
  // Joined data
  labor_code?: LaborCode;
  business_unit?: BusinessUnit;
  changed_user?: UserProfile;
}

export interface MaterialPriceHistory {
  id: string;
  material_id: string;
  material_sku: string;
  old_price: number | null;
  new_price: number;
  change_type: PriceChangeType | null;
  change_value: number | null;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
  
  // Joined data
  material?: Material;
  changed_user?: UserProfile;
}


// ============================================================================
// VIEW TYPES (Denormalized for display)
// ============================================================================

export interface QuoteSummary extends Quote {
  client_name: string | null;
  client_code: string | null;
  business_unit_code: string;
  business_unit_name: string;
  request_number: string | null;
  project_code: string | null;
  created_by_email: string | null;
  created_by_name: string | null;
}

export interface JobScheduleView extends Job {
  client_name: string | null;
  crew_code: string | null;
  crew_name: string | null;
  business_unit_code: string;
  quote_number: string | null;
  quote_total: number | null;
  project_code: string | null;
  project_name: string | null;
}

export interface RequestPipelineView extends ServiceRequest {
  client_name: string | null;
  business_unit_code: string | null;
  assigned_to_email: string | null;
  assigned_to_name: string | null;
  quote_count: number;
  latest_quote: string | null;
}


// ============================================================================
// HELPER TYPES
// ============================================================================

// Re-export existing types used in FSM (these should exist in your codebase)
export interface BusinessUnit {
  id: string;
  code: string;
  name: string;
  location: string;
  business_type: string;
  is_active: boolean;
}

export interface Client {
  id: string;
  name: string;
  code: string | null;
  // ... other fields from Client Hub
}

export interface Community {
  id: string;
  name: string;
  code: string | null;
  client_id: string;
  // ... other fields from Client Hub
}

export interface Property {
  id: string;
  address_line1: string;
  community_id: string;
  // ... other fields from Client Hub
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export interface BOMProject {
  id: string;
  project_code: string;
  project_name: string;
  // ... other fields from BOM Calculator
}

export interface LaborCode {
  id: string;
  labor_sku: string;
  description: string;
  unit_type: string;
}

export interface Material {
  id: string;
  material_sku: string;
  material_name: string;
  category: string;
  unit_cost: number;
  unit_type: string;
}

export interface RateSheet {
  id: string;
  name: string;
  code: string | null;
}

// GeoJSON type for territory bounds
export interface GeoJSON {
  type: string;
  coordinates: number[][][] | number[][];
}


// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AssignmentSuggestion {
  resourceType: 'rep' | 'crew';
  resourceId: string;
  resourceName: string;
  score: number;                        // 0-100
  reasons: string[];                    // ['territory_match', 'skill_match']
  conflicts: string[];                  // ['already_booked', 'capacity_exceeded']
  travelTime?: number;                  // Minutes from previous job
}

export interface BulkPriceUpdateResult {
  success: number;
  failed: number;
  errors: Array<{
    sku: string;
    error: string;
  }>;
}

export interface BulkRateUpdateResult {
  success: number;
  failed: number;
  errors: Array<{
    laborCode: string;
    businessUnit: string;
    error: string;
  }>;
}


// ============================================================================
// FORM FILTER TYPES
// ============================================================================

export interface RequestFilters {
  status?: RequestStatus[];
  priority?: Priority[];
  source?: RequestSource[];
  business_unit_id?: string;
  assigned_to?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface QuoteFilters {
  status?: QuoteStatus[];
  business_unit_id?: string;
  client_id?: string;
  created_by?: string;
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  max_amount?: number;
  search?: string;
}

export interface JobFilters {
  status?: JobStatus[];
  job_type?: JobType[];
  business_unit_id?: string;
  crew_id?: string;
  client_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface ScheduleFilters {
  crew_ids?: string[];
  business_unit_id?: string;
  date_from: string;
  date_to: string;
}


// ============================================================================
// CONSTANTS
// ============================================================================

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  site_visit_scheduled: 'Site Visit Scheduled',
  qualified: 'Qualified',
  converted: 'Converted',
  declined: 'Declined',
  duplicate: 'Duplicate',
};

export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  site_visit_scheduled: 'bg-purple-100 text-purple-800',
  qualified: 'bg-green-100 text-green-800',
  converted: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-gray-100 text-gray-800',
  duplicate: 'bg-gray-100 text-gray-500',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  revised: 'Revised',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  sent: 'bg-indigo-100 text-indigo-800',
  viewed: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
  revised: 'bg-gray-100 text-gray-600',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  en_route: 'En Route',
  arrived: 'Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  partial: 'Partial',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  en_route: 'bg-yellow-100 text-yellow-800',
  arrived: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  rescheduled: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-red-100 text-red-600',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

export const SKILL_TAG_OPTIONS = [
  'wood_vertical',
  'wood_horizontal', 
  'iron',
  'commercial',
  'residential',
  'large_projects',
  'repairs',
  'gates',
  'custom',
] as const;

export const FENCE_TYPE_OPTIONS = [
  { value: 'wood_vertical', label: 'Wood Vertical' },
  { value: 'wood_horizontal', label: 'Wood Horizontal' },
  { value: 'iron', label: 'Iron' },
] as const;
