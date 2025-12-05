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
 *
 * Storage:
 * - Material costs stored in product tables (universal, same for all BUs)
 * - Labor costs stored in sku_labor_costs table (one row per SKU per BU)
 */

import { supabase } from '../../../lib/supabase';
import { FenceCalculator, type HardwareMaterials } from './FenceCalculator';
import type {
  WoodVerticalProductWithMaterials,
  WoodHorizontalProductWithMaterials,
  IronProductWithMaterials,
  LaborRateWithDetails,
  Material,
} from '../database.types';

// Standard assumptions for SKU cost calculations
export const SKU_STANDARD_ASSUMPTIONS = {
  netLength: 100, // 100 linear feet
  numberOfLines: 4, // 4 fence lines
  numberOfGates: 0, // No gates for standard cost
};

export interface RecalculationResult {
  success: boolean;
  updatedMaterials: number;
  updatedLabor: number;
  errors: string[];
}

export interface MaterialCostResult {
  materialCost: number;
  materialCostPerFoot: number;
}

export interface LaborCostResult {
  laborCost: number;
  laborCostPerFoot: number;
}

/**
 * Create fallback concrete materials for calculations
 * These are used when concrete materials aren't in the database
 */
function createFallbackConcreteMaterials(): Material[] {
  const baseFallback = {
    length_ft: null,
    width_nominal: null,
    actual_width: null,
    thickness: null,
    quantity_per_unit: 1,
    fence_category_standard: [],
    is_bom_default: false,
    status: 'Active',
    normally_stocked: true,
    current_stock_qty: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return [
    {
      ...baseFallback,
      id: 'fallback-cts',
      material_sku: 'CTS',
      material_name: 'Sand & Gravel Mix (50lb)',
      category: '05-Concrete',
      sub_category: '3-Part',
      unit_type: 'bag',
      unit_cost: 4.25,
    },
    {
      ...baseFallback,
      id: 'fallback-ctp',
      material_sku: 'CTP',
      material_name: 'Portland Cement (94lb)',
      category: '05-Concrete',
      sub_category: '3-Part',
      unit_type: 'bag',
      unit_cost: 12.75,
    },
    {
      ...baseFallback,
      id: 'fallback-ctq',
      material_sku: 'CTQ',
      material_name: 'QuickRock (50lb)',
      category: '05-Concrete',
      sub_category: '3-Part',
      unit_type: 'bag',
      unit_cost: 5.50,
    },
  ];
}

/**
 * Create fallback hardware materials for calculations
 */
function createFallbackHardwareMaterials(): HardwareMaterials {
  const baseFallback = {
    length_ft: null,
    width_nominal: null,
    actual_width: null,
    thickness: null,
    quantity_per_unit: 1,
    fence_category_standard: [],
    is_bom_default: false,
    status: 'Active',
    normally_stocked: true,
    current_stock_qty: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    frameNails: {
      ...baseFallback,
      id: 'fallback-hw07',
      material_sku: 'HW07',
      material_name: 'Frame Nails (16d 3.5")',
      category: '06-Hardware',
      sub_category: 'Nails',
      unit_type: 'lb',
      unit_cost: 2.50,
    },
    picketNails: {
      ...baseFallback,
      id: 'fallback-hw08',
      material_sku: 'HW08',
      material_name: 'Picket Nails (8d 2.5")',
      category: '06-Hardware',
      sub_category: 'Nails',
      unit_type: 'lb',
      unit_cost: 2.50,
    },
  };
}

/**
 * Calculate material costs only for a Wood Vertical SKU
 * Includes base materials, nails, and concrete
 */
export function calculateWoodVerticalMaterialCost(
  product: WoodVerticalProductWithMaterials
): MaterialCostResult {
  const calculator = new FenceCalculator('sku-builder');
  const hardwareMaterials = createFallbackHardwareMaterials();
  const concreteMaterials = createFallbackConcreteMaterials();

  // Get base calculation with hardware materials (nails)
  const result = calculator.calculateWoodVertical(
    product,
    SKU_STANDARD_ASSUMPTIONS,
    [],
    hardwareMaterials
  );

  // Get post count for concrete calculation
  const postMaterial = result.materials.find(m =>
    m.material_sku === product.post_material.material_sku
  );
  const postQty = postMaterial ? Math.ceil(postMaterial.quantity) : 0;

  // Add frame nails if we have posts
  if (hardwareMaterials.frameNails && postQty > 0) {
    const hasCap = !!product.cap_material;
    const nailResult = calculator.calculateFrameNails(
      postQty,
      product.rail_count,
      hasCap,
      hardwareMaterials.frameNails
    );
    result.materials.push(nailResult);
  }

  // Add concrete
  const concreteMats = calculator.calculateConcrete(postQty, '3-part', concreteMaterials);
  result.materials.push(...concreteMats);

  const materialCost = result.materials.reduce(
    (sum, m) => sum + Math.ceil(m.quantity) * m.unit_cost,
    0
  );
  const materialCostPerFoot = SKU_STANDARD_ASSUMPTIONS.netLength > 0
    ? materialCost / SKU_STANDARD_ASSUMPTIONS.netLength
    : 0;

  return { materialCost, materialCostPerFoot };
}

/**
 * Calculate material costs only for a Wood Horizontal SKU
 * Includes base materials, nails, and concrete
 */
export function calculateWoodHorizontalMaterialCost(
  product: WoodHorizontalProductWithMaterials
): MaterialCostResult {
  const calculator = new FenceCalculator('sku-builder');
  const hardwareMaterials = createFallbackHardwareMaterials();
  const concreteMaterials = createFallbackConcreteMaterials();

  // Get base calculation with hardware materials (nails)
  const result = calculator.calculateWoodHorizontal(
    product,
    SKU_STANDARD_ASSUMPTIONS,
    [],
    hardwareMaterials
  );

  // Get post count for concrete calculation
  const postMaterial = result.materials.find(m =>
    m.material_sku === product.post_material.material_sku
  );
  const postQty = postMaterial ? Math.ceil(postMaterial.quantity) : 0;

  // Calculate board count for nailer nails
  const boardsPerBay = Math.floor((product.height * 12) / product.board_width_actual);
  const boardMaterial = result.materials.find(m =>
    m.material_sku === product.board_material.material_sku
  );
  const boardQty = boardMaterial ? Math.ceil(boardMaterial.quantity) : 0;

  // Add frame nails for horizontal (nails for nailer attachments)
  if (hardwareMaterials.frameNails && postQty > 0) {
    const hasCap = !!product.cap_material;
    // Use boardsPerBay as proxy for "rails" in horizontal fence
    const nailResult = calculator.calculateFrameNails(
      postQty,
      boardsPerBay,
      hasCap,
      hardwareMaterials.frameNails
    );
    result.materials.push(nailResult);
  }

  // Add board nails (similar to picket nails for vertical)
  // For horizontal: boards attach to 2 nailers per bay (one per post)
  if (hardwareMaterials.picketNails && boardQty > 0) {
    const boardNailResult = calculator.calculatePicketNails(
      boardQty,       // totalPickets (boards in this case)
      2,              // railsPerSection (nailers per bay)
      0,              // totalTrimBoards
      hardwareMaterials.picketNails
    );
    result.materials.push(boardNailResult);
  }

  // Add concrete
  const concreteMats = calculator.calculateConcrete(postQty, '3-part', concreteMaterials);
  result.materials.push(...concreteMats);

  const materialCost = result.materials.reduce(
    (sum, m) => sum + Math.ceil(m.quantity) * m.unit_cost,
    0
  );
  const materialCostPerFoot = SKU_STANDARD_ASSUMPTIONS.netLength > 0
    ? materialCost / SKU_STANDARD_ASSUMPTIONS.netLength
    : 0;

  return { materialCost, materialCostPerFoot };
}

/**
 * Calculate material costs only for an Iron SKU
 * Includes base materials and concrete (iron uses screws, not nails)
 */
export function calculateIronMaterialCost(
  product: IronProductWithMaterials
): MaterialCostResult {
  const calculator = new FenceCalculator('sku-builder');
  const concreteMaterials = createFallbackConcreteMaterials();

  // Get base calculation
  const result = calculator.calculateIron(
    product,
    SKU_STANDARD_ASSUMPTIONS,
    []
  );

  // Get post count for concrete calculation
  const postMaterial = result.materials.find(m =>
    m.material_sku === product.post_material.material_sku
  );
  const postQty = postMaterial ? Math.ceil(postMaterial.quantity) : 0;

  // Add concrete
  const concreteMats = calculator.calculateConcrete(postQty, '3-part', concreteMaterials);
  result.materials.push(...concreteMats);

  const materialCost = result.materials.reduce(
    (sum, m) => sum + Math.ceil(m.quantity) * m.unit_cost,
    0
  );
  const materialCostPerFoot = SKU_STANDARD_ASSUMPTIONS.netLength > 0
    ? materialCost / SKU_STANDARD_ASSUMPTIONS.netLength
    : 0;

  return { materialCost, materialCostPerFoot };
}

/**
 * Calculate labor costs for a Wood Vertical SKU with specific BU rates
 */
export function calculateWoodVerticalLaborCost(
  product: WoodVerticalProductWithMaterials,
  laborRates: LaborRateWithDetails[]
): LaborCostResult {
  const calculator = new FenceCalculator('sku-builder');
  const result = calculator.calculateWoodVertical(
    product,
    SKU_STANDARD_ASSUMPTIONS,
    laborRates
  );

  const laborCost = result.totalLaborCost;
  const laborCostPerFoot = SKU_STANDARD_ASSUMPTIONS.netLength > 0
    ? laborCost / SKU_STANDARD_ASSUMPTIONS.netLength
    : 0;

  return { laborCost, laborCostPerFoot };
}

/**
 * Calculate labor costs for a Wood Horizontal SKU with specific BU rates
 */
export function calculateWoodHorizontalLaborCost(
  product: WoodHorizontalProductWithMaterials,
  laborRates: LaborRateWithDetails[]
): LaborCostResult {
  const calculator = new FenceCalculator('sku-builder');
  const result = calculator.calculateWoodHorizontal(
    product,
    SKU_STANDARD_ASSUMPTIONS,
    laborRates
  );

  const laborCost = result.totalLaborCost;
  const laborCostPerFoot = SKU_STANDARD_ASSUMPTIONS.netLength > 0
    ? laborCost / SKU_STANDARD_ASSUMPTIONS.netLength
    : 0;

  return { laborCost, laborCostPerFoot };
}

/**
 * Calculate labor costs for an Iron SKU with specific BU rates
 */
export function calculateIronLaborCost(
  product: IronProductWithMaterials,
  laborRates: LaborRateWithDetails[]
): LaborCostResult {
  const calculator = new FenceCalculator('sku-builder');
  const result = calculator.calculateIron(
    product,
    SKU_STANDARD_ASSUMPTIONS,
    laborRates
  );

  const laborCost = result.totalLaborCost;
  const laborCostPerFoot = SKU_STANDARD_ASSUMPTIONS.netLength > 0
    ? laborCost / SKU_STANDARD_ASSUMPTIONS.netLength
    : 0;

  return { laborCost, laborCostPerFoot };
}

/**
 * Fetch labor rates for a specific business unit
 */
async function fetchLaborRatesForBU(businessUnitId: string): Promise<LaborRateWithDetails[]> {
  const { data, error } = await supabase
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

  if (error) throw error;
  return (data || []) as unknown as LaborRateWithDetails[];
}

/**
 * Upsert labor cost for a SKU/BU combination
 */
async function upsertLaborCost(
  productType: 'wood-vertical' | 'wood-horizontal' | 'iron',
  productId: string,
  businessUnitId: string,
  laborCost: number,
  laborCostPerFoot: number
): Promise<void> {
  const { error } = await supabase
    .from('sku_labor_costs')
    .upsert({
      product_type: productType,
      product_id: productId,
      business_unit_id: businessUnitId,
      labor_cost: laborCost,
      labor_cost_per_foot: laborCostPerFoot,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'product_type,product_id,business_unit_id',
    });

  if (error) throw error;
}

/**
 * Recalculate ALL costs (materials + labor for all BUs) for all SKUs
 */
export async function recalculateAllSKUs(
  onProgress?: (current: number, total: number, phase: string) => void
): Promise<RecalculationResult> {
  const errors: string[] = [];
  let updatedMaterials = 0;
  let updatedLabor = 0;

  try {
    // 1. Fetch all business units
    const { data: businessUnits, error: buError } = await supabase
      .from('business_units')
      .select('id, code, name')
      .eq('is_active', true);

    if (buError) throw buError;
    if (!businessUnits || businessUnits.length === 0) {
      throw new Error('No active business units found');
    }

    // 2. Fetch labor rates for ALL business units upfront
    const laborRatesByBU: Map<string, LaborRateWithDetails[]> = new Map();
    for (const bu of businessUnits) {
      const rates = await fetchLaborRatesForBU(bu.id);
      laborRatesByBU.set(bu.id, rates);
    }

    // 3. Fetch all products with materials
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

    // Total operations = materials + (products × BUs for labor)
    const totalLaborOps = totalProducts * businessUnits.length;
    const totalOps = totalProducts + totalLaborOps;
    let current = 0;

    // ========== PHASE 1: Update Material Costs ==========
    onProgress?.(current, totalOps, 'Calculating materials...');

    // Wood Vertical - Materials
    for (const product of (wvProducts || [])) {
      try {
        if (!product.post_material || !product.picket_material || !product.rail_material) {
          errors.push(`WV ${product.sku_code}: Missing required materials`);
          current++;
          onProgress?.(current, totalOps, 'Calculating materials...');
          continue;
        }

        const result = calculateWoodVerticalMaterialCost(
          product as WoodVerticalProductWithMaterials
        );

        const { error: updateError } = await supabase
          .from('wood_vertical_products')
          .update({
            standard_material_cost: result.materialCost,
            standard_cost_per_foot: result.materialCostPerFoot,
            standard_cost_calculated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          errors.push(`WV ${product.sku_code}: ${updateError.message}`);
        } else {
          updatedMaterials++;
        }
      } catch (err) {
        errors.push(`WV ${product.sku_code}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      current++;
      onProgress?.(current, totalOps, 'Calculating materials...');
    }

    // Wood Horizontal - Materials
    for (const product of (whProducts || [])) {
      try {
        if (!product.post_material || !product.board_material) {
          errors.push(`WH ${product.sku_code}: Missing required materials`);
          current++;
          onProgress?.(current, totalOps, 'Calculating materials...');
          continue;
        }

        const result = calculateWoodHorizontalMaterialCost(
          product as WoodHorizontalProductWithMaterials
        );

        const { error: updateError } = await supabase
          .from('wood_horizontal_products')
          .update({
            standard_material_cost: result.materialCost,
            standard_cost_per_foot: result.materialCostPerFoot,
            standard_cost_calculated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          errors.push(`WH ${product.sku_code}: ${updateError.message}`);
        } else {
          updatedMaterials++;
        }
      } catch (err) {
        errors.push(`WH ${product.sku_code}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      current++;
      onProgress?.(current, totalOps, 'Calculating materials...');
    }

    // Iron - Materials
    for (const product of (ironProducts || [])) {
      try {
        if (!product.post_material) {
          errors.push(`IR ${product.sku_code}: Missing required materials`);
          current++;
          onProgress?.(current, totalOps, 'Calculating materials...');
          continue;
        }

        const result = calculateIronMaterialCost(
          product as IronProductWithMaterials
        );

        const { error: updateError } = await supabase
          .from('iron_products')
          .update({
            standard_material_cost: result.materialCost,
            standard_cost_per_foot: result.materialCostPerFoot,
            standard_cost_calculated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          errors.push(`IR ${product.sku_code}: ${updateError.message}`);
        } else {
          updatedMaterials++;
        }
      } catch (err) {
        errors.push(`IR ${product.sku_code}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      current++;
      onProgress?.(current, totalOps, 'Calculating materials...');
    }

    // ========== PHASE 2: Update Labor Costs for ALL BUs ==========
    onProgress?.(current, totalOps, 'Calculating labor costs...');

    // Wood Vertical - Labor (for each BU)
    for (const product of (wvProducts || [])) {
      if (!product.post_material || !product.picket_material || !product.rail_material) {
        current += businessUnits.length;
        onProgress?.(current, totalOps, 'Calculating labor costs...');
        continue;
      }

      for (const bu of businessUnits) {
        try {
          const laborRates = laborRatesByBU.get(bu.id) || [];
          const result = calculateWoodVerticalLaborCost(
            product as WoodVerticalProductWithMaterials,
            laborRates
          );

          await upsertLaborCost(
            'wood-vertical',
            product.id,
            bu.id,
            result.laborCost,
            result.laborCostPerFoot
          );
          updatedLabor++;
        } catch (err) {
          errors.push(`WV ${product.sku_code} (${bu.code}): ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        current++;
        onProgress?.(current, totalOps, `Calculating labor (${bu.code})...`);
      }
    }

    // Wood Horizontal - Labor (for each BU)
    for (const product of (whProducts || [])) {
      if (!product.post_material || !product.board_material) {
        current += businessUnits.length;
        onProgress?.(current, totalOps, 'Calculating labor costs...');
        continue;
      }

      for (const bu of businessUnits) {
        try {
          const laborRates = laborRatesByBU.get(bu.id) || [];
          const result = calculateWoodHorizontalLaborCost(
            product as WoodHorizontalProductWithMaterials,
            laborRates
          );

          await upsertLaborCost(
            'wood-horizontal',
            product.id,
            bu.id,
            result.laborCost,
            result.laborCostPerFoot
          );
          updatedLabor++;
        } catch (err) {
          errors.push(`WH ${product.sku_code} (${bu.code}): ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        current++;
        onProgress?.(current, totalOps, `Calculating labor (${bu.code})...`);
      }
    }

    // Iron - Labor (for each BU)
    for (const product of (ironProducts || [])) {
      if (!product.post_material) {
        current += businessUnits.length;
        onProgress?.(current, totalOps, 'Calculating labor costs...');
        continue;
      }

      for (const bu of businessUnits) {
        try {
          const laborRates = laborRatesByBU.get(bu.id) || [];
          const result = calculateIronLaborCost(
            product as IronProductWithMaterials,
            laborRates
          );

          await upsertLaborCost(
            'iron',
            product.id,
            bu.id,
            result.laborCost,
            result.laborCostPerFoot
          );
          updatedLabor++;
        } catch (err) {
          errors.push(`IR ${product.sku_code} (${bu.code}): ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        current++;
        onProgress?.(current, totalOps, `Calculating labor (${bu.code})...`);
      }
    }

    return {
      success: errors.length === 0,
      updatedMaterials,
      updatedLabor,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      updatedMaterials,
      updatedLabor,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
