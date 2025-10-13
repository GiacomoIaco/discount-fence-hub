# BOM Calculator Implementation Plan
**Version**: 1.0
**Last Updated**: 2025-10-13
**Status**: Planning Complete - Ready for Implementation

---

## 🎯 Executive Summary

Build a Bill of Materials (BOM) and Bill of Labor (BOL) calculator for Discount Fence USA with **one unified calculation engine** applied in two contexts:

1. **SKU Builder Context**: Single SKU pricing for catalog (rounds immediately)
2. **Project Context**: Multi-SKU estimates with project-level aggregation (round once)

**Key Principle**: ONE calculator, ONE source of truth, TWO application modes.

---

## 📐 System Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     BOM Calculator System                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        Unified FenceCalculator Engine                 │  │
│  │  (Single source of truth for all formulas)            │  │
│  └──────────────────────────────────────────────────────┘  │
│                    ↓                 ↓                        │
│         ┌──────────────┐   ┌──────────────────┐            │
│         │ SKU Builder  │   │  Project         │            │
│         │ Context      │   │  Context         │            │
│         │              │   │                  │            │
│         │ • Round      │   │ • Aggregate      │            │
│         │   immediately│   │   first          │            │
│         │ • Single SKU │   │ • Round once     │            │
│         │ • Catalog    │   │ • Multi-SKU      │            │
│         │   pricing    │   │ • Manual adjust  │            │
│         └──────────────┘   └──────────────────┘            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                         ↓
            ┌────────────────────────┐
            │  Supabase PostgreSQL   │
            │  • 11 tables           │
            │  • Decimal precision   │
            │  • Generated columns   │
            └────────────────────────┘
```

### Technology Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **State Management**: React hooks + Context API
- **Database**: Supabase (PostgreSQL)
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library
- **Type Safety**: Strict TypeScript (no `any`)

---

## 📋 Implementation Phases

### Phase 0: Prerequisites (Complete ✅)
- [x] Database schema designed
- [x] Business logic documented (02-BUSINESS_LOGIC.md)
- [x] CSV data exported from Airtable
- [x] UI patterns documented
- [x] Architecture decisions made

### Phase 1: Database Setup (Week 1)
**Goal**: Establish database foundation with seed data

#### Tasks
- [ ] **1.1** Create Supabase project (if not exists)
- [ ] **1.2** Run schema migration (`01_schema.sql`)
- [ ] **1.3** Create seed data SQL files:
  - [ ] `02_seed_business_units.sql` (6 BUs)
  - [ ] `03_seed_materials.sql` (136 materials)
  - [ ] `04_seed_labor_codes.sql` (29 codes)
  - [ ] `05_seed_labor_rates.sql` (174 combinations)
  - [ ] `06_seed_products.sql` (50+ SKUs)
- [ ] **1.4** Run all seed data migrations
- [ ] **1.5** Verify data integrity with test queries
- [ ] **1.6** Set up Row Level Security (RLS) policies
- [ ] **1.7** Create database views for common queries

#### Deliverables
- ✅ Populated database with all reference data
- ✅ RLS policies protecting data
- ✅ SQL migration files for reproducibility

#### Acceptance Criteria
- All 11 tables exist with correct structure
- Can query: "Show all labor rates for ATX-RES"
- Can query: "Show materials for SKU A01"
- RLS prevents unauthorized access
- Seed data matches CSV exports exactly

---

### Phase 2: TypeScript Foundation (Week 1-2)
**Goal**: Create type-safe interfaces matching database schema

#### Tasks
- [ ] **2.1** Generate database types from Supabase
- [ ] **2.2** Create domain types:
  ```typescript
  src/features/bom_calculator/types/
  ├── database.types.ts        // Generated from Supabase
  ├── domain.types.ts          // Business domain types
  ├── calculator.types.ts      // Calculator input/output types
  └── index.ts                 // Barrel exports
  ```
- [ ] **2.3** Define calculator interfaces:
  - CalculatorContext (mode, rounding strategy)
  - SKUBuilderInput / SKUBuilderOutput
  - ProjectInput / ProjectOutput
  - LineItemCalculation
  - MaterialQuantity
  - LaborQuantity
- [ ] **2.4** Create type guards and validators
- [ ] **2.5** Set up strict TypeScript config

#### Deliverables
- ✅ Complete TypeScript type definitions
- ✅ Type-safe database queries
- ✅ No `any` types in codebase

#### Acceptance Criteria
- TypeScript compiles with zero errors
- Database queries are fully typed
- Calculator inputs/outputs have explicit types
- Type guards prevent runtime errors

---

### Phase 3: Unified Calculator Engine (Week 2-3)
**Goal**: Build single calculation engine with dual-context support

#### File Structure
```typescript
src/features/bom_calculator/calculator/
├── FenceCalculator.ts           // Main calculator class
├── formulas/
│   ├── woodVertical.ts          // Wood vertical formulas
│   ├── woodHorizontal.ts        // Wood horizontal formulas
│   ├── iron.ts                  // Iron formulas
│   ├── concrete.ts              // Concrete calculations
│   ├── hardware.ts              // Hardware (nails, brackets)
│   └── labor.ts                 // Labor code selection
├── aggregation/
│   ├── materialAggregator.ts    // Aggregate materials
│   ├── laborAggregator.ts       // Aggregate labor
│   └── roundingStrategy.ts      // Rounding logic
└── __tests__/
    ├── woodVertical.test.ts     // Formula unit tests
    ├── aggregation.test.ts      // Aggregation tests
    └── integration.test.ts      // End-to-end tests
```

#### Implementation Steps

##### 3.1 Formula Implementation
```typescript
// Example: Wood Vertical Posts
export function calculateWoodVerticalPosts(
  netLength: number,
  style: WoodVerticalStyle,
  numberOfLines: number
): number {
  // Base post spacing
  const spacing =
    style === 'Good Neighbor-RES' || style === 'Good Neighbor-HB'
      ? 7.71
      : 8.0;

  // Base posts (sections + 1)
  let posts = Math.ceil(netLength / spacing) + 1;

  // Add extra posts for multiple lines
  if (numberOfLines > 2) {
    const extraPosts = Math.ceil((numberOfLines - 2) / 2);
    posts += extraPosts;
  }

  return posts; // Returns DECIMAL
}
```

##### 3.2 Calculator Context Pattern
```typescript
interface CalculatorContext {
  mode: 'sku-builder' | 'project';
  roundingStrategy: 'immediate' | 'aggregate';
}

class FenceCalculator {
  calculate(input: CalculatorInput, context: CalculatorContext) {
    if (context.mode === 'sku-builder') {
      return this.calculateForSKUBuilder(input);
    } else {
      return this.calculateForProject(input);
    }
  }

  private calculateForSKUBuilder(input: SingleSKUInput) {
    // Calculate with immediate rounding
    const materials = this.calculateMaterials(input.sku, input.netLength);
    const rounded = this.roundMaterials(materials, 'immediate');
    return { materials: rounded, ... };
  }

  private calculateForProject(input: MultiSKUInput) {
    // Calculate all line items (keep decimals)
    const lineItems = input.lineItems.map(li =>
      this.calculateLineItem(li)
    );

    // Aggregate (sum decimals)
    const aggregated = this.aggregateMaterials(lineItems);

    // Round ONCE at project level
    const rounded = this.roundMaterials(aggregated, 'aggregate');

    return { lineItems, materials: rounded, ... };
  }
}
```

##### 3.3 Concrete Calculation (Project-Level)
```typescript
function calculateConcrete(
  totalPosts: number,
  concreteType: ConcreteType
): ConcreteQuantities {
  switch (concreteType) {
    case '3-part':
      return {
        CTS: Math.ceil(totalPosts / 10),
        CTP: Math.ceil(totalPosts / 20),
        CTQ: totalPosts * 0.5
      };
    case 'yellow-bags':
      return {
        CTY: Math.ceil(totalPosts * 0.65)
      };
    case 'red-bags':
      return {
        CTR: totalPosts * 1
      };
  }
}
```

##### 3.4 Labor Code Selection (Post Type Logic)
```typescript
function getWoodVerticalLaborCodes(
  sku: WoodVerticalProduct,
  lineItem: LineItemInput
): string[] {
  const codes: string[] = [];

  // Set posts (same for wood or steel)
  codes.push('W02');

  // Height-based nail up (DEPENDS ON POST TYPE!)
  if (sku.height <= 6) {
    codes.push(sku.post_type === 'STEEL' ? 'M03' : 'W03');
  } else {
    codes.push(sku.post_type === 'STEEL' ? 'M04' : 'W04');
  }

  // Good Neighbor (DEPENDS ON POST TYPE!)
  if (sku.style.includes('Good Neighbor')) {
    codes.push(sku.post_type === 'STEEL' ? 'M06' : 'W06');
  }

  // Cap and Trim
  if (sku.cap_material_id && sku.trim_material_id) {
    codes.push(sku.post_type === 'STEEL' ? 'M07' : 'W07');
  }

  return codes;
}
```

#### Tasks
- [ ] **3.1** Implement all formulas from 02-BUSINESS_LOGIC.md
- [ ] **3.2** Create FenceCalculator class with context support
- [ ] **3.3** Build material aggregation logic
- [ ] **3.4** Build labor aggregation logic
- [ ] **3.5** Implement rounding strategies
- [ ] **3.6** Add concrete calculation (project-level)
- [ ] **3.7** Add labor code selection logic
- [ ] **3.8** Write comprehensive unit tests
- [ ] **3.9** Create test fixtures with known results
- [ ] **3.10** Validate against production Airtable data

#### Deliverables
- ✅ FenceCalculator class (single source of truth)
- ✅ All formulas from documentation implemented
- ✅ 90%+ test coverage
- ✅ Calculations match Airtable system exactly

#### Acceptance Criteria
- Test case: "100ft A01" returns exact materials
- Test case: "2 line items aggregate correctly"
- Test case: "WOOD posts use W03, STEEL posts use M03"
- Test case: "Concrete calculates after aggregation"
- All tests pass with known production data

---

### Phase 4: Database Service Layer (Week 3)
**Goal**: Create type-safe database access layer

#### File Structure
```typescript
src/features/bom_calculator/services/
├── supabase.ts                  // Supabase client setup
├── businessUnits.service.ts     // BU queries
├── materials.service.ts         // Materials CRUD
├── laborRates.service.ts        // Labor rate lookups
├── products.service.ts          // SKU queries
├── projects.service.ts          // Project CRUD
└── __tests__/
    └── services.test.ts         // Service tests
```

#### Key Services

##### 4.1 Products Service
```typescript
class ProductsService {
  async getWoodVerticalProduct(skuCode: string) {
    const { data, error } = await supabase
      .from('wood_vertical_products')
      .select(`
        *,
        post_material:materials!post_material_id(*),
        picket_material:materials!picket_material_id(*),
        rail_material:materials!rail_material_id(*)
      `)
      .eq('sku_code', skuCode)
      .single();

    if (error) throw error;
    return data;
  }
}
```

##### 4.2 Labor Rates Service
```typescript
class LaborRatesService {
  async getLaborRate(
    laborCode: string,
    businessUnitCode: string
  ): Promise<number> {
    const { data, error } = await supabase
      .from('labor_rates')
      .select(`
        rate,
        labor_code:labor_codes!inner(labor_sku),
        business_unit:business_units!inner(code)
      `)
      .eq('labor_code.labor_sku', laborCode)
      .eq('business_unit.code', businessUnitCode)
      .single();

    if (error) throw error;
    return data.rate;
  }
}
```

##### 4.3 Projects Service
```typescript
class ProjectsService {
  async createProject(projectData: CreateProjectInput) {
    // Transaction: Create project + line items + calculate
    const { data: project } = await supabase
      .from('bom_projects')
      .insert(projectData)
      .select()
      .single();

    return project;
  }

  async saveCalculationResults(
    projectId: string,
    materials: MaterialQuantity[],
    labor: LaborQuantity[]
  ) {
    // Save aggregated BOM/BOL
    await supabase.from('project_materials').upsert(materials);
    await supabase.from('project_labor').upsert(labor);
  }
}
```

#### Tasks
- [ ] **4.1** Set up Supabase client
- [ ] **4.2** Create service classes for each table
- [ ] **4.3** Implement complex queries with joins
- [ ] **4.4** Add error handling and retries
- [ ] **4.5** Create service hooks for React
- [ ] **4.6** Write integration tests

#### Deliverables
- ✅ Complete database service layer
- ✅ Type-safe queries
- ✅ React hooks for data fetching

#### Acceptance Criteria
- Can fetch SKU with all materials
- Can get labor rate for any BU + code
- Can save/load projects
- Queries handle errors gracefully

---

### Phase 5: React Hooks & State Management (Week 3-4)
**Goal**: Create reusable hooks for calculator functionality

#### File Structure
```typescript
src/features/bom_calculator/hooks/
├── useCalculator.ts             // Main calculator hook
├── useSKUBuilder.ts             // SKU builder hook
├── useProject.ts                // Project management hook
├── useProducts.ts               // Product queries
├── useMaterials.ts              // Materials queries
├── useLaborRates.ts             // Labor rate queries
└── __tests__/
    └── hooks.test.ts            // Hook tests
```

#### Key Hooks

##### 5.1 Main Calculator Hook
```typescript
function useCalculator(context: CalculatorContext) {
  const calculator = useMemo(() => new FenceCalculator(), []);

  const calculate = useCallback((input: CalculatorInput) => {
    return calculator.calculate(input, context);
  }, [calculator, context]);

  return { calculate };
}
```

##### 5.2 SKU Builder Hook
```typescript
function useSKUBuilder() {
  const [sku, setSKU] = useState<WoodVerticalProduct | null>(null);
  const [testLength, setTestLength] = useState(100);
  const { calculate } = useCalculator({ mode: 'sku-builder' });

  const calculateStandardCost = useCallback(() => {
    if (!sku) return null;

    return calculate({
      skus: [{ sku, netLength: testLength }],
      roundImmediately: true
    });
  }, [sku, testLength, calculate]);

  const saveSKU = useCallback(async (result: CalculatorOutput) => {
    // Update SKU with standard costs
    await supabase
      .from('wood_vertical_products')
      .update({
        standard_material_cost: result.materialCost,
        standard_labor_cost: result.laborCost,
        standard_cost_per_foot: result.costPerFoot,
        standard_cost_calculated_at: new Date()
      })
      .eq('id', sku.id);
  }, [sku]);

  return {
    sku,
    setSKU,
    testLength,
    setTestLength,
    calculateStandardCost,
    saveSKU
  };
}
```

##### 5.3 Project Hook
```typescript
function useProject(projectId?: string) {
  const [project, setProject] = useState<BOMProject | null>(null);
  const [lineItems, setLineItems] = useState<ProjectLineItem[]>([]);
  const { calculate } = useCalculator({ mode: 'project' });

  const addLineItem = useCallback((lineItem: NewLineItem) => {
    setLineItems(prev => [...prev, lineItem]);
  }, []);

  const calculateProject = useCallback(async () => {
    if (lineItems.length === 0) return;

    // Calculate with aggregation
    const result = calculate({
      lineItems,
      aggregateFirst: true
    });

    // Save to database
    await projectsService.saveCalculationResults(
      project.id,
      result.materials,
      result.labor
    );

    return result;
  }, [lineItems, project, calculate]);

  return {
    project,
    lineItems,
    addLineItem,
    calculateProject
  };
}
```

#### Tasks
- [ ] **5.1** Create calculator hooks
- [ ] **5.2** Create data fetching hooks
- [ ] **5.3** Implement optimistic updates
- [ ] **5.4** Add loading/error states
- [ ] **5.5** Write hook tests

#### Deliverables
- ✅ Reusable calculator hooks
- ✅ Type-safe state management
- ✅ Error handling

#### Acceptance Criteria
- Hooks manage calculator state correctly
- Loading states work properly
- Error states display helpful messages
- Hooks can be composed together

---

### Phase 6: UI Components - SKU Builder (Week 4-5)
**Goal**: Build admin interface for creating/editing SKUs

#### Component Structure
```typescript
src/features/bom_calculator/components/sku-builder/
├── SKUBuilderModal.tsx          // Main modal
├── SKUTypeSelector.tsx          // Wood Vert/Horiz/Iron tabs
├── MaterialSelector.tsx         // Select post/picket/rail
├── SpecificationForm.tsx        // Height, rails, style
├── CostPreview.tsx              // Standard cost display
└── __tests__/
    └── sku-builder.test.tsx     // Component tests
```

#### Features
- Tab navigation (Wood Vertical | Wood Horizontal | Iron)
- Material selection with autocomplete
- Live cost calculation preview
- Save SKU with standard cost
- Edit existing SKUs

#### Tasks
- [ ] **6.1** Build modal shell with tabs
- [ ] **6.2** Create material selector dropdowns
- [ ] **6.3** Build specification form
- [ ] **6.4** Add live cost preview
- [ ] **6.5** Implement save functionality
- [ ] **6.6** Add validation
- [ ] **6.7** Write component tests

#### Deliverables
- ✅ Functional SKU Builder interface
- ✅ Real-time cost updates
- ✅ Form validation

#### Acceptance Criteria
- Can create new SKU (A01, B04, etc.)
- Material dropdowns show only relevant materials
- Cost updates as you type
- Saves to database correctly
- Matches UI from production system

---

### Phase 7: UI Components - SKU Catalog (Week 5)
**Goal**: Browse and search existing SKUs

#### Component Structure
```typescript
src/features/bom_calculator/components/sku-catalog/
├── SKUCatalogModal.tsx          // Main modal
├── SKUGrid.tsx                  // Grid view of SKUs
├── SKUCard.tsx                  // Individual SKU card
├── SKUFilters.tsx               // Filter by type/height/style
└── __tests__/
    └── sku-catalog.test.tsx     // Component tests
```

#### Features
- Grid view of all active SKUs
- Filter by fence type, height, post type, style
- Search by SKU code or name
- Click to edit (opens SKU Builder)
- Display standard cost per foot

#### Tasks
- [ ] **7.1** Build modal with grid layout
- [ ] **7.2** Create SKU cards with key info
- [ ] **7.3** Add filter controls
- [ ] **7.4** Implement search
- [ ] **7.5** Add edit functionality
- [ ] **7.6** Write component tests

#### Deliverables
- ✅ Browsable SKU catalog
- ✅ Filter and search
- ✅ Edit integration

#### Acceptance Criteria
- Shows all active SKUs
- Filters work correctly
- Search finds SKUs by code/name
- Clicking SKU opens edit modal
- Performance good with 100+ SKUs

---

### Phase 8: UI Components - Project Calculator (Week 6-7)
**Goal**: Build main calculator for multi-SKU projects

#### Component Structure
```typescript
src/features/bom_calculator/components/project/
├── ProjectCalculator.tsx        // Main calculator view
├── ProjectHeader.tsx            // Project name, customer, BU
├── LineItemList.tsx             // List of SKUs in project
├── LineItemCard.tsx             // Individual line item
├── SKUSearchModal.tsx           // Add SKU to project
├── BOMTable.tsx                 // Materials display
├── BOLTable.tsx                 // Labor display
├── ProjectTotals.tsx            // Cost summary
└── __tests__/
    └── project.test.tsx         // Component tests
```

#### Features
- Project details form (name, customer, BU)
- Add multiple line items (SKUs)
- Each line item: SKU, footage, buffer, lines, gates
- Calculate button
- BOM table with quantities (calculated → rounded → final)
- BOL table with labor codes and rates
- Project totals (materials, labor, total, $/ft)
- Manual adjustments
- Save project
- Export to PDF/Excel (future)

#### Tasks
- [ ] **8.1** Build project header form
- [ ] **8.2** Create line item list
- [ ] **8.3** Build SKU search/add modal
- [ ] **8.4** Implement calculate button
- [ ] **8.5** Build BOM table with manual overrides
- [ ] **8.6** Build BOL table
- [ ] **8.7** Create totals display
- [ ] **8.8** Add save/load functionality
- [ ] **8.9** Write component tests

#### Deliverables
- ✅ Complete project calculator UI
- ✅ Multi-SKU support
- ✅ Manual overrides
- ✅ Save/load projects

#### Acceptance Criteria
- Can create project with multiple SKUs
- Calculate aggregates correctly
- BOM shows calculated vs final quantities
- Labor codes match post types
- Totals calculate correctly
- Saves to database
- Loads existing projects

---

### Phase 9: UI Components - Projects List (Week 7)
**Goal**: View and manage saved projects

#### Component Structure
```typescript
src/features/bom_calculator/components/projects/
├── ProjectsListModal.tsx        // Main modal
├── ProjectsTable.tsx            // Table of projects
├── ProjectRow.tsx               // Individual project row
├── ProjectFilters.tsx           // Filter by BU/status
└── __tests__/
    └── projects.test.tsx        // Component tests
```

#### Features
- List all projects
- Filter by BU, status, date range
- Search by customer name
- Click to open in calculator
- Delete projects
- Duplicate projects

#### Tasks
- [ ] **9.1** Build modal with table
- [ ] **9.2** Create project rows with key info
- [ ] **9.3** Add filter controls
- [ ] **9.4** Implement search
- [ ] **9.5** Add open/delete/duplicate actions
- [ ] **9.6** Write component tests

#### Deliverables
- ✅ Projects list interface
- ✅ Filter and search
- ✅ Project actions

#### Acceptance Criteria
- Shows all user's projects
- Filters work correctly
- Search finds by customer name
- Can open project in calculator
- Can delete projects
- Performance good with 100+ projects

---

### Phase 10: Integration & Polish (Week 8)
**Goal**: Connect all pieces and polish UX

#### Tasks
- [ ] **10.1** Wire up all modals to header buttons
- [ ] **10.2** Add keyboard shortcuts
- [ ] **10.3** Implement responsive design (mobile)
- [ ] **10.4** Add loading states throughout
- [ ] **10.5** Add error boundaries
- [ ] **10.6** Implement toast notifications
- [ ] **10.7** Add confirmation dialogs
- [ ] **10.8** Optimize performance
- [ ] **10.9** Add analytics tracking
- [ ] **10.10** Final QA testing

#### Deliverables
- ✅ Fully integrated system
- ✅ Polished UX
- ✅ Mobile responsive

#### Acceptance Criteria
- All modals work together
- No console errors
- Fast and responsive
- Works on mobile
- User-friendly error messages

---

### Phase 11: Testing & Validation (Week 8-9)
**Goal**: Comprehensive testing against production data

#### Test Plan

##### Unit Tests (Target: 90% coverage)
- [ ] All calculator formulas
- [ ] All aggregation logic
- [ ] All rounding strategies
- [ ] All labor code selection
- [ ] All service methods
- [ ] All hooks

##### Integration Tests
- [ ] Database queries return correct data
- [ ] Calculator + Database work together
- [ ] Hooks + Services work together
- [ ] UI components + Hooks work together

##### End-to-End Tests
- [ ] Create SKU → Calculate → Save
- [ ] Create Project → Add SKUs → Calculate → Save
- [ ] Load Project → Modify → Recalculate → Save
- [ ] Manual override → Recalculate → Verify

##### Production Validation
- [ ] Compare 10 SKUs with Airtable (exact match)
- [ ] Compare 10 projects with Airtable (exact match)
- [ ] Test all business units (6 BUs)
- [ ] Test all fence types (Wood Vert/Horiz/Iron)
- [ ] Test all concrete types (3-part/Yellow/Red)

#### Tasks
- [ ] **11.1** Write all unit tests
- [ ] **11.2** Write integration tests
- [ ] **11.3** Set up E2E testing framework
- [ ] **11.4** Write E2E test scenarios
- [ ] **11.5** Compare with production data
- [ ] **11.6** Fix any discrepancies
- [ ] **11.7** Document test results

#### Deliverables
- ✅ 90%+ test coverage
- ✅ All tests passing
- ✅ Production validation complete

#### Acceptance Criteria
- All tests pass
- Calculations match Airtable exactly
- No regressions from production

---

### Phase 12: Deployment (Week 9)
**Goal**: Deploy to production

#### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Database migrations ready
- [ ] RLS policies verified
- [ ] Performance tested
- [ ] Security reviewed
- [ ] Documentation complete
- [ ] User training materials prepared

#### Deployment Steps
1. **Staging Deployment**
   - [ ] Deploy to staging environment
   - [ ] Run full test suite
   - [ ] User acceptance testing (UAT)
   - [ ] Fix any issues

2. **Production Deployment**
   - [ ] Schedule maintenance window
   - [ ] Backup production database
   - [ ] Run database migrations
   - [ ] Deploy application
   - [ ] Verify deployment
   - [ ] Monitor for errors

3. **Post-Deployment**
   - [ ] Verify all features work
   - [ ] Monitor performance
   - [ ] Monitor error logs
   - [ ] Collect user feedback
   - [ ] Document any issues

#### Rollback Plan
- Database backups ready
- Previous version available
- Rollback procedure documented

---

## 🧪 Testing Strategy

### Test Categories

#### 1. Formula Accuracy
```typescript
describe('calculateWoodVerticalPosts', () => {
  it('calculates standard 100ft correctly', () => {
    const posts = calculateWoodVerticalPosts(100, 'Standard', 1);
    expect(posts).toBe(14.25); // Decimal, not rounded
  });

  it('calculates Good Neighbor correctly', () => {
    const posts = calculateWoodVerticalPosts(100, 'Good Neighbor-RES', 1);
    expect(posts).toBe(14); // Different spacing
  });
});
```

#### 2. Aggregation Logic
```typescript
describe('materialAggregator', () => {
  it('aggregates posts from multiple line items', () => {
    const line1 = { posts: 14.25 };
    const line2 = { posts: 7.125 };
    const aggregated = aggregateMaterials([line1, line2]);
    expect(aggregated.posts).toBe(21.375); // Sum, not rounded yet
  });
});
```

#### 3. Context Switching
```typescript
describe('FenceCalculator', () => {
  it('rounds immediately in SKU builder mode', () => {
    const result = calculator.calculate(input, { mode: 'sku-builder' });
    expect(result.materials.posts).toBe(15); // Integer
  });

  it('rounds after aggregation in project mode', () => {
    const result = calculator.calculate(input, { mode: 'project' });
    expect(result.materials.posts).toBe(22); // Aggregated, then rounded
  });
});
```

#### 4. Labor Code Selection
```typescript
describe('getLaborCodes', () => {
  it('uses W codes for wood posts', () => {
    const sku = { post_type: 'WOOD', height: 6 };
    const codes = getLaborCodes(sku);
    expect(codes).toContain('W03');
    expect(codes).not.toContain('M03');
  });

  it('uses M codes for steel posts', () => {
    const sku = { post_type: 'STEEL', height: 6 };
    const codes = getLaborCodes(sku);
    expect(codes).toContain('M03');
    expect(codes).not.toContain('W03');
  });
});
```

### Production Validation

#### Test Cases from Production
```typescript
const PRODUCTION_TEST_CASES = [
  {
    name: 'A01 Standard',
    sku: 'A01',
    netLength: 100,
    expected: {
      posts: 15,
      pickets: 229,
      rails: 26,
      materialCost: 1200.00,
      laborCost: 400.00
    }
  },
  // ... more cases from Airtable
];

describe('Production Validation', () => {
  PRODUCTION_TEST_CASES.forEach(testCase => {
    it(`matches Airtable for ${testCase.name}`, () => {
      const result = calculator.calculate(testCase);
      expect(result.materials.posts).toBe(testCase.expected.posts);
      expect(result.materials.pickets).toBe(testCase.expected.pickets);
      // ... more assertions
    });
  });
});
```

---

## 📊 Data Migration Plan

### Step 1: Export from Airtable (Complete ✅)
- [x] Export all tables as CSV
- [x] Verify data integrity
- [x] Document data structure

### Step 2: Clean CSV Data
- [ ] Remove test/invalid records
- [ ] Standardize formats (dates, decimals)
- [ ] Resolve any data inconsistencies
- [ ] Document cleaning decisions

### Step 3: Generate Seed SQL
```bash
# Script to convert CSV to SQL
node scripts/csv-to-sql.js \
  --input "Airtable Sample Tables/Business Units.csv" \
  --output "database/02_seed_business_units.sql" \
  --table "business_units"
```

### Step 4: Validate Seed Data
- [ ] Run seed scripts in test database
- [ ] Verify row counts match CSV
- [ ] Run test queries
- [ ] Check foreign key relationships

### Step 5: Production Migration
- [ ] Backup production database
- [ ] Run migrations in transaction
- [ ] Verify data integrity
- [ ] Run smoke tests

---

## ✅ Success Criteria

### Functional Requirements
- [ ] Can create SKUs with all material selections
- [ ] SKU Builder calculates standard cost correctly
- [ ] Can create projects with multiple SKUs
- [ ] Project Calculator aggregates correctly
- [ ] Concrete calculates at project level
- [ ] Labor codes vary by post type
- [ ] Labor rates vary by business unit
- [ ] Manual overrides work in projects
- [ ] Projects save and load correctly

### Non-Functional Requirements
- [ ] All calculations match Airtable exactly
- [ ] UI matches production system look/feel
- [ ] TypeScript strict mode with no `any`
- [ ] 90%+ test coverage
- [ ] Page load < 2 seconds
- [ ] Calculate button responds < 500ms
- [ ] Mobile responsive
- [ ] Accessible (WCAG AA)

### Business Requirements
- [ ] Operations can create projects
- [ ] Admin can create/edit SKUs
- [ ] Cost estimates are accurate
- [ ] System is easier to use than Airtable
- [ ] System is faster than Airtable
- [ ] No data loss from migration

---

## 🎓 Key Learnings & Decisions

### Architecture Decisions

#### ✅ Single Calculator, Two Contexts
**Decision**: One FenceCalculator class with context-aware behavior
**Rationale**: DRY, single source of truth, easier to maintain
**Alternative Rejected**: Separate SKUCalculator and ProjectCalculator classes

#### ✅ Decimal Storage in Database
**Decision**: Store decimals in line items, round at project level
**Rationale**: Prevents cumulative rounding errors
**Alternative Rejected**: Round immediately at line item level

#### ✅ Post Type Determines Labor Codes
**Decision**: Check `post_type` field to select W vs M codes
**Rationale**: Same fence type can have different post types
**Alternative Rejected**: Base labor codes on fence type alone

#### ✅ Fence-Type Specific Tables
**Decision**: Separate tables for wood_vertical, wood_horizontal, iron
**Rationale**: Type safety, explicit, easier to query
**Alternative Rejected**: Single products table with JSON fields

#### ✅ Labor Rates by Business Unit
**Decision**: Junction table: labor_code × business_unit → rate
**Rationale**: Rates vary by location and client type
**Alternative Rejected**: Single rate column in labor_codes

### Technical Decisions

#### ✅ Supabase over Airtable
**Pros**: Cheaper, more flexible, SQL power, better performance
**Cons**: More setup, need to manage migrations
**Decision**: Supabase

#### ✅ TypeScript Strict Mode
**Pros**: Catch errors at compile time, self-documenting
**Cons**: More initial setup, steeper learning curve
**Decision**: Strict TypeScript

#### ✅ React Hooks over Redux
**Pros**: Simpler, less boilerplate, built-in
**Cons**: Can be harder to debug, less structure
**Decision**: React Hooks + Context API

---

## 🚨 Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Calculations don't match Airtable | Medium | High | Extensive testing with production data |
| Performance issues with large projects | Low | Medium | Optimize queries, add pagination |
| Data migration errors | Medium | High | Thorough validation, backup strategy |
| TypeScript complexity slows development | Low | Low | Team training, good examples |
| Supabase downtime | Low | High | Monitor status, have backup plan |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Users resist new system | Medium | High | User training, gradual rollout |
| Missing features from Airtable | Medium | Medium | Feature parity checklist |
| Data loss during migration | Low | Critical | Multiple backups, validation |
| Cost overruns | Low | Medium | Clear scope, phased approach |

### Mitigation Strategies

#### For Calculation Accuracy
1. Unit test every formula
2. Compare 50+ real projects with Airtable
3. Beta testing with operations team
4. Parallel run both systems initially

#### For User Adoption
1. Match UI to production system
2. Provide comprehensive training
3. Create user documentation
4. Offer support during transition

#### For Data Safety
1. Multiple database backups
2. Validation at every step
3. Rollback plan ready
4. Test in staging first

---

## 📚 Documentation Requirements

### Code Documentation
- [ ] JSDoc comments on all public methods
- [ ] README in each major folder
- [ ] Architecture decision records (ADRs)
- [ ] API documentation

### User Documentation
- [ ] User guide for operations
- [ ] Admin guide for SKU management
- [ ] FAQ document
- [ ] Video tutorials

### Technical Documentation
- [ ] Database schema documentation
- [ ] API documentation
- [ ] Deployment guide
- [ ] Troubleshooting guide

---

## 🔄 Maintenance & Evolution

### Post-Launch Tasks

#### Week 1-2 After Launch
- [ ] Monitor error logs daily
- [ ] Collect user feedback
- [ ] Fix critical bugs immediately
- [ ] Document common issues

#### Month 1
- [ ] Analyze usage patterns
- [ ] Optimize slow queries
- [ ] Add requested features
- [ ] Refine UI based on feedback

#### Month 3
- [ ] Review test coverage
- [ ] Update documentation
- [ ] Plan next features
- [ ] Performance audit

### Future Enhancements

#### Phase 13: QuickBooks Integration (Future)
- Export projects to QuickBooks
- Sync labor codes
- Sync materials

#### Phase 14: Templates & Presets (Future)
- Common project templates
- Favorite SKU combinations
- Quick estimates

#### Phase 15: Advanced Analytics (Future)
- Cost trends over time
- Most profitable SKUs
- Material usage reports

#### Phase 16: Mobile App (Future)
- Field estimates on phone/tablet
- Photo attachments
- GPS location tracking

---

## 📞 Support & Resources

### Team Roles
- **Development**: Build features, write tests, fix bugs
- **QA**: Test functionality, validate calculations
- **Operations**: User acceptance testing, feedback
- **Admin**: SKU management, configuration

### External Resources
- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://react.dev
- **TypeScript Handbook**: https://www.typescriptlang.org/docs
- **Testing Library**: https://testing-library.com

### Internal Resources
- **Business Logic**: `02-BUSINESS_LOGIC.md`
- **Database Schema**: `database/01_schema.sql`
- **Production System**: https://dfegenspark.netlify.app
- **Airtable Data**: `Airtable Sample Tables/*.csv`

---

## 🎯 Definition of Done

A phase is complete when:
- [ ] All tasks completed
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] User acceptance testing passed
- [ ] No critical bugs
- [ ] Performance acceptable
- [ ] Deployed to staging

The entire project is complete when:
- [ ] All 12 phases complete
- [ ] Production validation passed
- [ ] User training complete
- [ ] Documentation complete
- [ ] Deployed to production
- [ ] Monitoring in place
- [ ] Airtable system can be retired

---

**This plan serves as the single source of truth for BOM Calculator implementation. Update this document as decisions are made and keep it current throughout development.**

---

**Last Updated**: 2025-10-13
**Next Review**: After each phase completion
**Status**: ✅ Ready to Begin Phase 1
