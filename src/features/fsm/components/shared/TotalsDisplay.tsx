/**
 * TotalsDisplay - Financial summary for quotes, jobs, invoices
 *
 * Shows:
 * - Subtotal
 * - Tax (optional)
 * - Discount (optional)
 * - Total
 * - Amount Paid (for invoices)
 * - Balance Due (for invoices)
 */

interface TotalsDisplayProps {
  subtotal: number;
  tax?: number;
  taxRate?: number; // As percentage (e.g., 8.25)
  discount?: number;
  discountType?: 'amount' | 'percent';
  discountPercent?: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Show in horizontal layout */
  horizontal?: boolean;
}

const formatCurrency = (amount: number | undefined | null): string => {
  if (amount == null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export function TotalsDisplay({
  subtotal,
  tax,
  taxRate,
  discount,
  discountType,
  discountPercent,
  total,
  amountPaid,
  balanceDue,
  compact = false,
  horizontal = false,
}: TotalsDisplayProps) {
  const rows: Array<{
    label: string;
    value: string;
    highlight?: boolean;
    negative?: boolean;
    large?: boolean;
  }> = [
    { label: 'Subtotal', value: formatCurrency(subtotal) },
  ];

  // Add tax row if present
  if (tax !== undefined && tax > 0) {
    const taxLabel = taxRate ? `Tax (${taxRate}%)` : 'Tax';
    rows.push({ label: taxLabel, value: formatCurrency(tax) });
  }

  // Add discount row if present
  if (discount !== undefined && discount > 0) {
    let discountLabel = 'Discount';
    if (discountType === 'percent' && discountPercent) {
      discountLabel = `Discount (${discountPercent}%)`;
    }
    rows.push({ label: discountLabel, value: `-${formatCurrency(discount)}`, negative: true });
  }

  // Total row
  rows.push({ label: 'Total', value: formatCurrency(total), highlight: true, large: true });

  // Payment rows for invoices
  if (amountPaid !== undefined && amountPaid > 0) {
    rows.push({ label: 'Amount Paid', value: formatCurrency(amountPaid) });
  }

  if (balanceDue !== undefined) {
    rows.push({
      label: 'Balance Due',
      value: formatCurrency(balanceDue),
      highlight: balanceDue > 0,
      large: balanceDue > 0,
    });
  }

  if (horizontal) {
    return (
      <div className="flex items-center gap-6 flex-wrap">
        {rows.map((row, i) => (
          <div key={i} className="text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{row.label}</div>
            <div
              className={`
                font-semibold
                ${row.large ? 'text-lg' : 'text-sm'}
                ${row.highlight ? 'text-gray-900' : 'text-gray-700'}
                ${row.negative ? 'text-green-600' : ''}
              `}
            >
              {row.value}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${compact ? 'text-sm' : ''}`}>
      {rows.map((row, i) => (
        <div
          key={i}
          className={`
            flex justify-between items-center
            ${row.large ? 'pt-2 border-t border-gray-200' : ''}
          `}
        >
          <span className={row.highlight ? 'font-medium text-gray-900' : 'text-gray-600'}>
            {row.label}
          </span>
          <span
            className={`
              font-mono
              ${row.large ? 'text-lg font-bold' : 'font-medium'}
              ${row.highlight ? 'text-gray-900' : 'text-gray-700'}
              ${row.negative ? 'text-green-600' : ''}
            `}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Compact totals for list views or cards
 */
export function TotalsBadge({ total, label = 'Total' }: { total: number; label?: string }) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm">
      <span className="text-gray-500">{label}:</span>
      <span className="font-semibold text-gray-900">{formatCurrency(total)}</span>
    </div>
  );
}

/**
 * Balance due badge with color coding
 */
export function BalanceDueBadge({ amount, isPastDue = false }: { amount: number; isPastDue?: boolean }) {
  if (amount <= 0) {
    return (
      <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
        Paid in Full
      </span>
    );
  }

  return (
    <span
      className={`
        inline-flex items-center px-2 py-1 rounded text-sm font-medium
        ${isPastDue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}
      `}
    >
      Due: {formatCurrency(amount)}
    </span>
  );
}

export default TotalsDisplay;
