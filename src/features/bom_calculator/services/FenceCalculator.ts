/**
 * FenceCalculator - Unified calculation engine for BOM/BOL
 *
 * Implements all formulas from Excel BOM_Formula_Specification_Tables
 * Supports two calculation contexts:
 * 1. SKU Builder: Calculate standard cost for single SKU (no gates, rounds immediately)
 * 2. Project: Multi-SKU estimates with project-level aggregation (includes gates)
 *
 * Updated: December 2024 - Aligned with Excel Formula Specification
 */

import type {
  WoodVerticalProductWithMaterials,
  WoodHorizontalProductWithMaterials,
  IronProductWithMaterials,
  Material,
  LaborRateWithDetails,
  PostType,
} from '../database.types';

// ============================================================================
// TYPES
// ============================================================================

export interface CalculationInput {
  netLength: number; // feet
  numberOfLines: number; // 1-5
  numberOfGates: number; // 0-3 (always 0 for SKU Builder)
}

export interface MaterialCalculation {
  material_id: string;
  material_sku: string;
  material_name: string;
  quantity: number; // DECIMAL - not rounded
  unit_type: string;
  unit_cost: number;
  category: string;
}

export interface LaborCalculation {
  labor_code_id: string;
  labor_sku: string;
  description: string;
  quantity: number; // DECIMAL
  rate: number;
  unit_type: string;
}

export interface CalculationResult {
  materials: MaterialCalculation[];
  labor: LaborCalculation[];
  totalMaterialCost: number;
  totalLaborCost: number;
  totalCost: number;
}

export type CalculatorMode = 'sku-builder' | 'project';

// Gate post adjustment result
interface GatePostAdjustment {
  adjustedPosts: number; // Modified count of base posts
  steelGatePosts: number; // Separate line item for wood-post fences
}

// Hardware materials for calculations
export interface HardwareMaterials {
  picketNails?: Material; // HW08 - 300 nails per coil
  frameNails?: Material; // HW07 - 28 nails per box
  steelGatePost?: Material; // Steel post for gates on wood fences
  postCapDome?: Material; // Dome cap for steel posts
  postCapPlug?: Material; // Plug cap for steel posts (when cap+trim)
  brackets?: Material; // Brackets for steel posts
  selfTappingScrews?: Material; // Screws for steel post rails
}

// Concrete materials for calculations
export interface ConcreteMaterials {
  cts?: Material; // Sand & Gravel (3-part)
  ctp?: Material; // Portland Cement (3-part)
  ctq?: Material; // QuickRock (3-part)
  cty?: Material; // Yellow bags
  ctr?: Material; // Red bags
}

// Default fallback materials (used when not provided)
const DEFAULT_HARDWARE: HardwareMaterials = {
  frameNails: {
    id: 'fallback-hw07',
    material_sku: 'HW07',
    material_name: 'Frame Nails (16d 3.5")',
    category: '06-Hardware',
    sub_category: 'Nails',
    unit_type: 'lb',
    unit_cost: 2.50,
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
  },
  picketNails: {
    id: 'fallback-hw08',
    material_sku: 'HW08',
    material_name: 'Picket Nails (8d 2.5")',
    category: '06-Hardware',
    sub_category: 'Nails',
    unit_type: 'lb',
    unit_cost: 2.50,
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
  },
};

const DEFAULT_CONCRETE: ConcreteMaterials = {
  cts: {
    id: 'fallback-cts',
    material_sku: 'CTS',
    material_name: 'Sand & Gravel Mix (50lb)',
    category: '05-Concrete',
    sub_category: '3-Part',
    unit_type: 'bag',
    unit_cost: 4.25,
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
  },
  ctp: {
    id: 'fallback-ctp',
    material_sku: 'CTP',
    material_name: 'Portland Cement (94lb)',
    category: '05-Concrete',
    sub_category: '3-Part',
    unit_type: 'bag',
    unit_cost: 12.75,
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
  },
  ctq: {
    id: 'fallback-ctq',
    material_sku: 'CTQ',
    material_name: 'QuickRock (50lb)',
    category: '05-Concrete',
    sub_category: '3-Part',
    unit_type: 'bag',
    unit_cost: 5.50,
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
  },
};

// ============================================================================
// FENCE CALCULATOR CLASS
// ============================================================================

export class FenceCalculator {
  constructor(_mode: CalculatorMode = 'project') {
    // Mode stored for future use (e.g., different rounding strategies)
  }

  // ==========================================================================
  // WOOD VERTICAL CALCULATIONS
  // ==========================================================================

  calculateWoodVertical(
    product: WoodVerticalProductWithMaterials,
    input: CalculationInput,
    laborRates: LaborRateWithDetails[],
    hardwareMaterials?: HardwareMaterials,
    concreteMaterials?: ConcreteMaterials,
    concreteType: '3-part' | 'yellow-bags' | 'red-bags' = '3-part'
  ): CalculationResult {
    const materials: MaterialCalculation[] = [];
    const labor: LaborCalculation[] = [];

    // Use defaults if not provided
    const hw = { ...DEFAULT_HARDWARE, ...hardwareMaterials };
    const concrete = { ...DEFAULT_CONCRETE, ...concreteMaterials };

    // 1. POSTS (base calculation)
    const basePosts = this.calculateWoodVerticalPosts(
      input.netLength,
      product.style,
      product.post_spacing,
      input.numberOfLines
    );

    // 1b. GATE POST ADJUSTMENT (Calculator/Project mode only)
    const gateAdjustment = this.adjustPostsForGates(
      basePosts,
      input.numberOfGates,
      product.post_type
    );

    // Add adjusted base posts
    materials.push({
      material_id: product.post_material.id,
      material_sku: product.post_material.material_sku,
      material_name: product.post_material.material_name,
      quantity: gateAdjustment.adjustedPosts,
      unit_type: product.post_material.unit_type,
      unit_cost: product.post_material.unit_cost,
      category: product.post_material.category,
    });

    // Add steel gate posts if wood fence with gates
    if (gateAdjustment.steelGatePosts > 0 && hardwareMaterials?.steelGatePost) {
      materials.push({
        material_id: hardwareMaterials.steelGatePost.id,
        material_sku: hardwareMaterials.steelGatePost.material_sku,
        material_name: hardwareMaterials.steelGatePost.material_name,
        quantity: gateAdjustment.steelGatePosts,
        unit_type: hardwareMaterials.steelGatePost.unit_type,
        unit_cost: hardwareMaterials.steelGatePost.unit_cost,
        category: hardwareMaterials.steelGatePost.category,
      });
    }

    // 2. PICKETS
    const pickets = this.calculateWoodVerticalPickets(
      input.netLength,
      product.style,
      product.picket_material.actual_width || 5.5
    );

    materials.push({
      material_id: product.picket_material.id,
      material_sku: product.picket_material.material_sku,
      material_name: product.picket_material.material_name,
      quantity: pickets,
      unit_type: product.picket_material.unit_type,
      unit_cost: product.picket_material.unit_cost,
      category: product.picket_material.category,
    });

    // 3. RAILS
    const rails = this.calculateWoodVerticalRails(
      input.netLength,
      product.rail_count,
      product.post_spacing
    );

    materials.push({
      material_id: product.rail_material.id,
      material_sku: product.rail_material.material_sku,
      material_name: product.rail_material.material_name,
      quantity: rails,
      unit_type: product.rail_material.unit_type,
      unit_cost: product.rail_material.unit_cost,
      category: product.rail_material.category,
    });

    // 4. CAP (if present)
    let caps = 0;
    if (product.cap_material) {
      caps = this.calculateCap(input.netLength, product.cap_material.length_ft || 8);
      materials.push({
        material_id: product.cap_material.id,
        material_sku: product.cap_material.material_sku,
        material_name: product.cap_material.material_name,
        quantity: caps,
        unit_type: product.cap_material.unit_type,
        unit_cost: product.cap_material.unit_cost,
        category: product.cap_material.category,
      });
    }

    // 5. TRIM (if present)
    let trims = 0;
    if (product.trim_material) {
      trims = this.calculateTrim(input.netLength, product.trim_material.length_ft || 8);
      materials.push({
        material_id: product.trim_material.id,
        material_sku: product.trim_material.material_sku,
        material_name: product.trim_material.material_name,
        quantity: trims,
        unit_type: product.trim_material.unit_type,
        unit_cost: product.trim_material.unit_cost,
        category: product.trim_material.category,
      });
    }

    // 6. ROT BOARD (if present)
    if (product.rot_board_material) {
      const rotBoards = this.calculateRotBoard(
        input.netLength,
        product.rot_board_material.length_ft || 8
      );
      materials.push({
        material_id: product.rot_board_material.id,
        material_sku: product.rot_board_material.material_sku,
        material_name: product.rot_board_material.material_name,
        quantity: rotBoards,
        unit_type: product.rot_board_material.unit_type,
        unit_cost: product.rot_board_material.unit_cost,
        category: product.rot_board_material.category,
      });
    }

    // 7. STEEL POST EXTRAS (if steel posts)
    if (product.post_type === 'STEEL') {
      const totalPosts = gateAdjustment.adjustedPosts;
      const hasCap = product.cap_material_id !== null;
      const hasTrim = product.trim_material_id !== null;

      // 7a. Post Caps (Dome or Plug based on cap+trim)
      const postCapMaterial =
        hasCap && hasTrim
          ? hardwareMaterials?.postCapPlug
          : hardwareMaterials?.postCapDome;

      if (postCapMaterial) {
        materials.push({
          material_id: postCapMaterial.id,
          material_sku: postCapMaterial.material_sku,
          material_name: postCapMaterial.material_name,
          quantity: totalPosts,
          unit_type: postCapMaterial.unit_type,
          unit_cost: postCapMaterial.unit_cost,
          category: postCapMaterial.category,
        });
      }

      // 7b. Brackets (one per rail per post)
      if (hardwareMaterials?.brackets) {
        const brackets = this.calculateSteelPostBrackets(totalPosts, product.rail_count);
        materials.push({
          material_id: hardwareMaterials.brackets.id,
          material_sku: hardwareMaterials.brackets.material_sku,
          material_name: hardwareMaterials.brackets.material_name,
          quantity: brackets,
          unit_type: hardwareMaterials.brackets.unit_type,
          unit_cost: hardwareMaterials.brackets.unit_cost,
          category: hardwareMaterials.brackets.category,
        });
      }

      // 7c. Self-Tapping Screws (4 per rail)
      if (hardwareMaterials?.selfTappingScrews) {
        const screws = this.calculateSelfTappingScrews(rails);
        materials.push({
          material_id: hardwareMaterials.selfTappingScrews.id,
          material_sku: hardwareMaterials.selfTappingScrews.material_sku,
          material_name: hardwareMaterials.selfTappingScrews.material_name,
          quantity: screws,
          unit_type: hardwareMaterials.selfTappingScrews.unit_type,
          unit_cost: hardwareMaterials.selfTappingScrews.unit_cost,
          category: hardwareMaterials.selfTappingScrews.category,
        });
      }
    }

    // 8. LABOR
    const laborCodes = this.getWoodVerticalLaborCodes(product, input);
    for (const code of laborCodes) {
      const rateRecord = laborRates.find((r) => r.labor_code.labor_sku === code.labor_sku);
      if (rateRecord) {
        labor.push({
          labor_code_id: rateRecord.labor_code.id,
          labor_sku: rateRecord.labor_code.labor_sku,
          description: rateRecord.labor_code.description,
          quantity: code.quantity,
          rate: rateRecord.rate,
          unit_type: rateRecord.labor_code.unit_type,
        });
      }
    }

    // 9. FRAME NAILS (for posts/rails/caps)
    const totalPosts = gateAdjustment.adjustedPosts;
    const hasCap = !!product.cap_material;
    if (hw.frameNails) {
      // Raw calculation: posts × rails × 4 nails, + if cap: posts × 6
      let frameNailCount = totalPosts * product.rail_count * 4;
      if (hasCap) frameNailCount += totalPosts * 6;
      const frameNailBoxes = frameNailCount / 28; // RAW - no rounding

      materials.push({
        material_id: hw.frameNails.id,
        material_sku: hw.frameNails.material_sku,
        material_name: hw.frameNails.material_name,
        quantity: frameNailBoxes,
        unit_type: hw.frameNails.unit_type,
        unit_cost: hw.frameNails.unit_cost,
        category: hw.frameNails.category,
      });
    }

    // 10. PICKET NAILS (for pickets to rails, + trim if present)
    if (hw.picketNails) {
      // Raw calculation: pickets × rails × 2 nails, + if trim: trims × 6
      let picketNailCount = pickets * product.rail_count * 2;
      if (trims > 0) picketNailCount += trims * 6;
      const picketNailCoils = picketNailCount / 300; // RAW - no rounding

      materials.push({
        material_id: hw.picketNails.id,
        material_sku: hw.picketNails.material_sku,
        material_name: hw.picketNails.material_name,
        quantity: picketNailCoils,
        unit_type: hw.picketNails.unit_type,
        unit_cost: hw.picketNails.unit_cost,
        category: hw.picketNails.category,
      });
    }

    // 11. CONCRETE (3-part system)
    if (concreteType === '3-part') {
      if (concrete.cts) {
        materials.push({
          material_id: concrete.cts.id,
          material_sku: concrete.cts.material_sku,
          material_name: concrete.cts.material_name,
          quantity: totalPosts / 10, // RAW - no rounding
          unit_type: concrete.cts.unit_type,
          unit_cost: concrete.cts.unit_cost,
          category: concrete.cts.category,
        });
      }
      if (concrete.ctp) {
        materials.push({
          material_id: concrete.ctp.id,
          material_sku: concrete.ctp.material_sku,
          material_name: concrete.ctp.material_name,
          quantity: totalPosts / 20, // RAW - no rounding
          unit_type: concrete.ctp.unit_type,
          unit_cost: concrete.ctp.unit_cost,
          category: concrete.ctp.category,
        });
      }
      if (concrete.ctq) {
        materials.push({
          material_id: concrete.ctq.id,
          material_sku: concrete.ctq.material_sku,
          material_name: concrete.ctq.material_name,
          quantity: totalPosts * 0.5, // RAW - no rounding
          unit_type: concrete.ctq.unit_type,
          unit_cost: concrete.ctq.unit_cost,
          category: concrete.ctq.category,
        });
      }
    } else if (concreteType === 'yellow-bags' && concrete.cty) {
      materials.push({
        material_id: concrete.cty.id,
        material_sku: concrete.cty.material_sku,
        material_name: concrete.cty.material_name,
        quantity: totalPosts * 0.65, // RAW - no rounding
        unit_type: concrete.cty.unit_type,
        unit_cost: concrete.cty.unit_cost,
        category: concrete.cty.category,
      });
    } else if (concreteType === 'red-bags' && concrete.ctr) {
      materials.push({
        material_id: concrete.ctr.id,
        material_sku: concrete.ctr.material_sku,
        material_name: concrete.ctr.material_name,
        quantity: totalPosts * 1, // RAW - no rounding
        unit_type: concrete.ctr.unit_type,
        unit_cost: concrete.ctr.unit_cost,
        category: concrete.ctr.category,
      });
    }

    return this.aggregateResults(materials, labor);
  }

  // ==========================================================================
  // WOOD HORIZONTAL CALCULATIONS
  // ==========================================================================

  calculateWoodHorizontal(
    product: WoodHorizontalProductWithMaterials,
    input: CalculationInput,
    laborRates: LaborRateWithDetails[],
    hardwareMaterials?: HardwareMaterials,
    concreteMaterials?: ConcreteMaterials,
    concreteType: '3-part' | 'yellow-bags' | 'red-bags' = '3-part'
  ): CalculationResult {
    const materials: MaterialCalculation[] = [];
    const labor: LaborCalculation[] = [];

    // Use defaults if not provided
    const hw = { ...DEFAULT_HARDWARE, ...hardwareMaterials };
    const concrete = { ...DEFAULT_CONCRETE, ...concreteMaterials };

    // 1. POSTS (base calculation)
    const basePosts = this.calculateWoodHorizontalPosts(
      input.netLength,
      product.post_spacing,
      input.numberOfLines
    );

    // 1b. GATE POST ADJUSTMENT
    const gateAdjustment = this.adjustPostsForGates(
      basePosts,
      input.numberOfGates,
      product.post_type
    );

    materials.push({
      material_id: product.post_material.id,
      material_sku: product.post_material.material_sku,
      material_name: product.post_material.material_name,
      quantity: gateAdjustment.adjustedPosts,
      unit_type: product.post_material.unit_type,
      unit_cost: product.post_material.unit_cost,
      category: product.post_material.category,
    });

    // Add steel gate posts if wood fence with gates
    if (gateAdjustment.steelGatePosts > 0 && hardwareMaterials?.steelGatePost) {
      materials.push({
        material_id: hardwareMaterials.steelGatePost.id,
        material_sku: hardwareMaterials.steelGatePost.material_sku,
        material_name: hardwareMaterials.steelGatePost.material_name,
        quantity: gateAdjustment.steelGatePosts,
        unit_type: hardwareMaterials.steelGatePost.unit_type,
        unit_cost: hardwareMaterials.steelGatePost.unit_cost,
        category: hardwareMaterials.steelGatePost.category,
      });
    }

    // 2. HORIZONTAL BOARDS
    const boards = this.calculateHorizontalBoards(
      input.netLength,
      product.height,
      product.board_width_actual,
      product.board_material.length_ft || 8,
      product.style
    );

    materials.push({
      material_id: product.board_material.id,
      material_sku: product.board_material.material_sku,
      material_name: product.board_material.material_name,
      quantity: boards,
      unit_type: product.board_material.unit_type,
      unit_cost: product.board_material.unit_cost,
      category: product.board_material.category,
    });

    // Calculate boardsHigh for nailer calculation
    const boardsHigh = Math.ceil((product.height * 12) / product.board_width_actual);
    const sections = Math.ceil(input.netLength / product.post_spacing);

    // 3. MID NAILERS (2x2 vertical supports between posts)
    if (product.nailer_material) {
      const nailers = this.calculateMidNailers(boardsHigh, sections, product.style);
      materials.push({
        material_id: product.nailer_material.id,
        material_sku: product.nailer_material.material_sku,
        material_name: product.nailer_material.material_name,
        quantity: nailers,
        unit_type: product.nailer_material.unit_type,
        unit_cost: product.nailer_material.unit_cost,
        category: product.nailer_material.category,
      });
    }

    // 4. VERTICAL TRIM BOARDS (covers post faces)
    if (product.vertical_trim_material) {
      const verticalTrimCount = this.calculateVerticalTrimBoards(
        gateAdjustment.adjustedPosts,
        product.style
      );
      if (verticalTrimCount > 0) {
        materials.push({
          material_id: product.vertical_trim_material.id,
          material_sku: product.vertical_trim_material.material_sku,
          material_name: product.vertical_trim_material.material_name,
          quantity: verticalTrimCount,
          unit_type: product.vertical_trim_material.unit_type,
          unit_cost: product.vertical_trim_material.unit_cost,
          category: product.vertical_trim_material.category,
        });
      }
    }

    // 5. STEEL POST EXTRAS
    if (product.post_type === 'STEEL') {
      const totalPosts = gateAdjustment.adjustedPosts;

      // 5a. Brackets for steel posts (top & bottom)
      if (hardwareMaterials?.brackets) {
        const brackets = totalPosts * 2; // Top and bottom brackets
        materials.push({
          material_id: hardwareMaterials.brackets.id,
          material_sku: hardwareMaterials.brackets.material_sku,
          material_name: hardwareMaterials.brackets.material_name,
          quantity: brackets,
          unit_type: hardwareMaterials.brackets.unit_type,
          unit_cost: hardwareMaterials.brackets.unit_cost,
          category: hardwareMaterials.brackets.category,
        });
      }

      // 5b. Post caps
      if (hardwareMaterials?.postCapDome) {
        materials.push({
          material_id: hardwareMaterials.postCapDome.id,
          material_sku: hardwareMaterials.postCapDome.material_sku,
          material_name: hardwareMaterials.postCapDome.material_name,
          quantity: totalPosts,
          unit_type: hardwareMaterials.postCapDome.unit_type,
          unit_cost: hardwareMaterials.postCapDome.unit_cost,
          category: hardwareMaterials.postCapDome.category,
        });
      }
    }

    // 6. LABOR
    const laborCodes = this.getWoodHorizontalLaborCodes(product, input);
    for (const code of laborCodes) {
      const rateRecord = laborRates.find((r) => r.labor_code.labor_sku === code.labor_sku);
      if (rateRecord) {
        labor.push({
          labor_code_id: rateRecord.labor_code.id,
          labor_sku: rateRecord.labor_code.labor_sku,
          description: rateRecord.labor_code.description,
          quantity: code.quantity,
          rate: rateRecord.rate,
          unit_type: rateRecord.labor_code.unit_type,
        });
      }
    }

    // 7. FRAME NAILS (for nailer attachments)
    const totalPosts = gateAdjustment.adjustedPosts;
    const hasCap = !!product.cap_material;
    const nailers = product.nailer_material
      ? this.calculateMidNailers(boardsHigh, sections, product.style)
      : 0;

    if (hw.frameNails) {
      // Raw calculation: nailers × 2 attachment points × 6 nails, + posts × 2 for top/bottom
      let frameNailCount = nailers * 2 * 6 + totalPosts * 2 * 4;
      if (hasCap) frameNailCount += totalPosts * 6;
      const frameNailBoxes = frameNailCount / 28; // RAW - no rounding

      materials.push({
        material_id: hw.frameNails.id,
        material_sku: hw.frameNails.material_sku,
        material_name: hw.frameNails.material_name,
        quantity: frameNailBoxes,
        unit_type: hw.frameNails.unit_type,
        unit_cost: hw.frameNails.unit_cost,
        category: hw.frameNails.category,
      });
    }

    // 8. BOARD NAILS (for horizontal boards)
    if (hw.picketNails) {
      // Raw calculation: boards × 4 nails per board (2 each end)
      const boardNailCount = boards * 4;
      const boardNailCoils = boardNailCount / 300; // RAW - no rounding

      materials.push({
        material_id: hw.picketNails.id,
        material_sku: hw.picketNails.material_sku,
        material_name: hw.picketNails.material_name,
        quantity: boardNailCoils,
        unit_type: hw.picketNails.unit_type,
        unit_cost: hw.picketNails.unit_cost,
        category: hw.picketNails.category,
      });
    }

    // 9. CONCRETE (3-part system)
    if (concreteType === '3-part') {
      if (concrete.cts) {
        materials.push({
          material_id: concrete.cts.id,
          material_sku: concrete.cts.material_sku,
          material_name: concrete.cts.material_name,
          quantity: totalPosts / 10, // RAW - no rounding
          unit_type: concrete.cts.unit_type,
          unit_cost: concrete.cts.unit_cost,
          category: concrete.cts.category,
        });
      }
      if (concrete.ctp) {
        materials.push({
          material_id: concrete.ctp.id,
          material_sku: concrete.ctp.material_sku,
          material_name: concrete.ctp.material_name,
          quantity: totalPosts / 20, // RAW - no rounding
          unit_type: concrete.ctp.unit_type,
          unit_cost: concrete.ctp.unit_cost,
          category: concrete.ctp.category,
        });
      }
      if (concrete.ctq) {
        materials.push({
          material_id: concrete.ctq.id,
          material_sku: concrete.ctq.material_sku,
          material_name: concrete.ctq.material_name,
          quantity: totalPosts * 0.5, // RAW - no rounding
          unit_type: concrete.ctq.unit_type,
          unit_cost: concrete.ctq.unit_cost,
          category: concrete.ctq.category,
        });
      }
    } else if (concreteType === 'yellow-bags' && concrete.cty) {
      materials.push({
        material_id: concrete.cty.id,
        material_sku: concrete.cty.material_sku,
        material_name: concrete.cty.material_name,
        quantity: totalPosts * 0.65, // RAW - no rounding
        unit_type: concrete.cty.unit_type,
        unit_cost: concrete.cty.unit_cost,
        category: concrete.cty.category,
      });
    } else if (concreteType === 'red-bags' && concrete.ctr) {
      materials.push({
        material_id: concrete.ctr.id,
        material_sku: concrete.ctr.material_sku,
        material_name: concrete.ctr.material_name,
        quantity: totalPosts * 1, // RAW - no rounding
        unit_type: concrete.ctr.unit_type,
        unit_cost: concrete.ctr.unit_cost,
        category: concrete.ctr.category,
      });
    }

    return this.aggregateResults(materials, labor);
  }

  // ==========================================================================
  // IRON CALCULATIONS
  // ==========================================================================

  calculateIron(
    product: IronProductWithMaterials,
    input: CalculationInput,
    laborRates: LaborRateWithDetails[],
    hardwareMaterials?: HardwareMaterials,
    concreteMaterials?: ConcreteMaterials,
    concreteType: '3-part' | 'yellow-bags' | 'red-bags' = '3-part'
  ): CalculationResult {
    const materials: MaterialCalculation[] = [];
    const labor: LaborCalculation[] = [];

    // Use defaults if not provided
    const concrete = { ...DEFAULT_CONCRETE, ...concreteMaterials };

    // 1. POSTS (Iron always uses steel posts, gate adjustment adds to count)
    const basePosts = this.calculateIronPosts(
      input.netLength,
      product.panel_width,
      input.numberOfLines
    );

    // Gate adjustment for iron (steel posts): +1 per gate
    const gateAdjustment = this.adjustPostsForGates(basePosts, input.numberOfGates, 'STEEL');

    materials.push({
      material_id: product.post_material.id,
      material_sku: product.post_material.material_sku,
      material_name: product.post_material.material_name,
      quantity: gateAdjustment.adjustedPosts,
      unit_type: product.post_material.unit_type,
      unit_cost: product.post_material.unit_cost,
      category: product.post_material.category,
    });

    // 2. PANELS (if applicable)
    if (product.panel_material) {
      const panels = this.calculateIronPanels(input.netLength, product.panel_width);
      materials.push({
        material_id: product.panel_material.id,
        material_sku: product.panel_material.material_sku,
        material_name: product.panel_material.material_name,
        quantity: panels,
        unit_type: product.panel_material.unit_type,
        unit_cost: product.panel_material.unit_cost,
        category: product.panel_material.category,
      });
    }

    // 3. BRACKETS (if Ameristar/Centurion style)
    if (product.bracket_material && product.style.includes('Ameristar')) {
      const panels = this.calculateIronPanels(input.netLength, product.panel_width);
      const brackets = this.calculateIronBrackets(
        panels,
        product.rails_per_panel || 2,
        product.style
      );
      materials.push({
        material_id: product.bracket_material.id,
        material_sku: product.bracket_material.material_sku,
        material_name: product.bracket_material.material_name,
        quantity: brackets,
        unit_type: product.bracket_material.unit_type,
        unit_cost: product.bracket_material.unit_cost,
        category: product.bracket_material.category,
      });
    }

    // 4. POST CAPS (one per post)
    if (hardwareMaterials?.postCapDome) {
      materials.push({
        material_id: hardwareMaterials.postCapDome.id,
        material_sku: hardwareMaterials.postCapDome.material_sku,
        material_name: hardwareMaterials.postCapDome.material_name,
        quantity: gateAdjustment.adjustedPosts,
        unit_type: hardwareMaterials.postCapDome.unit_type,
        unit_cost: hardwareMaterials.postCapDome.unit_cost,
        category: hardwareMaterials.postCapDome.category,
      });
    }

    // 5. LABOR
    const laborCodes = this.getIronLaborCodes(product, input);
    for (const code of laborCodes) {
      const rateRecord = laborRates.find((r) => r.labor_code.labor_sku === code.labor_sku);
      if (rateRecord) {
        labor.push({
          labor_code_id: rateRecord.labor_code.id,
          labor_sku: rateRecord.labor_code.labor_sku,
          description: rateRecord.labor_code.description,
          quantity: code.quantity,
          rate: rateRecord.rate,
          unit_type: rateRecord.labor_code.unit_type,
        });
      }
    }

    // 6. CONCRETE (3-part system) - Iron doesn't use nails, uses screws/brackets
    const totalPosts = gateAdjustment.adjustedPosts;
    if (concreteType === '3-part') {
      if (concrete.cts) {
        materials.push({
          material_id: concrete.cts.id,
          material_sku: concrete.cts.material_sku,
          material_name: concrete.cts.material_name,
          quantity: totalPosts / 10, // RAW - no rounding
          unit_type: concrete.cts.unit_type,
          unit_cost: concrete.cts.unit_cost,
          category: concrete.cts.category,
        });
      }
      if (concrete.ctp) {
        materials.push({
          material_id: concrete.ctp.id,
          material_sku: concrete.ctp.material_sku,
          material_name: concrete.ctp.material_name,
          quantity: totalPosts / 20, // RAW - no rounding
          unit_type: concrete.ctp.unit_type,
          unit_cost: concrete.ctp.unit_cost,
          category: concrete.ctp.category,
        });
      }
      if (concrete.ctq) {
        materials.push({
          material_id: concrete.ctq.id,
          material_sku: concrete.ctq.material_sku,
          material_name: concrete.ctq.material_name,
          quantity: totalPosts * 0.5, // RAW - no rounding
          unit_type: concrete.ctq.unit_type,
          unit_cost: concrete.ctq.unit_cost,
          category: concrete.ctq.category,
        });
      }
    } else if (concreteType === 'yellow-bags' && concrete.cty) {
      materials.push({
        material_id: concrete.cty.id,
        material_sku: concrete.cty.material_sku,
        material_name: concrete.cty.material_name,
        quantity: totalPosts * 0.65, // RAW - no rounding
        unit_type: concrete.cty.unit_type,
        unit_cost: concrete.cty.unit_cost,
        category: concrete.cty.category,
      });
    } else if (concreteType === 'red-bags' && concrete.ctr) {
      materials.push({
        material_id: concrete.ctr.id,
        material_sku: concrete.ctr.material_sku,
        material_name: concrete.ctr.material_name,
        quantity: totalPosts * 1, // RAW - no rounding
        unit_type: concrete.ctr.unit_type,
        unit_cost: concrete.ctr.unit_cost,
        category: concrete.ctr.category,
      });
    }

    return this.aggregateResults(materials, labor);
  }

  // ==========================================================================
  // CONCRETE CALCULATIONS (Legacy - for backward compatibility)
  // ==========================================================================

  calculateConcrete(
    totalPosts: number,
    concreteType: '3-part' | 'yellow-bags' | 'red-bags',
    concreteMaterials: Material[]
  ): MaterialCalculation[] {
    const materials: MaterialCalculation[] = [];

    if (concreteType === '3-part') {
      // CTS: Sand & Gravel (50lb bags) - 1 bag per 10 posts
      const cts = concreteMaterials.find((m) => m.material_sku === 'CTS');
      if (cts) {
        materials.push({
          material_id: cts.id,
          material_sku: cts.material_sku,
          material_name: cts.material_name,
          quantity: Math.ceil(totalPosts / 10),
          unit_type: cts.unit_type,
          unit_cost: cts.unit_cost,
          category: cts.category,
        });
      }

      // CTP: Portland Cement (94lb bags) - 1 bag per 20 posts
      const ctp = concreteMaterials.find((m) => m.material_sku === 'CTP');
      if (ctp) {
        materials.push({
          material_id: ctp.id,
          material_sku: ctp.material_sku,
          material_name: ctp.material_name,
          quantity: Math.ceil(totalPosts / 20),
          unit_type: ctp.unit_type,
          unit_cost: ctp.unit_cost,
          category: ctp.category,
        });
      }

      // CTQ: QuickRock (50lb bags) - 0.5 bags per post
      const ctq = concreteMaterials.find((m) => m.material_sku === 'CTQ');
      if (ctq) {
        materials.push({
          material_id: ctq.id,
          material_sku: ctq.material_sku,
          material_name: ctq.material_name,
          quantity: Math.ceil(totalPosts * 0.5),
          unit_type: ctq.unit_type,
          unit_cost: ctq.unit_cost,
          category: ctq.category,
        });
      }
    } else if (concreteType === 'yellow-bags') {
      const cty = concreteMaterials.find((m) => m.material_sku === 'CTY');
      if (cty) {
        materials.push({
          material_id: cty.id,
          material_sku: cty.material_sku,
          material_name: cty.material_name,
          quantity: Math.ceil(totalPosts * 0.65),
          unit_type: cty.unit_type,
          unit_cost: cty.unit_cost,
          category: cty.category,
        });
      }
    } else if (concreteType === 'red-bags') {
      const ctr = concreteMaterials.find((m) => m.material_sku === 'CTR');
      if (ctr) {
        materials.push({
          material_id: ctr.id,
          material_sku: ctr.material_sku,
          material_name: ctr.material_name,
          quantity: Math.ceil(totalPosts * 1),
          unit_type: ctr.unit_type,
          unit_cost: ctr.unit_cost,
          category: ctr.category,
        });
      }
    }

    return materials;
  }

  // ==========================================================================
  // NAIL/HARDWARE CALCULATIONS (Project-Level)
  // ==========================================================================

  /**
   * Calculate picket nails needed (PROJECT LEVEL - aggregate first)
   * Formula: coils = ceil((pickets × railsPerSection × 2) / 300) + if trim: trimBoards × 6
   */
  calculatePicketNails(
    totalPickets: number,
    railsPerSection: number,
    totalTrimBoards: number,
    nailMaterial: Material,
    nailsPerCoil: number = 300
  ): MaterialCalculation {
    // Base: pickets × rails × 2 nails per connection
    let totalNails = totalPickets * railsPerSection * 2;

    // If trim: add 6 nails per trim board
    if (totalTrimBoards > 0) {
      totalNails += totalTrimBoards * 6;
    }

    const coils = Math.ceil(totalNails / nailsPerCoil);

    return {
      material_id: nailMaterial.id,
      material_sku: nailMaterial.material_sku,
      material_name: nailMaterial.material_name,
      quantity: coils,
      unit_type: nailMaterial.unit_type,
      unit_cost: nailMaterial.unit_cost,
      category: nailMaterial.category,
    };
  }

  /**
   * Calculate frame nails needed (PROJECT LEVEL - aggregate first)
   * Formula: boxes = ceil((posts × railsPerSection × 4) / 28) + if cap: posts × 6
   */
  calculateFrameNails(
    totalPosts: number,
    railsPerSection: number,
    hasCap: boolean,
    nailMaterial: Material,
    nailsPerBox: number = 28
  ): MaterialCalculation {
    // Base: posts × rails × 4 nails per connection
    let totalNails = totalPosts * railsPerSection * 4;

    // If cap: add 6 nails per post for cap attachment
    if (hasCap) {
      totalNails += totalPosts * 6;
    }

    const boxes = Math.ceil(totalNails / nailsPerBox);

    return {
      material_id: nailMaterial.id,
      material_sku: nailMaterial.material_sku,
      material_name: nailMaterial.material_name,
      quantity: boxes,
      unit_type: nailMaterial.unit_type,
      unit_cost: nailMaterial.unit_cost,
      category: nailMaterial.category,
    };
  }

  /**
   * Calculate board nails for horizontal fences (PROJECT LEVEL)
   * Formula: coils = ceil((boards × 4) / 300)
   */
  calculateBoardNails(
    totalBoards: number,
    nailMaterial: Material,
    nailsPerCoil: number = 300
  ): MaterialCalculation {
    const totalNails = totalBoards * 4;
    const coils = Math.ceil(totalNails / nailsPerCoil);

    return {
      material_id: nailMaterial.id,
      material_sku: nailMaterial.material_sku,
      material_name: nailMaterial.material_name,
      quantity: coils,
      unit_type: nailMaterial.unit_type,
      unit_cost: nailMaterial.unit_cost,
      category: nailMaterial.category,
    };
  }

  /**
   * Calculate structure nails for horizontal fences (PROJECT LEVEL)
   * Formula: boxes = ceil((nailers × 2 × 6) / 28)
   */
  calculateStructureNails(
    totalNailers: number,
    nailMaterial: Material,
    nailsPerBox: number = 28
  ): MaterialCalculation {
    const totalNails = totalNailers * 2 * 6;
    const boxes = Math.ceil(totalNails / nailsPerBox);

    return {
      material_id: nailMaterial.id,
      material_sku: nailMaterial.material_sku,
      material_name: nailMaterial.material_name,
      quantity: boxes,
      unit_type: nailMaterial.unit_type,
      unit_cost: nailMaterial.unit_cost,
      category: nailMaterial.category,
    };
  }

  // ==========================================================================
  // GATE POST ADJUSTMENT LOGIC
  // ==========================================================================

  /**
   * Adjust post counts based on gates
   * - STEEL base posts: +1 steel post per gate (added to existing count)
   * - WOOD base posts: -1 wood post per gate + 2 steel gate posts per gate (separate line)
   */
  private adjustPostsForGates(
    basePosts: number,
    numberOfGates: number,
    postType: PostType
  ): GatePostAdjustment {
    if (numberOfGates === 0) {
      return {
        adjustedPosts: basePosts,
        steelGatePosts: 0,
      };
    }

    if (postType === 'STEEL') {
      // STEEL base posts: +1 steel post per gate (added to existing count)
      return {
        adjustedPosts: basePosts + numberOfGates,
        steelGatePosts: 0,
      };
    } else {
      // WOOD base posts:
      // -1 wood post per gate (replaced by gate posts)
      // +2 steel gate posts per gate (new line item)
      return {
        adjustedPosts: Math.max(0, basePosts - numberOfGates),
        steelGatePosts: numberOfGates * 2,
      };
    }
  }

  // ==========================================================================
  // FORMULA IMPLEMENTATIONS
  // ==========================================================================

  private calculateWoodVerticalPosts(
    netLength: number,
    _style: string,
    postSpacing: number,
    numberOfLines: number
  ): number {
    // Base posts (sections + 1)
    let posts = Math.ceil(netLength / postSpacing) + 1;

    // Add extra posts for multiple lines (every 2 lines need 1 more post)
    if (numberOfLines > 2) {
      const extraPosts = Math.ceil((numberOfLines - 2) / 2);
      posts += extraPosts;
    }

    return posts;
  }

  private calculateWoodVerticalPickets(
    netLength: number,
    style: string,
    picketWidthActual: number
  ): number {
    const lengthInches = netLength * 12;

    // Base calculation with 2.5% waste factor
    let pickets = (lengthInches / picketWidthActual) * 1.025;

    // Style modifiers
    if (style.includes('Good Neighbor')) {
      // FIXED: 11% more for double-sided (was 10%)
      pickets = pickets * 1.11;
    } else if (style.includes('Board-on-Board')) {
      // Formula: (length × 2) / (width × 2 - gap) × waste
      pickets = ((lengthInches * 2) / (picketWidthActual * 2 - 2.5)) * 1.025;
    }

    return pickets;
  }

  private calculateWoodVerticalRails(
    netLength: number,
    railsPerSection: number,
    postSpacing: number
  ): number {
    const sections = Math.ceil(netLength / postSpacing);
    return sections * railsPerSection;
  }

  // FIXED: Added Math.ceil()
  private calculateCap(netLength: number, capLength: number): number {
    return Math.ceil(netLength / capLength);
  }

  // FIXED: Added Math.ceil()
  private calculateTrim(netLength: number, trimLength: number): number {
    return Math.ceil(netLength / trimLength);
  }

  // NEW: Rot board calculation
  private calculateRotBoard(netLength: number, rotBoardLength: number): number {
    return Math.ceil(netLength / rotBoardLength);
  }

  // NEW: Steel post brackets (one per rail per post)
  private calculateSteelPostBrackets(posts: number, railsPerSection: number): number {
    return posts * railsPerSection;
  }

  // NEW: Self-tapping screws (4 per rail)
  private calculateSelfTappingScrews(rails: number): number {
    return rails * 4;
  }

  private calculateWoodHorizontalPosts(
    netLength: number,
    postSpacing: number,
    numberOfLines: number
  ): number {
    let posts = Math.ceil(netLength / postSpacing) + 1;

    if (numberOfLines > 2) {
      posts += Math.ceil((numberOfLines - 2) / 2);
    }

    return posts;
  }

  private calculateHorizontalBoards(
    netLength: number,
    fenceHeight: number,
    boardWidthActual: number,
    boardLength: number,
    style: string
  ): number {
    // Calculate how many boards tall
    const boardsHigh = Math.ceil((fenceHeight * 12) / boardWidthActual);

    // FIXED: Added Math.ceil() - Each row runs the full length
    const boardsPerRow = Math.ceil(netLength / boardLength);

    let totalBoards = boardsHigh * boardsPerRow;

    // Good Neighbor needs double (both sides)
    if (style.includes('Good Neighbor')) {
      totalBoards *= 2;
    }

    return totalBoards;
  }

  // FIXED: Correct nailer formula - (boardsHigh - 1) × sections
  private calculateMidNailers(
    boardsHigh: number,
    sections: number,
    style: string
  ): number {
    if (style.includes('Exposed')) {
      // Exposed style: nailers = posts × 2 (one each side)
      // This is calculated differently, return sections × 2 as approximation
      return sections * 2;
    }
    // Standard and Good Neighbor: nailers = (boardsHigh - 1) × sections
    return (boardsHigh - 1) * sections;
  }

  /**
   * Calculate vertical trim boards for horizontal fences
   * Standard: posts × 1, Good Neighbor: posts × 2, Exposed: 0
   */
  private calculateVerticalTrimBoards(posts: number, style: string): number {
    if (style.includes('Exposed')) {
      return 0; // Not needed for exposed style
    }
    if (style.includes('Good Neighbor')) {
      return posts * 2; // Both sides
    }
    return posts * 1; // Standard: one side
  }

  private calculateIronPosts(
    netLength: number,
    panelWidth: number,
    numberOfLines: number
  ): number {
    let posts = Math.ceil(netLength / panelWidth) + 1;

    if (numberOfLines > 2) {
      posts += Math.ceil((numberOfLines - 2) / 2);
    }

    return posts;
  }

  private calculateIronPanels(netLength: number, panelWidth: number): number {
    return Math.ceil(netLength / panelWidth);
  }

  private calculateIronBrackets(
    panels: number,
    railsPerPanel: number,
    style: string
  ): number {
    if (!style.includes('Ameristar') && !style.includes('Centurion')) {
      return 0;
    }
    return panels * railsPerPanel * 2;
  }

  // ==========================================================================
  // LABOR CODE SELECTION
  // ==========================================================================

  /**
   * Get default rail count based on fence height
   * 6ft fences: 2 rails default
   * 8ft fences: 3 rails default
   */
  private getDefaultRailCount(height: number): number {
    return height <= 6 ? 2 : 3;
  }

  private getWoodVerticalLaborCodes(
    product: WoodVerticalProductWithMaterials,
    input: CalculationInput
  ): Array<{ labor_sku: string; quantity: number }> {
    const codes: Array<{ labor_sku: string; quantity: number }> = [];

    // W02: Set posts (same for wood or steel)
    codes.push({ labor_sku: 'W02', quantity: input.netLength });

    // Height-based nail up (depends on post type!)
    if (product.height <= 6) {
      codes.push({
        labor_sku: product.post_type === 'STEEL' ? 'M03' : 'W03',
        quantity: input.netLength,
      });
    } else {
      codes.push({
        labor_sku: product.post_type === 'STEEL' ? 'M04' : 'W04',
        quantity: input.netLength,
      });
    }

    // Good Neighbor (depends on post type!)
    if (product.style.includes('Good Neighbor')) {
      codes.push({
        labor_sku: product.post_type === 'STEEL' ? 'M06' : 'W06',
        quantity: input.netLength,
      });
    }

    // Cap and/or Trim
    const hasCap = product.cap_material_id !== null;
    const hasTrim = product.trim_material_id !== null;

    if (hasCap && hasTrim) {
      codes.push({
        labor_sku: product.post_type === 'STEEL' ? 'M07' : 'W07',
        quantity: input.netLength,
      });
    } else if (hasCap) {
      codes.push({ labor_sku: 'W09', quantity: input.netLength });
    } else if (hasTrim) {
      codes.push({ labor_sku: 'W08', quantity: input.netLength });
    }

    // NEW: Additional Rail labor (W05) - if rails > default for height
    const defaultRails = this.getDefaultRailCount(product.height);
    if (product.rail_count > defaultRails) {
      codes.push({ labor_sku: 'W05', quantity: input.netLength });
    }

    // Gates - using correct codes per Excel spec
    if (input.numberOfGates > 0) {
      codes.push({
        // W11 for 6ft gates, W12 for 8ft gates (per Excel Labor Codes sheet)
        labor_sku: product.height <= 6 ? 'W11' : 'W12',
        quantity: input.numberOfGates,
      });
    }

    return codes;
  }

  private getWoodHorizontalLaborCodes(
    product: WoodHorizontalProductWithMaterials,
    input: CalculationInput
  ): Array<{ labor_sku: string; quantity: number }> {
    const codes: Array<{ labor_sku: string; quantity: number }> = [];

    // W12: Set posts (6' OC for horizontal)
    codes.push({ labor_sku: 'W12', quantity: input.netLength });

    // W13: Nail up horizontal boards
    codes.push({ labor_sku: 'W13', quantity: input.netLength });

    // Good Neighbor style modifier
    if (product.style.includes('Good Neighbor')) {
      codes.push({
        labor_sku: product.post_type === 'STEEL' ? 'M06' : 'W06',
        quantity: input.netLength,
      });
    }

    // Gates
    if (input.numberOfGates > 0) {
      codes.push({ labor_sku: 'W15', quantity: input.numberOfGates });
    }

    return codes;
  }

  private getIronLaborCodes(
    product: IronProductWithMaterials,
    input: CalculationInput
  ): Array<{ labor_sku: string; quantity: number }> {
    const codes: Array<{ labor_sku: string; quantity: number }> = [];

    // IR01: Set posts
    codes.push({ labor_sku: 'IR01', quantity: input.netLength });

    // Style-specific installation
    if (product.style.includes('Standard 2 Rail')) {
      codes.push({ labor_sku: 'IR02', quantity: input.netLength });
    } else if (product.style.includes('Ameristar')) {
      codes.push({ labor_sku: 'IR06', quantity: input.netLength });
    } else if (product.style.includes('Iron Rail')) {
      codes.push({ labor_sku: 'IR04', quantity: input.netLength });
    }

    // Gates
    if (input.numberOfGates > 0) {
      codes.push({ labor_sku: 'IR07', quantity: input.numberOfGates });
    }

    return codes;
  }

  // ==========================================================================
  // AGGREGATION
  // ==========================================================================

  private aggregateResults(
    materials: MaterialCalculation[],
    labor: LaborCalculation[]
  ): CalculationResult {
    const totalMaterialCost = materials.reduce(
      (sum, m) => sum + m.quantity * m.unit_cost,
      0
    );
    const totalLaborCost = labor.reduce((sum, l) => sum + l.quantity * l.rate, 0);

    return {
      materials,
      labor,
      totalMaterialCost,
      totalLaborCost,
      totalCost: totalMaterialCost + totalLaborCost,
    };
  }
}
