import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { RateSheet, RateSheetItem, PricingMethod } from '../types';

/**
 * Pricing Resolution Hook
 *
 * Resolves prices for SKUs based on the rate sheet hierarchy:
 * 1. Community's rate_sheet_id (if set) → overrides client
 * 2. Client's default_rate_sheet_id (if set) → fallback
 * 3. Catalog price → final fallback
 */

export interface ResolvedPrice {
  price: number;
  laborPrice: number | null;
  materialPrice: number | null;
  pricingMethod: PricingMethod | 'catalog' | 'default_formula' | 'cost_only';
  rateSheetId: string | null;
  rateSheetName: string | null;
  /** Where the rate sheet came from: community, client, bu, or null if no rate sheet */
  source: 'community' | 'client' | 'bu' | null;
}

export interface PricingContext {
  communityId?: string | null;
  clientId?: string | null;
  /** QBO Class ID for BU default rate sheet fallback */
  qboClassId?: string | null;
}

// Get the effective rate sheet for a given context
async function getEffectiveRateSheet(context: PricingContext): Promise<{
  rateSheetId: string | null;
  rateSheet: RateSheet | null;
  source: 'community' | 'client' | 'bu' | null;
}> {
  // First try community rate sheet
  if (context.communityId) {
    const { data: community } = await supabase
      .from('communities')
      .select('rate_sheet_id, client_id')
      .eq('id', context.communityId)
      .single();

    if (community?.rate_sheet_id) {
      const { data: rateSheet } = await supabase
        .from('rate_sheets')
        .select('*')
        .eq('id', community.rate_sheet_id)
        .eq('is_active', true)
        .single();

      if (rateSheet) {
        return { rateSheetId: community.rate_sheet_id, rateSheet, source: 'community' as const };
      }
    }

    // Fall back to client's rate sheet
    if (community?.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('default_rate_sheet_id')
        .eq('id', community.client_id)
        .single();

      if (client?.default_rate_sheet_id) {
        const { data: rateSheet } = await supabase
          .from('rate_sheets')
          .select('*')
          .eq('id', client.default_rate_sheet_id)
          .eq('is_active', true)
          .single();

        if (rateSheet) {
          return { rateSheetId: client.default_rate_sheet_id, rateSheet, source: 'client' as const };
        }
      }
    }
  }

  // Try client directly if provided
  if (context.clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('default_rate_sheet_id')
      .eq('id', context.clientId)
      .single();

    if (client?.default_rate_sheet_id) {
      const { data: rateSheet } = await supabase
        .from('rate_sheets')
        .select('*')
        .eq('id', client.default_rate_sheet_id)
        .eq('is_active', true)
        .single();

      if (rateSheet) {
        return { rateSheetId: client.default_rate_sheet_id, rateSheet, source: 'client' as const };
      }
    }
  }

  // Priority 3: QBO Class (BU) default rate sheet
  if (context.qboClassId) {
    const { data: qboClass } = await supabase
      .from('qbo_classes')
      .select('default_rate_sheet_id')
      .eq('id', context.qboClassId)
      .single();

    if (qboClass?.default_rate_sheet_id) {
      const { data: rateSheet } = await supabase
        .from('rate_sheets')
        .select('*')
        .eq('id', qboClass.default_rate_sheet_id)
        .eq('is_active', true)
        .single();

      if (rateSheet) {
        return { rateSheetId: qboClass.default_rate_sheet_id, rateSheet, source: 'bu' as const };
      }
    }
  }

  return { rateSheetId: null, rateSheet: null, source: null };
}

// Calculate price based on pricing method
function calculatePrice(
  baseCost: number,
  item: RateSheetItem | null,
  rateSheet: RateSheet | null,
  source: 'community' | 'client' | 'bu' | null = null
): ResolvedPrice {
  // If we have a specific item override
  if (item) {
    if (item.pricing_method === 'fixed' && item.fixed_price !== null) {
      return {
        price: item.fixed_price,
        laborPrice: item.fixed_labor_price,
        materialPrice: item.fixed_material_price,
        pricingMethod: 'fixed',
        rateSheetId: item.rate_sheet_id,
        rateSheetName: null, // Will be filled by caller
        source,
      };
    }

    if (item.pricing_method === 'markup' && item.material_markup_percent !== null) {
      const price = baseCost * (1 + item.material_markup_percent / 100);
      return {
        price,
        laborPrice: null,
        materialPrice: null,
        pricingMethod: 'markup',
        rateSheetId: item.rate_sheet_id,
        rateSheetName: null,
        source,
      };
    }

    if (item.pricing_method === 'margin' && item.margin_target_percent !== null) {
      // Price = Cost / (1 - Margin%)
      const price = baseCost / (1 - item.margin_target_percent / 100);
      return {
        price,
        laborPrice: null,
        materialPrice: null,
        pricingMethod: 'margin',
        rateSheetId: item.rate_sheet_id,
        rateSheetName: null,
        source,
      };
    }

    // Fall through to fixed price if available
    if (item.fixed_price !== null) {
      return {
        price: item.fixed_price,
        laborPrice: item.fixed_labor_price,
        materialPrice: item.fixed_material_price,
        pricingMethod: 'fixed',
        rateSheetId: item.rate_sheet_id,
        rateSheetName: null,
        source,
      };
    }
  }

  // No item - check for default formula from rate sheet
  if (rateSheet && (rateSheet.pricing_type === 'formula' || rateSheet.pricing_type === 'hybrid')) {
    if (rateSheet.default_margin_target !== null) {
      const price = baseCost / (1 - rateSheet.default_margin_target / 100);
      return {
        price,
        laborPrice: null,
        materialPrice: null,
        pricingMethod: 'default_formula',
        rateSheetId: rateSheet.id,
        rateSheetName: rateSheet.name,
        source,
      };
    }

    if (rateSheet.default_material_markup !== null && rateSheet.default_material_markup > 0) {
      const price = baseCost * (1 + rateSheet.default_material_markup / 100);
      return {
        price,
        laborPrice: null,
        materialPrice: null,
        pricingMethod: 'default_formula',
        rateSheetId: rateSheet.id,
        rateSheetName: rateSheet.name,
        source,
      };
    }
  }

  // Final fallback - use cost as price (no rate sheet found)
  return {
    price: baseCost,
    laborPrice: null,
    materialPrice: null,
    pricingMethod: 'cost_only',
    rateSheetId: null,
    rateSheetName: null,
    source: null,
  };
}

/**
 * Hook to get the effective rate sheet for a given context
 */
export function useEffectiveRateSheet(context: PricingContext) {
  return useQuery({
    queryKey: ['effective-rate-sheet', context.communityId, context.clientId, context.qboClassId],
    queryFn: () => getEffectiveRateSheet(context),
    enabled: !!(context.communityId || context.clientId || context.qboClassId),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Hook to resolve price for a single SKU
 */
export function useResolvedPrice(
  skuId: string | null,
  baseCost: number,
  context: PricingContext
) {
  const { data: rateSheetData } = useEffectiveRateSheet(context);

  return useQuery({
    queryKey: ['resolved-price', skuId, baseCost, rateSheetData?.rateSheetId],
    queryFn: async () => {
      if (!skuId) {
        return calculatePrice(baseCost, null, null, null);
      }

      const { rateSheetId, rateSheet, source } = rateSheetData || { rateSheetId: null, rateSheet: null, source: null };

      if (!rateSheetId) {
        return calculatePrice(baseCost, null, null, null);
      }

      // Look up specific item override
      const { data: item } = await supabase
        .from('rate_sheet_items')
        .select('*')
        .eq('rate_sheet_id', rateSheetId)
        .eq('sku_id', skuId)
        .single();

      const result = calculatePrice(baseCost, item as RateSheetItem | null, rateSheet, source);
      result.rateSheetName = rateSheet?.name || null;
      return result;
    },
    enabled: !!skuId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get all rate sheet items for a given context
 * Useful for batch price lookups
 */
export function useRateSheetPrices(context: PricingContext) {
  const { data: rateSheetData } = useEffectiveRateSheet(context);

  return useQuery({
    queryKey: ['rate-sheet-prices', rateSheetData?.rateSheetId],
    queryFn: async () => {
      const { rateSheetId, rateSheet, source } = rateSheetData || { rateSheetId: null, rateSheet: null, source: null };

      if (!rateSheetId) {
        return { items: new Map<string, RateSheetItem>(), rateSheet: null, source: null };
      }

      const { data: items } = await supabase
        .from('rate_sheet_items')
        .select('*')
        .eq('rate_sheet_id', rateSheetId);

      const itemMap = new Map<string, RateSheetItem>();
      items?.forEach(item => {
        itemMap.set(item.sku_id, item as RateSheetItem);
      });

      return { items: itemMap, rateSheet, source };
    },
    enabled: !!rateSheetData?.rateSheetId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Utility function to resolve price synchronously when you have the rate sheet data
 */
export function resolvePrice(
  skuId: string,
  baseCost: number,
  itemMap: Map<string, RateSheetItem>,
  rateSheet: RateSheet | null,
  source: 'community' | 'client' | 'bu' | null = null
): ResolvedPrice {
  const item = itemMap.get(skuId) || null;
  const result = calculatePrice(baseCost, item, rateSheet, source);
  result.rateSheetName = rateSheet?.name || null;
  return result;
}

/**
 * Utility function to get approved SKUs for a community
 */
export function useApprovedSkus(communityId: string | null) {
  return useQuery({
    queryKey: ['approved-skus', communityId],
    queryFn: async () => {
      if (!communityId) return { restrictSkus: false, approvedSkuIds: [] as string[] };

      const { data } = await supabase
        .from('communities')
        .select('restrict_skus, approved_sku_ids')
        .eq('id', communityId)
        .single();

      return {
        restrictSkus: data?.restrict_skus || false,
        approvedSkuIds: data?.approved_sku_ids || [],
      };
    },
    enabled: !!communityId,
  });
}

/**
 * Hook to get community-level product info (price overrides, spec codes)
 */
export function useCommunityProducts(communityId: string | null) {
  return useQuery({
    queryKey: ['community-products', communityId],
    queryFn: async () => {
      if (!communityId) return new Map<string, {
        priceOverride: number | null;
        specCode: string | null;
        isDefault: boolean;
      }>();

      const { data } = await supabase
        .from('community_products')
        .select('sku_id, price_override, spec_code, is_default')
        .eq('community_id', communityId);

      const productMap = new Map<string, {
        priceOverride: number | null;
        specCode: string | null;
        isDefault: boolean;
      }>();

      data?.forEach(item => {
        productMap.set(item.sku_id, {
          priceOverride: item.price_override,
          specCode: item.spec_code,
          isDefault: item.is_default,
        });
      });

      return productMap;
    },
    enabled: !!communityId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Enhanced resolvePrice that checks community price override first
 */
export function resolvePriceWithCommunityOverride(
  skuId: string,
  baseCost: number,
  itemMap: Map<string, RateSheetItem>,
  rateSheet: RateSheet | null,
  communityProducts: Map<string, { priceOverride: number | null; specCode: string | null; isDefault: boolean }> | null,
  source: 'community' | 'client' | 'bu' | null = null
): ResolvedPrice & { communitySpecCode?: string | null } {
  // Check community price override first (highest priority)
  const communityProduct = communityProducts?.get(skuId);
  if (communityProduct?.priceOverride !== null && communityProduct?.priceOverride !== undefined) {
    return {
      price: communityProduct.priceOverride,
      laborPrice: null,
      materialPrice: null,
      pricingMethod: 'cost_plus', // Using 'cost_plus' to indicate override
      rateSheetId: null,
      rateSheetName: 'Community Price Override',
      source: 'community',
      communitySpecCode: communityProduct.specCode,
    };
  }

  // Fall back to regular rate sheet resolution
  const result = resolvePrice(skuId, baseCost, itemMap, rateSheet, source);
  return {
    ...result,
    communitySpecCode: communityProduct?.specCode || null,
  };
}

/**
 * Hook to get available SKUs filtered by BU price book and community restrictions
 * Uses the get_available_skus RPC function
 */
export function useAvailableSkus(qboClassId: string | null, communityId: string | null = null) {
  return useQuery({
    queryKey: ['available-skus', qboClassId, communityId],
    queryFn: async () => {
      if (!qboClassId) return [];

      const { data, error } = await supabase.rpc('get_available_skus', {
        p_qbo_class_id: qboClassId,
        p_community_id: communityId,
      });

      if (error) {
        console.error('Error fetching available SKUs:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!qboClassId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get fully resolved price using the new get_resolved_price RPC
 * Includes community price override, rate sheet hierarchy, and BU fallback
 */
export function useFullyResolvedPrice(
  skuId: string | null,
  baseCost: number,
  context: PricingContext
) {
  return useQuery({
    queryKey: ['fully-resolved-price', skuId, baseCost, context.communityId, context.clientId, context.qboClassId],
    queryFn: async () => {
      if (!skuId) {
        return {
          price: baseCost,
          labor_price: null,
          material_price: null,
          pricing_method: 'cost_only',
          pricing_source: 'No Rate Sheet',
          rate_sheet_id: null,
          rate_sheet_name: null,
        };
      }

      const { data, error } = await supabase.rpc('get_resolved_price', {
        p_sku_id: skuId,
        p_base_cost: baseCost,
        p_community_id: context.communityId || null,
        p_client_id: context.clientId || null,
        p_qbo_class_id: context.qboClassId || null,
      });

      if (error) {
        console.error('Error resolving price:', error);
        return {
          price: baseCost,
          labor_price: null,
          material_price: null,
          pricing_method: 'cost_only',
          pricing_source: 'Error - Using Cost',
          rate_sheet_id: null,
          rate_sheet_name: null,
        };
      }

      // RPC returns array, take first result
      return data?.[0] || {
        price: baseCost,
        labor_price: null,
        material_price: null,
        pricing_method: 'cost_only',
        pricing_source: 'No Rate Sheet',
        rate_sheet_id: null,
        rate_sheet_name: null,
      };
    },
    enabled: !!skuId,
    staleTime: 5 * 60 * 1000,
  });
}
