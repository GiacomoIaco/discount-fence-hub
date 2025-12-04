/**
 * BOM Calculator v2 - Smart Hybrid Architecture
 *
 * Entry point for the new BOM Calculator system.
 * Exports the main hub component and utility functions.
 */

// Main hub component
export { default as BOMCalculatorHub2 } from './BOMCalculatorHub2';

// Hooks
export * from './hooks';

// Calculator utilities
export { getCalculator, hasCalculator, getAvailableCalculators } from './calculators';

// Types
export type * from './types';
