// Column Mappers for Jobber CSV Imports
// Maps CSV column headers to database field names

import type { CSVRow } from '../../types/jobber';

// Jobs Column Map - maps CSV headers to DB columns
export const JOBS_COLUMN_MAP: Record<string, string> = {
  'Job #': 'job_number',
  'Client name': 'client_name',
  'Client email': 'client_email',
  'Client phone': 'client_phone',
  'Billing street': 'billing_street',
  'Billing city': 'billing_city',
  'Billing province': 'billing_state',
  'Billing ZIP': 'billing_zip',
  'Service street': 'service_street',
  'Service city': 'service_city',
  'Service province': 'service_state',
  'Service ZIP': 'service_zip',
  'Title': 'title',
  'Created date': 'created_date',
  'Scheduled start date': 'scheduled_start_date',
  'Closed date': 'closed_date',
  'Salesperson': 'salesperson_raw',
  'Builder Rep': 'builder_rep_raw',
  'BUILDER REP': 'builder_rep_raw',
  'Visits assigned to': 'visits_assigned_to',
  'Line items': 'line_items',
  'Invoice #s': 'invoice_numbers',
  'Quote #': 'quote_number',
  'Total revenue ($)': 'total_revenue',
  'Total costs ($)': 'total_costs',
  'Profit ($)': 'profit',
  'Profit %': 'profit_percent',
  'Quote discount ($)': 'quote_discount',
  'Community': 'community',
  'COMMUNITY': 'community',
  'Super name': 'super_name',
  'Super email': 'super_email',
  'PO number': 'po_number',
  'PO budget ($)': 'po_budget',
  'Procurement Material Estimate ($)': 'procurement_material_estimate',
  'Procurement Labor Estimate ($)': 'procurement_labor_estimate',
  'Pricing Tier': 'pricing_tier',
  'FRANCHISE LOCATION': 'franchise_location',
  'Project Type': 'project_type',
  'STANDARD PRODUCT': 'standard_product',
  'STANDARD PRODUCT - 2': 'standard_product_2',
  'Crew 1': 'crew_1',
  'Crew 1 Job Pay': 'crew_1_pay',
  'Crew 2': 'crew_2',
  'Crew 2 Job Pay': 'crew_2_pay',
  'Crew 3': 'crew_3',
  'Crew 3 Job Pay': 'crew_3_pay',
  'Overage': 'overage_ft',
  '811 - GPS Coordinates': 'gps_coordinates',
  '811 DETAILS': 'details_811',
  'Job Contains Rock Fee': 'job_contains_rock_fee',
  'Rock fee required?': 'rock_fee_required',
  'On QBO?': 'on_qbo',
  'Pay crew rock fee for this job?': 'pay_crew_rock_fee',
};

// Quotes Column Map
export const QUOTES_COLUMN_MAP: Record<string, string> = {
  'Quote #': 'quote_number',
  'Client name': 'client_name',
  'Client email': 'client_email',
  'Client phone': 'client_phone',
  'Service street': 'service_street',
  'Service city': 'service_city',
  'Service province': 'service_state',
  'Service ZIP': 'service_zip',
  'Title': 'title',
  'Status': 'status',
  'Line items': 'line_items',
  'Salesperson': 'salesperson_raw',
  'Builder Rep': 'builder_rep_raw',
  'BUILDER REP': 'builder_rep_raw',
  'Sent by user': 'sent_by_user',
  'Job #s': 'job_numbers',
  'Subtotal ($)': 'subtotal',
  'Total ($)': 'total',
  'Discount ($)': 'discount',
  'Required deposit ($)': 'required_deposit',
  'Collected deposit ($)': 'collected_deposit',
  'Community': 'community',
  'COMMUNITY': 'community',
  'Super name': 'super_name',
  'Super email': 'super_email',
  'PO number': 'po_number',
  'PO budget ($)': 'po_budget',
  'Pricing Tier': 'pricing_tier',
  'FRANCHISE LOCATION': 'franchise_location',
  'Project Type': 'project_type',
  'STANDARD PRODUCT': 'standard_product',
  'Drafted date': 'drafted_date',
  'Sent date': 'sent_date',
  'Changes requested date': 'changes_requested_date',
  'Approved date': 'approved_date',
  'Converted date': 'converted_date',
  'Archived date': 'archived_date',
};

// Invoices Column Map
export const INVOICES_COLUMN_MAP: Record<string, string> = {
  'Invoice #': 'invoice_number',
  'Client name': 'client_name',
  'Client email': 'client_email',
  'Client phone': 'client_phone',
  'Billing street': 'billing_street',
  'Billing city': 'billing_city',
  'Billing province': 'billing_state',
  'Billing ZIP': 'billing_zip',
  'Service street': 'service_street',
  'Service city': 'service_city',
  'Service province': 'service_state',
  'Service ZIP': 'service_zip',
  'Subject': 'subject',
  'Status': 'status',
  'Line items': 'line_items',
  'Salesperson': 'salesperson_raw',
  'Builder Rep': 'builder_rep_raw',
  'BUILDER REP': 'builder_rep_raw',
  'Visits assigned to': 'visits_assigned_to',
  'Job #s': 'job_numbers',
  'Pre-tax total ($)': 'pre_tax_total',
  'Total ($)': 'total',
  'Tip ($)': 'tip',
  'Balance ($)': 'balance',
  'Tax (%)': 'tax_percent',
  'Tax amount ($)': 'tax_amount',
  'Deposit $': 'deposit',
  'Discount ($)': 'discount',
  'Community': 'community',
  'COMMUNITY': 'community',
  'Super name': 'super_name',
  'Super email': 'super_email',
  'PO number': 'po_number',
  'PO budget ($)': 'po_budget',
  'Pricing Tier': 'pricing_tier',
  'FRANCHISE LOCATION': 'franchise_location',
  'Project Type': 'project_type',
  'STANDARD PRODUCT': 'standard_product',
  'Crew 1': 'crew_1',
  'Crew 1 Job Pay': 'crew_1_pay',
  'Crew 2': 'crew_2',
  'Crew 2 Job Pay': 'crew_2_pay',
  'Crew 3': 'crew_3',
  'Crew 3 Job Pay': 'crew_3_pay',
  'Created date': 'created_date',
  'Issued date': 'issued_date',
  'Due date': 'due_date',
  'Marked paid date': 'marked_paid_date',
  'Last contacted': 'last_contacted',
  'Late by': 'late_by_days',
  'Days to paid': 'days_to_paid',
};

// Numeric fields that need parsing
const NUMERIC_FIELDS = new Set([
  'job_number', 'quote_number', 'invoice_number',
  'total_revenue', 'total_costs', 'profit', 'profit_percent',
  'quote_discount', 'po_budget', 'procurement_material_estimate',
  'procurement_labor_estimate', 'crew_1_pay', 'crew_2_pay', 'crew_3_pay',
  'overage_ft', 'subtotal', 'total', 'discount', 'required_deposit',
  'collected_deposit', 'pre_tax_total', 'tip', 'balance', 'tax_percent',
  'tax_amount', 'deposit', 'late_by_days', 'days_to_paid'
]);

// Date fields that need parsing
const DATE_FIELDS = new Set([
  'created_date', 'scheduled_start_date', 'closed_date',
  'drafted_date', 'sent_date', 'changes_requested_date',
  'approved_date', 'converted_date', 'archived_date',
  'issued_date', 'due_date', 'marked_paid_date', 'last_contacted'
]);

/**
 * Map a CSV row to database fields using the appropriate column map
 */
export function mapCSVRowToDBFields(
  row: CSVRow,
  columnMap: Record<string, string>
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};

  for (const [csvColumn, dbField] of Object.entries(columnMap)) {
    const value = row[csvColumn];

    if (value === undefined || value === null || value === '') {
      // Skip empty values, let DB use defaults
      continue;
    }

    // Parse numeric fields
    if (NUMERIC_FIELDS.has(dbField)) {
      // Remove $ and , from currency values, handle % for percentages
      const cleanValue = value.replace(/[$,%]/g, '').replace(/,/g, '').trim();
      const numValue = parseFloat(cleanValue);
      mapped[dbField] = isNaN(numValue) ? null : numValue;
    }
    // Parse date fields
    else if (DATE_FIELDS.has(dbField)) {
      const dateValue = parseDate(value);
      if (dateValue) {
        mapped[dbField] = dateValue;
      }
    }
    // String fields
    else {
      mapped[dbField] = value.trim();
    }
  }

  return mapped;
}

/**
 * Parse various date formats from Jobber exports
 */
export function parseDate(value: string): string | null {
  if (!value || value.trim() === '') return null;

  const trimmed = value.trim();

  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try MM/DD/YYYY format
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try DD/MM/YYYY format
  const dmyMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Last resort: try native Date parsing
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Detect which type of report this is based on columns present
 */
export function detectReportType(headers: string[]): 'jobs' | 'quotes' | 'invoices' | null {
  const headerSet = new Set(headers);

  // Jobs have unique "Closed date" and "Total revenue ($)"
  if (headerSet.has('Job #') && headerSet.has('Total revenue ($)')) {
    return 'jobs';
  }

  // Quotes have "Quote #" and "Drafted date"
  if (headerSet.has('Quote #') && headerSet.has('Drafted date')) {
    return 'quotes';
  }

  // Invoices have "Invoice #" and "Balance ($)"
  if (headerSet.has('Invoice #') && headerSet.has('Balance ($)')) {
    return 'invoices';
  }

  return null;
}

/**
 * Get the appropriate column map for a report type
 */
export function getColumnMapForType(reportType: 'jobs' | 'quotes' | 'invoices'): Record<string, string> {
  switch (reportType) {
    case 'jobs':
      return JOBS_COLUMN_MAP;
    case 'quotes':
      return QUOTES_COLUMN_MAP;
    case 'invoices':
      return INVOICES_COLUMN_MAP;
  }
}

/**
 * Get the unique key field for a report type (for UPSERT)
 */
export function getUniqueKeyForType(reportType: 'jobs' | 'quotes' | 'invoices'): string {
  switch (reportType) {
    case 'jobs':
      return 'job_number';
    case 'quotes':
      return 'quote_number';
    case 'invoices':
      return 'invoice_number';
  }
}

/**
 * Get the table name for a report type
 */
export function getTableNameForType(reportType: 'jobs' | 'quotes' | 'invoices'): string {
  switch (reportType) {
    case 'jobs':
      return 'jobber_builder_jobs';
    case 'quotes':
      return 'jobber_builder_quotes';
    case 'invoices':
      return 'jobber_builder_invoices';
  }
}
