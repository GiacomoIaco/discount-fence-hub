/**
 * FenceCalculator - Unified calculation engine for BOM/BOL
 *
 * Implements all formulas from 02-BUSINESS_LOGIC.md
 * Supports two calculation contexts:
 * 1. SKU Builder: Calculate standard cost for single SKU (rounds immediately)
 * 2. Project: Multi-SKU estimates with project-level aggregation (round once)
 */

import type {
  WoodVerticalProductWithMaterials,
  WoodHorizontalProductWithMaterials,
  IronProductWithMaterials,
  Material,
  LaborRateWithDetails,
} from '../database.types';

// ============================================================================
// TYPES
// ============================================================================

export interface CalculationInput {
  netLength: number; // feet
  numberOfLines: number; // 1-5
  numberOfGates: number; // 0-3
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

// ============================================================================
// FENCE CALCULATOR CLASS
// ============================================================================

export class FenceCalculator {

  constructor(_mode: CalculatorMode = 'project') {
  }

  // ==========================================================================
  // WOOD VERTICAL CALCULATIONS
  // ==========================================================================

  calculateWoodVertical(
    product: WoodVerticalProductWithMaterials,
    input: CalculationInput,
    laborRates: LaborRateWithDetails[]
  ): CalculationResult {
    const materials: MaterialCalculation[] = [];
    const labor: LaborCalculation[] = [];

    // 1. POSTS
    const posts = this.calculateWoodVerticalPosts(
      input.netLength,
      product.style,
      product.post_spacing,
      input.numberOfLines
    );

    materials.push({
      material_id: product.post_material.id,
      material_sku: product.post_material.material_sku,
      material_name: product.post_material.material_name,
      quantity: posts,
      unit_type: product.post_material.unit_type,
      unit_cost: product.post_material.unit_cost,
      category: product.post_material.category,
    });

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
    if (product.cap_material) {
      const caps = this.calculateCap(input.netLength, product.cap_material.length_ft || 8);
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
    if (product.trim_material) {
      const trims = this.calculateTrim(input.netLength, product.trim_material.length_ft || 8);
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

    // 6. LABOR
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

    return this.aggregateResults(materials, labor);
  }

  // ==========================================================================
  // WOOD HORIZONTAL CALCULATIONS
  // ==========================================================================

  calculateWoodHorizontal(
    product: WoodHorizontalProductWithMaterials,
    input: CalculationInput,
    laborRates: LaborRateWithDetails[]
  ): CalculationResult {
    const materials: MaterialCalculation[] = [];
    const labor: LaborCalculation[] = [];

    // 1. POSTS
    const posts = this.calculateWoodHorizontalPosts(
      input.netLength,
      product.post_spacing,
      input.numberOfLines
    );

    materials.push({
      material_id: product.post_material.id,
      material_sku: product.post_material.material_sku,
      material_name: product.post_material.material_name,
      quantity: posts,
      unit_type: product.post_material.unit_type,
      unit_cost: product.post_material.unit_cost,
      category: product.post_material.category,
    });

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

    // 3. NAILERS (if present)
    if (product.nailer_material) {
      const nailers = this.calculateNailers(input.netLength, product.post_spacing);
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

    // 4. LABOR
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

    return this.aggregateResults(materials, labor);
  }

  // ==========================================================================
  // IRON CALCULATIONS
  // ==========================================================================

  calculateIron(
    product: IronProductWithMaterials,
    input: CalculationInput,
    laborRates: LaborRateWithDetails[]
  ): CalculationResult {
    const materials: MaterialCalculation[] = [];
    const labor: LaborCalculation[] = [];

    // 1. POSTS
    const posts = this.calculateIronPosts(
      input.netLength,
      product.panel_width,
      input.numberOfLines
    );

    materials.push({
      material_id: product.post_material.id,
      material_sku: product.post_material.material_sku,
      material_name: product.post_material.material_name,
      quantity: posts,
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

    // 4. LABOR
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

    return this.aggregateResults(materials, labor);
  }

  // ==========================================================================
  // CONCRETE CALCULATIONS (Project-Level)
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
          quantity: totalPosts * 0.5,
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
          quantity: totalPosts * 1,
          unit_type: ctr.unit_type,
          unit_cost: ctr.unit_cost,
          category: ctr.category,
        });
      }
    }

    return materials;
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
      pickets = pickets * 1.1; // 10% more for double-sided
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

  private calculateCap(netLength: number, capLength: number): number {
    return netLength / capLength;
  }

  private calculateTrim(netLength: number, trimLength: number): number {
    return netLength / trimLength;
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

    // Each row runs the full length
    const boardsPerRow = netLength / boardLength;

    let totalBoards = boardsHigh * boardsPerRow;

    // Good Neighbor needs double (both sides)
    if (style.includes('Good Neighbor')) {
      totalBoards *= 2;
    }

    return totalBoards;
  }

  private calculateNailers(netLength: number, postSpacing: number): number {
    const sections = Math.ceil(netLength / postSpacing);
    return sections;
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
    return netLength / panelWidth;
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

    // Gates
    if (input.numberOfGates > 0) {
      codes.push({
        labor_sku: product.height <= 6 ? 'W10' : 'W11',
        quantity: input.numberOfGates,
      });
    }

    return codes;
  }

  private getWoodHorizontalLaborCodes(
    _product: WoodHorizontalProductWithMaterials,
    input: CalculationInput
  ): Array<{ labor_sku: string; quantity: number }> {
    const codes: Array<{ labor_sku: string; quantity: number }> = [];

    // W12: Set posts (6" OC for horizontal)
    codes.push({ labor_sku: 'W12', quantity: input.netLength });

    // W13: Nail up horizontal boards
    codes.push({ labor_sku: 'W13', quantity: input.netLength });

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
