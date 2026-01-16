// Residential Division Analytics Types
// Opportunity-centric model with win rate focus

// =====================
// Database Types
// =====================

export interface ResidentialOpportunity {
  id: string;
  opportunity_key: string;

  // Client & Address
  client_name: string | null;
  client_name_normalized: string | null;
  client_email: string | null;
  client_phone: string | null;
  service_street: string | null;
  service_street_normalized: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;

  // Assignment
  salesperson: string | null;

  // Quote Aggregations
  quote_count: number;
  quote_numbers: string | null;
  first_quote_date: string | null;
  last_quote_date: string | null;

  // Values
  max_quote_value: number;
  min_quote_value: number;
  total_quoted_value: number;
  won_value: number;

  // Conversion Status
  is_won: boolean;
  is_lost: boolean;
  is_pending: boolean;
  won_date: string | null;
  won_quote_numbers: string | null;
  job_numbers: string | null;

  // From Jobs (enrichment)
  scheduled_date: string | null;
  closed_date: string | null;
  actual_revenue: number | null;

  // From Requests (speed-to-quote)
  assessment_date: string | null;

  // Project details
  project_type: string | null;
  location: string | null;
  lead_source: string | null;

  // Computed (from DB)
  days_to_quote: number | null;
  speed_to_quote_bucket: SpeedToQuoteBucket | null;
  revenue_bucket: RevenueBucket;
  quote_count_bucket: QuoteCountBucket;
  days_to_close: number | null;
  days_to_decision: number | null;

  // Import tracking
  first_imported_at: string;
  last_updated_at: string;
  import_log_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResidentialQuote {
  id: string;
  quote_number: number;
  opportunity_id: string | null;
  opportunity_key: string | null;

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
  lead_source: string | null;
  project_type: string | null;
  location: string | null;

  // People
  salesperson: string | null;
  sent_by_user: string | null;

  // Financials
  subtotal: number;
  total: number;
  discount: number;
  required_deposit: number;
  collected_deposit: number;

  // Dates
  drafted_date: string | null;
  sent_date: string | null;
  approved_date: string | null;
  converted_date: string | null;
  archived_date: string | null;

  // Linkage
  job_numbers: string | null;

  // Computed
  is_converted: boolean;
  is_archived: boolean;
  days_to_convert: number | null;

  created_at: string;
  updated_at: string;
}

export interface ResidentialJob {
  id: string;
  job_number: number;
  quote_number: number | null;

  client_name: string | null;
  service_street: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;

  title: string | null;
  project_type: string | null;
  salesperson: string | null;
  location: string | null;

  // Dates
  created_date: string | null;
  scheduled_start_date: string | null;
  closed_date: string | null;

  // Financials
  total_revenue: number;
  total_costs: number;
  profit: number;

  // Crew
  crew_1: string | null;
  crew_1_pay: number;
  crew_2: string | null;
  crew_2_pay: number;

  created_at: string;
  updated_at: string;
}

// =====================
// Filter Types
// =====================

export type SpeedToQuoteBucket = 'Same day' | '1-3 days' | '4-7 days' | '8+ days';

export type RevenueBucket =
  | '$0-$1K'
  | '$1K-$2K'
  | '$2K-$5K'
  | '$5K-$10K'
  | '$10K-$25K'
  | '$25K-$50K'
  | '$50K+';

export type QuoteCountBucket = '1 quote' | '2 quotes' | '3 quotes' | '4+ quotes';

export type ResidentialTimePreset =
  | 'last_30_days'
  | 'last_60_days'
  | 'last_90_days'
  | 'last_180_days'
  | 'last_365_days'
  | 'ytd'
  | 'all_time'
  | 'custom';

export interface ResidentialFilters {
  timePreset: ResidentialTimePreset;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  salesperson: string | null;
  revenueBucket: RevenueBucket | null;      // Project size filter
  speedBucket: SpeedToQuoteBucket | null;   // Speed to quote filter
  quoteCountBucket: QuoteCountBucket | null; // Number of quotes filter
}

export const DEFAULT_RESIDENTIAL_FILTERS: ResidentialFilters = {
  timePreset: 'all_time',
  dateRange: { start: null, end: null },
  salesperson: null,
  revenueBucket: null,
  speedBucket: null,
  quoteCountBucket: null,
};

export const REVENUE_BUCKET_ORDER: RevenueBucket[] = [
  '$0-$1K',
  '$1K-$2K',
  '$2K-$5K',
  '$5K-$10K',
  '$10K-$25K',
  '$25K-$50K',
  '$50K+',
];

export const SPEED_BUCKET_ORDER: SpeedToQuoteBucket[] = [
  'Same day',
  '1-3 days',
  '4-7 days',
  '8+ days',
];

export const QUOTE_COUNT_BUCKET_ORDER: QuoteCountBucket[] = [
  '1 quote',
  '2 quotes',
  '3 quotes',
  '4+ quotes',
];

// =====================
// Metrics Types
// =====================

export interface FunnelMetrics {
  total_opportunities: number;
  won_opportunities: number;
  lost_opportunities: number;
  pending_opportunities: number;
  win_rate: number | null;
  closed_win_rate: number | null;
  won_value: number;
  quoted_value: number;
  total_value: number;
  value_win_rate: number | null;
  avg_days_to_quote: number | null;
  avg_days_to_decision: number | null;
  avg_days_to_schedule: number | null;  // NEW: Converted → Job Scheduled
  avg_days_to_close: number | null;
  total_cycle_days: number | null;      // NEW: Assessment → Job Closed
}

// Warranty metrics from job-level analytics
export interface WarrantyMetrics {
  warranty_count: number;               // Jobs with $0 revenue
  paid_count: number;                   // Jobs with revenue > 0
  warranty_percent: number | null;      // % relative to baseline
  baseline_weekly_avg: number | null;   // Average paid jobs per week (8-week baseline)
}

// Request metrics (assessments scheduled)
export interface RequestMetrics {
  total_requests: number;
  assessments_scheduled: number;
  by_form_name: Record<string, number>; // Breakdown by request form type
}

export interface SalespersonMetrics {
  salesperson: string;
  total_opps: number;
  won_opps: number;
  lost_opps: number;
  win_rate: number | null;
  closed_win_rate: number | null;
  won_value: number;
  total_value: number;
  value_win_rate: number | null;
  avg_won_value: number | null;
  avg_days_to_quote: number | null;
}

export interface BucketMetrics {
  revenue_bucket: RevenueBucket;
  bucket_order: number;
  total_opps: number;
  won_opps: number;
  win_rate: number | null;
  closed_win_rate: number | null;
  won_value: number;
  total_value: number;
  value_win_rate: number | null;
}

export interface SpeedMetrics {
  speed_bucket: SpeedToQuoteBucket;
  bucket_order: number;
  total_opps: number;
  won_opps: number;
  win_rate: number | null;
  closed_win_rate: number | null;
  baseline_diff: number | null;
  won_value: number;
  total_value: number;
  value_win_rate: number | null;
}

export interface SpeedBySizeMetrics {
  speed_bucket: SpeedToQuoteBucket;
  revenue_bucket: RevenueBucket;
  total_opps: number;
  won_opps: number;
  win_rate: number | null;
}

export interface QuoteCountMetrics {
  quote_count_bucket: QuoteCountBucket;
  bucket_order: number;
  total_opps: number;
  won_opps: number;
  win_rate: number | null;
  closed_win_rate: number | null;
  won_value: number;
  total_value: number;
  value_win_rate: number | null;
}

export interface MonthlyTrend {
  month: string;
  month_label: string;
  total_opps: number;
  won_opps: number;
  win_rate: number | null;
  won_value: number;
  total_value: number;
  value_win_rate: number | null;
}

// Enhanced MonthlyTotals with total_value and value_win_rate
export interface MonthlyTotals {
  month: string;
  month_label: string;
  total_opps: number;
  won_opps: number;
  win_rate: number | null;
  won_value: number;
  total_value: number;
  value_win_rate: number | null;
}

// Weekly histogram data
export interface WeeklyTotals {
  week: string;
  week_label: string;
  week_start: string;
  total_opps: number;
  won_opps: number;
  win_rate: number | null;
  won_value: number;
  total_value: number;
}

// Win rate matrix entry (salesperson × month)
export interface WinRateMatrixEntry {
  salesperson: string;
  month: string;
  month_label: string;
  total_opps: number;
  won_opps: number;
  win_rate: number | null;
  won_value: number;
  total_value: number;
  value_win_rate: number | null;
}

// Weekly win rate matrix entry (salesperson × week)
export interface WeeklyWinRateMatrixEntry {
  salesperson: string;
  week: string;
  week_label: string;
  week_start: string;
  total_opps: number;
  won_opps: number;
  win_rate: number | null;
  won_value: number;
  total_value: number;
  value_win_rate: number | null;
}

export interface SalespersonMonthlyTrend extends MonthlyTrend {
  salesperson: string;
}

// =====================
// Import Types
// =====================

export interface ResidentialImportResult {
  success: boolean;
  opportunities: {
    total: number;
    new: number;
    updated: number;
  };
  quotes: {
    total: number;
    new: number;
    updated: number;
  };
  jobs: {
    total: number;
    linked: number;
  };
  requests: {
    total: number;
    linked: number;
    saved: number;
  };
  errors: ImportError[];
}

export interface ImportError {
  file: 'quotes' | 'jobs' | 'requests';
  row: number;
  field: string;
  message: string;
}

export interface ImportProgress {
  step: 'parsing' | 'quotes' | 'jobs' | 'requests' | 'opportunities' | 'complete';
  progress: number; // 0-100
  message: string;
}

// =====================
// Dashboard Types
// =====================

export type ResidentialDashboardTab =
  | 'funnel'
  | 'salespeople'
  | 'size'
  | 'speed'
  | 'options'
  | 'trends'
  | 'cycletime';

export const RESIDENTIAL_TAB_LABELS: Record<ResidentialDashboardTab, string> = {
  funnel: 'Conversion Funnel',
  salespeople: 'Salesperson',
  size: 'Project Size',
  speed: 'Speed to Quote',
  options: 'Quote Options',
  trends: 'Win Rate Trends',
  cycletime: 'Cycle Time',
};

// =====================
// Helper Functions
// =====================

/**
 * Normalize client name and address into unique opportunity key
 */
export function normalizeOpportunityKey(clientName: string | null, address: string | null): string {
  const client = (clientName || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const addr = (address || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  return `${client}|${addr}`;
}

/**
 * Get date range from time preset
 */
export function getResidentialDateRange(preset: ResidentialTimePreset): {
  start: Date | null;
  end: Date | null;
} {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'last_30_days': {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 30);
      return { start, end: today };
    }
    case 'last_60_days': {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 60);
      return { start, end: today };
    }
    case 'last_90_days': {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 90);
      return { start, end: today };
    }
    case 'last_180_days': {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 180);
      return { start, end: today };
    }
    case 'last_365_days': {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 365);
      return { start, end: today };
    }
    case 'ytd': {
      const start = new Date(today.getFullYear(), 0, 1);
      return { start, end: today };
    }
    case 'all_time':
    case 'custom':
    default:
      return { start: null, end: null };
  }
}

/**
 * Format currency for display
 */
export function formatResidentialCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Format percentage for display
 */
export function formatResidentialPercent(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(1)}%`;
}
