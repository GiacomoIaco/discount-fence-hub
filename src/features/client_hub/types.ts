// Client Hub Types - O-027

export interface Geography {
  id: string;
  code: string;
  name: string;
  state: string;
  base_labor_rate: number | null;
  labor_rate_multiplier: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BusinessUnit = 'residential' | 'commercial' | 'builders';
export type ClientType = 'large_builder' | 'custom_builder' | 'landscaper' | 'pool_company' | 'homeowner' | 'other';
export type ClientStatus = 'prospect' | 'onboarding' | 'active' | 'inactive';
export type CommunityStatus = 'onboarding' | 'active' | 'inactive' | 'completed';

export interface Client {
  id: string;
  name: string;
  code: string | null;
  business_unit: BusinessUnit;
  client_type: ClientType;

  // Contact info
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  billing_email: string | null;

  // Address
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string;
  zip: string | null;

  // Pricing
  default_rate_sheet_id: string | null;

  // Invoicing
  invoicing_frequency: 'per_job' | 'weekly' | 'monthly';
  payment_terms: number;
  requires_po: boolean;

  // Integration
  quickbooks_id: string | null;
  servicetitan_id: string | null;

  // Status
  status: ClientStatus;
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;

  // Metadata
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;

  // Computed/joined
  communities_count?: number;
  contacts?: ClientContact[];
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

export interface Community {
  id: string;
  client_id: string;
  geography_id: string | null;
  name: string;
  code: string | null;

  // Address
  address_line1: string | null;
  city: string | null;
  state: string;
  zip: string | null;

  // Pricing
  rate_sheet_id: string | null;

  // SKU Restrictions
  approved_sku_ids: string[];
  restrict_skus: boolean;

  // Status
  status: CommunityStatus;
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;

  // Metadata
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Joined
  client?: Client;
  geography?: Geography;
  contacts?: CommunityContact[];
}

export interface CommunityContact {
  id: string;
  community_id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

export interface OnboardingChecklistTemplate {
  id: string;
  entity_type: 'client' | 'community';
  name: string;
  items: ChecklistItem[];
  is_default: boolean;
}

export interface ChecklistItem {
  name: string;
  required: boolean;
  order: number;
  completed?: boolean;
  completed_at?: string;
  completed_by?: string;
  notes?: string;
}

export interface OnboardingChecklist {
  id: string;
  entity_type: 'client' | 'community';
  entity_id: string;
  template_id: string | null;
  items: ChecklistItem[];
  started_at: string;
  completed_at: string | null;
}

export interface ClientDocument {
  id: string;
  client_id: string | null;
  community_id: string | null;
  document_type: 'contract' | 'pricing_agreement' | 'w9' | 'insurance' | 'other';
  name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

// Form types
export interface ClientFormData {
  name: string;
  code: string;
  business_unit: BusinessUnit;
  client_type: ClientType;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  billing_email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  invoicing_frequency: 'per_job' | 'weekly' | 'monthly';
  payment_terms: number;
  requires_po: boolean;
  notes: string;
}

export interface CommunityFormData {
  client_id: string;
  geography_id: string;
  name: string;
  code: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  restrict_skus: boolean;
  approved_sku_ids: string[];
  notes: string;
}

// Display helpers
export const BUSINESS_UNIT_LABELS: Record<BusinessUnit, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  builders: 'Builders',
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  large_builder: 'Large Builder',
  custom_builder: 'Custom Builder',
  landscaper: 'Landscaper',
  pool_company: 'Pool Company',
  homeowner: 'Homeowner',
  other: 'Other',
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  prospect: 'Prospect',
  onboarding: 'Onboarding',
  active: 'Active',
  inactive: 'Inactive',
};

export const COMMUNITY_STATUS_LABELS: Record<CommunityStatus, string> = {
  onboarding: 'Onboarding',
  active: 'Active',
  inactive: 'Inactive',
  completed: 'Completed',
};
