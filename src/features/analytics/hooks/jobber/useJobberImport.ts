// Hook for Jobber CSV import functionality

import { useState, useCallback } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { importJobberCSV, getImportStats, getImportLogs } from '../../services/jobber/importService';
import { detectReportType } from '../../services/jobber/columnMapper';
import { parseCSV } from '../../services/jobber/importService';
import type { ImportResult, ReportType, BusinessUnit } from '../../types/jobber';

interface UseJobberImportReturn {
  // Import function
  importCSV: (file: File, reportTypeOverride?: ReportType) => Promise<ImportResult>;
  // State
  isImporting: boolean;
  importProgress: number;
  lastResult: ImportResult | null;
  // Error handling
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for importing Jobber CSV files
 */
export function useJobberImport(businessUnit: BusinessUnit = 'builder'): UseJobberImportReturn {
  const queryClient = useQueryClient();
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importCSV = useCallback(async (file: File, reportTypeOverride?: ReportType): Promise<ImportResult> => {
    setIsImporting(true);
    setImportProgress(0);
    setError(null);

    try {
      // Read file content
      setImportProgress(10);
      const text = await file.text();

      // Detect report type if not provided
      setImportProgress(20);
      const { headers } = parseCSV(text);
      const reportType = reportTypeOverride || detectReportType(headers);

      if (!reportType) {
        throw new Error('Could not detect report type from CSV headers. Please select the report type manually.');
      }

      // Import the data
      setImportProgress(30);
      const result = await importJobberCSV(text, file.name, businessUnit, reportType);

      setImportProgress(100);
      setLastResult(result);

      // Invalidate relevant queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['jobber-jobs'] });
      await queryClient.invalidateQueries({ queryKey: ['jobber-quotes'] });
      await queryClient.invalidateQueries({ queryKey: ['jobber-invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['jobber-import-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['jobber-import-logs'] });
      await queryClient.invalidateQueries({ queryKey: ['jobber-salesperson-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['jobber-client-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['jobber-monthly-trend'] });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(message);
      return {
        success: false,
        totalRows: 0,
        newRecords: 0,
        updatedRecords: 0,
        skippedRecords: 0,
        errors: [{ row: 0, field: '', message }],
        logId: '',
      };
    } finally {
      setIsImporting(false);
    }
  }, [businessUnit, queryClient]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    importCSV,
    isImporting,
    importProgress,
    lastResult,
    error,
    clearError,
  };
}

/**
 * Hook for getting import statistics
 * Note: Only works for 'builder' - residential uses separate import tracking
 */
export function useImportStats(businessUnit: BusinessUnit = 'builder') {
  return useQuery({
    queryKey: ['jobber-import-stats', businessUnit],
    queryFn: () => getImportStats(businessUnit),
    staleTime: 60 * 1000, // 1 minute
    // Only enable for builder - residential has different import flow
    enabled: businessUnit === 'builder',
  });
}

/**
 * Hook for getting actual data range in the database (not import logs)
 */
export function useActualDataRange(businessUnit: BusinessUnit = 'builder') {
  return useQuery({
    queryKey: ['jobber-actual-data-range', businessUnit],
    queryFn: async () => {
      const { supabase } = await import('../../../../lib/supabase');
      const tableName = businessUnit === 'builder' ? 'jobber_builder_jobs' : 'jobber_builder_jobs';

      // Get min/max created_date and closed_date
      const [createdRange, closedRange] = await Promise.all([
        supabase
          .from(tableName)
          .select('created_date')
          .not('created_date', 'is', null)
          .order('created_date', { ascending: true })
          .limit(1)
          .single(),
        supabase
          .from(tableName)
          .select('closed_date')
          .not('closed_date', 'is', null)
          .order('closed_date', { ascending: true })
          .limit(1)
          .single(),
      ]);

      const [createdMaxRange, closedMaxRange] = await Promise.all([
        supabase
          .from(tableName)
          .select('created_date')
          .not('created_date', 'is', null)
          .order('created_date', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from(tableName)
          .select('closed_date')
          .not('closed_date', 'is', null)
          .order('closed_date', { ascending: false })
          .limit(1)
          .single(),
      ]);

      return {
        createdDateMin: createdRange.data?.created_date || null,
        createdDateMax: createdMaxRange.data?.created_date || null,
        closedDateMin: closedRange.data?.closed_date || null,
        closedDateMax: closedMaxRange.data?.closed_date || null,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for getting import history
 * Note: Only works for 'builder' - residential has separate tracking
 */
export function useImportLogs(businessUnit?: BusinessUnit, limit: number = 10) {
  return useQuery({
    queryKey: ['jobber-import-logs', businessUnit, limit],
    queryFn: () => getImportLogs(businessUnit, limit),
    staleTime: 60 * 1000,
    // Only enable for builder or undefined - residential has different import flow
    enabled: !businessUnit || businessUnit === 'builder',
  });
}

/**
 * Hook for detecting report type from file
 */
export function useReportTypeDetection() {
  const [detectedType, setDetectedType] = useState<ReportType | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const detectFromFile = useCallback(async (file: File): Promise<ReportType | null> => {
    setIsDetecting(true);
    try {
      const text = await file.text();
      const { headers } = parseCSV(text);
      const type = detectReportType(headers);
      setDetectedType(type);
      return type;
    } catch {
      setDetectedType(null);
      return null;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  return {
    detectFromFile,
    detectedType,
    isDetecting,
  };
}
