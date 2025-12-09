/**
 * ✅ BOM Calculator V1 - PRODUCTION VERSION
 *
 * This is the ACTIVE production BOM Calculator.
 *
 * Database tables (V1):
 * - wood_vertical_products
 * - wood_horizontal_products
 * - iron_products
 * - custom_products
 *
 * Note: There is an experimental V2 in bom_calculator_v2/ folder.
 * V2 is NOT used in production - ignore it.
 *
 * IMPORTANT: Only export what should be accessible from outside this feature.
 * Keep all implementation details (components, hooks, services) private.
 */

// ============================================================================
// MAIN COMPONENT (for routing)
// ============================================================================

export { BOMCalculator } from './BOMCalculator';

// ============================================================================
// PUBLIC TYPES (if other features need them)
// ============================================================================

export type {
  ProjectDetails,
  CalculationResult,
  LineItem,
  FenceType,
  PostType
} from './types';

// ============================================================================
// DATABASE TYPES (read-only access for other features if needed)
// ============================================================================

export type {
  BusinessUnit,
  Material,
  WoodVerticalProduct,
  WoodHorizontalProduct,
  IronProduct
} from './database.types';

// ============================================================================
// INTERNAL - DO NOT EXPORT
// ============================================================================

// ❌ DO NOT export: Individual components (ProjectDetailsForm, etc.)
// ❌ DO NOT export: Hooks (useBOMData, etc.)
// ❌ DO NOT export: Services (FenceCalculator, etc.)
// ❌ DO NOT export: Mock data or test utilities
//
// These are implementation details and should remain private to this feature.
// If you need to share functionality, create a shared package or refactor.
