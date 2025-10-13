/**
 * TypeScript interfaces for BOM Calculator
 * Based on 02-BUSINESS_LOGIC.md and 03-DATABASE_SCHEMA.sql
 */

// ============================================================================
// ENUM TYPES
// ============================================================================

export type FenceType = 'wood_vertical' | 'wood_horizontal' | 'iron';
export type PostType = 'wood' | 'steel';
export type BusinessUnit = 'austin' | 'san_antonio' | 'houston';

// ============================================================================
// PROJECT DETAILS
// ============================================================================

export interface ProjectDetails {
  id?: string;
  customerName: string;
  projectName?: string;
  businessUnit: BusinessUnit;
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
  fenceType: FenceType;
  productId: string;
  productName: string; // denormalized for display
  postType: PostType; // CRITICAL: stored at line item level
  length: number; // feet
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
  businessUnit: BusinessUnit;
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
  projectDetails: ProjectDetails;
  lineItems: LineItem[];
  bom: BOMLineItem[];
  bol: BOLLineItem[];
  totalMaterialCost: number;
  totalLaborCost: number;
  totalProjectCost: number;
  costPerLinearFoot: number;
  totalLinearFeet: number;
  calculatedAt: string;
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
