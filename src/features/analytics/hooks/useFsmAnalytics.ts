import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

// ============================================
// TYPES
// ============================================

export interface MarketingFunnelData {
  source: string;
  total_leads: number;
  converted_to_project: number;
  won: number;
  lead_to_project_pct: number | null;
  project_to_won_pct: number | null;
}

export interface QuoteTimelinessData {
  rep_id: string;
  rep_name: string;
  total_assessments: number;
  avg_hours_to_quote: number | null;
  same_day_pct: number | null;
  over_48hrs_pct: number | null;
}

export interface ChangeOrdersByRepData {
  rep_id: string;
  rep_name: string;
  total_projects: number;
  original_quotes: number;
  change_orders: number;
  original_value: number;
  change_order_value: number;
  change_order_rate_pct: number | null;
  change_order_value_pct: number | null;
}

export interface WarrantyByCrewData {
  crew_id: string;
  crew_name: string;
  total_jobs_completed: number;
  warranty_callbacks: number;
  warranty_pct: number | null;
  warranty_cost: number;
}

export interface ReworkByCrewData {
  crew_id: string;
  crew_name: string;
  rework_issues: number;
  total_rework_cost: number;
}

export interface PenalizationSummaryData {
  penalization_type: string;
  crew_id: string | null;
  crew_name: string | null;
  rep_id: string | null;
  rep_name: string | null;
  issue_count: number;
  total_amount: number;
  avg_percent_reduction: number | null;
  month: string;
}

// ============================================
// HOOKS
// ============================================

/**
 * Marketing Funnel - Lead conversion rates by source
 */
export function useMarketingFunnel() {
  return useQuery({
    queryKey: ['fsm-analytics', 'marketing-funnel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_marketing_funnel')
        .select('*')
        .order('total_leads', { ascending: false });

      if (error) throw error;
      return data as MarketingFunnelData[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Quote Timeliness - Rep accountability for same-day quotes
 */
export function useQuoteTimeliness() {
  return useQuery({
    queryKey: ['fsm-analytics', 'quote-timeliness'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_quote_timeliness')
        .select('*')
        .order('same_day_pct', { ascending: false });

      if (error) throw error;
      return data as QuoteTimelinessData[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Change Orders by Rep - KEY ACCOUNTABILITY METRIC
 */
export function useChangeOrdersByRep() {
  return useQuery({
    queryKey: ['fsm-analytics', 'change-orders-by-rep'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_change_orders_by_rep')
        .select('*')
        .order('change_order_rate_pct', { ascending: false });

      if (error) throw error;
      return data as ChangeOrdersByRepData[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Warranty by Crew - Callback rates
 */
export function useWarrantyByCrew() {
  return useQuery({
    queryKey: ['fsm-analytics', 'warranty-by-crew'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_warranty_by_crew')
        .select('*')
        .order('warranty_pct', { ascending: false });

      if (error) throw error;
      return data as WarrantyByCrewData[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Rework by Crew - Quality issues
 */
export function useReworkByCrew() {
  return useQuery({
    queryKey: ['fsm-analytics', 'rework-by-crew'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_rework_by_crew')
        .select('*')
        .order('rework_issues', { ascending: false });

      if (error) throw error;
      return data as ReworkByCrewData[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Penalization Summary - Backcharges and commission reductions
 */
export function usePenalizationSummary() {
  return useQuery({
    queryKey: ['fsm-analytics', 'penalization-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_penalization_summary')
        .select('*')
        .order('month', { ascending: false });

      if (error) throw error;
      return data as PenalizationSummaryData[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Combined hook for all FSM analytics
 */
export function useFsmAnalytics() {
  const marketingFunnel = useMarketingFunnel();
  const quoteTimeliness = useQuoteTimeliness();
  const changeOrdersByRep = useChangeOrdersByRep();
  const warrantyByCrew = useWarrantyByCrew();
  const reworkByCrew = useReworkByCrew();
  const penalizationSummary = usePenalizationSummary();

  const isLoading =
    marketingFunnel.isLoading ||
    quoteTimeliness.isLoading ||
    changeOrdersByRep.isLoading ||
    warrantyByCrew.isLoading ||
    reworkByCrew.isLoading ||
    penalizationSummary.isLoading;

  const error =
    marketingFunnel.error ||
    quoteTimeliness.error ||
    changeOrdersByRep.error ||
    warrantyByCrew.error ||
    reworkByCrew.error ||
    penalizationSummary.error;

  return {
    marketingFunnel: marketingFunnel.data || [],
    quoteTimeliness: quoteTimeliness.data || [],
    changeOrdersByRep: changeOrdersByRep.data || [],
    warrantyByCrew: warrantyByCrew.data || [],
    reworkByCrew: reworkByCrew.data || [],
    penalizationSummary: penalizationSummary.data || [],
    isLoading,
    error,
  };
}
