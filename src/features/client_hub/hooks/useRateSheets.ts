import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { RateSheet, RateSheetItem } from '../types';

// ============================================
// RATE SHEETS QUERIES
// ============================================

export function useRateSheets(filters?: {
  search?: string;
  is_active?: boolean;
  is_template?: boolean;
  pricing_type?: string;
}) {
  return useQuery({
    queryKey: ['rate-sheets', filters],
    queryFn: async () => {
      let query = supabase
        .from('rate_sheets')
        .select(`
          *,
          items_count:rate_sheet_items(count),
          assignments:rate_sheet_assignments(
            id,
            client_id,
            community_id,
            is_default,
            clients(id, name),
            communities(id, name)
          )
        `)
        .order('name');

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
      }
      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      if (filters?.is_template !== undefined) {
        query = query.eq('is_template', filters.is_template);
      }
      if (filters?.pricing_type) {
        query = query.eq('pricing_type', filters.pricing_type);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform items_count from array to number
      return data?.map(sheet => ({
        ...sheet,
        items_count: sheet.items_count?.[0]?.count || 0,
      })) as (RateSheet & { items_count: number; assignments: any[] })[];
    },
  });
}

export function useRateSheet(id: string | null) {
  return useQuery({
    queryKey: ['rate-sheet', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('rate_sheets')
        .select(`
          *,
          items:rate_sheet_items(
            *,
            sku:sku_catalog(id, sku, description, unit, sell_price)
          ),
          assignments:rate_sheet_assignments(
            *,
            client:clients(id, name, code),
            community:communities(id, name)
          ),
          created_by_user:user_profiles!rate_sheets_created_by_fkey(full_name),
          updated_by_user:user_profiles!rate_sheets_updated_by_fkey(full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as RateSheet & {
        items: (RateSheetItem & { sku: any })[];
        assignments: any[];
        created_by_user: { full_name: string } | null;
        updated_by_user: { full_name: string } | null;
      };
    },
    enabled: !!id,
  });
}

// ============================================
// RATE SHEETS MUTATIONS
// ============================================

export function useCreateRateSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<RateSheet>) => {
      const { data: user } = await supabase.auth.getUser();

      const { data: result, error } = await supabase
        .from('rate_sheets')
        .insert({
          ...data,
          created_by: user.user?.id,
          updated_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-sheets'] });
    },
  });
}

export function useUpdateRateSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<RateSheet> & { id: string }) => {
      const { data: user } = await supabase.auth.getUser();

      const { data: result, error } = await supabase
        .from('rate_sheets')
        .update({
          ...data,
          updated_by: user.user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rate-sheets'] });
      queryClient.invalidateQueries({ queryKey: ['rate-sheet', variables.id] });
    },
  });
}

export function useDeleteRateSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rate_sheets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-sheets'] });
    },
  });
}

// ============================================
// RATE SHEET ITEMS MUTATIONS
// ============================================

export function useCreateRateSheetItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<RateSheetItem>) => {
      const { data: result, error } = await supabase
        .from('rate_sheet_items')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rate-sheet', variables.rate_sheet_id] });
      queryClient.invalidateQueries({ queryKey: ['rate-sheets'] });
    },
  });
}

export function useUpdateRateSheetItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, rate_sheet_id, ...data }: Partial<RateSheetItem> & { id: string; rate_sheet_id: string }) => {
      const { data: result, error } = await supabase
        .from('rate_sheet_items')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rate-sheet', variables.rate_sheet_id] });
    },
  });
}

export function useDeleteRateSheetItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, rate_sheet_id: _rate_sheet_id }: { id: string; rate_sheet_id: string }) => {
      const { error } = await supabase
        .from('rate_sheet_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rate-sheet', variables.rate_sheet_id] });
      queryClient.invalidateQueries({ queryKey: ['rate-sheets'] });
    },
  });
}

export function useBulkUpsertRateSheetItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rate_sheet_id, items }: { rate_sheet_id: string; items: Partial<RateSheetItem>[] }) => {
      // First, get existing items
      const { data: existing } = await supabase
        .from('rate_sheet_items')
        .select('id, sku_id')
        .eq('rate_sheet_id', rate_sheet_id);

      const existingMap = new Map(existing?.map(e => [e.sku_id, e.id]) || []);

      const toInsert: Partial<RateSheetItem>[] = [];
      const toUpdate: { id: string; data: Partial<RateSheetItem> }[] = [];

      for (const item of items) {
        const existingId = existingMap.get(item.sku_id!);
        if (existingId) {
          toUpdate.push({ id: existingId, data: item });
        } else {
          toInsert.push({ ...item, rate_sheet_id });
        }
      }

      // Insert new items
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('rate_sheet_items')
          .insert(toInsert);
        if (insertError) throw insertError;
      }

      // Update existing items
      for (const { id, data } of toUpdate) {
        const { error: updateError } = await supabase
          .from('rate_sheet_items')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (updateError) throw updateError;
      }

      return { inserted: toInsert.length, updated: toUpdate.length };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rate-sheet', variables.rate_sheet_id] });
      queryClient.invalidateQueries({ queryKey: ['rate-sheets'] });
    },
  });
}

// ============================================
// RATE SHEET ASSIGNMENTS
// ============================================

export function useCreateRateSheetAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      rate_sheet_id: string;
      client_id?: string;
      community_id?: string;
      is_default?: boolean;
      priority?: number;
    }) => {
      const { data: user } = await supabase.auth.getUser();

      const { data: result, error } = await supabase
        .from('rate_sheet_assignments')
        .insert({
          ...data,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rate-sheet', variables.rate_sheet_id] });
      queryClient.invalidateQueries({ queryKey: ['rate-sheets'] });
      if (variables.client_id) {
        queryClient.invalidateQueries({ queryKey: ['client', variables.client_id] });
      }
      if (variables.community_id) {
        queryClient.invalidateQueries({ queryKey: ['community', variables.community_id] });
      }
    },
  });
}

export function useDeleteRateSheetAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, rate_sheet_id: _rate_sheet_id }: { id: string; rate_sheet_id: string }) => {
      const { error } = await supabase
        .from('rate_sheet_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rate-sheet', variables.rate_sheet_id] });
      queryClient.invalidateQueries({ queryKey: ['rate-sheets'] });
    },
  });
}

// ============================================
// SKU CATALOG QUERY (for adding items)
// ============================================

export function useSkuCatalog(search?: string) {
  return useQuery({
    queryKey: ['sku-catalog', search],
    queryFn: async () => {
      let query = supabase
        .from('sku_catalog')
        .select('id, sku, description, unit, sell_price, category')
        .eq('is_active', true)
        .order('sku')
        .limit(100);

      if (search) {
        query = query.or(`sku.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
