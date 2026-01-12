/**
 * JobLineItemsSection - Read-only display of job line items
 *
 * Job line items are copied from the quote when the job is created.
 * This component displays them in a clean, read-only format.
 */

import { Package, Wrench, User, DollarSign } from 'lucide-react';
import type { JobLineItem } from '../../types';
import CollapsibleSection from './CollapsibleSection';

interface JobLineItemsSectionProps {
  lineItems: JobLineItem[];
  totalAmount?: number;
}

const LINE_TYPE_ICONS = {
  material: Package,
  labor: Wrench,
  service: User,
  adjustment: DollarSign,
  discount: DollarSign,
};

// Currency formatter with commas
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function JobLineItemsSection({
  lineItems,
  totalAmount,
}: JobLineItemsSectionProps) {
  if (!lineItems || lineItems.length === 0) {
    return (
      <CollapsibleSection
        title="Line Items"
        icon={<Package className="w-5 h-5" />}
        defaultOpen={false}
      >
        <div className="p-8 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No line items for this job</p>
          <p className="text-sm text-gray-400 mt-1">
            Line items are copied from the quote when the job is created
          </p>
        </div>
      </CollapsibleSection>
    );
  }

  // Sort by sort_order
  const sortedItems = [...lineItems].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  // Calculate totals
  const subtotal = sortedItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
  const materialCost = sortedItems.reduce((sum, item) => sum + (item.material_unit_cost || 0) * item.quantity, 0);
  const laborCost = sortedItems.reduce((sum, item) => sum + (item.labor_unit_cost || 0) * item.quantity, 0);

  return (
    <CollapsibleSection
      title="Line Items"
      icon={<Package className="w-5 h-5" />}
      defaultOpen={true}
      badge={
        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
          {lineItems.length} item{lineItems.length !== 1 ? 's' : ''}
        </span>
      }
    >
      <div className="divide-y">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
          <div className="col-span-1">Type</div>
          <div className="col-span-5">Description</div>
          <div className="col-span-1 text-center">Qty</div>
          <div className="col-span-1 text-center">Unit</div>
          <div className="col-span-2 text-right">Unit Price</div>
          <div className="col-span-2 text-right">Total</div>
        </div>

        {/* Table Rows */}
        {sortedItems.map((item) => {
          const Icon = LINE_TYPE_ICONS[item.line_type] || Package;
          const lineTotal = item.total_price || item.quantity * item.unit_price;

          return (
            <div
              key={item.id}
              className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50"
            >
              {/* Type */}
              <div className="col-span-1">
                <div className="flex items-center gap-1">
                  <Icon className="w-4 h-4 text-gray-500" />
                </div>
              </div>

              {/* Description */}
              <div className="col-span-5">
                <p className="text-sm font-medium text-gray-900">{item.description}</p>
                {item.sku_id && (
                  <p className="text-xs text-gray-500">
                    M: ${formatCurrency(item.material_unit_cost)}/unit • L: ${formatCurrency(item.labor_unit_cost)}/unit
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div className="col-span-1 text-center">
                <span className="text-sm text-gray-900">{item.quantity}</span>
              </div>

              {/* Unit Type */}
              <div className="col-span-1 text-center">
                <span className="text-sm text-gray-600">{item.unit_type || 'EA'}</span>
              </div>

              {/* Unit Price */}
              <div className="col-span-2 text-right">
                <span className="text-sm text-gray-900">${formatCurrency(item.unit_price)}</span>
              </div>

              {/* Line Total */}
              <div className="col-span-2 text-right">
                <span className="text-sm font-medium text-gray-900">${formatCurrency(lineTotal)}</span>
              </div>
            </div>
          );
        })}

        {/* Totals Section */}
        <div className="px-4 py-4 bg-gray-50">
          <div className="max-w-xs ml-auto space-y-2">
            {/* Cost Breakdown */}
            <div className="flex justify-between text-sm text-gray-600">
              <span>Material Cost</span>
              <span>${formatCurrency(materialCost)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Labor Cost</span>
              <span>${formatCurrency(laborCost)}</span>
            </div>

            {/* Subtotal */}
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">${formatCurrency(subtotal)}</span>
            </div>

            {/* Total */}
            <div className="flex justify-between text-base font-semibold pt-2 border-t">
              <span>Total</span>
              <span className="text-lg">${formatCurrency(totalAmount || subtotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
