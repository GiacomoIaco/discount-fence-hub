/**
 * SKU Recalculation Service
 *
 * Uses FenceCalculator to recalculate standard costs for all SKUs
 * based on current material prices and labor rates.
 *
 * Standard assumptions for SKU costing:
 * - 100 linear feet
 * - 4 lines (fence runs)
 * - 0 gates
 */

import { supabase } from '../../../lib/supabase';
import { FenceCalculator } from './FenceCalculator';
import type {
  WoodVerticalProductWithMaterials,
  WoodHorizontalProductWithMaterials,
  IronProductWithMaterials,
  LaborRateWithDetails,
} from '../database.types';

// Standard assumptions for SKU cost calculations
export const SKU_STANDARD_ASSUMPTIONS = {
  netLength: 100, // 100 linear feet
  numberOfLines: 4, // 4 fence lines
  numberOfGates: 0, // No gates for standard cost
};

export interface RecalculationResult {
  success: boolean;
  updated: number;
  errors: string[];
}

export interface SingleSKUResult {
  materialCost: number;
  laborCost: number;
  totalCost: number;
  costPerFoot: number;
}

/**
 * Recalculate costs for a single Wood Vertical SKU
 */
export async function recalculateWoodVerticalSKU(
  product: WoodVerticalProductWithMaterials,
  laborRates: LaborRateWithDetails[]
): Promise<SingleSKUResult> {
  const calculator = new FenceCalculator('sku-builder');
  const result = calculator.calculateWoodVertical(
    product,
    SKU_STANDARD_ASSUMPTIONS,
    laborRates
  );

  // Round materials for cost calculation
  const materialCost = result.materials.reduce(
    (sum, m) => sum + Math.ceil(m.quantity) * m.unit_cost,
    0
  );
  const laborCost = result.totalLaborCost;
  const totalCost = materialCost + laborCost;
  const costPerFoot = SKU_STANDARD_ASSUMPTIONS.netLength > 0
    ? totalCost / SKU_STANDARD_ASSUMPTIONS.netLength
    : 0;

  return { materialCost, laborCost, totalCost, costPerFoot };
}

/**
 * Recalculate costs for a single Wood Horizontal SKU
 */
export async function recalculateWoodHorizontalSKU(
  product: WoodHorizontalProductWithMaterials,
  laborRates: LaborRateWithDetails[]
): Promise<SingleSKUResult> {
  const calculator = new FenceCalculator('sku-builder');
  const result = calculator.calculateWoodHorizontal(
    product,
    SKU_STANDARD_ASSUMPTIONS,
    laborRates
  );

  const materialCost = result.materials.reduce(
    (sum, m) => sum + Math.ceil(m.quantity) * m.unit_cost,
    0
  );
  const laborCost = result.totalLaborCost;
  const totalCost = materialCost + laborCost;
  const costPerFoot = SKU_STANDARD_ASSUMPTIONS.netLength > 0
    ? totalCost / SKU_STANDARD_ASSUMPTIONS.netLength
    : 0;

  return { materialCost, laborCost, totalCost, costPerFoot };
}

/**
 * Recalculate costs for a single Iron SKU
 */
export async function recalculateIronSKU(
  product: IronProductWithMaterials,
  laborRates: LaborRateWithDetails[]
): Promise<SingleSKUResult> {
  const calculator = new FenceCalculator('sku-builder');
  const result = calculator.calculateIron(
    product,
    SKU_STANDARD_ASSUMPTIONS,
    laborRates
  );

  const materialCost = result.materials.reduce(
    (sum, m) => sum + Math.ceil(m.quantity) * m.unit_cost,
    0
  );
  const laborCost = result.totalLaborCost;
  const totalCost = materialCost + laborCost;
  const costPerFoot = SKU_STANDARD_ASSUMPTIONS.netLength > 0
    ? totalCost / SKU_STANDARD_ASSUMPTIONS.netLength
    : 0;

  return { materialCost, laborCost, totalCost, costPerFoot };
}

/**
 * Recalculate all SKUs and update the database
 */
export async function recalculateAllSKUs(
  businessUnitId: string,
  onProgress?: (current: number, total: number) => void
): Promise<RecalculationResult> {
  const errors: string[] = [];
  let updated = 0;

  try {
    // 1. Fetch labor rates for the business unit
    const { data: laborRatesData, error: laborError } = await supabase
      .from('labor_rates')
      .select(`
        id,
        labor_code_id,
        business_unit_id,
        rate,
        effective_date,
        created_at,
        updated_at,
        labor_code:labor_codes(id, labor_sku, description, unit_type, fence_category_standard, is_active),
        business_unit:business_units(id, code, name)
      `)
      .eq('business_unit_id', businessUnitId);

    if (laborError) throw laborError;

    const laborRates = (laborRatesData || []) as unknown as LaborRateWithDetails[];

    // 2. Fetch all Wood Vertical products with materials
    const { data: wvProducts, error: wvError } = await supabase
      .from('wood_vertical_products')
      .select(`
        *,
        post_material:materials!wood_vertical_products_post_material_id_fkey(*),
        picket_material:materials!wood_vertical_products_picket_material_id_fkey(*),
        rail_material:materials!wood_vertical_products_rail_material_id_fkey(*),
        cap_material:materials!wood_vertical_products_cap_material_id_fkey(*),
        trim_material:materials!wood_vertical_products_trim_material_id_fkey(*)
      `);

    if (wvError) throw wvError;

    // 3. Fetch all Wood Horizontal products with materials
    const { data: whProducts, error: whError } = await supabase
      .from('wood_horizontal_products')
      .select(`
        *,
        post_material:materials!wood_horizontal_products_post_material_id_fkey(*),
        board_material:materials!wood_horizontal_products_board_material_id_fkey(*),
        nailer_material:materials!wood_horizontal_products_nailer_material_id_fkey(*),
        cap_material:materials!wood_horizontal_products_cap_material_id_fkey(*)
      `);

    if (whError) throw whError;

    // 4. Fetch all Iron products with materials
    const { data: ironProducts, error: ironError } = await supabase
      .from('iron_products')
      .select(`
        *,
        post_material:materials!iron_products_post_material_id_fkey(*),
        panel_material:materials!iron_products_panel_material_id_fkey(*),
        bracket_material:materials!iron_products_bracket_material_id_fkey(*)
      `);

    if (ironError) throw ironError;

    const totalProducts =
      (wvProducts?.length || 0) +
      (whProducts?.length || 0) +
      (ironProducts?.length || 0);

    let current = 0;

    // 5. Recalculate Wood Vertical products
    for (const product of (wvProducts || [])) {
      try {
        // Skip if missing required materials
        if (!product.post_material || !product.picket_material || !product.rail_material) {
          errors.push(`WV ${product.sku_code}: Missing required materials`);
          current++;
          onProgress?.(current, totalProducts);
          continue;
        }

        const result = await recalculateWoodVerticalSKU(
          product as WoodVerticalProductWithMaterials,
          laborRates
        );

        const { error: updateError } = await supabase
          .from('wood_vertical_products')
          .update({
            standard_material_cost: result.materialCost,
            standard_labor_cost: result.laborCost,
            standard_cost_per_foot: result.costPerFoot,
            standard_cost_calculated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          errors.push(`WV ${product.sku_code}: ${updateError.message}`);
        } else {
          updated++;
        }
      } catch (err) {
        errors.push(`WV ${product.sku_code}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      current++;
      onProgress?.(current, totalProducts);
    }

    // 6. Recalculate Wood Horizontal products
    for (const product of (whProducts || [])) {
      try {
        if (!product.post_material || !product.board_material) {
          errors.push(`WH ${product.sku_code}: Missing required materials`);
          current++;
          onProgress?.(current, totalProducts);
          continue;
        }

        const result = await recalculateWoodHorizontalSKU(
          product as WoodHorizontalProductWithMaterials,
          laborRates
        );

        const { error: updateError } = await supabase
          .from('wood_horizontal_products')
          .update({
            standard_material_cost: result.materialCost,
            standard_labor_cost: result.laborCost,
            standard_cost_per_foot: result.costPerFoot,
            standard_cost_calculated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          errors.push(`WH ${product.sku_code}: ${updateError.message}`);
        } else {
          updated++;
        }
      } catch (err) {
        errors.push(`WH ${product.sku_code}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      current++;
      onProgress?.(current, totalProducts);
    }

    // 7. Recalculate Iron products
    for (const product of (ironProducts || [])) {
      try {
        if (!product.post_material) {
          errors.push(`IR ${product.sku_code}: Missing required materials`);
          current++;
          onProgress?.(current, totalProducts);
          continue;
        }

        const result = await recalculateIronSKU(
          product as IronProductWithMaterials,
          laborRates
        );

        const { error: updateError } = await supabase
          .from('iron_products')
          .update({
            standard_material_cost: result.materialCost,
            standard_labor_cost: result.laborCost,
            standard_cost_per_foot: result.costPerFoot,
            standard_cost_calculated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          errors.push(`IR ${product.sku_code}: ${updateError.message}`);
        } else {
          updated++;
        }
      } catch (err) {
        errors.push(`IR ${product.sku_code}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      current++;
      onProgress?.(current, totalProducts);
    }

    return {
      success: errors.length === 0,
      updated,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      updated,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
