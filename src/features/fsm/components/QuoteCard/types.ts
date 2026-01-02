/**
 * QuoteCard Types
 *
 * Types for the unified QuoteCard component that handles create/edit/view modes.
 */

import type { Quote } from '../../types';

export type QuoteCardMode = 'create' | 'edit' | 'view';

export interface QuoteCardProps {
  /** Mode: 'create' for new quotes, 'edit' for existing, 'view' for read-only */
  mode: QuoteCardMode;

  // For create mode from project context
  projectId?: string;
  clientId?: string;
  communityId?: string;
  propertyId?: string;

  // For create mode from request context
  requestId?: string;
  requestData?: {
    client_id?: string;
    client_name?: string;
    community_id?: string;
    community_name?: string;
    property_id?: string;
    product_type?: string;
    linear_feet?: number;
    description?: string;
  };

  // For edit/view mode
  quoteId?: string;

  // Callbacks
  onSave?: (quote: Quote) => void;
  onCancel?: () => void;
  onBack?: () => void;
  onConvertToJob?: (quoteId: string) => void;
  onSend?: (quoteId: string) => void;
  onApprove?: (quoteId: string) => void;
}

export interface LineItemFormState {
  id?: string;
  line_type: 'material' | 'labor' | 'service' | 'adjustment' | 'discount';
  description: string;
  quantity: number;
  unit_type: string;
  unit_price: number;
  unit_cost: number;
  sku_id?: string | null;
  pricing_source?: string | null;
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface QuoteFormState {
  // Client/Property
  clientId: string;
  communityId: string;
  propertyId: string;

  // Quote details
  jobTitle: string;
  productType: string;
  linearFeet: string;
  scopeSummary: string;

  // Terms
  validUntil: string;
  paymentTerms: string;
  depositPercent: string;
  discountPercent: string;
  taxRate: string;

  // Assignment
  salesRepId: string;

  // Notes
  clientFacingNotes: string;
  internalNotes: string;

  // Line items
  lineItems: LineItemFormState[];
}

export interface QuoteTotals {
  subtotal: number;
  materialCost: number;
  laborCost: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  grossProfit: number;
  marginPercent: number;
  depositAmount: number;
}

export interface QuoteValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  needsApproval: boolean;
  approvalReasons: string[];
}

export const DEFAULT_LINE_ITEM: LineItemFormState = {
  line_type: 'material',
  description: '',
  quantity: 1,
  unit_type: 'LF',
  unit_price: 0,
  unit_cost: 0,
  sku_id: null,
  pricing_source: null,
  isNew: true,
};

export const PRODUCT_TYPE_OPTIONS = [
  'Wood Vertical',
  'Wood Horizontal',
  'Iron',
  'Chain Link',
  'Vinyl',
  'Gate Only',
  'Deck',
  'Glass Railing',
];

export const PAYMENT_TERMS_OPTIONS = [
  'Due on Receipt',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  '50% Deposit, Balance on Completion',
];

export const LINE_TYPE_OPTIONS = [
  { value: 'material', label: 'Material' },
  { value: 'labor', label: 'Labor' },
  { value: 'service', label: 'Service' },
  { value: 'adjustment', label: 'Adjustment' },
] as const;

export const UNIT_TYPE_OPTIONS = ['EA', 'LF', 'SF', 'HR', 'DAY'] as const;
