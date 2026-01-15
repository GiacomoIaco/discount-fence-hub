// Hook for handling Residential data import
// Wraps the import service with React Query mutation

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { importResidentialData } from '../../../services/jobber/residentialImportService';
import type { ImportProgress, ResidentialImportResult } from '../../../types/residential';

export function useResidentialImport() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      quotesFile,
      jobsFile,
      requestsFile,
    }: {
      quotesFile: File;
      jobsFile: File | null;
      requestsFile: File | null;
    }) => {
      return importResidentialData(quotesFile, jobsFile, requestsFile, setProgress);
    },
    onSuccess: () => {
      // Invalidate all residential queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['jobber-residential-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['jobber-residential-funnel-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['jobber-residential-salesperson-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['jobber-residential-bucket-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['jobber-residential-speed-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['jobber-residential-speed-size-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['jobber-residential-quote-count-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['jobber-residential-monthly-totals'] });
      queryClient.invalidateQueries({ queryKey: ['jobber-residential-salesperson-monthly'] });
      queryClient.invalidateQueries({ queryKey: ['jobber-residential-salespersons'] });
      queryClient.invalidateQueries({ queryKey: ['jobber-residential-opportunity-count'] });
    },
  });

  const reset = useCallback(() => {
    setProgress(null);
    mutation.reset();
  }, [mutation]);

  return {
    importData: mutation.mutate,
    importAsync: mutation.mutateAsync,
    isImporting: mutation.isPending,
    progress,
    result: mutation.data as ResidentialImportResult | undefined,
    error: mutation.error,
    reset,
  };
}
