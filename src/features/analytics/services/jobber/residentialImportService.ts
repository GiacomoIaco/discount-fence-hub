// Residential Import Service
// Handles bulk upload of Quotes, Jobs, and Requests CSVs
// Normalizes quotes into opportunities and enriches with job/request data

import { supabase } from '../../../../lib/supabase';
import {
  mapQuoteRow,
  mapJobRow,
  mapRequestRow,
  type ParsedQuoteRow,
  type ParsedJobRow,
  type ParsedRequestRow,
} from './residentialColumnMapper';
import {
  normalizeOpportunityKey,
  type ResidentialImportResult,
  type ImportError,
  type ImportProgress,
} from '../../types/residential';
import Papa from 'papaparse';

// =====================
// TYPES
// =====================

interface OpportunityBuilder {
  key: string;
  clientName: string | null;
  clientNameNormalized: string;
  clientEmail: string | null;
  clientPhone: string | null;
  serviceStreet: string | null;
  serviceStreetNormalized: string;
  serviceCity: string | null;
  serviceState: string | null;
  serviceZip: string | null;
  salesperson: string | null;
  projectType: string | null;
  location: string | null;
  leadSource: string | null;

  // Quote aggregations
  quotes: ParsedQuoteRow[];
  quoteNumbers: number[];

  // Computed after processing
  quoteCount: number;
  maxQuoteValue: number;
  minQuoteValue: number;
  totalQuotedValue: number;
  avgQuoteValue: number;              // For normalized pipeline value calculation
  firstQuoteDate: string | null;      // First DRAFTED date (legacy)
  firstQuoteSentDate: string | null;  // First SENT date (for correct cycle time)
  lastQuoteDate: string | null;

  // Conversion status
  isWon: boolean;
  isLost: boolean;
  isPending: boolean;
  wonValue: number;
  wonDate: string | null;
  wonQuoteNumbers: number[];
  jobNumbers: string[];

  // Enrichment from jobs
  scheduledDate: string | null;
  closedDate: string | null;
  actualRevenue: number | null;

  // Enrichment from requests
  assessmentDate: string | null;
  requestDate: string | null;  // Fallback for days_to_quote when no assessment
}

// =====================
// MAIN IMPORT FUNCTION
// =====================

export async function importResidentialData(
  quotesFile: File,
  jobsFile: File | null,
  requestsFile: File | null,
  onProgress?: (progress: ImportProgress) => void
): Promise<ResidentialImportResult> {
  const errors: ImportError[] = [];

  const report = (step: ImportProgress['step'], progress: number, message: string) => {
    onProgress?.({ step, progress, message });
  };

  try {
    // =====================
    // STEP 1: PARSE CSV FILES
    // =====================
    report('parsing', 5, 'Parsing CSV files...');

    const quotesData = await parseCSV(quotesFile);
    const jobsData = jobsFile ? await parseCSV(jobsFile) : [];
    const requestsData = requestsFile ? await parseCSV(requestsFile) : [];

    report('parsing', 15, `Parsed ${quotesData.length} quotes, ${jobsData.length} jobs, ${requestsData.length} requests`);

    // =====================
    // STEP 2: BUILD OPPORTUNITIES FROM QUOTES
    // =====================
    report('quotes', 20, 'Processing quotes and building opportunities...');

    const opportunities = new Map<string, OpportunityBuilder>();
    const quoteRows: ParsedQuoteRow[] = [];

    for (let i = 0; i < quotesData.length; i++) {
      const row = quotesData[i];
      const parsed = mapQuoteRow(row);

      // Validate quote number
      if (!parsed.quote_number) {
        errors.push({
          file: 'quotes',
          row: i + 2, // +2 for header and 0-index
          field: 'Quote #',
          message: 'Missing quote number',
        });
        continue;
      }

      quoteRows.push(parsed);

      // Build opportunity key
      const oppKey = normalizeOpportunityKey(parsed.client_name, parsed.service_street);

      if (!opportunities.has(oppKey)) {
        opportunities.set(oppKey, createOpportunityBuilder(oppKey, parsed));
      }

      const opp = opportunities.get(oppKey)!;
      opp.quotes.push(parsed);
      opp.quoteNumbers.push(parsed.quote_number);

      // Update salesperson if not set (take first non-null)
      if (!opp.salesperson && parsed.salesperson) {
        opp.salesperson = parsed.salesperson;
      }
    }

    report('quotes', 40, `Built ${opportunities.size} opportunities from ${quoteRows.length} quotes`);

    // =====================
    // STEP 3: CALCULATE OPPORTUNITY METRICS
    // =====================
    report('opportunities', 45, 'Calculating opportunity metrics...');

    for (const opp of opportunities.values()) {
      calculateOpportunityMetrics(opp);
    }

    // =====================
    // STEP 4: ENRICH WITH JOBS DATA
    // =====================
    report('jobs', 50, 'Enriching with job data...');

    const jobRows: ParsedJobRow[] = [];
    const jobByQuoteNumber = new Map<number, ParsedJobRow>();

    for (let i = 0; i < jobsData.length; i++) {
      const row = jobsData[i];
      const parsed = mapJobRow(row);

      if (!parsed.job_number) {
        errors.push({
          file: 'jobs',
          row: i + 2,
          field: 'Job #',
          message: 'Missing job number',
        });
        continue;
      }

      jobRows.push(parsed);

      // Index by quote number for enrichment
      if (parsed.quote_number) {
        jobByQuoteNumber.set(parsed.quote_number, parsed);
      }
    }

    // Link jobs to opportunities
    let linkedJobs = 0;
    for (const opp of opportunities.values()) {
      if (opp.isWon && opp.jobNumbers.length > 0) {
        // Try to find job data for this opportunity
        for (const qn of opp.wonQuoteNumbers) {
          const job = jobByQuoteNumber.get(qn);
          if (job) {
            opp.scheduledDate = job.scheduled_start_date;
            opp.closedDate = job.closed_date;
            opp.actualRevenue = job.total_revenue;
            linkedJobs++;
            break; // Take first job's dates
          }
        }
      }
    }

    report('jobs', 65, `Linked ${linkedJobs} jobs to opportunities`);

    // =====================
    // STEP 5: ENRICH WITH REQUESTS DATA (ASSESSMENT + REQUEST DATES)
    // =====================
    report('requests', 70, 'Enriching with assessment and request dates...');

    // Build lookups: Quote # -> dates (assessment and request/fallback)
    const assessmentByQuote = new Map<number, string>();
    const requestDateByQuote = new Map<number, string>();  // Fallback for days_to_quote
    const requestRows: ParsedRequestRow[] = [];

    for (let i = 0; i < requestsData.length; i++) {
      const row = requestsData[i];
      const parsed = mapRequestRow(row);

      // Collect all parsed requests for persistence
      if (parsed.request_key) {
        requestRows.push(parsed);
      }

      // Skip if no quote linkage
      if (parsed.quote_numbers.length === 0) continue;

      for (const qnStr of parsed.quote_numbers) {
        const qn = parseInt(qnStr, 10);
        if (isNaN(qn)) continue;

        // Track assessment date (if available)
        if (parsed.assessment_date) {
          const existing = assessmentByQuote.get(qn);
          if (!existing || parsed.assessment_date < existing) {
            assessmentByQuote.set(qn, parsed.assessment_date);
          }
        }

        // Track request date (fallback for days_to_quote)
        // Use assessment_date if available, otherwise requested_date
        const requestDate = parsed.assessment_date || parsed.requested_date;
        if (requestDate) {
          const existing = requestDateByQuote.get(qn);
          if (!existing || requestDate < existing) {
            requestDateByQuote.set(qn, requestDate);
          }
        }
      }
    }

    // Apply dates to opportunities
    let linkedRequests = 0;
    for (const opp of opportunities.values()) {
      for (const qn of opp.quoteNumbers) {
        // Apply assessment date
        const assessDate = assessmentByQuote.get(qn);
        if (assessDate) {
          if (!opp.assessmentDate || assessDate < opp.assessmentDate) {
            opp.assessmentDate = assessDate;
            linkedRequests++;
          }
        }

        // Apply request date (for days_to_quote fallback)
        const reqDate = requestDateByQuote.get(qn);
        if (reqDate) {
          if (!opp.requestDate || reqDate < opp.requestDate) {
            opp.requestDate = reqDate;
          }
        }
      }
    }

    report('requests', 80, `Linked ${linkedRequests} assessment dates, ${requestRows.length} requests to save`);

    // =====================
    // STEP 6: UPSERT TO DATABASE
    // =====================
    report('opportunities', 85, 'Saving to database...');

    // Save quotes first (deduplicate by quote_number - keep latest/last occurrence)
    const quoteMap = new Map<number, typeof quoteRows[0]>();
    for (const q of quoteRows) {
      if (q.quote_number) {
        quoteMap.set(q.quote_number, q); // Later entries overwrite earlier ones
      }
    }
    const uniqueQuoteRows = Array.from(quoteMap.values());

    const quotesToInsert = uniqueQuoteRows.map(q => ({
      quote_number: q.quote_number,
      opportunity_key: normalizeOpportunityKey(q.client_name, q.service_street),
      client_name: q.client_name,
      client_email: q.client_email,
      client_phone: q.client_phone,
      service_street: q.service_street,
      service_city: q.service_city,
      service_state: q.service_state,
      service_zip: q.service_zip,
      title: q.title,
      status: q.status,
      line_items: q.line_items,
      lead_source: q.lead_source,
      project_type: q.project_type,
      location: q.location,
      salesperson: q.salesperson,
      sent_by_user: q.sent_by_user,
      subtotal: q.subtotal,
      total: q.total,
      discount: q.discount,
      required_deposit: q.required_deposit,
      collected_deposit: q.collected_deposit,
      drafted_date: q.drafted_date,
      sent_date: q.sent_date,
      approved_date: q.approved_date,
      converted_date: q.converted_date,
      archived_date: q.archived_date,
      job_numbers: q.job_numbers,
    }));

    // Batch upsert quotes
    let quotesNew = 0;
    let quotesUpdated = 0;

    for (let i = 0; i < quotesToInsert.length; i += 500) {
      const batch = quotesToInsert.slice(i, i + 500);
      const { error } = await supabase
        .from('jobber_residential_quotes')
        .upsert(batch, { onConflict: 'quote_number' });

      if (error) {
        console.error('Error upserting quotes batch:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          batchSize: batch.length,
          firstRow: batch[0] ? { quote_number: batch[0].quote_number, client_name: batch[0].client_name } : null,
        });
        errors.push({
          file: 'quotes',
          row: i,
          field: 'database',
          message: `Database error: ${error.message} (code: ${error.code}, hint: ${error.hint || 'none'})`,
        });
      }
    }
    quotesNew = quotesToInsert.length; // Simplified - actual count would require comparison

    // Save jobs
    const jobsToInsert = jobRows.map(j => ({
      job_number: j.job_number,
      quote_number: j.quote_number,
      client_name: j.client_name,
      service_street: j.service_street,
      service_city: j.service_city,
      service_state: j.service_state,
      service_zip: j.service_zip,
      title: j.title,
      project_type: j.project_type,
      salesperson: j.salesperson,
      location: j.location,
      created_date: j.created_date,
      scheduled_start_date: j.scheduled_start_date,
      closed_date: j.closed_date,
      total_revenue: j.total_revenue,
      total_costs: j.total_costs,
      profit: j.profit,
      crew_1: j.crew_1,
      crew_1_pay: j.crew_1_pay,
      crew_2: j.crew_2,
      crew_2_pay: j.crew_2_pay,
    }));

    for (let i = 0; i < jobsToInsert.length; i += 500) {
      const batch = jobsToInsert.slice(i, i + 500);
      const { error } = await supabase
        .from('jobber_residential_jobs')
        .upsert(batch, { onConflict: 'job_number' });

      if (error) {
        console.error('Error upserting jobs batch:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        errors.push({
          file: 'jobs',
          row: i,
          field: 'database',
          message: `Database error: ${error.message} (code: ${error.code})`,
        });
      }
    }

    // Save requests (deduplicate by request_key - keep latest/last occurrence)
    let requestsSaved = 0;
    if (requestRows.length > 0) {
      const requestMap = new Map<string, typeof requestRows[0]>();
      for (const r of requestRows) {
        if (r.request_key) {
          requestMap.set(r.request_key, r); // Later entries overwrite earlier ones
        }
      }
      const uniqueRequestRows = Array.from(requestMap.values());

      const requestsToInsert = uniqueRequestRows.map(r => ({
        request_key: r.request_key,
        client_name: r.client_name,
        client_name_normalized: r.client_name_normalized,
        service_street: r.service_street,
        service_street_normalized: r.service_street_normalized,
        service_city: r.service_city,
        service_state: r.service_state,
        service_zip: r.service_zip,
        requested_date: r.requested_date,
        assessment_date: r.assessment_date,
        form_name: r.form_name,
        request_title: r.request_title,
        status: r.status,
        assessment_assigned_to: r.assessment_assigned_to,
        description_of_work: r.description_of_work,
        size_of_project: r.size_of_project,
        source: r.source,
        additional_rep: r.additional_rep,
        online_booking: r.online_booking,
        quote_numbers: r.quote_numbers.length > 0 ? r.quote_numbers.join(',') : null,
        job_numbers: r.job_numbers.length > 0 ? r.job_numbers.join(',') : null,
      }));

      for (let i = 0; i < requestsToInsert.length; i += 500) {
        const batch = requestsToInsert.slice(i, i + 500);
        const { error } = await supabase
          .from('jobber_residential_requests')
          .upsert(batch, { onConflict: 'request_key' });

        if (error) {
          console.error('Error upserting requests batch:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          errors.push({
            file: 'requests',
            row: i,
            field: 'database',
            message: `Database error: ${error.message} (code: ${error.code})`,
          });
        } else {
          requestsSaved += batch.length;
        }
      }
    }

    // Save opportunities
    const oppsToInsert = Array.from(opportunities.values()).map(opp => ({
      opportunity_key: opp.key,
      client_name: opp.clientName,
      client_name_normalized: opp.clientNameNormalized,
      client_email: opp.clientEmail,
      client_phone: opp.clientPhone,
      service_street: opp.serviceStreet,
      service_street_normalized: opp.serviceStreetNormalized,
      service_city: opp.serviceCity,
      service_state: opp.serviceState,
      service_zip: opp.serviceZip,
      salesperson: opp.salesperson,
      project_type: opp.projectType,
      location: opp.location,
      lead_source: opp.leadSource,
      quote_count: opp.quoteCount,
      quote_numbers: opp.quoteNumbers.join(','),
      first_quote_date: opp.firstQuoteDate,
      first_quote_sent_date: opp.firstQuoteSentDate,
      last_quote_date: opp.lastQuoteDate,
      max_quote_value: opp.maxQuoteValue,
      min_quote_value: opp.minQuoteValue,
      total_quoted_value: opp.totalQuotedValue,
      avg_quote_value: opp.avgQuoteValue,
      won_value: opp.wonValue,
      is_won: opp.isWon,
      is_lost: opp.isLost,
      is_pending: opp.isPending,
      won_date: opp.wonDate,
      won_quote_numbers: opp.wonQuoteNumbers.length > 0 ? opp.wonQuoteNumbers.join(',') : null,
      job_numbers: opp.jobNumbers.length > 0 ? opp.jobNumbers.join(',') : null,
      scheduled_date: opp.scheduledDate,
      closed_date: opp.closedDate,
      actual_revenue: opp.actualRevenue,
      assessment_date: opp.assessmentDate,
      request_date: opp.requestDate,  // Fallback for days_to_quote when no assessment
      last_updated_at: new Date().toISOString(),
    }));

    let oppsNew = 0;
    let oppsUpdated = 0;

    for (let i = 0; i < oppsToInsert.length; i += 500) {
      const batch = oppsToInsert.slice(i, i + 500);
      const { error } = await supabase
        .from('jobber_residential_opportunities')
        .upsert(batch, { onConflict: 'opportunity_key' });

      if (error) {
        console.error('Error upserting opportunities batch:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          batchSize: batch.length,
        });
        errors.push({
          file: 'quotes', // Use 'quotes' since opportunities are derived from quotes
          row: i,
          field: 'database',
          message: `Opportunities DB error: ${error.message} (code: ${error.code})`,
        });
      }
    }
    oppsNew = oppsToInsert.length;

    report('complete', 100, 'Import complete!');

    return {
      success: errors.length === 0,
      opportunities: {
        total: opportunities.size,
        new: oppsNew,
        updated: oppsUpdated,
      },
      quotes: {
        total: quoteRows.length,
        new: quotesNew,
        updated: quotesUpdated,
      },
      jobs: {
        total: jobRows.length,
        linked: linkedJobs,
      },
      requests: {
        total: requestsData.length,
        linked: linkedRequests,
        saved: requestsSaved,
      },
      errors,
    };
  } catch (error) {
    console.error('Import error:', error);
    return {
      success: false,
      opportunities: { total: 0, new: 0, updated: 0 },
      quotes: { total: 0, new: 0, updated: 0 },
      jobs: { total: 0, linked: 0 },
      requests: { total: 0, linked: 0, saved: 0 },
      errors: [{
        file: 'quotes',
        row: 0,
        field: 'system',
        message: error instanceof Error ? error.message : 'Unknown error',
      }],
    };
  }
}


// =====================
// HELPER FUNCTIONS
// =====================

async function parseCSV(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as Record<string, string>[]);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

function createOpportunityBuilder(key: string, firstQuote: ParsedQuoteRow): OpportunityBuilder {
  return {
    key,
    clientName: firstQuote.client_name,
    clientNameNormalized: (firstQuote.client_name || '').toLowerCase().trim(),
    clientEmail: firstQuote.client_email,
    clientPhone: firstQuote.client_phone,
    serviceStreet: firstQuote.service_street,
    serviceStreetNormalized: (firstQuote.service_street || '').toLowerCase().trim(),
    serviceCity: firstQuote.service_city,
    serviceState: firstQuote.service_state,
    serviceZip: firstQuote.service_zip,
    salesperson: firstQuote.salesperson,
    projectType: firstQuote.project_type,
    location: firstQuote.location,
    leadSource: firstQuote.lead_source,
    quotes: [],
    quoteNumbers: [],
    quoteCount: 0,
    maxQuoteValue: 0,
    minQuoteValue: Infinity,
    totalQuotedValue: 0,
    avgQuoteValue: 0,
    firstQuoteDate: null,
    firstQuoteSentDate: null,
    lastQuoteDate: null,
    isWon: false,
    isLost: false,
    isPending: true,
    wonValue: 0,
    wonDate: null,
    wonQuoteNumbers: [],
    jobNumbers: [],
    scheduledDate: null,
    closedDate: null,
    actualRevenue: null,
    assessmentDate: null,
    requestDate: null,
  };
}

function calculateOpportunityMetrics(opp: OpportunityBuilder): void {
  const quotes = opp.quotes;

  opp.quoteCount = quotes.length;

  // Calculate value aggregations
  let maxVal = 0;
  let minVal = Infinity;
  let totalVal = 0;

  for (const q of quotes) {
    const val = q.total || 0;
    totalVal += val;
    if (val > maxVal) maxVal = val;
    if (val < minVal) minVal = val;
  }

  opp.maxQuoteValue = maxVal;
  opp.minQuoteValue = minVal === Infinity ? 0 : minVal;
  opp.totalQuotedValue = totalVal;
  opp.avgQuoteValue = quotes.length > 0 ? totalVal / quotes.length : 0;

  // Calculate date ranges
  // First DRAFTED date (legacy - keep for backwards compatibility)
  const draftDates = quotes
    .map(q => q.drafted_date)
    .filter((d): d is string => d !== null)
    .sort();

  if (draftDates.length > 0) {
    opp.firstQuoteDate = draftDates[0];
    opp.lastQuoteDate = draftDates[draftDates.length - 1];
  }

  // First SENT date (for correct cycle time calculations)
  const sentDates = quotes
    .map(q => q.sent_date)
    .filter((d): d is string => d !== null)
    .sort();

  if (sentDates.length > 0) {
    opp.firstQuoteSentDate = sentDates[0];
  }

  // Determine conversion status
  const converted = quotes.filter(q => q.status === 'Converted');
  const archived = quotes.filter(q => q.status === 'Archived');

  if (converted.length > 0) {
    opp.isWon = true;
    opp.isLost = false;
    opp.isPending = false;

    // Calculate won value and date
    opp.wonValue = converted.reduce((sum, q) => sum + (q.total || 0), 0);

    // Get earliest converted date
    const convertedDates = converted
      .map(q => q.converted_date)
      .filter((d): d is string => d !== null)
      .sort();
    if (convertedDates.length > 0) {
      opp.wonDate = convertedDates[0];
    }

    // Get won quote numbers
    opp.wonQuoteNumbers = converted
      .map(q => q.quote_number)
      .filter((n): n is number => n !== null);

    // Get job numbers from converted quotes
    const jobNums: string[] = [];
    for (const q of converted) {
      if (q.job_numbers) {
        const nums = q.job_numbers.split(',').map(n => n.trim()).filter(n => n && n !== '-');
        jobNums.push(...nums);
      }
    }
    opp.jobNumbers = [...new Set(jobNums)]; // Dedupe
  } else if (archived.length === quotes.length && quotes.length > 0) {
    // All quotes archived = lost
    opp.isWon = false;
    opp.isLost = true;
    opp.isPending = false;
  } else {
    // Some pending quotes
    opp.isWon = false;
    opp.isLost = false;
    opp.isPending = true;
  }
}
