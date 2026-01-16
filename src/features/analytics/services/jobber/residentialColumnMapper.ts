// Column mapping for Residential CSV files (Quotes, Jobs, Requests)
// Maps Jobber export column names to our database fields

// =====================
// QUOTES CSV MAPPING
// =====================

export const RESIDENTIAL_QUOTE_COLUMNS: Record<string, string> = {
  // Core identifiers
  'Quote #': 'quote_number',

  // Client info
  'Client name': 'client_name',
  'Client email': 'client_email',
  'Client phone': 'client_phone',

  // Service address
  'Service property name': 'service_property_name',
  'Service street': 'service_street',
  'Service city': 'service_city',
  'Service province': 'service_state',
  'Service ZIP': 'service_zip',

  // Quote details
  'Title': 'title',
  'Status': 'status',
  'Line items': 'line_items',
  'Lead source': 'lead_source',

  // People
  'Salesperson': 'salesperson',
  'Sent by user': 'sent_by_user',

  // Financials
  'Subtotal ($)': 'subtotal',
  'Total ($)': 'total',
  'Discount ($)': 'discount',
  'Required deposit ($)': 'required_deposit',
  'Collected deposit ($)': 'collected_deposit',

  // Dates
  'Drafted date': 'drafted_date',
  'Sent date': 'sent_date',
  'Changes requested date': 'changes_requested_date',
  'Approved date': 'approved_date',
  'Converted date': 'converted_date',
  'Archived date': 'archived_date',

  // Linkage
  'Job #s': 'job_numbers',

  // Custom fields (Residential)
  'Rep Name': 'rep_name',
  'Rep Email': 'rep_email',
  'Rep Phone': 'rep_phone',
  'Project Type': 'project_type',
  'Location': 'location',
  'Priority': 'priority',
  'Lead Source': 'lead_source_custom',
  'Plot Plan': 'plot_plan',
  'Called the office?': 'called_office',
};


// =====================
// JOBS CSV MAPPING
// =====================

export const RESIDENTIAL_JOB_COLUMNS: Record<string, string> = {
  // Core identifiers
  'Job #': 'job_number',
  'Quote #': 'quote_number',

  // Client info
  'Client name': 'client_name',
  'Client email': 'client_email',
  'Client phone': 'client_phone',
  'Lead source': 'lead_source',

  // Address
  'Billing street': 'billing_street',
  'Billing city': 'billing_city',
  'Billing province': 'billing_state',
  'Billing ZIP': 'billing_zip',
  'Service property name': 'service_property_name',
  'Service street': 'service_street',
  'Service city': 'service_city',
  'Service province': 'service_state',
  'Service ZIP': 'service_zip',

  // Job details
  'Title': 'title',
  'Line items': 'line_items',
  'Online booking': 'online_booking',

  // People
  'Salesperson': 'salesperson',
  'Visits assigned to': 'visits_assigned_to',

  // Dates
  'Created date': 'created_date',
  'Scheduled start date': 'scheduled_start_date',
  'Closed date': 'closed_date',

  // Financials
  'Expenses total ($)': 'expenses_total',
  'Time tracked': 'time_tracked',
  'Labour cost total ($)': 'labour_cost_total',
  'Line item cost total ($)': 'line_item_cost_total',
  'Total costs ($)': 'total_costs',
  'Quote discount ($)': 'quote_discount',
  'Total revenue ($)': 'total_revenue',
  'Profit ($)': 'profit',
  'Profit %': 'profit_percent',

  // Invoice linkage
  'Invoice #s': 'invoice_numbers',

  // Crew
  'Crew 1': 'crew_1',
  'Crew 1 Job Pay': 'crew_1_pay',
  'Crew 2': 'crew_2',
  'Crew 2 Job Pay': 'crew_2_pay',
  'Crew 3': 'crew_3',
  'Crew 3 Job Pay': 'crew_3_pay',

  // Custom fields
  'Rep Name': 'rep_name',
  'Rep Email': 'rep_email',
  'Rep Phone': 'rep_phone',
  'Project Type': 'project_type',
  'Location': 'location',
  'Priority': 'priority',
  'Plot Plan': 'plot_plan',
  '811 details': 'details_811',
  'Cleared To Schedule': 'cleared_to_schedule',
  'Any problem encountered': 'problem_encountered',
  'Service Crew Credits': 'service_crew_credits',
};


// =====================
// REQUESTS CSV MAPPING
// =====================

export const RESIDENTIAL_REQUEST_COLUMNS: Record<string, string> = {
  // Dates
  'Requested on date': 'requested_date',
  'Assessment date': 'assessment_date',

  // Form info
  'Form name': 'form_name',

  // Client info
  'Client name': 'client_name',
  'Client email': 'client_email',
  'Client phone': 'client_phone',

  // Address
  'Service property name': 'service_property_name',
  'Service street': 'service_street',
  'Service city': 'service_city',
  'Service province': 'service_state',
  'Service ZIP': 'service_zip',

  // Request details
  'Request title': 'request_title',
  'Status': 'status',
  'Online booking': 'online_booking',

  // Assignment
  'Assessment assigned to': 'assessment_assigned_to',

  // Linkage - IMPORTANT for speed-to-quote
  'Quote #s': 'quote_numbers',
  'Job #s': 'job_numbers',

  // Custom fields
  'Description of Work:': 'description_of_work',
  'Source (For Internal Use)': 'source',
  'SIze of Project': 'size_of_project',
  'Additional Rep': 'additional_rep',
};


// =====================
// PARSING HELPERS
// =====================

/**
 * Parse date from various Jobber formats
 */
export function parseResidentialDate(value: string | undefined | null): string | null {
  if (!value || value === '-' || value.trim() === '') return null;

  const trimmed = value.trim();

  // Try ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.split('T')[0];
  }

  // Try "Jan 15, 2026" format
  const monthDayYear = trimmed.match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (monthDayYear) {
    const months: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const month = months[monthDayYear[1]];
    const day = monthDayYear[2].padStart(2, '0');
    const year = monthDayYear[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try MM/DD/YYYY format
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const month = mdyMatch[1].padStart(2, '0');
    const day = mdyMatch[2].padStart(2, '0');
    const year = mdyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback: try native Date parsing
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Parse currency value from string
 */
export function parseResidentialCurrency(value: string | undefined | null): number {
  if (!value || value === '-' || value.trim() === '') return 0;

  // Remove $, commas, and other non-numeric chars except decimal
  const cleaned = value.replace(/[$,%]/g, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse integer value from string
 */
export function parseResidentialInteger(value: string | undefined | null): number | null {
  if (!value || value === '-' || value.trim() === '') return null;

  const cleaned = value.replace(/,/g, '').trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/**
 * Parse comma-separated quote numbers from Requests CSV
 * Returns array of quote number strings
 */
export function parseQuoteNumbers(value: string | undefined | null): string[] {
  if (!value || value === '-' || value.trim() === '') return [];

  return value
    .split(',')
    .map(num => num.trim())
    .filter(num => num && num !== '-' && /^\d+$/.test(num));
}

/**
 * Clean string value
 */
export function cleanString(value: string | undefined | null): string | null {
  if (!value || value === '-' || value.trim() === '') return null;
  return value.trim();
}


// =====================
// ROW MAPPING FUNCTIONS
// =====================

export interface ParsedQuoteRow {
  quote_number: number | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  service_street: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;
  title: string | null;
  status: string | null;
  line_items: string | null;
  lead_source: string | null;
  salesperson: string | null;
  sent_by_user: string | null;
  subtotal: number;
  total: number;
  discount: number;
  required_deposit: number;
  collected_deposit: number;
  drafted_date: string | null;
  sent_date: string | null;
  approved_date: string | null;
  converted_date: string | null;
  archived_date: string | null;
  job_numbers: string | null;
  project_type: string | null;
  location: string | null;
}

export function mapQuoteRow(row: Record<string, string>): ParsedQuoteRow {
  const get = (csvColumn: string): string | undefined => row[csvColumn];

  return {
    quote_number: parseResidentialInteger(get('Quote #')),
    client_name: cleanString(get('Client name')),
    client_email: cleanString(get('Client email')),
    client_phone: cleanString(get('Client phone')),
    service_street: cleanString(get('Service street')),
    service_city: cleanString(get('Service city')),
    service_state: cleanString(get('Service province')),
    service_zip: cleanString(get('Service ZIP')),
    title: cleanString(get('Title')),
    status: cleanString(get('Status')),
    line_items: cleanString(get('Line items')),
    lead_source: cleanString(get('Lead source')) || cleanString(get('Lead Source')),
    salesperson: cleanString(get('Salesperson')),
    sent_by_user: cleanString(get('Sent by user')),
    subtotal: parseResidentialCurrency(get('Subtotal ($)')),
    total: parseResidentialCurrency(get('Total ($)')),
    discount: parseResidentialCurrency(get('Discount ($)')),
    required_deposit: parseResidentialCurrency(get('Required deposit ($)')),
    collected_deposit: parseResidentialCurrency(get('Collected deposit ($)')),
    drafted_date: parseResidentialDate(get('Drafted date')),
    sent_date: parseResidentialDate(get('Sent date')),
    approved_date: parseResidentialDate(get('Approved date')),
    converted_date: parseResidentialDate(get('Converted date')),
    archived_date: parseResidentialDate(get('Archived date')),
    job_numbers: cleanString(get('Job #s')),
    project_type: cleanString(get('Project Type')),
    location: cleanString(get('Location')),
  };
}

export interface ParsedJobRow {
  job_number: number | null;
  quote_number: number | null;
  client_name: string | null;
  service_street: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;
  title: string | null;
  salesperson: string | null;
  project_type: string | null;
  location: string | null;
  created_date: string | null;
  scheduled_start_date: string | null;
  closed_date: string | null;
  total_revenue: number;
  total_costs: number;
  profit: number;
  crew_1: string | null;
  crew_1_pay: number;
  crew_2: string | null;
  crew_2_pay: number;
}

export function mapJobRow(row: Record<string, string>): ParsedJobRow {
  const get = (csvColumn: string): string | undefined => row[csvColumn];

  return {
    job_number: parseResidentialInteger(get('Job #')),
    quote_number: parseResidentialInteger(get('Quote #')),
    client_name: cleanString(get('Client name')),
    service_street: cleanString(get('Service street')),
    service_city: cleanString(get('Service city')),
    service_state: cleanString(get('Service province')),
    service_zip: cleanString(get('Service ZIP')),
    title: cleanString(get('Title')),
    salesperson: cleanString(get('Salesperson')),
    project_type: cleanString(get('Project Type')),
    location: cleanString(get('Location')),
    created_date: parseResidentialDate(get('Created date')),
    scheduled_start_date: parseResidentialDate(get('Scheduled start date')),
    closed_date: parseResidentialDate(get('Closed date')),
    total_revenue: parseResidentialCurrency(get('Total revenue ($)')),
    total_costs: parseResidentialCurrency(get('Total costs ($)')),
    profit: parseResidentialCurrency(get('Profit ($)')),
    crew_1: cleanString(get('Crew 1')),
    crew_1_pay: parseResidentialCurrency(get('Crew 1 Job Pay')),
    crew_2: cleanString(get('Crew 2')),
    crew_2_pay: parseResidentialCurrency(get('Crew 2 Job Pay')),
  };
}

export interface ParsedRequestRow {
  // Core identification
  client_name: string | null;
  client_name_normalized: string | null;
  client_email: string | null;
  client_phone: string | null;
  service_street: string | null;
  service_street_normalized: string | null;
  service_city: string | null;
  service_state: string | null;
  service_zip: string | null;

  // Dates
  requested_date: string | null;
  assessment_date: string | null;

  // Request details
  form_name: string | null;           // Product type indicator
  request_title: string | null;
  status: string | null;

  // Assignment
  assessment_assigned_to: string | null;

  // Custom fields
  description_of_work: string | null;
  size_of_project: string | null;
  source: string | null;
  additional_rep: string | null;
  online_booking: boolean;

  // Linkage
  quote_numbers: string[];
  job_numbers: string[];

  // Computed key for matching
  request_key: string | null;
}

export function mapRequestRow(row: Record<string, string>): ParsedRequestRow {
  const get = (csvColumn: string): string | undefined => row[csvColumn];

  const clientName = cleanString(get('Client name'));
  const serviceStreet = cleanString(get('Service street'));

  // Generate request key for matching (client + address)
  const clientNorm = (clientName || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const streetNorm = (serviceStreet || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const requestKey = clientNorm && streetNorm ? `${clientNorm}|${streetNorm}` : null;

  return {
    // Core identification
    client_name: clientName,
    client_name_normalized: clientNorm || null,
    client_email: cleanString(get('Client email')),
    client_phone: cleanString(get('Client phone')),
    service_street: serviceStreet,
    service_street_normalized: streetNorm || null,
    service_city: cleanString(get('Service city')),
    service_state: cleanString(get('Service province')),
    service_zip: cleanString(get('Service ZIP')),

    // Dates
    requested_date: parseResidentialDate(get('Requested on date')),
    assessment_date: parseResidentialDate(get('Assessment date')),

    // Request details
    form_name: cleanString(get('Form name')),
    request_title: cleanString(get('Request title')),
    status: cleanString(get('Status')),

    // Assignment
    assessment_assigned_to: cleanString(get('Assessment assigned to')),

    // Custom fields
    description_of_work: cleanString(get('Description of Work:')),
    size_of_project: cleanString(get('SIze of Project')),  // Note: CSV has typo "SIze"
    source: cleanString(get('Source (For Internal Use)')),
    additional_rep: cleanString(get('Additional Rep')),
    online_booking: get('Online booking')?.toLowerCase() === 'yes',

    // Linkage
    quote_numbers: parseQuoteNumbers(get('Quote #s')),
    job_numbers: parseQuoteNumbers(get('Job #s')),  // Same format as quote numbers

    // Computed key
    request_key: requestKey,
  };
}
