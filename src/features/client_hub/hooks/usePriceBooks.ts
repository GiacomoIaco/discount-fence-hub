import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { PriceBook, PriceBookItem, ClientPriceBookAssignment } from '../types';

// ============================================
// PRICE BOOKS QUERIES
// ============================================

export function usePriceBooks(filters?: {
  search?: string;
  is_active?: boolean;
  tags?: string[];
}) {
  return useQuery({
    queryKey: ['price-books', filters],
    queryFn: async () => {
      let query = supabase
        .from('price_books')
        .select(`
          *,
          items_count:price_book_items(count),
          assignments:client_price_book_assignments(
            id,
            client_id,
            clients(id, name)
          )
        `)
        .order('name');

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
      }
      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      if (filters?.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform items_count from array to number and calculate featured count
      return data?.map(book => ({
        ...book,
        items_count: book.items_count?.[0]?.count || 0,
        assigned_clients_count: book.assignments?.length || 0,
        assigned_client_names: book.assignments?.map((a: any) => a.clients?.name).filter(Boolean),
      })) as (PriceBook & { items_count: number; assigned_clients_count: number; assigned_client_names: string[] })[];
    },
  });
}

export function usePriceBook(id: string | null) {
  return useQuery({
    queryKey: ['price-book', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('price_books')
        .select(`
          *,
          items:price_book_items(
            *,
            sku:sku_catalog(id, sku, description, unit, sell_price, category)
          ),
          assignments:client_price_book_assignments(
            *,
            client:clients(id, name, code),
            rate_sheet:rate_sheets(id, name, code)
          ),
          created_by_user:user_profiles!price_books_created_by_fkey(full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as PriceBook & {
        items: (PriceBookItem & { sku: any })[];
        assignments: (ClientPriceBookAssignment & { client: any; rate_sheet: any })[];
        created_by_user: { full_name: string } | null;
      };
    },
    enabled: !!id,
  });
}

// ============================================
// PRICE BOOKS MUTATIONS
// ============================================

export function useCreatePriceBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<PriceBook>) => {
      const { data: user } = await supabase.auth.getUser();

      const { data: result, error } = await supabase
        .from('price_books')
        .insert({
          ...data,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
    },
  });
}

export function useUpdatePriceBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<PriceBook> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('price_books')
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
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
      queryClient.invalidateQueries({ queryKey: ['price-book', variables.id] });
    },
  });
}

export function useDeletePriceBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('price_books')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
    },
  });
}

// ============================================
// PRICE BOOK ITEMS MUTATIONS
// ============================================

export function useAddPriceBookItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { price_book_id: string; sku_id: string; is_featured?: boolean; sort_order?: number }) => {
      const { data: result, error } = await supabase
        .from('price_book_items')
        .insert(data)
        .select(`
          *,
          sku:sku_catalog(id, sku, description, unit, sell_price, category)
        `)
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-book', variables.price_book_id] });
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
    },
  });
}

export function useUpdatePriceBookItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, price_book_id, ...data }: { id: string; price_book_id: string } & Partial<PriceBookItem>) => {
      const { data: result, error } = await supabase
        .from('price_book_items')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-book', variables.price_book_id] });
    },
  });
}

export function useRemovePriceBookItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, price_book_id }: { id: string; price_book_id: string }) => {
      const { error } = await supabase
        .from('price_book_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-book', variables.price_book_id] });
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
    },
  });
}

export function useBulkAddPriceBookItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ price_book_id, sku_ids, is_featured = false }: {
      price_book_id: string;
      sku_ids: string[];
      is_featured?: boolean
    }) => {
      // Get existing items to avoid duplicates
      const { data: existing } = await supabase
        .from('price_book_items')
        .select('sku_id')
        .eq('price_book_id', price_book_id);

      const existingSkuIds = new Set(existing?.map(e => e.sku_id) || []);
      const newSkuIds = sku_ids.filter(id => !existingSkuIds.has(id));

      if (newSkuIds.length === 0) {
        return { added: 0, skipped: sku_ids.length };
      }

      const items = newSkuIds.map((sku_id, index) => ({
        price_book_id,
        sku_id,
        is_featured,
        sort_order: index,
      }));

      const { error } = await supabase
        .from('price_book_items')
        .insert(items);

      if (error) throw error;
      return { added: newSkuIds.length, skipped: sku_ids.length - newSkuIds.length };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-book', variables.price_book_id] });
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
    },
  });
}

// ============================================
// CLIENT PRICE BOOK ASSIGNMENTS
// ============================================

export function useClientPriceBookAssignments(clientId: string | null) {
  return useQuery({
    queryKey: ['client-price-book-assignments', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('client_price_book_assignments')
        .select(`
          *,
          price_book:price_books(id, name, code, tags, is_active),
          rate_sheet:rate_sheets(id, name, code, pricing_type)
        `)
        .eq('client_id', clientId)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data as (ClientPriceBookAssignment & { price_book: any; rate_sheet: any })[];
    },
    enabled: !!clientId,
  });
}

export function useCreateClientPriceBookAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      client_id: string;
      price_book_id: string;
      rate_sheet_id?: string | null;
      is_default?: boolean;
      effective_date?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();

      const { data: result, error } = await supabase
        .from('client_price_book_assignments')
        .insert({
          ...data,
          created_by: user.user?.id,
        })
        .select(`
          *,
          price_book:price_books(id, name, code),
          rate_sheet:rate_sheets(id, name, code)
        `)
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-price-book-assignments', variables.client_id] });
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
      queryClient.invalidateQueries({ queryKey: ['client', variables.client_id] });
    },
  });
}

export function useUpdateClientPriceBookAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, client_id, ...data }: {
      id: string;
      client_id: string;
      rate_sheet_id?: string | null;
      is_default?: boolean;
      effective_date?: string;
      expires_at?: string | null;
    }) => {
      const { data: result, error } = await supabase
        .from('client_price_book_assignments')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-price-book-assignments', variables.client_id] });
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
    },
  });
}

export function useDeleteClientPriceBookAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, client_id }: { id: string; client_id: string }) => {
      const { error } = await supabase
        .from('client_price_book_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-price-book-assignments', variables.client_id] });
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
    },
  });
}

// ============================================
// SKU CATALOG QUERY (for adding items)
// ============================================

export function useSkuCatalogForPriceBook(filters?: {
  search?: string;
  category?: string;
  product_type_id?: string;
  height?: number;
  excludeSkuIds?: string[];
}) {
  return useQuery({
    queryKey: ['sku-catalog-for-price-book', filters],
    queryFn: async () => {
      let query = supabase
        .from('sku_catalog')
        .select('id, sku, description, unit, sell_price, category, product_type_id, height')
        .eq('is_active', true)
        .order('sku')
        .limit(200);

      if (filters?.search) {
        query = query.or(`sku.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.product_type_id) {
        query = query.eq('product_type_id', filters.product_type_id);
      }
      if (filters?.height) {
        query = query.eq('height', filters.height);
      }
      if (filters?.excludeSkuIds && filters.excludeSkuIds.length > 0) {
        // Supabase doesn't support NOT IN directly, but we can filter client-side
        // or use a workaround. For now, we'll filter client-side.
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter out excluded SKUs client-side
      if (filters?.excludeSkuIds && filters.excludeSkuIds.length > 0) {
        const excludeSet = new Set(filters.excludeSkuIds);
        return data?.filter(sku => !excludeSet.has(sku.id)) || [];
      }

      return data || [];
    },
  });
}

// ============================================
// GET UNIQUE TAGS FROM ALL PRICE BOOKS
// ============================================

export function usePriceBookTags() {
  return useQuery({
    queryKey: ['price-book-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_books')
        .select('tags');

      if (error) throw error;

      // Flatten and deduplicate tags
      const allTags = data?.flatMap(pb => pb.tags || []) || [];
      return [...new Set(allTags)].sort();
    },
  });
}

// ============================================
// PRICE RESOLUTION (Phase 5: Quote Integration)
// ============================================

export interface PriceResolutionContext {
  clientId: string | null;
  communityId: string | null;
  qboClassId: string | null;
}

export interface ResolvedPrice {
  unitPrice: number;
  materialPrice: number | null;
  laborPrice: number | null;
  pricingSource: string;
  pricingMethod: string;
  rateSheetId: string | null;
  rateSheetName: string | null;
}

/**
 * Get available SKU IDs for a client/community context.
 * Resolution cascade:
 * 1. If community has community_products entries -> intersect with client's Price Book
 * 2. Else use client's Price Book SKUs
 * 3. If no client Price Book -> full catalog access (return null to indicate "all")
 */
export function useAvailableSkuIds(context: PriceResolutionContext) {
  const { clientId, communityId } = context;

  return useQuery({
    queryKey: ['available-sku-ids', clientId, communityId],
    queryFn: async () => {
      // Get client's price book assignments
      let priceBookSkuIds: Set<string> | null = null;

      if (clientId) {
        const { data: assignments } = await supabase
          .from('client_price_book_assignments')
          .select(`
            price_book_id,
            price_book:price_books!inner(
              items:price_book_items(sku_id)
            )
          `)
          .eq('client_id', clientId);

        if (assignments && assignments.length > 0) {
          priceBookSkuIds = new Set<string>();
          assignments.forEach((a: any) => {
            a.price_book?.items?.forEach((item: { sku_id: string }) => {
              priceBookSkuIds!.add(item.sku_id);
            });
          });
        }
      }

      // Get community product restrictions if community is specified
      let communitySkuIds: Set<string> | null = null;

      if (communityId) {
        const { data: communityProducts } = await supabase
          .from('community_products')
          .select('sku_id')
          .eq('community_id', communityId);

        if (communityProducts && communityProducts.length > 0) {
          communitySkuIds = new Set(communityProducts.map(cp => cp.sku_id));
        }
      }

      // Resolution logic:
      // - If community has restrictions, intersect with price book (or use community alone if no PB)
      // - If no community restrictions, use price book SKUs
      // - If neither, return null (full catalog access)

      if (communitySkuIds && priceBookSkuIds) {
        // Intersect community products with price book
        return Array.from(communitySkuIds).filter(id => priceBookSkuIds!.has(id));
      } else if (communitySkuIds) {
        // Community-only restriction
        return Array.from(communitySkuIds);
      } else if (priceBookSkuIds) {
        // Price book-only restriction
        return Array.from(priceBookSkuIds);
      }

      // No restrictions - full catalog access
      return null;
    },
    enabled: !!clientId || !!communityId,
  });
}

/**
 * Resolve price for a specific SKU in a given context.
 * Resolution cascade:
 * 1. community_products.price_override (highest priority)
 * 2. community.rate_sheet_override_id
 * 3. client_price_book_assignments.rate_sheet_id
 * 4. qbo_classes.default_rate_sheet_id (BU default)
 * 5. SKU catalog sell_price (fallback)
 */
export function useResolvedPrice(
  skuId: string | null,
  context: PriceResolutionContext
): { data: ResolvedPrice | null; isLoading: boolean } {
  const { clientId, communityId, qboClassId } = context;

  const { data, isLoading } = useQuery({
    queryKey: ['resolved-price', skuId, clientId, communityId, qboClassId],
    queryFn: async (): Promise<ResolvedPrice | null> => {
      if (!skuId) return null;

      // Get SKU base info
      const { data: skuData } = await supabase
        .from('sku_catalog')
        .select('id, sell_price, unit')
        .eq('id', skuId)
        .single();

      if (!skuData) return null;

      // 1. Check community price override
      if (communityId) {
        const { data: communityProduct } = await supabase
          .from('community_products')
          .select('price_override, price_override_reason')
          .eq('community_id', communityId)
          .eq('sku_id', skuId)
          .maybeSingle();

        if (communityProduct?.price_override) {
          return {
            unitPrice: communityProduct.price_override,
            materialPrice: null,
            laborPrice: null,
            pricingSource: `Community Override${communityProduct.price_override_reason ? `: ${communityProduct.price_override_reason}` : ''}`,
            pricingMethod: 'fixed',
            rateSheetId: null,
            rateSheetName: null,
          };
        }
      }

      // 2. Check community rate sheet override
      if (communityId) {
        const { data: community } = await supabase
          .from('communities')
          .select(`
            rate_sheet_override_id,
            rate_sheet_override:rate_sheets(id, name, pricing_type)
          `)
          .eq('id', communityId)
          .maybeSingle();

        if (community?.rate_sheet_override_id) {
          const price = await resolveFromRateSheet(skuId, community.rate_sheet_override_id, skuData.sell_price);
          if (price) {
            const rateSheet = community.rate_sheet_override as { id: string; name: string } | null;
            return {
              ...price,
              pricingSource: `Community Rate Sheet: ${rateSheet?.name || 'Unknown'}`,
              rateSheetId: community.rate_sheet_override_id,
              rateSheetName: rateSheet?.name || null,
            };
          }
        }
      }

      // 3. Check client price book assignment rate sheet
      if (clientId) {
        const { data: assignments } = await supabase
          .from('client_price_book_assignments')
          .select(`
            rate_sheet_id,
            rate_sheet:rate_sheets(id, name, pricing_type),
            price_book:price_books!inner(
              items:price_book_items(sku_id)
            )
          `)
          .eq('client_id', clientId)
          .not('rate_sheet_id', 'is', null);

        // Find assignment that contains this SKU
        const relevantAssignment = assignments?.find((a: any) =>
          a.price_book?.items?.some((item: { sku_id: string }) => item.sku_id === skuId)
        );

        if (relevantAssignment?.rate_sheet_id) {
          const price = await resolveFromRateSheet(skuId, relevantAssignment.rate_sheet_id, skuData.sell_price);
          if (price) {
            const rateSheet = relevantAssignment.rate_sheet as { id: string; name: string } | null;
            return {
              ...price,
              pricingSource: `Client Rate Sheet: ${rateSheet?.name || 'Unknown'}`,
              rateSheetId: relevantAssignment.rate_sheet_id,
              rateSheetName: rateSheet?.name || null,
            };
          }
        }
      }

      // 4. Check BU default rate sheet
      if (qboClassId) {
        const { data: qboClass } = await supabase
          .from('qbo_classes')
          .select(`
            default_rate_sheet_id,
            default_rate_sheet:rate_sheets(id, name, pricing_type)
          `)
          .eq('id', qboClassId)
          .maybeSingle();

        if (qboClass?.default_rate_sheet_id) {
          const price = await resolveFromRateSheet(skuId, qboClass.default_rate_sheet_id, skuData.sell_price);
          if (price) {
            const rateSheet = qboClass.default_rate_sheet as { id: string; name: string } | null;
            return {
              ...price,
              pricingSource: `BU Default: ${rateSheet?.name || 'Unknown'}`,
              rateSheetId: qboClass.default_rate_sheet_id,
              rateSheetName: rateSheet?.name || null,
            };
          }
        }
      }

      // 5. Fallback to SKU catalog price
      return {
        unitPrice: skuData.sell_price || 0,
        materialPrice: null,
        laborPrice: null,
        pricingSource: 'Catalog Default',
        pricingMethod: 'catalog',
        rateSheetId: null,
        rateSheetName: null,
      };
    },
    enabled: !!skuId,
  });

  return { data: data ?? null, isLoading };
}

/**
 * Helper to resolve price from a rate sheet
 */
async function resolveFromRateSheet(
  skuId: string,
  rateSheetId: string,
  catalogPrice: number
): Promise<Omit<ResolvedPrice, 'pricingSource' | 'rateSheetId' | 'rateSheetName'> | null> {
  // Check if rate sheet has a specific item for this SKU
  const { data: rateSheetItem } = await supabase
    .from('rate_sheet_items')
    .select('*')
    .eq('rate_sheet_id', rateSheetId)
    .eq('sku_id', skuId)
    .maybeSingle();

  if (rateSheetItem) {
    // Use the rate sheet item's pricing
    switch (rateSheetItem.pricing_method) {
      case 'fixed':
        return {
          unitPrice: rateSheetItem.fixed_price || 0,
          materialPrice: rateSheetItem.fixed_material_price || null,
          laborPrice: rateSheetItem.fixed_labor_price || null,
          pricingMethod: 'fixed',
        };

      case 'markup':
        // Calculate from cost (would need SKU cost data)
        // For now, use catalog price as base
        const materialMarkup = (rateSheetItem.material_markup_percent || 0) / 100;
        const laborMarkup = (rateSheetItem.labor_markup_percent || 0) / 100;
        // Simplified: apply average markup to catalog price
        const avgMarkup = (materialMarkup + laborMarkup) / 2;
        return {
          unitPrice: catalogPrice * (1 + avgMarkup),
          materialPrice: null,
          laborPrice: null,
          pricingMethod: 'markup',
        };

      case 'margin':
        const margin = (rateSheetItem.margin_target_percent || 33) / 100;
        return {
          unitPrice: catalogPrice / (1 - margin),
          materialPrice: null,
          laborPrice: null,
          pricingMethod: 'margin',
        };

      case 'cost_plus':
        return {
          unitPrice: catalogPrice + (rateSheetItem.cost_plus_amount || 0),
          materialPrice: null,
          laborPrice: null,
          pricingMethod: 'cost_plus',
        };
    }
  }

  // No specific item - use rate sheet defaults
  const { data: rateSheet } = await supabase
    .from('rate_sheets')
    .select('pricing_type, default_labor_markup, default_material_markup, default_margin_target')
    .eq('id', rateSheetId)
    .maybeSingle();

  if (rateSheet) {
    if (rateSheet.pricing_type === 'formula') {
      // Apply default markup/margin
      if (rateSheet.default_margin_target) {
        const margin = rateSheet.default_margin_target / 100;
        return {
          unitPrice: catalogPrice / (1 - margin),
          materialPrice: null,
          laborPrice: null,
          pricingMethod: 'margin',
        };
      } else {
        const avgMarkup = ((rateSheet.default_labor_markup || 0) + (rateSheet.default_material_markup || 0)) / 200;
        return {
          unitPrice: catalogPrice * (1 + avgMarkup),
          materialPrice: null,
          laborPrice: null,
          pricingMethod: 'markup',
        };
      }
    }
  }

  return null;
}
