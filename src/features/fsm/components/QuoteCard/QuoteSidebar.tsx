/**
 * QuoteSidebar - Right sidebar with metadata and profitability
 *
 * Contains:
 * - Quote Details (lifecycle dates)
 * - Sales rep assignment
 * - Project info
 * - Terms (payment, deposit, discount)
 * - Profitability metrics (costs & margin only - totals moved to body)
 */

import { useState } from 'react';
import {
  Users,
  Calendar,
  Percent,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Eye,
  CheckCircle,
  Send,
} from 'lucide-react';
import type { QuoteCardMode, QuoteTotals, QuoteValidation } from './types';
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
  depositPercent: string;
  discountPercent: string;
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
  depositPercent,
  discountPercent,
  taxRate,
  salesRepId,
  qboClassId,
  totals,
  validation,
  onFieldChange,
  quoteDates,
}: QuoteSidebarProps) {
  const isEditable = mode !== 'view';
  // Filter reps by QBO class (Business Unit) when available
  const { data: salesReps } = useRepsByQboClass(qboClassId);
  const selectedSalesRep = salesReps?.find(r => r.id === salesRepId);

  return (
    <aside className="w-80 min-w-[280px] max-w-[400px] h-full overflow-y-auto bg-gray-50 border-l border-gray-200 p-4">
      {/* Quote Details Section - Lifecycle dates (view mode only) */}
      {mode === 'view' && quoteDates && (
        <div className="bg-white rounded-lg p-4 mb-4 border">
          <CollapsibleSection title="QUOTE DETAILS" icon={FileText} defaultOpen={true}>
            <div className="space-y-0.5">
              <DateRow icon={Clock} label="Created" date={quoteDates.created_at} />
              <DateRow icon={Send} label="Sent" date={quoteDates.sent_at} />
              <DateRow icon={Eye} label="Viewed" date={quoteDates.viewed_at} />
              <DateRow icon={CheckCircle} label="Approved" date={quoteDates.client_approved_at} highlight={true} />
              {quoteDates.expires_at && (
                <DateRow icon={Calendar} label="Expires" date={quoteDates.expires_at} />
              )}
            </div>
          </CollapsibleSection>
        </div>
      )}

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

      {/* Terms Section */}
      <div className="bg-white rounded-lg p-4 mb-4 border">
        <CollapsibleSection title="TERMS" icon={Percent}>
          <div className="space-y-3">
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
                <div className="text-sm text-gray-900">{paymentTerms}</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Deposit %</label>
                {isEditable ? (
                  <input
                    type="number"
                    value={depositPercent}
                    onChange={(e) => onFieldChange('depositPercent', e.target.value)}
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <div className="text-sm text-gray-900">{depositPercent}%</div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Discount %</label>
                {isEditable ? (
                  <input
                    type="number"
                    value={discountPercent}
                    onChange={(e) => onFieldChange('discountPercent', e.target.value)}
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <div className="text-sm text-gray-900">{discountPercent}%</div>
                )}
              </div>
            </div>
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
    </aside>
  );
}
