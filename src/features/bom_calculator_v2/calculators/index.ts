/**
 * Calculator Registry
 *
 * Maps product type codes to their calculator classes.
 * When adding a new product type, add it here.
 */

import { BaseProductCalculator } from './BaseProductCalculator';
import { WoodVerticalCalculator } from './WoodVerticalCalculator';

// Calculator registry - add new calculators here
const calculatorRegistry: Record<string, new () => BaseProductCalculator> = {
  'wood-vertical': WoodVerticalCalculator,
  // 'wood-horizontal': WoodHorizontalCalculator,
  // 'iron': IronCalculator,
  // 'chain-link': ChainLinkCalculator,
};

/**
 * Get calculator instance for a product type
 */
export function getCalculator(productTypeCode: string): BaseProductCalculator {
  const CalculatorClass = calculatorRegistry[productTypeCode];

  if (!CalculatorClass) {
    throw new Error(`No calculator found for product type: ${productTypeCode}`);
  }

  return new CalculatorClass();
}

/**
 * Check if a calculator exists for a product type
 */
export function hasCalculator(productTypeCode: string): boolean {
  return productTypeCode in calculatorRegistry;
}

/**
 * Get list of product types with calculators
 */
export function getAvailableCalculators(): string[] {
  return Object.keys(calculatorRegistry);
}

// Export individual calculators for direct use if needed
export { BaseProductCalculator } from './BaseProductCalculator';
export { WoodVerticalCalculator } from './WoodVerticalCalculator';
