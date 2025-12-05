/**
 * Database Types for BOM Calculator
 * Auto-generated from migration 017_bom_calculator_system.sql
 *
 * These types match the PostgreSQL schema exactly.
 * For application-level types, see types.ts
 */

// ============================================================================
// DATABASE ENUMS
// ============================================================================

export type PostType = 'WOOD' | 'STEEL';
export type ConcreteType = '3-part' | 'yellow-bags' | 'red-bags';
export type ProjectStatus = 'draft' | 'quoted' | 'approved' | 'completed';
export type FenceTypeDB = 'wood_vertical' | 'wood_horizontal' | 'iron';
export type SKUStatus = 'draft' | 'complete' | 'archived';

// ============================================================================
// REFERENCE TABLES
// ============================================================================

export interface BusinessUnit {
  id: string;
  code: string; // 'ATX-RES', 'SA-HB', etc.
  name: string;
  location: string; // 'ATX', 'SA', 'HOU'
  business_type: string; // 'Residential', 'Home Builders'
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  material_sku: string;
  material_name: string;
  category: string; // '01-Post', '02-Pickets', etc.
  sub_category: string | null;
  unit_type: string;
  unit_cost: number;

  // Physical dimensions
  length_ft: number | null;
  width_nominal: number | null;
  actual_width: number | null;
  thickness: string | null;
  quantity_per_unit: number;

  // Categorization
  fence_category_standard: string[];
  is_bom_default: boolean;

  // Inventory
  status: string;
  normally_stocked: boolean;
  current_stock_qty: number | null;

  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaborCode {
  id: string;
  labor_sku: string;
  description: string;
  fence_category_standard: string[];
  unit_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LaborRate {
  id: string;
  labor_code_id: string;
  business_unit_id: string;
  rate: number;
  qbo_labor_code: string | null;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PRODUCT TABLES (SKU Definitions)
// ============================================================================

export interface WoodVerticalProduct {
  id: string;
  sku_code: string;
  sku_name: string;

  // Physical specifications
  height: number; // feet
  rail_count: number;
  post_type: PostType;
  style: string;
  post_spacing: number;

  // Material references
  post_material_id: string;
  picket_material_id: string;
  rail_material_id: string;
  cap_material_id: string | null;
  trim_material_id: string | null;
  rot_board_material_id: string | null;

  // Standard cost (cached)
  standard_material_cost: number | null;
  standard_labor_cost: number | null;
  standard_cost_per_foot: number | null;
  standard_cost_calculated_at: string | null;

  product_description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // SKU Import tracking
  sku_status: SKUStatus;
  imported_at: string | null;
  populated_at: string | null;
  populated_by: string | null;
  import_notes: string | null;
}

export interface WoodHorizontalProduct {
  id: string;
  sku_code: string;
  sku_name: string;

  height: number;
  post_type: PostType;
  style: string;
  post_spacing: number;
  board_width_actual: number;

  post_material_id: string;
  board_material_id: string;
  nailer_material_id: string | null;
  cap_material_id: string | null;
  vertical_trim_material_id: string | null; // Covers post faces

  standard_material_cost: number | null;
  standard_labor_cost: number | null;
  standard_cost_per_foot: number | null;
  standard_cost_calculated_at: string | null;

  product_description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // SKU Import tracking
  sku_status: SKUStatus;
  imported_at: string | null;
  populated_at: string | null;
  populated_by: string | null;
  import_notes: string | null;
}

export interface IronProduct {
  id: string;
  sku_code: string;
  sku_name: string;

  height: number;
  post_type: PostType; // always 'STEEL'
  style: string;
  panel_width: number;
  rails_per_panel: number | null;

  post_material_id: string;
  panel_material_id: string | null;
  bracket_material_id: string | null;
  rail_material_id: string | null;
  picket_material_id: string | null;

  standard_material_cost: number | null;
  standard_labor_cost: number | null;
  standard_cost_per_foot: number | null;
  standard_cost_calculated_at: string | null;

  product_description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // SKU Import tracking
  sku_status: SKUStatus;
  imported_at: string | null;
  populated_at: string | null;
  populated_by: string | null;
  import_notes: string | null;
}

// ============================================================================
// PROJECT TABLES
// ============================================================================

export interface BOMProject {
  id: string;
  project_name: string;
  customer_name: string | null;
  business_unit_id: string;

  concrete_type: ConcreteType;

  // Calculated totals (cached)
  total_linear_feet: number | null;
  total_material_cost: number | null;
  total_labor_cost: number | null;
  manual_adjustments: number;
  total_project_cost: number | null;
  cost_per_foot: number | null;

  status: ProjectStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectLineItem {
  id: string;
  project_id: string;

  fence_type: FenceTypeDB;
  product_id: string;
  product_sku_code: string;
  product_name: string;

  total_footage: number;
  buffer: number;
  net_length: number;
  number_of_lines: number;
  number_of_gates: number;

  // Calculated quantities (decimals before rounding)
  calculated_posts: number | null;
  calculated_pickets: number | null;
  calculated_rails: number | null;
  calculated_panels: number | null;
  calculated_boards: number | null;
  calculated_nailers: number | null;

  // Manual overrides
  adjusted_posts: number | null;
  adjusted_pickets: number | null;
  adjusted_rails: number | null;
  adjusted_panels: number | null;

  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMaterial {
  id: string;
  project_id: string;
  material_id: string;

  calculated_quantity: number;
  rounded_quantity: number | null;
  manual_quantity: number | null;
  final_quantity: number; // GENERATED COLUMN

  unit_cost: number;
  extended_cost: number; // GENERATED COLUMN

  aggregation_level: string;
  calculation_note: string | null;
  is_manual_addition: boolean;

  created_at: string;
  updated_at: string;
}

export interface ProjectLabor {
  id: string;
  project_id: string;
  labor_code_id: string;

  calculated_quantity: number;
  manual_quantity: number | null;
  final_quantity: number; // GENERATED COLUMN

  labor_rate: number;
  extended_cost: number; // GENERATED COLUMN

  is_manual_addition: boolean;
  calculation_note: string | null;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// JOINED TYPES (with relations populated)
// ============================================================================

export interface WoodVerticalProductWithMaterials extends WoodVerticalProduct {
  post_material: Material;
  picket_material: Material;
  rail_material: Material;
  cap_material?: Material;
  trim_material?: Material;
  rot_board_material?: Material;
}

export interface WoodHorizontalProductWithMaterials extends WoodHorizontalProduct {
  post_material: Material;
  board_material: Material;
  nailer_material?: Material;
  cap_material?: Material;
  vertical_trim_material?: Material;
}

export interface IronProductWithMaterials extends IronProduct {
  post_material: Material;
  panel_material?: Material;
  bracket_material?: Material;
  rail_material?: Material;
  picket_material?: Material;
}

export interface LaborRateWithDetails extends LaborRate {
  labor_code: LaborCode;
  business_unit: BusinessUnit;
}

export interface ProjectMaterialWithDetails extends ProjectMaterial {
  material: Material;
}

export interface ProjectLaborWithDetails extends ProjectLabor {
  labor_code: LaborCode;
}

export interface ProjectWithDetails extends BOMProject {
  business_unit: BusinessUnit;
  line_items: ProjectLineItem[];
  materials: ProjectMaterialWithDetails[];
  labor: ProjectLaborWithDetails[];
}

// ============================================================================
// CUSTOM PRODUCTS (Flexible products/services)
// ============================================================================

export type UnitBasis = 'LF' | 'SF' | 'EA' | 'PROJECT';

export interface CustomProduct {
  id: string;
  sku_code: string;
  sku_name: string;

  unit_basis: UnitBasis;

  // Cached costs (updated on save)
  standard_material_cost: number;
  standard_labor_cost: number;
  standard_cost_per_unit: number;
  standard_cost_calculated_at: string | null;

  // Metadata
  product_description: string | null;
  category: string | null; // 'Service', 'Add-On', 'Repair', 'Upgrade'
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // SKU Import tracking
  sku_status: SKUStatus;
  imported_at: string | null;
  populated_at: string | null;
  populated_by: string | null;
  import_notes: string | null;
}

export interface CustomProductMaterial {
  id: string;
  custom_product_id: string;
  material_id: string;
  quantity_per_unit: number;
  notes: string | null;
  created_at: string;
}

export interface CustomProductLabor {
  id: string;
  custom_product_id: string;
  labor_code_id: string;
  quantity_per_unit: number;
  notes: string | null;
  created_at: string;
}

// With relations
export interface CustomProductMaterialWithDetails extends CustomProductMaterial {
  material: Material;
}

export interface CustomProductLaborWithDetails extends CustomProductLabor {
  labor_code: LaborCode;
}

export interface CustomProductWithDetails extends CustomProduct {
  materials: CustomProductMaterialWithDetails[];
  labor: CustomProductLaborWithDetails[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type AnyProduct = WoodVerticalProduct | WoodHorizontalProduct | IronProduct | CustomProduct;
export type AnyProductWithMaterials =
  | WoodVerticalProductWithMaterials
  | WoodHorizontalProductWithMaterials
  | IronProductWithMaterials
  | CustomProductWithDetails;

// Type guards
export const isWoodVertical = (product: AnyProduct): product is WoodVerticalProduct => {
  return 'picket_material_id' in product && 'rail_count' in product;
};

export const isWoodHorizontal = (product: AnyProduct): product is WoodHorizontalProduct => {
  return 'board_material_id' in product && 'board_width_actual' in product;
};

export const isIron = (product: AnyProduct): product is IronProduct => {
  return 'panel_material_id' in product || 'rails_per_panel' in product;
};

export const isCustomProduct = (product: AnyProduct): product is CustomProduct => {
  return 'unit_basis' in product && !('post_material_id' in product);
};
