// Hook for fetching Jobber builder invoices data

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import type { JobberBuilderInvoice, JobberFilters } from '../../types/jobber';

interface UseJobberInvoicesOptions {
  filters?: JobberFilters;
  enabled?: boolean;
}

/**
 * Fetch builder invoices with optional filters
 */
export function useJobberInvoices({ filters, enabled = true }: UseJobberInvoicesOptions = {}) {
  return useQuery({
    queryKey: ['jobber-invoices', filters],
    queryFn: async () => {
      let query = supabase
        .from('jobber_builder_invoices')
        .select('*')
        .order('created_date', { ascending: false });

      // Apply date filters
      if (filters?.dateRange.start) {
        query = query.gte('created_date', filters.dateRange.start.toISOString().split('T')[0]);
      }
      if (filters?.dateRange.end) {
        query = query.lte('created_date', filters.dateRange.end.toISOString().split('T')[0]);
      }

      // Apply salesperson filter
      if (filters?.salesperson) {
        query = query.eq('effective_salesperson', filters.salesperson);
      }

      // Apply location filter
      if (filters?.location) {
        query = query.eq('franchise_location', filters.location);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch invoices: ${error.message}`);
      }

      return data as JobberBuilderInvoice[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get invoice payment metrics
 */
export function useInvoicePaymentMetrics(filters?: JobberFilters) {
  return useQuery({
    queryKey: ['jobber-invoice-payment', filters],
    queryFn: async () => {
      const { data: invoices, error } = await supabase
        .from('jobber_builder_invoices')
        .select('status, total, balance, is_paid, days_to_paid');

      if (error) {
        throw new Error(`Failed to fetch invoice payment data: ${error.message}`);
      }

      const total = invoices?.length || 0;
      const paid = invoices?.filter(i => i.is_paid).length || 0;
      const totalInvoiced = invoices?.reduce((sum, i) => sum + (Number(i.total) || 0), 0) || 0;
      const outstandingBalance = invoices?.reduce((sum, i) => sum + (Number(i.balance) || 0), 0) || 0;

      // Calculate average days to paid
      const paidWithDays = invoices?.filter(i => i.days_to_paid !== null && i.days_to_paid >= 0) || [];
      const avgDaysToPaid = paidWithDays.length > 0
        ? paidWithDays.reduce((sum, i) => sum + (i.days_to_paid || 0), 0) / paidWithDays.length
        : 0;

      return {
        totalInvoices: total,
        paidInvoices: paid,
        paidRate: total > 0 ? (paid / total) * 100 : 0,
        totalInvoiced,
        outstandingBalance,
        avgDaysToPaid,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get overdue invoices
 */
export function useOverdueInvoices(filters?: JobberFilters) {
  return useQuery({
    queryKey: ['jobber-overdue-invoices', filters],
    queryFn: async () => {
      let query = supabase
        .from('jobber_builder_invoices')
        .select('*')
        .eq('is_overdue', true)
        .order('due_date', { ascending: true });

      if (filters?.salesperson) {
        query = query.eq('effective_salesperson', filters.salesperson);
      }
      if (filters?.location) {
        query = query.eq('franchise_location', filters.location);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch overdue invoices: ${error.message}`);
      }

      return data as JobberBuilderInvoice[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
