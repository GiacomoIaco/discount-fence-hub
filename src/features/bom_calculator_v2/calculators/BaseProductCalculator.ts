/**
 * BaseProductCalculator
 *
 * Abstract base class for all product type calculators.
 * Provides common functionality and defines the interface that
 * concrete calculators must implement.
 */

import type {
  CalculationInput,
  CalculationContext,
  CalculationResult,
  MaterialCalculation,
  LaborCalculation,
  ProductSKUWithDetails,
  FormulaParameter,
  ProductLaborRuleWithDetails,
} from '../types';
import { supabase } from '../../../lib/supabase';

export abstract class BaseProductCalculator {
  protected productTypeCode: string;

  constructor(productTypeCode: string) {
    this.productTypeCode = productTypeCode;
  }

  /**
   * Main entry point for calculations
   */
  async calculate(
    sku: ProductSKUWithDetails,
    input: CalculationInput
  ): Promise<CalculationResult> {
    // 1. Load parameters from database
    const parameters = await this.loadParameters(sku);

    // 2. Build context with all necessary data
    const context = this.buildContext(sku, input, parameters);

    // 3. Calculate materials (implemented by subclass)
    const materials = this.calculateMaterials(context);

    // 4. Calculate labor
    const labor = await this.calculateLabor(context);

    // 5. Aggregate results
    return this.aggregateResults(materials, labor, context);
  }

  /**
   * Load formula parameters from database
   * Merges global -> type -> style -> component specific parameters
   */
  protected async loadParameters(sku: ProductSKUWithDetails): Promise<Map<string, number>> {
    const params = new Map<string, number>();

    const { data: dbParams } = await supabase
      .from('formula_parameters')
      .select('*')
      .or(`product_type_id.is.null,product_type_id.eq.${sku.product_type_id}`)
      .order('product_type_id', { ascending: true, nullsFirst: true })
      .order('product_style_id', { ascending: true, nullsFirst: true })
      .order('component_id', { ascending: true, nullsFirst: true });

    if (dbParams) {
      for (const param of dbParams as FormulaParameter[]) {
        // Only include if it matches our style (or is null/global)
        if (param.product_style_id === null || param.product_style_id === sku.product_style_id) {
          params.set(param.parameter_key, param.parameter_value);
        }
      }
    }

    return params;
  }

  /**
   * Build calculation context from SKU and input
   */
  protected buildContext(
    sku: ProductSKUWithDetails,
    input: CalculationInput,
    parameters: Map<string, number>
  ): CalculationContext {
    // Build component materials map
    const componentMaterials = new Map<string, {
      material_id: string;
      material_sku: string;
      actual_width: number | null;
      length_ft: number | null;
      unit_cost: number;
    }>();

    for (const comp of sku.components) {
      componentMaterials.set(comp.component.code, {
        material_id: comp.material.id,
        material_sku: comp.material.material_sku,
        actual_width: comp.material.actual_width,
        length_ft: comp.material.length_ft,
        unit_cost: comp.material.unit_cost,
      });
    }

    return {
      sku,
      input,
      parameters,
      componentMaterials,
    };
  }

  /**
   * Abstract method - each product type implements its own material calculations
   */
  protected abstract calculateMaterials(context: CalculationContext): MaterialCalculation[];

  /**
   * Calculate labor based on product_labor_rules
   */
  protected async calculateLabor(context: CalculationContext): Promise<LaborCalculation[]> {
    const labor: LaborCalculation[] = [];
    const { sku, input } = context;

    // Load labor rules for this product type and style
    const { data: rules } = await supabase
      .from('product_labor_rules')
      .select(`
        *,
        labor_code:labor_codes(id, labor_sku, description, unit_type)
      `)
      .eq('product_type_id', sku.product_type_id)
      .eq('is_active', true)
      .or(`product_style_id.is.null,product_style_id.eq.${sku.product_style_id}`)
      .order('priority', { ascending: false });

    if (!rules) return labor;

    // Load labor rates for the business unit
    const { data: rates } = await supabase
      .from('labor_rates')
      .select('labor_code_id, rate')
      .eq('business_unit_id', input.businessUnitId);

    const rateMap = new Map<string, number>();
    if (rates) {
      for (const r of rates) {
        rateMap.set(r.labor_code_id, r.rate);
      }
    }

    // Evaluate each rule
    for (const rule of rules as ProductLaborRuleWithDetails[]) {
      if (this.evaluateLaborCondition(rule.condition_json, context)) {
        const quantity = this.calculateLaborQuantity(rule.quantity_formula, context);
        const rate = rateMap.get(rule.labor_code_id) || 0;

        if (quantity > 0 && rate > 0) {
          labor.push({
            labor_code_id: rule.labor_code_id,
            labor_sku: rule.labor_code.labor_sku,
            description: rule.labor_code.description,
            quantity,
            rate,
            unit_type: rule.labor_code.unit_type,
          });
        }
      }
    }

    return labor;
  }

  /**
   * Evaluate labor rule condition against context
   */
  protected evaluateLaborCondition(
    condition: Record<string, unknown>,
    context: CalculationContext
  ): boolean {
    const { sku, input } = context;

    for (const [key, value] of Object.entries(condition)) {
      switch (key) {
        case 'height':
          if (!this.evaluateNumericCondition(sku.height, value)) return false;
          break;
        case 'post_type':
          if (sku.post_type !== value) return false;
          break;
        case 'gates':
          if (!this.evaluateNumericCondition(input.numberOfGates, value)) return false;
          break;
        case 'has_component':
          // Check if SKU has all specified components
          if (Array.isArray(value)) {
            for (const compCode of value) {
              if (!context.componentMaterials.has(compCode as string)) return false;
            }
          }
          break;
        case 'not_has_component':
          // Check if SKU does NOT have specified components
          if (Array.isArray(value)) {
            for (const compCode of value) {
              if (context.componentMaterials.has(compCode as string)) return false;
            }
          }
          break;
      }
    }

    return true;
  }

  /**
   * Evaluate numeric conditions like {min: 7}, {max: 6}, {">": 0}
   */
  protected evaluateNumericCondition(actual: number, condition: unknown): boolean {
    if (typeof condition === 'number') {
      return actual === condition;
    }

    if (typeof condition === 'object' && condition !== null) {
      const cond = condition as Record<string, number>;
      if ('min' in cond && actual < cond.min) return false;
      if ('max' in cond && actual > cond.max) return false;
      if ('>' in cond && actual <= cond['>']) return false;
      if ('>=' in cond && actual < cond['>=']) return false;
      if ('<' in cond && actual >= cond['<']) return false;
      if ('<=' in cond && actual > cond['<=']) return false;
    }

    return true;
  }

  /**
   * Calculate labor quantity based on formula string
   */
  protected calculateLaborQuantity(formula: string, context: CalculationContext): number {
    const { input } = context;

    switch (formula) {
      case 'net_length':
        return input.netLength;
      case 'gates':
        return input.numberOfGates;
      case 'posts':
        // This would need to be passed from material calculations
        // For now, we'll recalculate
        return this.getPostCount(context);
      default:
        // Try to evaluate simple expressions
        if (formula.includes('gates')) {
          return input.numberOfGates;
        }
        return input.netLength;
    }
  }

  /**
   * Get post count - can be overridden by subclass if needed
   */
  protected getPostCount(context: CalculationContext): number {
    const { sku, input } = context;
    const spacing = sku.post_spacing ||
      context.parameters.get('post_spacing') ||
      sku.product_type.default_post_spacing ||
      8;

    let posts = Math.ceil(input.netLength / spacing) + 1;

    if (input.numberOfLines > 2) {
      posts += Math.ceil((input.numberOfLines - 2) / 2);
    }

    return posts;
  }

  /**
   * Aggregate materials and labor into final result
   */
  protected aggregateResults(
    materials: MaterialCalculation[],
    labor: LaborCalculation[],
    context: CalculationContext
  ): CalculationResult {
    const totalMaterialCost = materials.reduce(
      (sum, m) => sum + m.quantity * m.unit_cost,
      0
    );

    const totalLaborCost = labor.reduce(
      (sum, l) => sum + l.quantity * l.rate,
      0
    );

    return {
      materials,
      labor,
      totalMaterialCost,
      totalLaborCost,
      totalCost: totalMaterialCost + totalLaborCost,
      debug: {
        posts: this.getPostCount(context),
        sections: Math.ceil(context.input.netLength / (context.sku.post_spacing || 8)),
        parameters: Object.fromEntries(context.parameters),
      },
    };
  }

  /**
   * Helper to create a material calculation entry
   */
  protected createMaterialEntry(
    componentCode: string,
    componentName: string,
    quantity: number,
    context: CalculationContext
  ): MaterialCalculation | null {
    const material = context.componentMaterials.get(componentCode);
    if (!material) return null;

    // Find component definition for unit type
    const component = context.sku.components.find(
      c => c.component.code === componentCode
    );

    return {
      component_code: componentCode,
      component_name: componentName,
      material_id: material.material_id,
      material_sku: material.material_sku,
      material_name: component?.material.material_name || material.material_sku,
      quantity,
      unit_type: component?.component.unit_type || 'Each',
      unit_cost: material.unit_cost,
    };
  }
}
