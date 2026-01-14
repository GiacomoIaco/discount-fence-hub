// Jobber Import Hub Types
// Generated from JOBBER_IMPORT_HUB_HANDOFF_V2.md

// =====================
// Database Types
// =====================

export interface JobberImportLog {
  id: string;
  business_unit: 'builder' | 'residential';
  report_type: 'jobs' | 'quotes' | 'invoices';
  file_name: string;
  uploaded_by: string | null;
  uploaded_at: string;
  total_rows: number;
  new_records: number;
  updated_records: number;
  skipped_records: number;
  errors: ImportError[];
  data_start_date: string | null;
  data_end_date: string | null;
  status: 'processing' | 'completed' | 'failed';
  error_message: string | null;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface JobberNameNormalization {
  id: string;
  original_name: string;
  canonical_name: string;
  created_at: string;
}

export interface JobberBuilderJob {
  id: string;
  job_number: number;
  quote_number: number | null;
  invoice_numbers: string | null;

  // Client
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  billing_street: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  service_street: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;

  // Job details
  title: string | null;
  line_items: string | null;
  project_type: string | null;
  standard_product: string | null;
  standard_product_2: string | null;

  // People
  salesperson_raw: string | null;
  builder_rep_raw: string | null;
  visits_assigned_to: string | null;
  effective_salesperson: string | null;

  // Builder-specific
  community: string | null;
  super_name: string | null;
  super_email: string | null;
  po_number: string | null;
  pricing_tier: string | null;
  franchise_location: string | null;

  // Dates
  created_date: string | null;
  scheduled_start_date: string | null;
  closed_date: string | null;

  // Financials
  total_revenue: number;
  total_costs: number;
  profit: number;
  profit_percent: number;
  quote_discount: number;
  po_budget: number;
  procurement_material_estimate: number;
  procurement_labor_estimate: number;

  // Crew
  crew_1: string | null;
  crew_1_pay: number;
  crew_2: string | null;
  crew_2_pay: number;
  crew_3: string | null;
  crew_3_pay: number;

  // Rock fees
  job_contains_rock_fee: string | null;
  rock_fee_required: string | null;
  pay_crew_rock_fee: string | null;

  // Other
  overage_ft: number;
  gps_coordinates: string | null;
  details_811: string | null;
  on_qbo: string | null;

  // Computed (from DB)
  is_warranty: boolean;
  is_substantial: boolean;
  days_to_schedule: number | null;
  days_to_close: number | null;
  total_cycle_days: number | null;

  // Import tracking
  first_imported_at: string;
  last_updated_at: string;
  import_log_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobberBuilderQuote {
  id: string;
  quote_number: number;
  job_numbers: string | null;

  // Client
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  service_street: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;

  // Quote details
  title: string | null;
  status: string | null;
  line_items: string | null;

  // People
  salesperson_raw: string | null;
  builder_rep_raw: string | null;
  effective_salesperson: string | null;
  sent_by_user: string | null;

  // Financials
  subtotal: number;
  total: number;
  discount: number;
  required_deposit: number;
  collected_deposit: number;

  // Builder-specific
  community: string | null;
  super_name: string | null;
  super_email: string | null;
  po_number: string | null;
  po_budget: number;
  pricing_tier: string | null;
  franchise_location: string | null;
  project_type: string | null;
  standard_product: string | null;

  // Dates
  drafted_date: string | null;
  sent_date: string | null;
  changes_requested_date: string | null;
  approved_date: string | null;
  converted_date: string | null;
  archived_date: string | null;

  // Computed
  is_converted: boolean;
  days_to_convert: number | null;

  // Import tracking
  first_imported_at: string;
  last_updated_at: string;
  import_log_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobberBuilderInvoice {
  id: string;
  invoice_number: number;
  job_numbers: string | null;

  // Client
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  billing_street: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  service_street: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;

  // Invoice details
  subject: string | null;
  status: string | null;
  line_items: string | null;

  // People
  salesperson_raw: string | null;
  builder_rep_raw: string | null;
  effective_salesperson: string | null;
  visits_assigned_to: string | null;

  // Financials
  pre_tax_total: number;
  total: number;
  tip: number;
  balance: number;
  tax_percent: number;
  tax_amount: number;
  deposit: number;
  discount: number;

  // Builder-specific
  community: string | null;
  super_name: string | null;
  super_email: string | null;
  po_number: string | null;
  po_budget: number;
  pricing_tier: string | null;
  franchise_location: string | null;
  project_type: string | null;
  standard_product: string | null;

  // Crew
  crew_1: string | null;
  crew_1_pay: number;
  crew_2: string | null;
  crew_2_pay: number;
  crew_3: string | null;
  crew_3_pay: number;

  // Dates
  created_date: string | null;
  issued_date: string | null;
  due_date: string | null;
  marked_paid_date: string | null;
  last_contacted: string | null;

  // Timing
  late_by_days: number | null;
  days_to_paid: number | null;

  // Computed
  is_paid: boolean;
  is_overdue: boolean;

  // Import tracking
  first_imported_at: string;
  last_updated_at: string;
  import_log_id: string | null;
  created_at: string;
  updated_at: string;
}

// =====================
// Analytics Types
// =====================

export interface SalespersonMetrics {
  name: string;
  total_jobs: number;
  substantial_jobs: number;
  warranty_jobs: number;
  total_revenue: number;
  avg_job_value: number;
  avg_days_to_schedule: number | null;
  avg_days_to_close: number | null;
  avg_total_days: number | null;
}

export interface MonthlyTrend {
  month: string;
  label: string;
  total_jobs: number;
  substantial_jobs: number;
  warranty_jobs: number;
  revenue: number;
  avg_job_value: number;
}

export interface ClientMetrics {
  client_name: string;
  total_jobs: number;
  total_quotes: number;
  total_invoices: number;
  total_revenue: number;
  avg_job_value: number;
  warranty_jobs: number;
  avg_cycle_days: number | null;
}

export interface PipelineSummary {
  metric_name: string;
  metric_value: number | null;
  record_count: number;
}

export interface LocationMetrics {
  location: string;
  revenue: number;
  jobs: number;
  percentage: number;
  avg_value: number;
  avg_cycle: number | null;
}

export interface ProjectTypeMetrics {
  type: string;
  revenue: number;
  jobs: number;
  percentage: number;
  warranty_rate: number;
}

export interface CrewMetrics {
  crew_name: string;
  jobs: number;
  avg_pay: number;
  total_pay: number;
}

export interface CycleTimeMetrics {
  stage: string;
  average: number;
  median: number;
  target: number;
}

export interface CycleTimeDistribution {
  bucket: string;
  count: number;
  percentage: number;
}

export interface DayOfWeekPattern {
  day: string;
  day_index: number;
  created: number;
  scheduled: number;
}

export interface QuoteStatusMetrics {
  status: string;
  count: number;
  value: number;
  percentage: number;
}

export interface QBOSyncMetrics {
  status: string;
  jobs: number;
  revenue: number;
}

// =====================
// Filter Types
// =====================

export interface JobberFilters {
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  salesperson: string | null;
  location: string | null;
  includeWarranties: boolean;
}

export interface JobberFilterOptions {
  salespersons: string[];
  locations: string[];
}

// =====================
// Import Types
// =====================

export type ReportType = 'jobs' | 'quotes' | 'invoices';
export type BusinessUnit = 'builder' | 'residential';

export interface ImportResult {
  success: boolean;
  totalRows: number;
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  errors: ImportError[];
  logId: string;
}

export interface CSVRow {
  [key: string]: string | undefined;
}

// =====================
// Dashboard State
// =====================

export type JobberDashboardTab =
  | 'overview'
  | 'salespeople'
  | 'clients'
  | 'pipeline'
  | 'cycletime';

export interface JobberDashboardState {
  activeTab: JobberDashboardTab;
  filters: JobberFilters;
  selectedSalesperson: string | null;
  selectedClient: string | null;
}

// Executive Summary
export interface ExecutiveSummaryData {
  totalRevenue: number;
  billableJobs: number;
  avgJobValue: number;
  avgCycleDays: number;
  openPipelineValue: number;
  openPipelineJobs: number;
  quoteConversionRate: number;
  speedToInvoice: number;
  qboSyncRate: number;
}
