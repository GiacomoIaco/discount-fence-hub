# Implementation Plan: BOM Calculator Improvements

## Overview

This plan addresses gaps between the Excel Formula Specification and the current `FenceCalculator.ts` implementation. The SKU Builder calculates standard costs (no gates), while the Calculator handles project-level inputs including gates.

---

## Phase 1: Formula Corrections (Quick Wins)

### 1.1 Fix Picket Waste Factor for Good Neighbor
**File:** `src/features/bom_calculator/services/FenceCalculator.ts`
**Lines:** ~456-457

**Current:**
```typescript
if (style.includes('Good Neighbor')) {
  pickets = pickets * 1.1; // 10% more for double-sided
}
```

**Corrected:**
```typescript
if (style.includes('Good Neighbor')) {
  pickets = pickets * 1.11; // 11% more for double-sided (per Excel spec)
}
```

### 1.2 Add Missing `Math.ceil()` to Cap/Trim Calculations
**File:** `src/features/bom_calculator/services/FenceCalculator.ts`
**Lines:** ~475-481

**Current:**
```typescript
private calculateCap(netLength: number, capLength: number): number {
  return netLength / capLength;
}

private calculateTrim(netLength: number, trimLength: number): number {
  return netLength / trimLength;
}
```

**Corrected:**
```typescript
private calculateCap(netLength: number, capLength: number): number {
  return Math.ceil(netLength / capLength);
}

private calculateTrim(netLength: number, trimLength: number): number {
  return Math.ceil(netLength / trimLength);
}
```

### 1.3 Fix Nailer Formula for Wood Horizontal
**File:** `src/features/bom_calculator/services/FenceCalculator.ts`
**Lines:** ~520-523

**Current:**
```typescript
private calculateNailers(netLength: number, postSpacing: number): number {
  const sections = Math.ceil(netLength / postSpacing);
  return sections;
}
```

**Corrected:**
```typescript
private calculateNailers(
  netLength: number,
  postSpacing: number,
  fenceHeight: number,
  boardWidthActual: number
): number {
  const sections = Math.ceil(netLength / postSpacing);
  const boardsHigh = Math.ceil((fenceHeight * 12) / boardWidthActual);
  return (boardsHigh - 1) * sections;
}
```

---

## Phase 2: Gate Post Logic (Calculator Only)

### 2.1 Add Gate Post Adjustment Function

**New function in `FenceCalculator.ts`:**

```typescript
interface GatePostAdjustment {
  adjustedPosts: number;      // Modified count of base posts
  steelGatePosts: number;     // Separate line item for wood-post fences
  gatePostMaterialId: string | null; // Material for steel gate posts
}

private adjustPostsForGates(
  basePosts: number,
  numberOfGates: number,
  postType: PostType,
  steelGatePostMaterial?: Material
): GatePostAdjustment {
  if (numberOfGates === 0) {
    return {
      adjustedPosts: basePosts,
      steelGatePosts: 0,
      gatePostMaterialId: null
    };
  }

  if (postType === 'STEEL') {
    // STEEL base posts: +1 steel post per gate (added to existing count)
    return {
      adjustedPosts: basePosts + numberOfGates,
      steelGatePosts: 0,
      gatePostMaterialId: null
    };
  } else {
    // WOOD base posts:
    // -1 wood post per gate (replaced by gate posts)
    // +2 steel gate posts per gate (new line item)
    return {
      adjustedPosts: basePosts - numberOfGates,
      steelGatePosts: numberOfGates * 2,
      gatePostMaterialId: steelGatePostMaterial?.id || null
    };
  }
}
```

### 2.2 Update Wood Vertical Calculator

Modify `calculateWoodVertical()` to use gate adjustment:

```typescript
calculateWoodVertical(
  product: WoodVerticalProductWithMaterials,
  input: CalculationInput,
  laborRates: LaborRateWithDetails[],
  steelGatePostMaterial?: Material  // NEW: Optional steel gate post material
): CalculationResult {
  const materials: MaterialCalculation[] = [];
  const labor: LaborCalculation[] = [];

  // 1. POSTS (base calculation)
  const basePosts = this.calculateWoodVerticalPosts(
    input.netLength,
    product.style,
    product.post_spacing,
    input.numberOfLines
  );

  // 1b. GATE POST ADJUSTMENT (Calculator only - not in SKU Builder)
  const gateAdjustment = this.adjustPostsForGates(
    basePosts,
    input.numberOfGates,
    product.post_type,
    steelGatePostMaterial
  );

  // Add adjusted base posts
  materials.push({
    material_id: product.post_material.id,
    material_sku: product.post_material.material_sku,
    material_name: product.post_material.material_name,
    quantity: gateAdjustment.adjustedPosts,
    unit_type: product.post_material.unit_type,
    unit_cost: product.post_material.unit_cost,
    category: product.post_material.category,
  });

  // Add steel gate posts if wood fence with gates
  if (gateAdjustment.steelGatePosts > 0 && steelGatePostMaterial) {
    materials.push({
      material_id: steelGatePostMaterial.id,
      material_sku: steelGatePostMaterial.material_sku,
      material_name: steelGatePostMaterial.material_name,
      quantity: gateAdjustment.steelGatePosts,
      unit_type: steelGatePostMaterial.unit_type,
      unit_cost: steelGatePostMaterial.unit_cost,
      category: steelGatePostMaterial.category,
    });
  }

  // ... rest of calculation uses gateAdjustment.adjustedPosts for post count
}
```

### 2.3 Add Steel Gate Post Material Lookup

The Calculator needs to know which steel post material to use for gate posts when the base fence uses wood posts. Options:

**Option A:** Store `gate_post_material_id` in the product/SKU record
**Option B:** Use a convention-based lookup (e.g., "PS-STEEL-GATE-{height}")
**Option C:** Pass from UI selection

**Recommended:** Option A - Add `gate_post_material_id` column to `wood_vertical_products` table.

---

## Phase 3: Hardware Calculations (Steel Post Extras)

### 3.1 Add Post Cap Calculation

```typescript
interface PostCapResult {
  materialId: string;
  quantity: number;
  capType: 'dome' | 'plug';
}

private calculatePostCaps(
  posts: number,
  hasCap: boolean,
  hasTrim: boolean,
  domeCapMaterial: Material,
  plugCapMaterial: Material
): PostCapResult {
  // If SKU has BOTH cap AND trim → Use "Plug" post cap
  // Otherwise → Use "Dome" post cap
  const capType = (hasCap && hasTrim) ? 'plug' : 'dome';
  const material = capType === 'plug' ? plugCapMaterial : domeCapMaterial;

  return {
    materialId: material.id,
    quantity: posts,
    capType
  };
}
```

### 3.2 Add Bracket Calculation (Steel Posts)

```typescript
private calculateBrackets(posts: number, railsPerSection: number): number {
  return posts * railsPerSection;
}
```

### 3.3 Add Self-Tapping Screws (Steel Posts)

```typescript
private calculateSelfTappingScrews(rails: number): number {
  return rails * 4; // 4 screws per rail
}
```

---

## Phase 4: Nail/Hardware Calculations (Project Level)

### 4.1 Add Picket Nails Calculation

```typescript
calculatePicketNails(
  totalPickets: number,
  railsPerSection: number,
  totalTrimBoards: number,
  nailsPerCoil: number = 300
): number {
  // Base: pickets × rails × 2 nails per connection
  let totalNails = totalPickets * railsPerSection * 2;

  // If trim: add 6 nails per trim board
  if (totalTrimBoards > 0) {
    totalNails += totalTrimBoards * 6;
  }

  return Math.ceil(totalNails / nailsPerCoil);
}
```

### 4.2 Add Frame Nails Calculation

```typescript
calculateFrameNails(
  totalPosts: number,
  railsPerSection: number,
  hasCap: boolean,
  nailsPerBox: number = 28
): number {
  // Base: posts × rails × 4 nails per connection
  let totalNails = totalPosts * railsPerSection * 4;

  // If cap: add 6 nails per post
  if (hasCap) {
    totalNails += totalPosts * 6;
  }

  return Math.ceil(totalNails / nailsPerBox);
}
```

---

## Phase 5: Additional Rail Labor Code (W05)

### 5.1 Add Default Rails Check

```typescript
private getDefaultRailCount(height: number): number {
  return height <= 6 ? 2 : 3;
}

// In getWoodVerticalLaborCodes():
const defaultRails = this.getDefaultRailCount(product.height);
if (product.rail_count > defaultRails) {
  codes.push({ labor_sku: 'W05', quantity: input.netLength });
}
```

---

## Phase 6: Rot Board Calculation

### 6.1 Add Rot Board to Wood Vertical

```typescript
// In calculateWoodVertical(), after trim calculation:
if (product.rot_board_material) {
  const rotBoards = Math.ceil(input.netLength / (product.rot_board_material.length_ft || 8));
  materials.push({
    material_id: product.rot_board_material.id,
    material_sku: product.rot_board_material.material_sku,
    material_name: product.rot_board_material.material_name,
    quantity: rotBoards,
    unit_type: product.rot_board_material.unit_type,
    unit_cost: product.rot_board_material.unit_cost,
    category: product.rot_board_material.category,
  });
}
```

---

## Phase 7: Wood Horizontal Enhancements

### 7.1 Add Top Nailer for Steel Posts

```typescript
// In calculateWoodHorizontal():
if (product.post_type === 'STEEL' && product.top_nailer_material) {
  const sections = Math.ceil(input.netLength / product.post_spacing);
  materials.push({
    material_id: product.top_nailer_material.id,
    // ... rest of material properties
    quantity: sections,
  });
}
```

### 7.2 Add Vertical Trim Boards

```typescript
private calculateVerticalTrimBoards(
  posts: number,
  style: string
): number {
  if (style.includes('Exposed')) {
    return 0; // Not needed for exposed style
  }
  if (style.includes('Good Neighbor')) {
    return posts * 2; // Both sides
  }
  return posts * 1; // Standard: one side
}
```

---

## Implementation Order

| Priority | Phase | Effort | Impact | Status |
|----------|-------|--------|--------|--------|
| 1 | Phase 1: Formula Corrections | 30 min | High (accuracy) | ✅ COMPLETED |
| 2 | Phase 2: Gate Post Logic | 2 hrs | High (missing feature) | ✅ COMPLETED |
| 3 | Phase 5: W05 Labor Code | 30 min | Medium (labor accuracy) | ✅ COMPLETED |
| 4 | Phase 6: Rot Board | 30 min | Medium (missing material) | ✅ COMPLETED |
| 5 | Phase 3: Steel Post Hardware | 1 hr | Medium (steel fences) | ✅ COMPLETED |
| 6 | Phase 4: Nail Calculations | 1 hr | Medium (hardware) | ✅ COMPLETED |
| 7 | Phase 7: Wood Horizontal | 1.5 hrs | Lower (less common) | ✅ COMPLETED |

**All phases implemented on December 4, 2024**

---

## Database Changes Required

### New Columns (Optional but Recommended)

```sql
-- Add gate post material reference to wood vertical products
ALTER TABLE wood_vertical_products
ADD COLUMN gate_post_material_id UUID REFERENCES materials(id);

-- Add top nailer material reference to wood horizontal products
ALTER TABLE wood_horizontal_products
ADD COLUMN top_nailer_material_id UUID REFERENCES materials(id);
```

### New Material SKUs Needed

Ensure these materials exist in the `materials` table:
- `HW07` - Frame Nails (28/box)
- `HW08` - Picket Nails (300/coil)
- Steel gate post material (e.g., `PS-STEEL-GATE-8`)
- Post caps: Dome and Plug variants
- Self-tapping screws for steel posts

---

## Testing Checklist

### Phase 1 Tests
- [ ] Good Neighbor picket count increased by 11% (not 10%)
- [ ] Cap/Trim quantities are whole numbers (ceil applied)
- [ ] Nailer count = (boardsHigh - 1) × sections

### Phase 2 Tests
- [ ] Steel post fence + 2 gates = basePosts + 2
- [ ] Wood post fence + 2 gates = basePosts - 2 wood posts + 4 steel gate posts

### Phase 5 Tests
- [ ] 6ft fence with 3 rails triggers W05
- [ ] 8ft fence with 4 rails triggers W05
- [ ] Default rail counts don't trigger W05

---

## Notes

- SKU Builder uses `numberOfGates = 0` when calculating standard costs
- Calculator receives actual gate count from user input
- All hardware calculations should be at PROJECT level (aggregate first, then calculate)
