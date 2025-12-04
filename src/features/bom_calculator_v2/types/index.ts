/**
 * BOM Calculator v2 - Type Definitions
 * Smart Hybrid Architecture
 */

// ============================================================================
// DATABASE TYPES (match schema exactly)
// ============================================================================

export interface ProductType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  default_post_spacing: number | null;
  calculator_class: string;
  display_order: number;
  is_active: boolean;
  has_calculator?: boolean;  // Computed field based on calculator registry
  created_at: string;
  updated_at: string;
}

export interface ProductStyle {
  id: string;
  product_type_id: string;
  code: string;
  name: string;
  description: string | null;
  default_components: Record<string, boolean> | null;  // Optional default component settings
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComponentDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category?: string;           // For grouping (e.g., 'primary', 'optional', 'accessory')
  calculation_type?: string;   // 'formula', 'lookup', 'fixed'
  unit_type: string;
  display_order: number;
  created_at: string;
}

export interface ProductTypeComponent {
  id: string;
  product_type_id: string;
  component_id: string;
  is_required: boolean;
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface FormulaParameter {
  id: string;
  product_type_id: string | null;
  product_style_id: string | null;
  component_id: string | null;
  parameter_key: string;
  parameter_value: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComponentFormula {
  id: string;
  product_type_id: string;
  product_style_id: string | null;
  component_id: string;
  plain_english: string;
  formula_text: string | null;
  variables_used: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductRule {
  id: string;
  product_type_id: string | null;
  product_style_id: string | null;
  rule_type: 'constraint' | 'material_match' | 'conditional_component' | 'derived_value';
  name: string;
  plain_english: string;
  condition_json: Record<string, unknown>;
  action_json: Record<string, unknown>;
  error_message: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductLaborRule {
  id: string;
  product_type_id: string;
  product_style_id: string | null;
  labor_code_id: string;
  name: string;
  plain_english: string;
  condition_json: Record<string, unknown>;
  quantity_formula: string;
  is_base_labor: boolean;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductSKU {
  id: string;
  sku_code: string;
  sku_name: string;
  product_type_id: string;
  product_style_id: string;
  height: number;
  post_type: 'WOOD' | 'STEEL';
  post_spacing: number | null;
  config_json: Record<string, unknown>;
  standard_material_cost: number | null;
  standard_labor_cost: number | null;
  standard_cost_per_foot: number | null;
  standard_cost_calculated_at: string | null;
  product_description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SKUComponent {
  id: string;
  sku_id: string;
  component_id: string;
  material_id: string;
  created_at: string;
}

// ============================================================================
// JOINED/ENRICHED TYPES
// ============================================================================

export interface ProductTypeWithStyles extends ProductType {
  styles: ProductStyle[];
}

export interface ProductTypeWithComponents extends ProductType {
  components: (ProductTypeComponent & { component: ComponentDefinition })[];
}

export interface ProductSKUWithDetails extends ProductSKU {
  product_type: ProductType;
  product_style: ProductStyle;
  components: (SKUComponent & {
    component: ComponentDefinition;
    material: {
      id: string;
      material_sku: string;
      material_name: string;
      unit_cost: number;
      actual_width: number | null;
      length_ft: number | null;
    };
  })[];
}

export interface ProductLaborRuleWithDetails extends ProductLaborRule {
  labor_code: {
    id: string;
    labor_sku: string;
    description: string;
    unit_type: string;
  };
}

// ============================================================================
// CALCULATOR TYPES
// ============================================================================

export interface CalculationInput {
  netLength: number;          // feet
  numberOfLines: number;      // 1-5
  numberOfGates: number;      // 0-3
  businessUnitId: string;     // for labor rates
}

export interface CalculationContext {
  sku: ProductSKUWithDetails;
  input: CalculationInput;
  parameters: Map<string, number>;  // parameter_key -> value
  componentMaterials: Map<string, {
    material_id: string;
    material_sku: string;
    actual_width: number | null;
    length_ft: number | null;
    unit_cost: number;
  }>;
}

export interface MaterialCalculation {
  component_code: string;
  component_name: string;
  material_id: string;
  material_sku: string;
  material_name: string;
  quantity: number;           // decimal, before rounding
  unit_type: string;
  unit_cost: number;
}

export interface LaborCalculation {
  labor_code_id: string;
  labor_sku: string;
  description: string;
  quantity: number;
  rate: number;
  unit_type: string;
}

export interface CalculationResult {
  materials: MaterialCalculation[];
  labor: LaborCalculation[];
  totalMaterialCost: number;
  totalLaborCost: number;
  totalCost: number;
  // Intermediate values for debugging
  debug?: {
    posts: number;
    pickets?: number;
    rails?: number;
    sections: number;
    parameters: Record<string, number>;
  };
}

// ============================================================================
// UI TYPES
// ============================================================================

export interface SKUBuilderFormData {
  productTypeCode: string;
  productStyleCode: string;
  height: number;
  postType: 'WOOD' | 'STEEL';
  postSpacing?: number;
  config: Record<string, unknown>;
  components: Record<string, string>;  // component_code -> material_id
}

export interface ProjectLineItemV2 {
  id: string;
  skuId: string;
  sku: ProductSKUWithDetails;
  totalFootage: number;
  buffer: number;
  netLength: number;
  numberOfLines: number;
  numberOfGates: number;
  calculationResult?: CalculationResult;
}
