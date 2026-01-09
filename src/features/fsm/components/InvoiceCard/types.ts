/**
 * InvoiceCard Type Definitions
 *
 * Types for the unified InvoiceCard component (create/edit/view modes)
 */

import type { Invoice, InvoiceStatus, InvoiceLineItem, Payment, AddressSnapshot } from '../../types';

// Component mode
export type InvoiceCardMode = 'create' | 'edit' | 'view';

// Main component props
export interface InvoiceCardProps {
  mode: InvoiceCardMode;
  invoiceId?: string;
  projectId?: string;
  jobId?: string;
  quoteId?: string;
  clientId?: string;
  billingAddress?: AddressSnapshot;
  // Callbacks
  onSave?: (invoice: Invoice) => void;
  onCancel?: () => void;
  onBack?: () => void;
  onSend?: (invoiceId: string) => void;
  onRecordPayment?: (invoiceId: string) => void;
}

// Form state for invoice editing
export interface InvoiceFormState {
  // Project linkage
  projectId: string;
  jobId: string;
  quoteId: string;

  // Customer
  clientId: string;
  billingAddress: AddressSnapshot;

  // Amounts
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  total: number;

  // Terms
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  terms: string;
  poNumber: string;
  notes: string;
  internalNotes: string;

  // Line items
  lineItems: LineItemFormState[];
}

// Line item form state
export interface LineItemFormState {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  jobId?: string;
}

// Computed totals
export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
}

// Validation state
export interface InvoiceValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

// Header component props
export interface InvoiceHeaderProps {
  mode: InvoiceCardMode;
  invoice: Invoice | null;
  validation: InvoiceValidation;
  isSaving: boolean;
  isDirty: boolean;
  onBack?: () => void;
  onCancel?: () => void;
  onSave: () => void;
  onEdit?: () => void;
  onSend?: () => void;
  onRecordPayment?: () => void;
  onVoid?: () => void;
  onMarkBadDebt?: () => void;
}

// Line items section props
export interface InvoiceLineItemsProps {
  mode: InvoiceCardMode;
  lineItems: LineItemFormState[];
  totals: InvoiceTotals;
  taxRate: number;
  discountAmount: number;
  onAddItem: () => void;
  onUpdateItem: (index: number, data: Partial<LineItemFormState>) => void;
  onRemoveItem: (index: number) => void;
  onTaxRateChange: (rate: number) => void;
  onDiscountChange: (amount: number) => void;
}

// Payments section props
export interface InvoicePaymentsProps {
  mode: InvoiceCardMode;
  invoiceId?: string;
  payments: Payment[];
  amountPaid: number;
  balanceDue: number;
  isLoading?: boolean;
  onRecordPayment: () => void;
  onDeletePayment?: (paymentId: string) => void;
}

// Sidebar props
export interface InvoiceSidebarProps {
  mode: InvoiceCardMode;
  form: InvoiceFormState;
  invoice: Invoice | null;
  validation: InvoiceValidation;
  totals: InvoiceTotals;
  onFieldChange: (field: keyof InvoiceFormState, value: string | number) => void;
}

// Payment form for recording payments
export interface PaymentFormState {
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
}

// Status constants
export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Sent' },
  past_due: { bg: 'bg-red-100', text: 'text-red-700', label: 'Past Due' },
  paid: { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid' },
  bad_debt: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Bad Debt' },
};

// Payment method options
export const PAYMENT_METHODS = [
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH / Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
] as const;

// Payment terms options
export const PAYMENT_TERMS_OPTIONS = [
  { value: 'Due on Receipt', label: 'Due on Receipt' },
  { value: 'Net 15', label: 'Net 15' },
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 45', label: 'Net 45' },
  { value: 'Net 60', label: 'Net 60' },
  { value: '50% Deposit', label: '50% Deposit Required' },
] as const;
