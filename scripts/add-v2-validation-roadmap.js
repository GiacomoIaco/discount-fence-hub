import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function insertRoadmapItem() {
  const rawIdea = `Compare SKU calculations between V1 and V2 calculators to identify and fix formula discrepancies:

1. SKU COMPARISON TESTING
   - Take several Wood Vertical SKUs from the SKU Catalog (e.g., A01, C04, etc.)
   - Run same inputs through V1 Calculator and V2 SKU Builder
   - Compare BOM quantities and costs line by line
   - Document differences in a spreadsheet

2. INTERNAL V2 CONSISTENCY
   - Verify SKU Catalog V2 stored costs match SKU Builder V2 calculated costs
   - Ensure saved SKUs produce same results when re-calculated
   - Test edge cases: different heights, rail counts, post types

3. FORMULA CORRECTIONS
   - Identify which V2 formulas produce wrong quantities
   - Compare against V1 FenceCalculator.ts hardcoded logic
   - Update formula_templates_v2 table with corrected formulas
   - Re-test after corrections

4. CONCRETE SYSTEM IN V2
   - V1 supports 3 concrete types: 3-part mix, yellow bag, red bag
   - Each has different components/quantities:
     * 3-part mix: sand + portland cement (calculated separately)
     * Yellow bag (Quickcrete): single product, different qty formula
     * Red bag (Quikrok): single product, different qty formula
   - Need to implement concrete_type variable in V2 formulas
   - Add conditional logic or separate formulas per concrete type

5. ACCEPTANCE CRITERIA
   - V2 produces same quantities as V1 for all test SKUs (within 1% tolerance)
   - Concrete calculations work correctly for all 3 types
   - SKU Catalog and SKU Builder produce identical results`;

  const { data, error } = await supabase.from('roadmap_items').insert({
    hub: 'ops-hub',
    title: 'V2 Calculator Validation - Compare V1 vs V2 Results & Fix Formulas',
    status: 'idea',
    importance: 1,
    complexity: 'M',
    raw_idea: rawIdea
  }).select('code, title');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  } else {
    console.log('Created roadmap item:', data);
  }
}

insertRoadmapItem();
