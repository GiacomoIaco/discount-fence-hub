// Jobber Import Service
// Handles CSV parsing and UPSERT operations for Jobber data imports

import { supabase } from '../../../../lib/supabase';
import {
  mapCSVRowToDBFields,
  getColumnMapForType,
  getUniqueKeyForType,
  getTableNameForType,
  detectReportType,
  parseDate
} from './columnMapper';
import { loadNameNormalizationMap, getEffectiveSalesperson } from './nameNormalizer';
import type {
  CSVRow,
  ImportResult,
  ImportError,
  ReportType,
  BusinessUnit,
  JobberImportLog
} from '../../types/jobber';

// Batch size for database operations
const BATCH_SIZE = 100;

/**
 * Parse CSV text into array of row objects
 */
export function parseCSV(csvText: string): { headers: string[]; rows: CSVRow[] } {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse header line
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line, handling quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ',') {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  // Don't forget the last field
  result.push(current.trim());

  return result;
}

/**
 * Create an import log entry
 */
async function createImportLog(
  businessUnit: BusinessUnit,
  reportType: ReportType,
  fileName: string,
  totalRows: number
): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('jobber_import_logs')
    .insert({
      business_unit: businessUnit,
      report_type: reportType,
      file_name: fileName,
      uploaded_by: userData.user?.id || null,
      total_rows: totalRows,
      status: 'processing',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create import log:', error);
    return null;
  }

  return data.id;
}

/**
 * Update import log with final results
 */
async function updateImportLog(
  logId: string,
  result: Partial<JobberImportLog>
): Promise<void> {
  const { error } = await supabase
    .from('jobber_import_logs')
    .update(result)
    .eq('id', logId);

  if (error) {
    console.error('Failed to update import log:', error);
  }
}

/**
 * Import a CSV file into the Jobber database tables
 */
export async function importJobberCSV(
  csvText: string,
  fileName: string,
  businessUnit: BusinessUnit = 'builder',
  reportTypeOverride?: ReportType
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let newRecords = 0;
  let updatedRecords = 0;
  let skippedRecords = 0;

  // Parse CSV
  const { headers, rows } = parseCSV(csvText);

  if (rows.length === 0) {
    return {
      success: false,
      totalRows: 0,
      newRecords: 0,
      updatedRecords: 0,
      skippedRecords: 0,
      errors: [{ row: 0, field: '', message: 'No data rows found in CSV' }],
      logId: '',
    };
  }

  // Detect or use provided report type
  const reportType = reportTypeOverride || detectReportType(headers);

  if (!reportType) {
    return {
      success: false,
      totalRows: rows.length,
      newRecords: 0,
      updatedRecords: 0,
      skippedRecords: rows.length,
      errors: [{ row: 0, field: '', message: 'Could not detect report type from CSV headers' }],
      logId: '',
    };
  }

  // Create import log
  const logId = await createImportLog(businessUnit, reportType, fileName, rows.length);

  if (!logId) {
    return {
      success: false,
      totalRows: rows.length,
      newRecords: 0,
      updatedRecords: 0,
      skippedRecords: rows.length,
      errors: [{ row: 0, field: '', message: 'Failed to create import log' }],
      logId: '',
    };
  }

  // Load name normalization map
  const normMap = await loadNameNormalizationMap();

  // Get column map and table info
  const columnMap = getColumnMapForType(reportType);
  const uniqueKey = getUniqueKeyForType(reportType);
  const tableName = getTableNameForType(reportType);

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const mappedBatch: Record<string, unknown>[] = [];

    for (let j = 0; j < batch.length; j++) {
      const rowIndex = i + j + 2; // +2 for 1-indexed and header row
      const row = batch[j];

      try {
        // Map CSV columns to DB fields
        const mapped = mapCSVRowToDBFields(row, columnMap);

        // Check for required unique key
        if (!mapped[uniqueKey]) {
          errors.push({
            row: rowIndex,
            field: uniqueKey,
            message: `Missing required field: ${uniqueKey}`,
          });
          skippedRecords++;
          continue;
        }

        // Add effective salesperson (computed field)
        mapped.effective_salesperson = getEffectiveSalesperson(row, normMap);

        // Add import log reference
        mapped.import_log_id = logId;
        mapped.last_updated_at = new Date().toISOString();

        mappedBatch.push(mapped);
      } catch (err) {
        errors.push({
          row: rowIndex,
          field: '',
          message: `Error processing row: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
        skippedRecords++;
      }
    }

    // UPSERT batch
    if (mappedBatch.length > 0) {
      const { data, error } = await supabase
        .from(tableName)
        .upsert(mappedBatch, {
          onConflict: uniqueKey,
          ignoreDuplicates: false,
        })
        .select('id');

      if (error) {
        console.error(`Error upserting batch:`, error);
        errors.push({
          row: i + 2,
          field: '',
          message: `Batch upsert error: ${error.message}`,
        });
        skippedRecords += mappedBatch.length;
      } else {
        // Count results - we can't easily distinguish new vs updated with upsert
        // For now, count all as updates (more conservative)
        const count = data?.length || mappedBatch.length;
        updatedRecords += count;
      }
    }
  }

  // Calculate date range from data
  let dataStartDate: string | null = null;
  let dataEndDate: string | null = null;

  const dateField = reportType === 'quotes' ? 'drafted_date' : 'created_date';
  const dateColumnKey = Object.keys(columnMap).find(k => columnMap[k] === dateField) || '';

  // Parse dates and filter out invalid ones, then sort chronologically
  const parsedDates = rows
    .map(r => parseDate(r[dateColumnKey] || ''))
    .filter((d): d is string => d !== null)
    .sort((a, b) => a.localeCompare(b)); // ISO dates (YYYY-MM-DD) sort correctly as strings

  if (parsedDates.length > 0) {
    dataStartDate = parsedDates[0] || null;
    dataEndDate = parsedDates[parsedDates.length - 1] || null;
  }

  // Update import log with results
  await updateImportLog(logId, {
    status: errors.length > 0 && errors.length === rows.length ? 'failed' : 'completed',
    new_records: newRecords,
    updated_records: updatedRecords,
    skipped_records: skippedRecords,
    errors: errors.slice(0, 100), // Limit stored errors
    data_start_date: dataStartDate,
    data_end_date: dataEndDate,
    error_message: errors.length > 0 ? `${errors.length} errors occurred` : null,
  });

  return {
    success: errors.length === 0 || errors.length < rows.length,
    totalRows: rows.length,
    newRecords,
    updatedRecords,
    skippedRecords,
    errors,
    logId,
  };
}

/**
 * Get recent import logs
 */
export async function getImportLogs(
  businessUnit?: BusinessUnit,
  limit: number = 10
): Promise<JobberImportLog[]> {
  let query = supabase
    .from('jobber_import_logs')
    .select('*')
    .order('uploaded_at', { ascending: false })
    .limit(limit);

  if (businessUnit) {
    query = query.eq('business_unit', businessUnit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch import logs:', error);
    return [];
  }

  return data as JobberImportLog[];
}

/**
 * Get import statistics summary
 */
export async function getImportStats(businessUnit: BusinessUnit = 'builder'): Promise<{
  lastJobsImport: JobberImportLog | null;
  lastQuotesImport: JobberImportLog | null;
  lastInvoicesImport: JobberImportLog | null;
  totalJobs: number;
  totalQuotes: number;
  totalInvoices: number;
}> {
  // Get last imports for each type
  const [jobsResult, quotesResult, invoicesResult] = await Promise.all([
    supabase
      .from('jobber_import_logs')
      .select('*')
      .eq('business_unit', businessUnit)
      .eq('report_type', 'jobs')
      .eq('status', 'completed')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('jobber_import_logs')
      .select('*')
      .eq('business_unit', businessUnit)
      .eq('report_type', 'quotes')
      .eq('status', 'completed')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('jobber_import_logs')
      .select('*')
      .eq('business_unit', businessUnit)
      .eq('report_type', 'invoices')
      .eq('status', 'completed')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single(),
  ]);

  // Get record counts
  const [jobsCount, quotesCount, invoicesCount] = await Promise.all([
    supabase.from('jobber_builder_jobs').select('id', { count: 'exact', head: true }),
    supabase.from('jobber_builder_quotes').select('id', { count: 'exact', head: true }),
    supabase.from('jobber_builder_invoices').select('id', { count: 'exact', head: true }),
  ]);

  return {
    lastJobsImport: jobsResult.data as JobberImportLog | null,
    lastQuotesImport: quotesResult.data as JobberImportLog | null,
    lastInvoicesImport: invoicesResult.data as JobberImportLog | null,
    totalJobs: jobsCount.count || 0,
    totalQuotes: quotesCount.count || 0,
    totalInvoices: invoicesCount.count || 0,
  };
}
