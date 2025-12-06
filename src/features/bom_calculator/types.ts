/**
 * TypeScript interfaces for BOM Calculator
 * Based on 02-BUSINESS_LOGIC.md and 03-DATABASE_SCHEMA.sql
 */

// ============================================================================
// ENUM TYPES
// ============================================================================

export type FenceType = 'wood_vertical' | 'wood_horizontal' | 'iron' | 'custom';
export type FenceTypeWithAll = FenceType | 'all'; // For SKU search UI
export type PostType = 'WOOD' | 'STEEL';

// ============================================================================
// PROJECT DETAILS
// ============================================================================

export interface ProjectDetails {
  id?: string;
  customerName: string;
  projectName?: string;
  businessUnit: string; // Business Unit ID (UUID)
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// PRODUCTS (Fence-Type Specific)
// ============================================================================

export interface WoodVerticalProduct {
  id: string;
  name: string;
  height: number; // inches
  postSpacing: number; // inches
  picketWidth: number; // actual inches
  postType: PostType; // CRITICAL: determines labor codes
  railsPerSection: number;
  postMaterialCode: string;
  picketMaterialCode: string;
  railMaterialCode: string;
  isActive: boolean;
}

export interface WoodHorizontalProduct {
  id: string;
  name: string;
  height: number; // inches
  postSpacing: number; // inches
  boardWidth: number; // actual inches
  postType: PostType; // CRITICAL: determines labor codes
  postMaterialCode: string;
  boardMaterialCode: string;
  spacerMaterialCode?: string;
  isActive: boolean;
}

export interface IronProduct {
  id: string;
  name: string;
  height: number; // feet
  panelWidth: number; // feet
  postType: PostType; // always 'steel' for iron
  postMaterialCode: string;
  panelMaterialCode: string;
  isActive: boolean;
}

export type Product = WoodVerticalProduct | WoodHorizontalProduct | IronProduct;

// ============================================================================
// LINE ITEMS
// ============================================================================

export interface LineItem {
  id: string;
  projectId?: string;
  fenceType: FenceTypeWithAll; // Can be 'all' for UI search, set to actual type when product selected
  productId: string;
  productName: string; // denormalized for display
  postType: PostType; // CRITICAL: stored at line item level
  totalFootage: number; // total footage entered
  buffer: number; // material buffer/waste factor (in feet, e.g., 5)
  numberOfLines: number; // number of fence runs (1-5)
  numberOfGates: number; // number of gates to subtract (0-3)
  netLength: number; // calculated: totalFootage - buffer
  calculatedPosts?: number;
  calculatedPrimaryMaterial?: number; // pickets/boards/panels
  calculatedSecondaryMaterial?: number; // rails/spacers
  adjustedPosts?: number; // manual override
  adjustedPrimaryMaterial?: number;
  adjustedSecondaryMaterial?: number;
  sortOrder: number;
}

// ============================================================================
// MATERIALS (Reference Table)
// ============================================================================

export interface Material {
  id: string;
  materialCode: string; // e.g., "6X6X8-PT", "P-1X6X6-WRC"
  description: string;
  unit: string; // "EA", "LF", "BF"
  unitCost: number;
  category: string; // "post", "picket", "rail", "panel", "hardware", "concrete"
  qboItemName?: string;
}

// ============================================================================
// LABOR CODES (Reference Table)
// ============================================================================

export interface LaborCode {
  id: string;
  code: string; // e.g., "W-INST-WV-4", "M-INST-IRON-6"
  description: string;
  fenceType: FenceType;
  heightCategory: string; // "4ft", "6ft", "8ft"
  unit: string; // "LF", "EA"
  baseRate: number; // per unit
  businessUnitId: string; // Business Unit ID (UUID)
}

// ============================================================================
// CALCULATION RESULTS
// ============================================================================

export interface BOMLineItem {
  materialCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  extendedCost: number;
  category: string;
  isAdjusted?: boolean; // manual override applied
}

export interface BOLLineItem {
  laborCode: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  extendedCost: number;
  isAdjusted?: boolean;
}

export interface CalculationResult {
  materials: Array<{
    material_id: string;
    material_sku: string;
    material_name: string;
    quantity: number;
    unit_type: string;
    unit_cost: number;
    category: string;
  }>;
  labor: Array<{
    labor_code_id: string;
    labor_sku: string;
    description: string;
    quantity: number;
    rate: number;
    unit_type: string;
  }>;
}

// ============================================================================
// PROJECT-LEVEL AGGREGATES (for concrete/hardware calculation)
// ============================================================================

export interface ProjectAggregates {
  totalPosts: number; // sum all line items first
  totalLinearFeet: number;
  postTypes: { wood: number; steel: number }; // count by post type
}

// ============================================================================
// FORM STATE
// ============================================================================

export interface BOMCalculatorState {
  projectDetails: ProjectDetails;
  lineItems: LineItem[];
  calculationResult: CalculationResult | null;
  isCalculating: boolean;
  errors: string[];
}
