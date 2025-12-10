# O-026: BOM Calculator V2 - Formula-Based Architecture

## Executive Summary

Replace the abandoned V2 BOM Calculator experiment with a new formula-based architecture that:
- Uses **database-stored executable formulas** instead of hardcoded TypeScript
- Shares read-only tables with V1 (materials, labor rates, components)
- Replicates core V1 UI/UX but connected to new V2 tables
- Allows V1 and V2 to run in parallel during transition

---

## V2 Scope (Finalized)

### Pages IN V2:
| Page | Source | Notes |
|------|--------|-------|
| Calculator | New | Uses FormulaInterpreter |
| SKU Builder | New | Saves to sku_catalog_v2 |
| SKU Catalog | New | Reads sku_catalog_v2, horizontal JSONB display |
| Component Configurator | **Shared from V1** | Material eligibility rules |
| Materials | **Shared from V1** | Same page |
| Labor Rates | **Shared from V1** | Same page |

### Pages NOT in V2 (stay V1 only):
- Yard (all yard pages)
- SKU Import
- SKU Queue
- Analytics
- Custom Builder (future phase)
- Projects list (V2 has its own bom_projects_v2)

---

## Current State

### V1 (Production - Keep Running)

**Location:** `src/features/bom_calculator/`

**V1-Only Tables (DO NOT MODIFY):**
| Table | Purpose |
|-------|---------|
| `wood_vertical_products` | Wood vertical fence SKUs |
| `wood_horizontal_products` | Wood horizontal fence SKUs |
| `iron_products` | Iron fence SKUs |
| `custom_products` | Custom/service SKUs |
| `bom_projects` | Saved projects |
| `project_skus` | SKUs in projects |
| `project_materials` | Calculated materials |

**Shared Tables (V1 + V2 read):**
| Table | Purpose |
|-------|---------|
| `materials` | Material catalog |
| `labor_codes` | Labor code definitions |
| `labor_rates` | Business unit labor rates |
| `components` | Component definitions |
| `component_material_eligibility` | Which materials available per component |

**Calculator:** `FenceCalculator.ts` (1,575 lines of hardcoded formulas)

### V2 Abandoned Experiment

**Location:** `src/features/bom_calculator_v2/`

**Tables (FROM MIGRATION 072-079, EMPTY - will be dropped/replaced):**
- `product_types`, `product_styles`, `product_skus`, `sku_components`
- `component_definitions`, `formula_parameters`, `component_formulas`
- `product_rules`, `product_labor_rules`

**Status:** Incomplete, non-functional, uses hardcoded calculator classes

---

## Proposed V2 Architecture

### Design Principles

1. **Formula-Driven:** All calculations stored as executable formula strings in DB
2. **Shared Read Tables:** V2 reads from `materials`, `labor_codes`, `labor_rates` (same as V1)
3. **Unified SKU Table:** Single `sku_catalog_v2` with JSONB for flexibility
4. **Same UI as V1:** Users see identical interface, different backend
5. **Parallel Operation:** V1 and V2 run simultaneously during transition
6. **Rounding Control:** Formulas specify sku-level vs project-level rounding

### New V2 Tables

#### 1. `product_types_v2`
Master list of fence product categories.

```sql
CREATE TABLE product_types_v2 (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,           -- 'wood_vertical', 'iron'
  name TEXT NOT NULL,                  -- 'Wood Vertical'
  description TEXT,
  default_post_spacing DECIMAL(10,2),  -- 8.0 feet
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);
```

**Seed Data:** wood_vertical, wood_horizontal, iron, custom

#### 2. `product_styles_v2`
Style variations within a product type.

```sql
CREATE TABLE product_styles_v2 (
  id UUID PRIMARY KEY,
  product_type_id UUID REFERENCES product_types_v2(id),
  code TEXT NOT NULL,                  -- 'good_neighbor'
  name TEXT NOT NULL,                  -- 'Good Neighbor'
  description TEXT,
  formula_adjustments JSONB DEFAULT '{}',  -- {"post_spacing": 7.71, "picket_multiplier": 1.11}
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(product_type_id, code)
);
```

**Formula Adjustments:** Style-specific modifiers applied to formulas

#### 3. `product_variables_v2`
Input variables per product type (what the SKU Builder collects).

```sql
CREATE TABLE product_variables_v2 (
  id UUID PRIMARY KEY,
  product_type_id UUID REFERENCES product_types_v2(id),
  variable_code TEXT NOT NULL,         -- 'rail_count', 'board_width'
  variable_name TEXT NOT NULL,         -- 'Rail Count'
  variable_type TEXT NOT NULL,         -- 'integer', 'decimal', 'select'
  default_value TEXT,
  allowed_values TEXT[],               -- For select: ['2', '3', '4']
  unit TEXT,                           -- 'ft', 'in', NULL
  is_required BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  UNIQUE(product_type_id, variable_code)
);
```

#### 4. `component_types_v2`
Master list of all fence components.

```sql
CREATE TABLE component_types_v2 (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,           -- 'post', 'picket', 'rail'
  name TEXT NOT NULL,                  -- 'Post'
  description TEXT,
  unit_type TEXT DEFAULT 'Each',       -- 'Each', 'Linear Feet', 'Box'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);
```

**Seed Data:** post, picket, rail, cap, trim, rot_board, bracket, nails_picket, nails_rail, board, nailer, vertical_trim, panel, steel_post_cap, iron_post_cap

#### 5. `formula_templates_v2` ⭐ THE CORE TABLE
Executable formula strings that replace FenceCalculator.ts logic (1,575 lines → ~50 rows).

```sql
CREATE TABLE formula_templates_v2 (
  id UUID PRIMARY KEY,
  product_type_id UUID REFERENCES product_types_v2(id),
  product_style_id UUID REFERENCES product_styles_v2(id),  -- NULL = all styles
  component_type_id UUID REFERENCES component_types_v2(id),

  -- The executable formula
  formula TEXT NOT NULL,
  -- Examples:
  -- 'ROUNDUP([Quantity]/[post_spacing])+1'
  -- '[Quantity]*12/[picket.width_inches]*1.025*[picket_multiplier]'
  -- '([post_count]*[rail_count]*4)/[nails_rail.qty_per_unit]'

  -- Rounding control
  rounding_level TEXT NOT NULL DEFAULT 'sku',
  -- 'sku' = round per SKU (most components)
  -- 'project' = aggregate then round (nails, concrete)
  -- 'none' = keep decimals

  -- Documentation
  plain_english TEXT,
  notes TEXT,

  -- Priority for style overrides (higher wins)
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  UNIQUE NULLS NOT DISTINCT (product_type_id, product_style_id, component_type_id)
);
```

**Formula Variable Types:**
| Variable | Source | Example |
|----------|--------|---------|
| `[Quantity]` | Project input | Net length in feet |
| `[Lines]` | Project input | Number of fence lines |
| `[Gates]` | Project input | Number of gates |
| `[rail_count]` | SKU variables | From sku_catalog_v2.variables |
| `[post_spacing]` | Style adjustment or SKU variable | 8 or 7.71 |
| `[picket.width_inches]` | Material attribute | From materials table |
| `[cap.length_feet]` | Material attribute | From materials table |
| `[nails_rail.qty_per_unit]` | Material attribute | 28 nails per box |
| `[post_count]` | Calculated value | From previous formula result |
| `[picket_multiplier]` | Style adjustment | 1.11 for Good Neighbor |

#### 6. `sku_catalog_v2`
Unified SKU table replacing wood_vertical_products, etc.

```sql
CREATE TABLE sku_catalog_v2 (
  id UUID PRIMARY KEY,
  sku_code TEXT UNIQUE NOT NULL,       -- 'A01', 'H01', 'I01'
  sku_name TEXT NOT NULL,              -- "6' Ver 1x6 : 2R : WOOD Post"

  -- Type & Style
  product_type_id UUID REFERENCES product_types_v2(id),
  product_style_id UUID REFERENCES product_styles_v2(id),

  -- Common specifications
  height INTEGER NOT NULL,             -- feet
  post_type TEXT NOT NULL,             -- 'WOOD', 'STEEL'

  -- Product-specific variables (JSONB)
  variables JSONB DEFAULT '{}',
  -- {"rail_count": 2, "post_spacing": 8, "board_count": 12}

  -- Component-to-material mappings (JSONB)
  components JSONB DEFAULT '{}',
  -- {"post": "PS13", "picket": "P601", "rail": "R201", "cap": "C101"}
  -- Keys = component_type codes, Values = material SKU codes

  -- Custom formula overrides (optional, NULL = use templates)
  custom_formulas JSONB DEFAULT NULL,
  -- {"post": "ROUNDUP([Quantity]/10)+2"} -- Override just this component

  -- Cached costs
  standard_material_cost DECIMAL(10,2),
  standard_labor_cost DECIMAL(10,2),
  standard_cost_per_foot DECIMAL(10,2),
  standard_cost_calculated_at TIMESTAMPTZ,

  -- Service Titan sync
  service_titan_id TEXT,

  product_description TEXT,
  is_active BOOLEAN DEFAULT true
);
```

**Horizontal UI Display:** The JSONB `variables` and `components` columns render as horizontal columns in the SKU Catalog table (similar to labor rates page pattern).

#### 7. `bom_projects_v2`
V2 project storage (separate from V1 for safety).

```sql
CREATE TABLE bom_projects_v2 (
  id UUID PRIMARY KEY,
  project_code TEXT UNIQUE NOT NULL,   -- Auto-generated
  project_name TEXT NOT NULL,
  customer_name TEXT,

  -- Project inputs
  net_length DECIMAL(10,2) NOT NULL,
  number_of_lines INTEGER DEFAULT 1,
  number_of_gates INTEGER DEFAULT 0,

  -- Selected SKU
  sku_id UUID REFERENCES sku_catalog_v2(id),

  -- Calculated results (stored as JSONB)
  materials_result JSONB,              -- Component quantities and costs
  labor_result JSONB,                  -- Labor codes and costs

  -- Totals
  total_material_cost DECIMAL(10,2),
  total_labor_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),

  -- Metadata
  created_by UUID REFERENCES user_profiles(id),
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Shared Tables (Read from V1)

These tables are used by BOTH V1 and V2:

| Table | Usage |
|-------|-------|
| `materials` | Material SKUs, costs, dimensions |
| `labor_codes` | Labor code definitions |
| `labor_rates` | Business unit rates |

**V2 Additions to `materials`:**
```sql
ALTER TABLE materials ADD COLUMN IF NOT EXISTS width_inches DECIMAL(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS length_feet DECIMAL(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS qty_per_unit INTEGER;
```

These columns enable formula variable resolution like `[picket.width_inches]`.

---

## Formula Interpreter

**Location:** `src/features/bom_calculator_v2/services/FormulaInterpreter.ts`

**Size:** ~200 lines (vs 1,575 in FenceCalculator.ts)

**Capabilities:**
```typescript
// Supported functions
ROUNDUP(x)    // Math.ceil
ROUND(x)      // Math.round
ROUNDDOWN(x)  // Math.floor
MAX(a, b)     // Math.max
MIN(a, b)     // Math.min
IF(cond, t, f) // Ternary

// Example execution
const context = {
  Quantity: 100,           // 100 ft fence
  Lines: 1,
  Gates: 0,
  variables: { rail_count: 2, post_spacing: 8 },
  styleAdjustments: {},
  materialAttributes: { 'picket.width_inches': 5.5 },
  calculatedValues: {}     // Built up as formulas execute
};

// Formula: 'ROUNDUP([Quantity]/[post_spacing])+1'
// Result: ROUNDUP(100/8)+1 = 13+1 = 14 posts
```

---

## V2 Pages

### Page Structure

| Page | Type | Notes |
|------|------|-------|
| Calculator | **New V2** | Uses FormulaInterpreter, saves to bom_projects_v2 |
| SKU Builder | **New V2** | Saves to sku_catalog_v2 |
| SKU Catalog | **New V2** | Reads sku_catalog_v2, horizontal JSONB display |
| Materials | **Shared** | Same V1 page, reads materials table |
| Labor Rates | **Shared** | Same V1 page, reads labor_rates table |
| Component Configurator | **Shared** | Same V1 page, material eligibility rules |

### Admin-Only Pages (Future)

1. **Formula Editor** - Edit formula_templates_v2 with live preview
2. **Product Types Manager** - Manage product_types_v2 and styles

---

## Migration Plan

### Phase 1: Database Setup
1. Create new V2 tables (with _v2 suffix)
2. Add dimension columns to materials table
3. Seed product types, styles, components
4. Seed formula templates from FenceCalculator.ts logic

### Phase 2: Formula Interpreter
1. Build FormulaInterpreter service
2. Unit test against FenceCalculator.ts results
3. Ensure identical outputs for same inputs

### Phase 3: V2 UI
1. Update bom_calculator_v2 pages to use new tables
2. Wire up FormulaInterpreter
3. Implement horizontal JSONB display for SKU Catalog
4. Add Formula Editor page for admins

### Phase 4: Data Migration
1. Script to convert wood_vertical_products → sku_catalog_v2
2. Script to convert wood_horizontal_products → sku_catalog_v2
3. Script to convert iron_products → sku_catalog_v2
4. Validate all SKU costs match V1

### Phase 5: Testing & Validation
1. Side-by-side comparison: V1 vs V2 calculations
2. User acceptance testing
3. Performance benchmarks

### Phase 6: Cutover (Future)
1. Make V2 the default
2. Deprecate V1 (keep for rollback)
3. Eventually remove V1 code and tables

---

## File Changes Summary

### New Files
```
migrations/
  120_o026_v2_tables.sql           # Core V2 tables (drops old 072 tables)
  121_o026_formula_templates.sql   # Seed formula templates
  122_o026_migrate_skus.sql        # Optional: migrate V1 SKUs to V2

src/features/bom_calculator_v2/
  services/
    FormulaInterpreter.ts          # Formula execution engine (~200 lines)
```

### Modified Files (Rewrite)
```
src/features/bom_calculator_v2/
  BOMCalculatorHub2.tsx            # Update navigation, add shared pages
  pages/SKUCatalogPage.tsx         # Use sku_catalog_v2, horizontal display
  pages/SKUBuilderPage.tsx         # Use sku_catalog_v2, formula preview
  pages/CalculatorPage.tsx         # Use FormulaInterpreter
  hooks/                           # New hooks for V2 tables
```

### Shared from V1 (imported into V2 hub)
```
src/features/bom_calculator/pages/MaterialsPage.tsx
src/features/bom_calculator/pages/LaborRatesPage.tsx
src/features/bom_calculator/pages/ComponentConfiguratorPage.tsx
```

---

## Key Decisions

### 1. Table Naming
**Decision:** Use `_v2` suffix for all new tables
**Rationale:** Clear separation, no risk of breaking V1

### 2. JSONB vs Normalized
**Decision:** Use JSONB for `variables` and `components` in sku_catalog_v2
**Rationale:**
- Flexibility for different product types
- UI displays as horizontal columns anyway
- Easy Excel import/export
- No schema changes needed for new product types

### 3. Formula Storage
**Decision:** Store formulas as executable strings, not parsed AST
**Rationale:**
- Human readable in DB
- Easy to edit via UI
- Simple interpreter (~200 lines)
- Service Titan compatibility

### 4. Rounding Control
**Decision:** `rounding_level` column on formula_templates_v2
**Values:** 'sku', 'project', 'none'
**Rationale:** Some items (nails) should aggregate before rounding

### 5. Custom SKU Formulas
**Decision:** `custom_formulas` JSONB column on sku_catalog_v2
**Rationale:** Allow per-SKU formula overrides without new tables

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Project Tables | New `bom_projects_v2` for safety |
| Custom Builder | Leave for future phase |
| Component Configurator | Share from V1 |
| Yard Integration | Not in V2 (stays V1 only) |
| Analytics | Not in V2 (stays V1 only) |
| SKU Import/Queue | Not in V2 (stays V1 only) |

---

## Open Questions

1. **Service Titan Export:** Should V2 generate ST-compatible formula strings, or just final quantities?

---

## Implementation Order

1. **Migration 120:** Create V2 tables, drop abandoned 072 tables
2. **Migration 121:** Seed formula templates from FenceCalculator.ts logic
3. **FormulaInterpreter.ts:** Build and unit test
4. **SKU Catalog page:** Display sku_catalog_v2 with horizontal JSONB
5. **SKU Builder page:** Create/edit SKUs with formula preview
6. **Calculator page:** Wire up FormulaInterpreter
7. **Hub navigation:** Add shared pages (Materials, Labor, Components)
8. **Migration 122 (optional):** Script to migrate V1 SKUs → V2

---

*Created: December 9, 2024*
*Updated: December 9, 2024*
*Roadmap Item: O-026*
