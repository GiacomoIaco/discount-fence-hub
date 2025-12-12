/**
 * V1 vs V2 Calculator Comparison Script
 *
 * Compares BOM calculations between:
 * - V1: FenceCalculator.ts (hardcoded TypeScript)
 * - V2: FormulaInterpreter + formula_templates_v2 (database-driven)
 *
 * Tests SKUs: A01, C05, D07
 *
 * Run with: npx tsx scripts/compare-v1-v2-calculators.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ===========================================================================
// SETUP
// ===========================================================================

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Test parameters
const TEST_LENGTH = 100; // feet
const TEST_LINES = 4;
const TEST_GATES = 0;

const SKU_CODES_TO_TEST = ['A01', 'C05', 'D07'];

// ===========================================================================
// V1 CALCULATOR (Simplified from FenceCalculator.ts)
// ===========================================================================

interface V1CalculationResult {
  component: string;
  quantity: number;
  formula: string;
}

function calculateV1WoodVertical(
  netLength: number,
  numberOfLines: number,
  _numberOfGates: number,
  height: number,
  railCount: number,
  postSpacing: number,
  style: string,
  picketWidthActual: number,
  capLength: number | null,
  trimLength: number | null,
  rotBoardLength: number | null,
  postType: string
): V1CalculationResult[] {
  const results: V1CalculationResult[] = [];

  // Helper functions
  const isGoodNeighbor = (s: string) => s.toLowerCase().includes('good') && s.toLowerCase().includes('neighbor');
  const isBoardOnBoard = (s: string) => s.toLowerCase().includes('board') && s.toLowerCase().includes('board');

  // 1. POSTS
  let posts = Math.ceil(netLength / postSpacing) + 1;
  if (numberOfLines > 2) {
    posts += Math.ceil((numberOfLines - 2) / 2);
  }
  results.push({
    component: 'post',
    quantity: posts,
    formula: `ceil(${netLength}/${postSpacing})+1+ceil(max(${numberOfLines}-2,0)/2) = ${posts}`
  });

  // 2. PICKETS
  const lengthInches = netLength * 12;
  let pickets: number;
  let picketFormula: string;

  if (isGoodNeighbor(style)) {
    pickets = (lengthInches / picketWidthActual) * 1.025 * 1.11;
    picketFormula = `(${lengthInches}/${picketWidthActual})*1.025*1.11 = ${pickets.toFixed(2)}`;
  } else if (isBoardOnBoard(style)) {
    pickets = ((lengthInches * 2) / (picketWidthActual * 2 - 2.5)) * 1.025;
    picketFormula = `((${lengthInches}*2)/(${picketWidthActual}*2-2.5))*1.025 = ${pickets.toFixed(2)}`;
  } else {
    pickets = (lengthInches / picketWidthActual) * 1.025;
    picketFormula = `(${lengthInches}/${picketWidthActual})*1.025 = ${pickets.toFixed(2)}`;
  }
  // V1 rounds at SKU level
  const picketsRounded = Math.ceil(pickets);
  results.push({
    component: 'picket',
    quantity: picketsRounded,
    formula: picketFormula + ` -> ceil = ${picketsRounded}`
  });

  // 3. RAILS
  const sections = Math.ceil(netLength / postSpacing);
  const rails = sections * railCount;
  results.push({
    component: 'rail',
    quantity: rails,
    formula: `ceil(${netLength}/${postSpacing})*${railCount} = ${rails}`
  });

  // 4. BRACKETS (steel posts only)
  if (postType === 'STEEL') {
    const brackets = posts * railCount;
    results.push({
      component: 'bracket',
      quantity: brackets,
      formula: `posts(${posts})*rails(${railCount}) = ${brackets}`
    });
  }

  // 5. CAP (if present)
  if (capLength) {
    const caps = Math.ceil(netLength / capLength);
    results.push({
      component: 'cap',
      quantity: caps,
      formula: `ceil(${netLength}/${capLength}) = ${caps}`
    });
  }

  // 6. TRIM (if present) - V1 does NOT multiply by 2
  if (trimLength) {
    const trims = Math.ceil(netLength / trimLength);
    results.push({
      component: 'trim',
      quantity: trims,
      formula: `ceil(${netLength}/${trimLength}) = ${trims}`
    });
  }

  // 7. ROT BOARD (if present)
  if (rotBoardLength) {
    const rotBoards = Math.ceil(netLength / rotBoardLength);
    results.push({
      component: 'rot_board',
      quantity: rotBoards,
      formula: `ceil(${netLength}/${rotBoardLength}) = ${rotBoards}`
    });
  }

  // 8. STEEL POST CAPS (if steel posts)
  if (postType === 'STEEL') {
    results.push({
      component: 'steel_post_cap',
      quantity: posts,
      formula: `posts = ${posts}`
    });
  }

  // 9. PICKET NAILS (project-level, show raw)
  const picketNailsRaw = (picketsRounded * railCount * 2) / 300;
  results.push({
    component: 'nails_picket',
    quantity: picketNailsRaw,
    formula: `(${picketsRounded}*${railCount}*2)/300 = ${picketNailsRaw.toFixed(4)}`
  });

  // 10. FRAME NAILS (project-level, show raw)
  const frameNailsRaw = (posts * railCount * 4) / 28;
  results.push({
    component: 'nails_framing',
    quantity: frameNailsRaw,
    formula: `(${posts}*${railCount}*4)/28 = ${frameNailsRaw.toFixed(4)}`
  });

  // 11. CONCRETE (3-part, project-level)
  results.push({
    component: 'concrete_sand',
    quantity: posts / 10,
    formula: `posts(${posts})/10 = ${(posts / 10).toFixed(4)}`
  });
  results.push({
    component: 'concrete_portland',
    quantity: posts / 20,
    formula: `posts(${posts})/20 = ${(posts / 20).toFixed(4)}`
  });
  results.push({
    component: 'concrete_quickrock',
    quantity: posts * 0.5,
    formula: `posts(${posts})*0.5 = ${(posts * 0.5).toFixed(4)}`
  });

  return results;
}

// ===========================================================================
// V2 CALCULATOR (FormulaInterpreter simulation)
// ===========================================================================

interface V2FormulaTemplate {
  component_code: string;
  formula: string;
  rounding_level: string;
  product_style_id: string | null;
  priority: number;
}

function executeV2Formula(
  formula: string,
  context: Record<string, number>
): number {
  let expr = formula;

  // Replace [VarName] with values
  expr = expr.replace(/\[([^\]]+)\]/g, (_match, varName) => {
    if (varName in context) {
      return String(context[varName]);
    }
    // Handle dot notation (e.g., picket.width_inches)
    const dotKey = varName.replace('.', '_');
    if (dotKey in context) {
      return String(context[dotKey]);
    }
    console.warn(`  Unknown variable: ${varName}`);
    return '0';
  });

  // Replace functions
  expr = expr.replace(/ROUNDUP/gi, 'Math.ceil');
  expr = expr.replace(/ROUNDDOWN/gi, 'Math.floor');
  expr = expr.replace(/ROUND(?!UP|DOWN)/gi, 'Math.round');
  expr = expr.replace(/MAX/gi, 'Math.max');
  expr = expr.replace(/MIN/gi, 'Math.min');

  try {
    const fn = new Function(`return ${expr}`);
    return fn();
  } catch (err) {
    console.error(`  Formula error: ${formula} -> ${expr}`, err);
    return 0;
  }
}

async function calculateV2(
  productTypeCode: string,
  styleCode: string,
  context: Record<string, number>
): Promise<V1CalculationResult[]> {
  const results: V1CalculationResult[] = [];

  // Get product type ID
  const { data: productType } = await supabase
    .from('product_types_v2')
    .select('id')
    .eq('code', productTypeCode)
    .single();

  if (!productType) {
    console.error(`Product type not found: ${productTypeCode}`);
    return results;
  }

  // Get style ID
  const { data: style } = await supabase
    .from('product_styles_v2')
    .select('id, code')
    .eq('product_type_id', productType.id)
    .eq('code', styleCode)
    .single();

  console.log(`  V2 Style: ${styleCode} -> ID: ${style?.id || 'NOT FOUND'}`);

  // Load formula templates
  const { data: templates, error } = await supabase
    .from('formula_templates_v2')
    .select(`
      formula,
      rounding_level,
      product_style_id,
      priority,
      component_type:component_types_v2(code)
    `)
    .eq('product_type_id', productType.id)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (error || !templates) {
    console.error('Error loading formulas:', error);
    return results;
  }

  // Convert to usable format
  const formulas: V2FormulaTemplate[] = templates.map(t => ({
    component_code: (t.component_type as { code: string })?.code || '',
    formula: t.formula,
    rounding_level: t.rounding_level,
    product_style_id: t.product_style_id,
    priority: t.priority
  })).filter(f => f.component_code);

  // Group by component, prefer style-specific
  const formulaMap = new Map<string, V2FormulaTemplate>();
  for (const f of formulas) {
    const existing = formulaMap.get(f.component_code);
    // Prefer: style-specific > higher priority > existing
    if (!existing) {
      formulaMap.set(f.component_code, f);
    } else if (f.product_style_id === style?.id && existing.product_style_id !== style?.id) {
      formulaMap.set(f.component_code, f);
    } else if (f.priority > existing.priority && f.product_style_id === existing.product_style_id) {
      formulaMap.set(f.component_code, f);
    }
  }

  // Debug: show picket formula selection
  const picketFormula = formulaMap.get('picket');
  if (picketFormula) {
    console.log(`  Picket formula selected: style=${picketFormula.product_style_id || 'generic'}, formula=${picketFormula.formula.substring(0, 50)}...`);
  }

  // Execution order (dependencies)
  const executionOrder = [
    'post', 'picket', 'rail', 'bracket', 'cap', 'trim', 'rot_board',
    'steel_post_cap', 'nails_picket', 'nails_framing',
    'concrete_sand', 'concrete_portland', 'concrete_quickrock'
  ];

  const calculatedValues: Record<string, number> = { ...context };

  for (const componentCode of executionOrder) {
    const template = formulaMap.get(componentCode);
    if (!template) continue;

    const rawValue = executeV2Formula(template.formula, calculatedValues);
    const roundedValue = template.rounding_level === 'sku' ? Math.ceil(rawValue) : rawValue;

    // Store for subsequent formulas (use _qty to avoid collision with input variables)
    calculatedValues[`${componentCode}_qty`] = roundedValue;

    results.push({
      component: componentCode,
      quantity: roundedValue,
      formula: `${template.formula} = ${rawValue.toFixed(4)}${template.rounding_level === 'sku' ? ` -> ceil = ${roundedValue}` : ''}`
    });
  }

  return results;
}

// ===========================================================================
// COMPARISON LOGIC
// ===========================================================================

interface ComparisonResult {
  component: string;
  v1Quantity: number;
  v2Quantity: number;
  difference: number;
  percentDiff: string;
  v1Formula: string;
  v2Formula: string;
  status: 'MATCH' | 'CLOSE' | 'DIFFERENT' | 'MISSING_V2';
}

function compareResults(v1Results: V1CalculationResult[], v2Results: V1CalculationResult[]): ComparisonResult[] {
  const comparisons: ComparisonResult[] = [];
  const v2Map = new Map(v2Results.map(r => [r.component, r]));

  for (const v1 of v1Results) {
    const v2 = v2Map.get(v1.component);

    if (!v2) {
      comparisons.push({
        component: v1.component,
        v1Quantity: v1.quantity,
        v2Quantity: 0,
        difference: v1.quantity,
        percentDiff: '100%',
        v1Formula: v1.formula,
        v2Formula: 'NOT FOUND',
        status: 'MISSING_V2'
      });
      continue;
    }

    const diff = Math.abs(v1.quantity - v2.quantity);
    const percentDiff = v1.quantity !== 0 ? (diff / v1.quantity * 100) : (v2.quantity !== 0 ? 100 : 0);

    let status: 'MATCH' | 'CLOSE' | 'DIFFERENT';
    if (diff < 0.001) {
      status = 'MATCH';
    } else if (percentDiff <= 1) {
      status = 'CLOSE';
    } else {
      status = 'DIFFERENT';
    }

    comparisons.push({
      component: v1.component,
      v1Quantity: v1.quantity,
      v2Quantity: v2.quantity,
      difference: diff,
      percentDiff: percentDiff.toFixed(2) + '%',
      v1Formula: v1.formula,
      v2Formula: v2.formula,
      status
    });
  }

  return comparisons;
}

// ===========================================================================
// MAIN
// ===========================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         V1 vs V2 CALCULATOR COMPARISON                         ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Test Length: ${TEST_LENGTH} ft | Lines: ${TEST_LINES} | Gates: ${TEST_GATES}                 ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  for (const skuCode of SKU_CODES_TO_TEST) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  SKU: ${skuCode}`);
    console.log(`${'═'.repeat(70)}`);

    // Load V1 SKU data
    const { data: v1Sku, error: v1Error } = await supabase
      .from('wood_vertical_products')
      .select(`
        *,
        post_material:materials!wood_vertical_products_post_material_id_fkey(actual_width, length_ft),
        picket_material:materials!wood_vertical_products_picket_material_id_fkey(actual_width, length_ft),
        cap_material:materials!wood_vertical_products_cap_material_id_fkey(actual_width, length_ft),
        trim_material:materials!wood_vertical_products_trim_material_id_fkey(actual_width, length_ft),
        rot_board_material:materials!wood_vertical_products_rot_board_material_id_fkey(actual_width, length_ft)
      `)
      .eq('sku_code', skuCode)
      .single();

    if (v1Error || !v1Sku) {
      console.log(`  ❌ V1 SKU not found: ${skuCode}`);
      console.log(`     Error: ${v1Error?.message || 'No data'}`);
      continue;
    }

    console.log(`  Style: ${v1Sku.style}`);
    console.log(`  Height: ${v1Sku.height}' | Rails: ${v1Sku.rail_count} | Post Type: ${v1Sku.post_type}`);
    console.log(`  Post Spacing: ${v1Sku.post_spacing} ft`);
    console.log(`  Picket Width: ${v1Sku.picket_material?.actual_width || 'N/A'} inches`);

    // Run V1 calculation
    const v1Results = calculateV1WoodVertical(
      TEST_LENGTH,
      TEST_LINES,
      TEST_GATES,
      v1Sku.height,
      v1Sku.rail_count,
      v1Sku.post_spacing,
      v1Sku.style,
      v1Sku.picket_material?.actual_width || 5.5,
      v1Sku.cap_material?.length_ft || null,
      v1Sku.trim_material?.length_ft || null,
      v1Sku.rot_board_material?.length_ft || null,
      v1Sku.post_type
    );

    // Build V2 context
    const v2Context: Record<string, number> = {
      Quantity: TEST_LENGTH,
      Lines: TEST_LINES,
      Gates: TEST_GATES,
      height: v1Sku.height,
      rail_count: v1Sku.rail_count,
      post_spacing: v1Sku.post_spacing,
      'picket_width_inches': v1Sku.picket_material?.actual_width || 5.5,
      'cap_length_feet': v1Sku.cap_material?.length_ft || 8,
      'trim_length_feet': v1Sku.trim_material?.length_ft || 8,
      'rot_board_length_feet': v1Sku.rot_board_material?.length_ft || 8,
    };

    // Map V1 style to V2 style code (handle both title case and kebab-case)
    const styleMap: Record<string, string> = {
      'Standard': 'standard',
      'standard': 'standard',
      'Good Neighbor': 'good-neighbor-residential',
      'good-neighbor': 'good-neighbor-residential',
      'Good Neighbor Residential': 'good-neighbor-residential',
      'good-neighbor-residential': 'good-neighbor-residential',
      'Good Neighbor Builder': 'good-neighbor-builder',
      'good-neighbor-builder': 'good-neighbor-builder',
      'Board-on-Board': 'board-on-board',
      'board-on-board': 'board-on-board',
      'Board on Board': 'board-on-board',
    };
    const v2StyleCode = styleMap[v1Sku.style] || v1Sku.style || 'standard';

    // Run V2 calculation
    const v2Results = await calculateV2('wood-vertical', v2StyleCode, v2Context);

    // Compare
    const comparisons = compareResults(v1Results, v2Results);

    // Output
    console.log(`\n  ${'─'.repeat(66)}`);
    console.log('  COMPONENT          │    V1 QTY │    V2 QTY │ DIFF      │ STATUS');
    console.log(`  ${'─'.repeat(66)}`);

    let hasIssues = false;
    for (const c of comparisons) {
      const statusIcon = c.status === 'MATCH' ? '✅' :
                        c.status === 'CLOSE' ? '⚠️' :
                        c.status === 'MISSING_V2' ? '❌' : '🔴';

      const v1Str = c.v1Quantity.toFixed(2).padStart(9);
      const v2Str = c.v2Quantity.toFixed(2).padStart(9);
      const diffStr = c.percentDiff.padStart(8);

      console.log(`  ${c.component.padEnd(18)} │ ${v1Str} │ ${v2Str} │ ${diffStr} │ ${statusIcon} ${c.status}`);

      if (c.status !== 'MATCH') {
        hasIssues = true;
      }
    }
    console.log(`  ${'─'.repeat(66)}`);

    // Show detailed discrepancies
    const issues = comparisons.filter(c => c.status !== 'MATCH');
    if (issues.length > 0) {
      console.log('\n  📋 DISCREPANCIES DETAIL:');
      for (const issue of issues) {
        console.log(`\n  ${issue.component.toUpperCase()}:`);
        console.log(`    V1: ${issue.v1Formula}`);
        console.log(`    V2: ${issue.v2Formula}`);
        console.log(`    Diff: ${issue.difference.toFixed(4)} (${issue.percentDiff})`);
      }
    }

    if (!hasIssues) {
      console.log('\n  ✅ All calculations match!');
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log('  COMPARISON COMPLETE');
  console.log(`${'═'.repeat(70)}\n`);
}

main().catch(console.error);
