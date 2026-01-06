/**
 * useSkuLaborCost - Fetch labor cost for a SKU based on QBO Class
 *
 * The sku_labor_costs_v2 table stores labor costs per SKU per Business Unit.
 * This hook resolves the QBO Class to its Business Unit (via labor_code)
 * and returns the labor cost for that BU.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

interface UseSkuLaborCostParams {
  skuId: string | null;
  qboClassId: string | null;
}

interface SkuLaborCostResult {
  laborCost: number;  // Labor cost for 100 LF
  laborCostPerFoot: number;  // Labor cost per 1 LF
  businessUnitId: string | null;
  businessUnitCode: string | null;
}

/**
 * Fetch the labor cost for a SKU based on the QBO Class's Business Unit
 */
export function useSkuLaborCost({ skuId, qboClassId }: UseSkuLaborCostParams) {
  return useQuery({
    queryKey: ['sku-labor-cost', skuId, qboClassId],
    queryFn: async (): Promise<SkuLaborCostResult | null> => {
      if (!skuId || !qboClassId) return null;

      // Step 1: Get the QBO Class's labor_code
      const { data: qboClass, error: qboError } = await supabase
        .from('qbo_classes')
        .select('labor_code')
        .eq('id', qboClassId)
        .single();

      if (qboError || !qboClass?.labor_code) {
        console.warn('Could not find QBO class or labor_code:', qboError);
        return null;
      }

      // Step 2: Find the Business Unit with that code
      const { data: bu, error: buError } = await supabase
        .from('business_units')
        .select('id, code')
        .eq('code', qboClass.labor_code)
        .single();

      if (buError || !bu) {
        console.warn('Could not find Business Unit for labor_code:', qboClass.labor_code, buError);
        return null;
      }

      // Step 3: Fetch the labor cost from sku_labor_costs_v2
      const { data: laborCost, error: laborError } = await supabase
        .from('sku_labor_costs_v2')
        .select('labor_cost, labor_cost_per_foot')
        .eq('sku_id', skuId)
        .eq('business_unit_id', bu.id)
        .single();

      if (laborError || !laborCost) {
        // No labor cost found for this SKU + BU combination
        // This could happen if the SKU hasn't been recalculated yet
        return {
          laborCost: 0,
          laborCostPerFoot: 0,
          businessUnitId: bu.id,
          businessUnitCode: bu.code,
        };
      }

      return {
        laborCost: laborCost.labor_cost,
        laborCostPerFoot: laborCost.labor_cost_per_foot,
        businessUnitId: bu.id,
        businessUnitCode: bu.code,
      };
    },
    enabled: !!skuId && !!qboClassId,
    staleTime: 5 * 60 * 1000, // 5 minutes - labor costs don't change often
  });
}

/**
 * Synchronous helper to fetch labor cost for a SKU + QBO class
 * Used when you need the value immediately (e.g., in a callback)
 *
 * Returns the labor cost per foot, or 0 if not found
 */
export async function fetchSkuLaborCostPerFoot(
  skuId: string,
  qboClassId: string
): Promise<number> {
  if (!skuId || !qboClassId) return 0;

  try {
    // Get the QBO Class's labor_code
    const { data: qboClass } = await supabase
      .from('qbo_classes')
      .select('labor_code')
      .eq('id', qboClassId)
      .single();

    if (!qboClass?.labor_code) return 0;

    // Find the Business Unit
    const { data: bu } = await supabase
      .from('business_units')
      .select('id')
      .eq('code', qboClass.labor_code)
      .single();

    if (!bu) return 0;

    // Fetch the labor cost
    const { data: laborCost } = await supabase
      .from('sku_labor_costs_v2')
      .select('labor_cost_per_foot')
      .eq('sku_id', skuId)
      .eq('business_unit_id', bu.id)
      .single();

    return laborCost?.labor_cost_per_foot || 0;
  } catch (error) {
    console.error('Error fetching SKU labor cost:', error);
    return 0;
  }
}
