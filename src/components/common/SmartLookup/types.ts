// Smart Lookup Types
// Unified search pattern for Client/Property lookup

import type { Client, Property, Community } from '../../../features/client_hub/types';

// ============================================
// CLIENT/COMMUNITY LOOKUP
// ============================================

// The lookup can return either a Client OR a Community
// For builders, users often search for "Cypress Creek" which is a Community
export type EntityType = 'client' | 'community';

export interface ClientSearchResult {
  // Entity identification
  entity_type: EntityType;
  id: string;
  name: string;

  // For display
  display_name: string;        // e.g., "Cypress Creek" or "ABC Builders"
  parent_name?: string;        // e.g., "ABC Builders" (for communities)
  subtitle?: string;           // e.g., "Community under ABC Builders"

  // Contact info (from client or community contacts)
  primary_contact_name?: string | null;
  primary_contact_phone?: string | null;
  primary_contact_email?: string | null;

  // Address
  address_line1?: string | null;
  city?: string | null;
  state?: string;
  zip?: string | null;

  // Match info
  match_field: 'name' | 'phone' | 'email' | 'code';
  match_confidence: number;

  // Related counts
  property_count?: number;
  communities_count?: number;  // Only for clients

  // Full entity data
  client_data?: Client;
  community_data?: Community;

  last_activity?: {
    type: 'request' | 'quote' | 'job';
    number: string;
    date: string;
  } | null;
}

// What gets selected - can be client, community, or both
export interface SelectedEntity {
  client: Client;                    // Always have a client (bill-to)
  community?: Community | null;      // Optional community
  display_name: string;              // What to show in the selected display
}

export interface ClientLookupProps {
  // Value - now includes both client and optional community
  value: SelectedEntity | null;
  onChange: (entity: SelectedEntity | null) => void;

  // Optional filters
  businessUnit?: 'residential' | 'commercial' | 'builders';

  // Callbacks
  onClientCreated?: (client: Client) => void;
  onCommunityCreated?: (community: Community, client: Client) => void;

  // Display
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
}

// ============================================
// PROPERTY LOOKUP
// ============================================

export interface PropertySearchResult extends Property {
  has_active_request?: boolean;
  has_active_quote?: boolean;
  has_active_job?: boolean;
  last_activity?: {
    type: 'request' | 'quote' | 'job';
    number: string;
    date: string;
  } | null;
}

export interface PropertyLookupProps {
  // Required: client must be selected first
  clientId: string;
  client: Client;

  // Value
  value: Property | null;
  onChange: (property: Property | null) => void;

  // Callbacks
  onPropertyCreated?: (property: Property) => void;
  onDuplicateDetected?: (duplicates: DuplicateInfo) => void;

  // Display
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
}

// ============================================
// BUILDER CASCADE (Community -> Lot)
// ============================================

export interface BuilderCascadeProps {
  // Required: builder client
  builderId: string;
  builder: Client;

  // Values
  selectedCommunity: Community | null;
  selectedProperty: Property | null;
  onCommunityChange: (community: Community | null) => void;
  onPropertyChange: (property: Property | null) => void;

  // Display
  disabled?: boolean;
  errors?: {
    community?: string;
    property?: string;
  };
}

// ============================================
// DUPLICATE DETECTION
// ============================================

export interface DuplicateInfo {
  hasRecentRequest: boolean;
  hasActiveQuote: boolean;
  hasActiveJob: boolean;
  details: {
    requests: Array<{ id: string; request_number: string; status: string; created_at: string }>;
    quotes: Array<{ id: string; quote_number: string; status: string; created_at: string }>;
    jobs: Array<{ id: string; job_number: string; status: string; created_at: string }>;
  };
}

// ============================================
// SLIDE-OUT PANEL
// ============================================

export interface SlideOutPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';  // 320px, 400px, 480px
}

// ============================================
// NEW ENTITY FORMS
// ============================================

export interface NewClientFormData {
  name: string;
  phone: string;
  email?: string;
  company_name?: string;
  client_type: 'homeowner' | 'large_builder' | 'custom_builder' | 'landscaper' | 'pool_company' | 'other';
  business_unit: 'residential' | 'commercial' | 'builders';

  // Optional first property
  first_property?: {
    address: string;
    city: string;
    state: string;
    zip: string;
  };
}

export interface NewPropertyFormData {
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  lot_number?: string;
  gate_code?: string;
  access_notes?: string;
  homeowner_name?: string;
  homeowner_phone?: string;
}
