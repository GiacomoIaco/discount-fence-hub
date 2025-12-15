/**
 * FormulaInterpreter - Database-Driven Formula Execution Engine
 *
 * Replaces hardcoded FenceCalculator.ts (1,575 lines) with database-stored
 * executable formula strings (~200 lines interpreter + ~40 formula rows).
 *
 * Supports:
 * - Functions: ROUNDUP, ROUND, ROUNDDOWN, MAX, MIN, IF
 * - Project inputs: [Quantity], [Lines], [Gates]
 * - SKU variables: [rail_count], [post_spacing], [height]
 * - Material attributes: [picket.width_inches], [cap.length_feet]
 * - Style adjustments: [picket_multiplier] from formula_adjustments JSONB
 * - Calculated values: [post_qty], [picket_qty], [rail_qty] from previous formulas (use _qty suffix)
 *
 * O-026 Implementation
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface FormulaContext {
  // Project inputs
  Quantity: number;      // Net length in feet
  Lines: number;         // Number of fence lines (1-5)
  Gates: number;         // Number of gates (0-3)
  height: number;        // Fence height in feet

  // SKU variables (from sku_catalog_v2.variables JSONB)
  variables: Record<string, number | string>;

  // Style adjustments (from product_styles_v2.formula_adjustments JSONB)
  styleAdjustments: Record<string, number | string>;

  // Material attributes (from materials table)
  // Keyed by component.attribute (e.g., 'picket.width_inches')
  materialAttributes: Record<string, number>;

  // Calculated values from previous formulas
  // e.g., { post_qty: 13, picket_qty: 200, rail_qty: 26 }
  calculatedValues: Record<string, number>;
}

export interface FormulaTemplate {
  id: string;
  product_type_id: string;
  product_style_id: string | null;
  component_type_id: string;
  component_code: string;
  formula: string;
  rounding_level: 'sku' | 'project' | 'none';
  plain_english: string | null;
  priority: number;
}

export interface FormulaResult {
  component_code: string;
  component_name: string;
  raw_value: number;
  rounded_value: number;
  rounding_level: 'sku' | 'project' | 'none';
  formula_used: string;
}

// ============================================================================
// FORMULA INTERPRETER CLASS
// ============================================================================

export class FormulaInterpreter {
  private supabase: SupabaseClient;
  private formulaCache: Map<string, FormulaTemplate[]> = new Map();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Load formula templates for a product type/style
   */
  async loadFormulas(productTypeId: string, productStyleId: string | null): Promise<FormulaTemplate[]> {
    const cacheKey = `${productTypeId}:${productStyleId || 'all'}`;

    if (this.formulaCache.has(cacheKey)) {
      return this.formulaCache.get(cacheKey)!;
    }

    const { data, error } = await this.supabase
      .from('formula_templates_v2')
      .select(`
        *,
        component_type:component_types_v2(code, name)
      `)
      .eq('product_type_id', productTypeId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('[FormulaInterpreter] Error loading formulas:', error);
      return [];
    }

    // Filter to most specific formula per component (style-specific wins over generic)
    const formulas: FormulaTemplate[] = [];
    const seenComponents = new Set<string>();

    for (const row of data || []) {
      const componentCode = row.component_type?.code;
      if (!componentCode) continue;

      // Skip if we already have a style-specific formula for this component
      if (seenComponents.has(componentCode)) continue;

      // Only include if: matches style OR is generic (null style)
      if (row.product_style_id === productStyleId || row.product_style_id === null) {
        // Prefer style-specific over generic
        if (row.product_style_id === productStyleId) {
          seenComponents.add(componentCode);
        }

        formulas.push({
          id: row.id,
          product_type_id: row.product_type_id,
          product_style_id: row.product_style_id,
          component_type_id: row.component_type_id,
          component_code: componentCode,
          formula: row.formula,
          rounding_level: row.rounding_level,
          plain_english: row.plain_english,
          priority: row.priority,
        });
      }
    }

    // Dedupe: keep only highest priority per component
    const deduped = new Map<string, FormulaTemplate>();
    for (const f of formulas) {
      const existing = deduped.get(f.component_code);
      if (!existing || f.priority > existing.priority ||
          (f.priority === existing.priority && f.product_style_id !== null)) {
        deduped.set(f.component_code, f);
      }
    }

    const result = Array.from(deduped.values());
    this.formulaCache.set(cacheKey, result);
    return result;
  }

  /**
   * Execute a single formula string with context
   */
  executeFormula(formula: string, context: FormulaContext): number {
    try {
      // Replace variables with values
      let expr = formula;

      // Replace [VarName] patterns with actual values
      // Handle both numeric and string comparisons
      expr = expr.replace(/\[([^\]]+)\]/g, (_match, varName) => {
        const value = this.resolveVariable(varName, context);
        // For string values, wrap in quotes for proper comparison
        if (typeof value === 'string') {
          return `"${value}"`;
        }
        return String(value);
      });

      // Handle IF(condition, trueVal, falseVal) - must be done BEFORE other function replacements
      // Convert Excel-style IF to JavaScript ternary operator
      expr = this.convertIfStatements(expr);

      // Replace function names with JavaScript equivalents
      expr = expr.replace(/ROUNDUP/gi, 'Math.ceil');
      expr = expr.replace(/ROUNDDOWN/gi, 'Math.floor');
      expr = expr.replace(/ROUND(?!UP|DOWN)/gi, 'Math.round');
      expr = expr.replace(/MAX/gi, 'Math.max');
      expr = expr.replace(/MIN/gi, 'Math.min');

      // Evaluate the expression
      // Using Function constructor for safe(r) eval
      const fn = new Function(`return ${expr}`);
      const result = fn();

      return typeof result === 'number' && isFinite(result) ? result : 0;
    } catch (err) {
      console.error('[FormulaInterpreter] Formula error:', formula, err);
      return 0;
    }
  }

  /**
   * Convert Excel-style IF(condition, trueVal, falseVal) to JavaScript ternary
   * Handles nested IF statements
   */
  private convertIfStatements(expr: string): string {
    // Pattern to match IF( with balanced parentheses
    const ifPattern = /IF\s*\(/gi;
    let result = expr;
    let match;
    let iterations = 0;
    const maxIterations = 20; // Prevent infinite loops

    while ((match = ifPattern.exec(result)) !== null && iterations < maxIterations) {
      iterations++;
      const startIdx = match.index;
      const argsStart = startIdx + match[0].length;

      // Find the matching closing parenthesis
      let depth = 1;
      let pos = argsStart;
      while (pos < result.length && depth > 0) {
        if (result[pos] === '(') depth++;
        else if (result[pos] === ')') depth--;
        pos++;
      }

      if (depth !== 0) {
        console.warn('[FormulaInterpreter] Unbalanced parentheses in IF statement');
        break;
      }

      const argsEnd = pos - 1;
      const argsStr = result.substring(argsStart, argsEnd);

      // Split by comma, respecting nested parentheses
      const args = this.splitIfArgs(argsStr);

      if (args.length >= 3) {
        const condition = args[0].trim();
        const trueVal = args[1].trim();
        const falseVal = args[2].trim();

        // Convert to ternary: (condition ? trueVal : falseVal)
        const ternary = `(${condition} ? ${trueVal} : ${falseVal})`;

        // Replace the IF(...) with the ternary
        result = result.substring(0, startIdx) + ternary + result.substring(pos);

        // Reset pattern to find nested IFs
        ifPattern.lastIndex = 0;
      } else {
        console.warn('[FormulaInterpreter] IF statement with < 3 args:', argsStr);
        break;
      }
    }

    return result;
  }

  /**
   * Split IF arguments by comma, respecting nested parentheses
   */
  private splitIfArgs(argsStr: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        args.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    if (current) {
      args.push(current);
    }

    return args;
  }

  /**
   * Resolve a variable name to its value
   * Returns string for string variables (like post_type), number otherwise
   */
  private resolveVariable(varName: string, context: FormulaContext): number | string {
    // Project inputs (always numeric)
    if (varName === 'Quantity') return context.Quantity;
    if (varName === 'Lines') return context.Lines;
    if (varName === 'Gates') return context.Gates;
    if (varName === 'height') return context.height;

    // Calculated values (from previous formulas - always numeric)
    if (varName in context.calculatedValues) {
      return context.calculatedValues[varName];
    }

    // Style adjustments - can be string or number
    if (varName in context.styleAdjustments) {
      const val = context.styleAdjustments[varName];
      // Keep strings as strings for comparisons
      if (typeof val === 'string' && isNaN(Number(val))) {
        return val;
      }
      return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
    }

    // SKU variables - can be string or number
    if (varName in context.variables) {
      const val = context.variables[varName];
      // Keep strings as strings for comparisons (like post_type, style)
      if (typeof val === 'string' && isNaN(Number(val))) {
        return val;
      }
      return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
    }

    // Material attributes (component.attribute format - always numeric)
    if (varName.includes('.')) {
      if (varName in context.materialAttributes) {
        return context.materialAttributes[varName];
      }
      // Try lowercase
      const lower = varName.toLowerCase();
      if (lower in context.materialAttributes) {
        return context.materialAttributes[lower];
      }
    }

    console.warn(`[FormulaInterpreter] Unknown variable: ${varName}`);
    return 0;
  }

  /**
   * Execute all formulas for a SKU, building up calculated values
   */
  async executeAllFormulas(
    productTypeId: string,
    productStyleId: string | null,
    context: FormulaContext,
    componentFilter?: string[]
  ): Promise<FormulaResult[]> {
    const formulas = await this.loadFormulas(productTypeId, productStyleId);
    const results: FormulaResult[] = [];

    // Define execution order (dependencies first)
    const executionOrder = [
      'post',           // Posts first (many depend on post_qty)
      'picket',         // Pickets
      'rail',           // Rails
      'bracket',        // Brackets (depend on post_qty + rail_qty)
      'cap',            // Cap
      'trim',           // Trim
      'rot_board',      // Rot board
      'steel_post_cap', // Steel post cap
      'board',          // Horizontal boards
      'nailer',         // Nailers
      'vertical_trim',  // Vertical trim
      'panel',          // Iron panels
      'iron_post_cap',  // Iron post caps
      'nails_picket',   // Picket nails (depend on picket_qty)
      'nails_frame',    // Frame nails
      'concrete_sand',  // Concrete (depend on post_qty)
      'concrete_portland',
      'concrete_quickrock',
    ];

    // Sort formulas by execution order
    const sortedFormulas = [...formulas].sort((a, b) => {
      const aIdx = executionOrder.indexOf(a.component_code);
      const bIdx = executionOrder.indexOf(b.component_code);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    for (const formula of sortedFormulas) {
      // Skip if not in filter
      if (componentFilter && !componentFilter.includes(formula.component_code)) {
        continue;
      }

      const rawValue = this.executeFormula(formula.formula, context);

      // Apply SKU-level rounding if needed
      const roundedValue = formula.rounding_level === 'sku'
        ? Math.ceil(rawValue)
        : rawValue;

      // Store in calculated values for subsequent formulas
      // Use _qty suffix to avoid collision with input variables (e.g., rail_count)
      context.calculatedValues[`${formula.component_code}_qty`] = roundedValue;

      results.push({
        component_code: formula.component_code,
        component_name: formula.component_code, // Will be enriched by caller
        raw_value: rawValue,
        rounded_value: roundedValue,
        rounding_level: formula.rounding_level,
        formula_used: formula.formula,
      });
    }

    return results;
  }

  /**
   * Clear the formula cache
   */
  clearCache() {
    this.formulaCache.clear();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build material attributes from SKU components JSONB
 * @param supabase Supabase client
 * @param components JSONB like {"post": "PS13", "picket": "P601"}
 */
export async function buildMaterialAttributes(
  supabase: SupabaseClient,
  components: Record<string, string>
): Promise<Record<string, number>> {
  const materialCodes = Object.values(components).filter(Boolean);

  if (materialCodes.length === 0) return {};

  const { data: materials, error } = await supabase
    .from('materials')
    .select('material_sku, width_inches, length_feet, qty_per_unit, actual_width, length_ft')
    .in('material_sku', materialCodes);

  if (error || !materials) {
    console.error('[FormulaInterpreter] Error fetching materials:', error);
    return {};
  }

  const attrs: Record<string, number> = {};

  for (const [componentCode, materialCode] of Object.entries(components)) {
    const mat = materials.find(m => m.material_sku === materialCode);
    if (!mat) continue;

    // Map to formula variable names
    if (mat.width_inches) {
      attrs[`${componentCode}.width_inches`] = mat.width_inches;
    } else if (mat.actual_width) {
      // Fallback to actual_width if width_inches not set
      attrs[`${componentCode}.width_inches`] = mat.actual_width;
    }

    if (mat.length_feet) {
      attrs[`${componentCode}.length_feet`] = mat.length_feet;
    } else if (mat.length_ft) {
      // Fallback to length_ft
      attrs[`${componentCode}.length_feet`] = mat.length_ft;
    }

    if (mat.qty_per_unit) {
      attrs[`${componentCode}.qty_per_unit`] = mat.qty_per_unit;
    }
  }

  return attrs;
}

/**
 * Create a formula context from inputs
 */
export function createFormulaContext(
  netLength: number,
  numberOfLines: number,
  numberOfGates: number,
  height: number,
  skuVariables: Record<string, number | string>,
  styleAdjustments: Record<string, number | string>,
  materialAttributes: Record<string, number>
): FormulaContext {
  return {
    Quantity: netLength,
    Lines: numberOfLines,
    Gates: numberOfGates,
    height,
    variables: skuVariables,
    styleAdjustments,
    materialAttributes,
    calculatedValues: {},
  };
}

/**
 * Apply project-level rounding to results
 * Aggregates items with rounding_level='project' and rounds at the end
 */
export function applyProjectRounding(results: FormulaResult[]): FormulaResult[] {
  return results.map(r => {
    if (r.rounding_level === 'project') {
      return {
        ...r,
        rounded_value: Math.ceil(r.raw_value),
      };
    }
    return r;
  });
}
