/**
 * ⚠️ EXPERIMENTAL - DO NOT USE IN PRODUCTION ⚠️
 *
 * BOM Calculator v2 - Smart Hybrid Architecture
 *
 * This is an EXPERIMENTAL future version of the BOM Calculator.
 * The production app uses V1 (bom_calculator folder).
 *
 * V2 uses a unified `product_skus` table instead of per-type tables.
 * It is NOT connected to any UI in the main app.
 *
 * DO NOT:
 * - Import from this module in production code
 * - Run migrations that affect `product_skus` table
 * - Confuse V2 tables with V1 tables
 *
 * V1 tables (PRODUCTION): wood_vertical_products, wood_horizontal_products, iron_products
 * V2 tables (EXPERIMENTAL): product_skus, sku_components_v2, component_definitions_v2
 */

// Main hub component
export { default as BOMCalculatorHub2 } from './BOMCalculatorHub2';

// Hooks
export * from './hooks';

// Calculator utilities
export { getCalculator, hasCalculator, getAvailableCalculators } from './calculators';

// Types
export type * from './types';
