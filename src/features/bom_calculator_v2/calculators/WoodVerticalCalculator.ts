/**
 * WoodVerticalCalculator
 *
 * Calculates materials for Wood Vertical fence products.
 * Handles styles: Standard, Good Neighbor, Board-on-Board
 */

import { BaseProductCalculator } from './BaseProductCalculator';
import type {
  CalculationContext,
  MaterialCalculation,
} from '../types';

export class WoodVerticalCalculator extends BaseProductCalculator {
  constructor() {
    super('wood-vertical');
  }

  /**
   * Calculate all materials for wood vertical fence
   */
  protected calculateMaterials(context: CalculationContext): MaterialCalculation[] {
    const materials: MaterialCalculation[] = [];

    // 1. Posts
    const postEntry = this.calculatePosts(context);
    if (postEntry) materials.push(postEntry);

    // 2. Pickets
    const picketEntry = this.calculatePickets(context);
    if (picketEntry) materials.push(picketEntry);

    // 3. Rails
    const railEntry = this.calculateRails(context);
    if (railEntry) materials.push(railEntry);

    // 4. Brackets (steel posts only)
    const bracketEntry = this.calculateBrackets(context);
    if (bracketEntry) materials.push(bracketEntry);

    // 5. Cap (optional)
    const capEntry = this.calculateCap(context);
    if (capEntry) materials.push(capEntry);

    // 6. Trim (optional)
    const trimEntry = this.calculateTrim(context);
    if (trimEntry) materials.push(trimEntry);

    // 7. Rot Board (optional)
    const rotBoardEntry = this.calculateRotBoard(context);
    if (rotBoardEntry) materials.push(rotBoardEntry);

    // 8. Steel Post Caps (steel posts only)
    const steelPostCapEntry = this.calculateSteelPostCaps(context);
    if (steelPostCapEntry) materials.push(steelPostCapEntry);

    return materials;
  }

  /**
   * Calculate post count
   *
   * Formula: ceil(net_length / post_spacing) + 1
   * Plus extra posts for multiple lines: ceil((lines - 2) / 2) when lines > 2
   */
  private calculatePosts(context: CalculationContext): MaterialCalculation | null {
    const { sku, input, parameters } = context;

    // Get post spacing (style override > SKU > type default)
    const postSpacing = parameters.get('post_spacing') ||
      sku.post_spacing ||
      sku.product_type.default_post_spacing ||
      8;

    // Base calculation
    let posts = Math.ceil(input.netLength / postSpacing) + 1;

    // Extra posts for multiple lines
    if (input.numberOfLines > 2) {
      posts += Math.ceil((input.numberOfLines - 2) / 2);
    }

    return this.createMaterialEntry('post', 'Post', posts, context);
  }

  /**
   * Calculate picket count
   *
   * Base: ceil((net_length * 12) / picket_width * waste_factor)
   * Style multipliers:
   *   - Standard: 1.0
   *   - Good Neighbor: 1.1 (10% more for both sides)
   *   - Board-on-Board: 1.14 (14% more for overlap)
   */
  private calculatePickets(context: CalculationContext): MaterialCalculation | null {
    const { input, parameters, componentMaterials } = context;

    const picketMaterial = componentMaterials.get('picket');
    if (!picketMaterial) return null;

    // Get picket width from material
    const picketWidth = picketMaterial.actual_width || 5.5;

    // Get waste factor (default 2.5%)
    const wasteFactor = parameters.get('default_waste_factor') || 1.025;

    // Get style multiplier (1.0 for standard, 1.1 for GN, 1.14 for BOB)
    const styleMultiplier = parameters.get('picket_multiplier') || 1.0;

    // Calculate
    const pickets = Math.ceil(
      (input.netLength * 12 / picketWidth) * wasteFactor * styleMultiplier
    );

    return this.createMaterialEntry('picket', 'Picket', pickets, context);
  }

  /**
   * Calculate rail count
   *
   * Formula: sections * rail_count
   * where sections = ceil(net_length / post_spacing)
   *
   * Rail count is stored in SKU config (2 for 6ft, 3-4 for 8ft)
   */
  private calculateRails(context: CalculationContext): MaterialCalculation | null {
    const { sku, input, parameters } = context;

    const postSpacing = parameters.get('post_spacing') ||
      sku.post_spacing ||
      sku.product_type.default_post_spacing ||
      8;

    const sections = Math.ceil(input.netLength / postSpacing);
    const railCount = (sku.config_json as { rail_count?: number }).rail_count || 2;

    const rails = sections * railCount;

    return this.createMaterialEntry('rail', 'Rail', rails, context);
  }

  /**
   * Calculate brackets (steel posts only)
   *
   * Formula: posts * rail_count
   * One bracket per rail per post
   */
  private calculateBrackets(context: CalculationContext): MaterialCalculation | null {
    const { sku } = context;

    // Only for steel posts
    if (sku.post_type !== 'STEEL') return null;

    // Check if bracket component exists for this SKU
    if (!context.componentMaterials.has('bracket')) return null;

    const posts = this.getPostCount(context);
    const railCount = (sku.config_json as { rail_count?: number }).rail_count || 2;

    const brackets = posts * railCount;

    return this.createMaterialEntry('bracket', 'Rail Bracket', brackets, context);
  }

  /**
   * Calculate cap boards (optional)
   *
   * Formula: ceil(net_length / cap_length)
   */
  private calculateCap(context: CalculationContext): MaterialCalculation | null {
    const { input, componentMaterials } = context;

    const capMaterial = componentMaterials.get('cap');
    if (!capMaterial) return null;

    const capLength = capMaterial.length_ft || 8;
    const caps = Math.ceil(input.netLength / capLength);

    return this.createMaterialEntry('cap', 'Cap Board', caps, context);
  }

  /**
   * Calculate trim boards (optional)
   *
   * Formula: ceil((net_length * 2) / trim_length)
   * Trim goes on both sides of the posts
   */
  private calculateTrim(context: CalculationContext): MaterialCalculation | null {
    const { input, componentMaterials } = context;

    const trimMaterial = componentMaterials.get('trim');
    if (!trimMaterial) return null;

    const trimLength = trimMaterial.length_ft || 8;
    // Trim on both sides
    const trims = Math.ceil((input.netLength * 2) / trimLength);

    return this.createMaterialEntry('trim', 'Trim Board', trims, context);
  }

  /**
   * Calculate rot boards (optional)
   *
   * Formula: ceil(net_length / rot_board_length)
   */
  private calculateRotBoard(context: CalculationContext): MaterialCalculation | null {
    const { input, componentMaterials } = context;

    const rotBoardMaterial = componentMaterials.get('rot-board');
    if (!rotBoardMaterial) return null;

    const rotBoardLength = rotBoardMaterial.length_ft || 8;
    const rotBoards = Math.ceil(input.netLength / rotBoardLength);

    return this.createMaterialEntry('rot-board', 'Rot Board', rotBoards, context);
  }

  /**
   * Calculate steel post caps (steel posts only)
   *
   * Formula: posts (one cap per post)
   * Type (dome vs plug) determined by product rules
   */
  private calculateSteelPostCaps(context: CalculationContext): MaterialCalculation | null {
    const { sku } = context;

    // Only for steel posts
    if (sku.post_type !== 'STEEL') return null;

    // Check if steel post cap component exists
    if (!context.componentMaterials.has('steel-post-cap')) return null;

    const posts = this.getPostCount(context);

    return this.createMaterialEntry('steel-post-cap', 'Steel Post Cap', posts, context);
  }

  /**
   * Override to include picket count in debug
   */
  protected override getPostCount(context: CalculationContext): number {
    const { sku, input, parameters } = context;

    const postSpacing = parameters.get('post_spacing') ||
      sku.post_spacing ||
      sku.product_type.default_post_spacing ||
      8;

    let posts = Math.ceil(input.netLength / postSpacing) + 1;

    if (input.numberOfLines > 2) {
      posts += Math.ceil((input.numberOfLines - 2) / 2);
    }

    return posts;
  }
}
