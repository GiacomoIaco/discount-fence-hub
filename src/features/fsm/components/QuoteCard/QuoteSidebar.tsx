/**
 * QuoteSidebar - Right sidebar with metadata and profitability
 *
 * Contains:
 * - Quote Details (lifecycle dates + valid until + payment terms)
 * - Sales rep assignment
 * - Project info
 * - Profitability metrics (costs & margin only - totals moved to body)
 * - Additional Info (custom fields)
 *
 * NOTE: Discount % and Deposit % moved to main body (Jobber pattern)
 */

import { useState } from 'react';
import {
  Users,
  Calendar,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Eye,
  CheckCircle,
  Send,
  Plus,
  Trash2,
  List,
  CreditCard,
} from 'lucide-react';
import type { QuoteCardMode, QuoteTotals, QuoteValidation, CustomField } from './types';
import { PAYMENT_TERMS_OPTIONS, PRODUCT_TYPE_OPTIONS } from './types';
import { useRepsByQboClass } from '../../hooks/useSalesReps';

// Currency formatter with commas
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Date formatter helper
const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

interface QuoteSidebarProps {
  mode: QuoteCardMode;
  productType: string;
  linearFeet: string;
  validUntil: string;
  paymentTerms: string;
  // NOTE: depositPercent and discountPercent moved to QuoteLineItems (Jobber pattern)
  taxRate: string;
  salesRepId: string;
  /** QBO Class ID for filtering reps by Business Unit */
  qboClassId?: string | null;
  totals: QuoteTotals;
  validation: QuoteValidation;
  onFieldChange: (field: string, value: string) => void;
  /** Quote lifecycle dates (view mode only) */
  quoteDates?: {
    created_at?: string | null;
    sent_at?: string | null;
    viewed_at?: string | null;
    client_approved_at?: string | null;
    expires_at?: string | null;
  };
  /** Custom fields for Additional Info section */
  customFields?: CustomField[];
  onAddCustomField?: () => void;
  onUpdateCustomField?: (id: string, field: 'label' | 'value', value: string) => void;
  onRemoveCustomField?: (id: string) => void;
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200 pb-4 mb-4 last:border-b-0 last:pb-0 last:mb-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="mt-3">{children}</div>}
    </div>
  );
}

// Date Row Component for Quote Details section
function DateRow({
  icon: Icon,
  label,
  date,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  date: string | null | undefined;
  highlight?: boolean;
}) {
  const formattedDate = formatDateTime(date);
  const hasDate = date && formattedDate !== '-';

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-gray-600">
        <Icon className={`w-3.5 h-3.5 ${hasDate && highlight ? 'text-green-500' : 'text-gray-400'}`} />
        <span className="text-sm">{label}</span>
      </div>
      <span className={`text-sm ${hasDate ? (highlight ? 'text-green-600 font-medium' : 'text-gray-900') : 'text-gray-400'}`}>
        {formattedDate}
      </span>
    </div>
  );
}

export default function QuoteSidebar({
  mode,
  productType,
  linearFeet,
  validUntil,
  paymentTerms,
  taxRate,
  salesRepId,
  qboClassId,
  totals,
  validation,
  onFieldChange,
  quoteDates,
  customFields = [],
  onAddCustomField,
  onUpdateCustomField,
  onRemoveCustomField,
}: QuoteSidebarProps) {
  const isEditable = mode !== 'view';
  // Filter reps by QBO class (Business Unit) when available
  const { data: salesReps } = useRepsByQboClass(qboClassId);
  const selectedSalesRep = salesReps?.find(r => r.id === salesRepId);

  return (
    <aside className="w-80 min-w-[280px] max-w-[400px] h-full overflow-y-auto bg-gray-50 border-l border-gray-200 p-4">
      {/* Quote Details Section - Lifecycle dates + Valid Until + Payment Terms */}
      <div className="bg-white rounded-lg p-4 mb-4 border">
        <CollapsibleSection title="QUOTE DETAILS" icon={FileText} defaultOpen={true}>
          <div className="space-y-3">
            {/* Lifecycle dates (view mode only) */}
            {mode === 'view' && quoteDates && (
              <div className="space-y-0.5 pb-3 border-b">
                <DateRow icon={Clock} label="Created" date={quoteDates.created_at} />
                <DateRow icon={Send} label="Sent" date={quoteDates.sent_at} />
                <DateRow icon={Eye} label="Viewed" date={quoteDates.viewed_at} />
                <DateRow icon={CheckCircle} label="Approved" date={quoteDates.client_approved_at} highlight={true} />
              </div>
            )}

            {/* Valid Until - editable in edit mode */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Valid Until</label>
              {isEditable ? (
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => onFieldChange('validUntil', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
              ) : (
                <div className="text-sm text-gray-900">
                  {validUntil ? new Date(validUntil).toLocaleDateString() : 'Not set'}
                </div>
              )}
            </div>

            {/* Payment Terms - editable in edit mode */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Payment Terms</label>
              {isEditable ? (
                <select
                  value={paymentTerms}
                  onChange={(e) => onFieldChange('paymentTerms', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  {PAYMENT_TERMS_OPTIONS.map((term) => (
                    <option key={term} value={term}>{term}</option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-900">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  {paymentTerms}
                </div>
              )}
            </div>

            {/* Tax Rate - editable in edit mode */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tax Rate %</label>
              {isEditable ? (
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => onFieldChange('taxRate', e.target.value)}
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
              ) : (
                <div className="text-sm text-gray-900">{taxRate}%</div>
              )}
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* Assignment Section */}
      <div className="bg-white rounded-lg p-4 mb-4 border">
        <CollapsibleSection title="ASSIGNMENT" icon={Users}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sales Rep</label>
              {isEditable ? (
                <select
                  value={salesRepId}
                  onChange={(e) => onFieldChange('salesRepId', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select rep...</option>
                  {salesReps?.filter(r => r.is_active).map((rep) => (
                    <option key={rep.id} value={rep.id}>{rep.name}</option>
                  ))}
                </select>
              ) : selectedSalesRep ? (
                <div className="text-sm text-gray-900">{selectedSalesRep.name}</div>
              ) : (
                <span className="text-sm text-gray-400 italic">Not assigned</span>
              )}
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* Project Info Section */}
      <div className="bg-white rounded-lg p-4 mb-4 border">
        <CollapsibleSection title="PROJECT INFO" icon={Calendar}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product Type</label>
              {isEditable ? (
                <select
                  value={productType}
                  onChange={(e) => onFieldChange('productType', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select type...</option>
                  {PRODUCT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-gray-900">{productType || 'Not specified'}</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Linear Feet</label>
              {isEditable ? (
                <input
                  type="number"
                  value={linearFeet}
                  onChange={(e) => onFieldChange('linearFeet', e.target.value)}
                  placeholder="e.g., 150"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
              ) : (
                <div className="text-sm text-gray-900">{linearFeet || '-'}</div>
              )}
            </div>
          </div>
        </CollapsibleSection>
      </div>


      {/* Profitability Section - Costs & Margin only */}
      <div className="bg-white rounded-lg p-4 border">
        <CollapsibleSection title="PROFITABILITY" icon={DollarSign}>
          <div className="space-y-2 text-sm">
            <div className="text-xs text-gray-500 uppercase font-medium">Estimated Costs</div>
            <div className="flex justify-between">
              <span className="text-gray-600">Materials:</span>
              <span>${formatCurrency(totals.materialCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Labor:</span>
              <span>${formatCurrency(totals.laborCost)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-600">Total Cost:</span>
              <span className="font-medium">${formatCurrency(totals.materialCost + totals.laborCost)}</span>
            </div>

            <div className="text-xs text-gray-500 uppercase font-medium mt-4">Margin Analysis</div>
            <div className="flex justify-between">
              <span className="text-gray-600">Gross Profit:</span>
              <span>${formatCurrency(totals.grossProfit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Gross Margin:</span>
              <span className={`font-semibold ${totals.marginPercent >= 15 ? 'text-green-600' : 'text-red-600'}`}>
                {totals.marginPercent.toFixed(1)}%
              </span>
            </div>

            {validation.needsApproval && (
              <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Approval Required</div>
                    <ul className="mt-1 space-y-0.5">
                      {validation.approvalReasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* Additional Info Section - Custom Fields */}
      <div className="bg-white rounded-lg p-4 mt-4 border">
        <CollapsibleSection title="ADDITIONAL INFO" icon={List} defaultOpen={customFields.length > 0 || isEditable}>
          <div className="space-y-3">
            {customFields.length === 0 && !isEditable ? (
              <p className="text-sm text-gray-400 italic">No custom fields</p>
            ) : (
              <>
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    {isEditable ? (
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => onUpdateCustomField?.(field.id, 'label', e.target.value)}
                            placeholder="Label"
                            className="w-full px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-purple-500 font-medium"
                          />
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => onUpdateCustomField?.(field.id, 'value', e.target.value)}
                            placeholder="Value"
                            className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <button
                          onClick={() => onRemoveCustomField?.(field.id)}
                          className="self-center p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs font-medium text-gray-500">{field.label}</div>
                        <div className="text-sm text-gray-900">{field.value || '-'}</div>
                      </div>
                    )}
                  </div>
                ))}
                {isEditable && (
                  <button
                    onClick={onAddCustomField}
                    className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Field
                  </button>
                )}
              </>
            )}
          </div>
        </CollapsibleSection>
      </div>
    </aside>
  );
}
