# BOM/BOL Calculator - Project Context

**For Claude Code:** This document provides deep business context and architectural decisions.

---

## 🏢 Business Context

### Company: Discount Fence USA
- **Industry:** Residential & Commercial Fencing
- **Locations:** Austin, San Antonio, Houston (Texas)
- **Customer Types:** Residential homeowners, Home builders
- **Annual Revenue:** Mid-market contractor
- **Philosophy:** "Easier is better" - prioritize simple, efficient workflows

### Current Process (Manual - Being Automated)
1. **Sales Team** creates estimate in Service Titan
2. **Estimator** manually calculates materials needed
3. **Estimator** manually calculates labor costs
4. **Materials** ordered based on estimate
5. **Yard** pulls materials for job
6. **Crew** installs fence
7. **Accounting** tracks costs in QuickBooks Online

### Pain Points (What This App Solves)
- ❌ Manual calculations error-prone (10-15% variance)
- ❌ Takes 30-45 minutes per estimate
- ❌ Inconsistent between estimators
- ❌ No historical data on material usage
- ❌ Can't easily update pricing
- ❌ Disconnect between estimate and actual materials

---

## 🎯 Product Vision

### MVP (Current - Production)
- **Input:** Fence specs (type, length, height, location)
- **Output:** Complete BOM + BOL with costs
- **Users:** Estimators only (6-8 people)
- **Data:** Airtable (manual entry)

### V2 (This Migration)
- **Integrated:** Part of larger operational system
- **Modern Stack:** TypeScript, Supabase, proper testing
- **Better UX:** Faster, more intuitive
- **Maintainable:** Clear code, documented formulas

### V3 (Future Vision)
- **Service Titan Integration:** Auto-sync projects
- **Mobile Access:** Crew can view BOM on-site
- **Historical Analysis:** "What did similar jobs actually use?"
- **Purchase Order Generation:** Send to suppliers directly
- **QBO Sync:** Automatic cost tracking

---

## 🏗️ Architecture Evolution

### Stage 1: Original Manual Process (Before)
```
Excel Spreadsheet → Email to Yard → Manual material pull
Problems: Error-prone, slow, no audit trail
```

### Stage 2: Current App (Airtable + React CDN)
```
Web App → Airtable API → Calculations → BOM/BOL Output
Wins: Consistent calculations, faster estimates
Issues: Expensive, limited, abstract data model
```

### Stage 3: Target Architecture (Integrated System)
```
Larger App
├── Auth Module (shared)
├── UI Components (shared)
├── Database (Supabase - shared)
├── BOM Calculator Module
│   ├── Components
│   ├── Services (FenceCalculator)
│   └── Types
└── Other Modules
```

---

## 📊 Data Model Philosophy

### What We Learned (The Hard Way)

#### ❌ **Mistake 1: Abstract SKU Master**
```javascript
// Original approach - ABSTRACT
{
  "SKU": "WV-STD-6-WOOD",
  "Category": "Wood Vertical",
  "Height": 6
  // Then lookup materials via junction tables
  // Then figure out what they mean
  // Complex, fragile, hard to query
}
```

**Problems:**
- Can't easily answer: "Show me all 6ft steel post fences"
- Requires multiple joins to see what's in a fence
- Led to duplicate calculators (SKU Builder vs Main)
- Hard to maintain, easy to break

#### ✅ **Solution: Fence-Type Specific Tables**
```javascript
// New approach - EXPLICIT
{
  "SKU": "WV-STD-6-WOOD",
  "Style": "Standard",
  "Height": 6,
  // EXPLICIT component references
  "Post_Material_ID": "uuid-of-4x4x8-post",
  "Post_Type": "WOOD",
  "Picket_Material_ID": "uuid-of-1x6-picket",
  "Rail_Material_ID": "uuid-of-2x4-rail",
  "Cap_Material_ID": null,
  "Trim_Material_ID": null
  // One glance tells you everything!
}
```

**Benefits:**
- ✅ Easy to query and report
- ✅ One row = complete recipe
- ✅ Simple calculations
- ✅ No abstract mappings

---

#### ❌ **Mistake 2: Ignoring Post Type for Labor**
```javascript
// Original logic - WRONG
if (fenceType === "Wood Vertical" && height <= 6) {
  laborCodes.push("W03"); // Always W03
}
// Missed that steel posts use different codes!
```

**Actual Rule:**
```javascript
// Correct logic - depends on Post Type
if (fenceType === "Wood Vertical" && height <= 6) {
  if (sku.Post_Type === "STEEL") {
    laborCodes.push("M03"); // Metal codes
  } else {
    laborCodes.push("W03"); // Wood codes
  }
}
```

**Impact:** This caused incorrect labor estimates for 30% of SKUs!

---

#### ❌ **Mistake 3: Duplicate Calculators**
```javascript
// FenceCalculator in services.js - used by main app
class FenceCalculator {
  calculateWoodVertical(sku, measurements) { /* logic */ }
}

// ALSO: Separate calculator in sku-builder.js
// Duplicate logic, fell out of sync, caused bugs
```

**Solution:** One calculator, used by both SKU Builder and Project Calculator

---

## 🧮 Calculation Architecture

### Design Principles

1. **Explicit over Implicit**
   - Don't make calculator guess what materials are needed
   - SKU explicitly lists every component
   - Calculator just executes formulas on known components

2. **Project-Level Aggregation**
   - Materials calculated per line item
   - Concrete/hardware aggregated at project level (avoid waste)
   - Labor aggregated but can be per-line for multi-fence projects

3. **Business Rules in Code, Not Data**
   - Formulas live in TypeScript functions (type-safe, testable)
   - Data describes "what" (which materials)
   - Code describes "how" (calculation logic)
   - Exception: Simple multiplication can be stored as formula strings

4. **Post Type is Critical**
   - Determines labor codes (W vs M)
   - Must be explicit field on SKU
   - No assumptions or defaults

---

### Calculation Flow

```
1. User Input
   ↓
2. Select SKU(s) from fence-type specific table
   ↓
3. For each line item:
   a. Get SKU recipe (explicit component list)
   b. Execute formulas for each component
   c. Calculate line-item materials
   d. Calculate line-item labor
   ↓
4. Aggregate:
   a. Sum materials across all line items
   b. Round up project-level materials (concrete, nails)
   c. Sum labor across all line items
   ↓
5. Apply manual adjustments (if any)
   ↓
6. Calculate costs:
   a. Material costs (quantity × unit price)
   b. Labor costs (quantity × BU-specific rate)
   c. Total project cost
   ↓
7. Output BOM/BOL
```

---

## 🗄️ Database Design Philosophy

### Supabase (PostgreSQL) Advantages

1. **Relational Integrity**
   - Foreign keys enforce data consistency
   - Cascading deletes prevent orphaned records
   - ACID transactions guarantee correctness

2. **Query Performance**
   - Indexes on frequently queried fields
   - Materialized views for complex reports
   - Much faster than Airtable API calls

3. **Cost Effective**
   - Free tier: 500MB database, 2GB bandwidth
   - Pro ($25/month): 8GB database, 250GB bandwidth
   - Airtable: $240/year for 5 users

4. **Better for Complex Queries**
```sql
-- Easy to answer business questions:
SELECT 
  COUNT(*) as fence_count,
  AVG(base_material_cost) as avg_cost
FROM wood_vertical_products
WHERE height = 6 
  AND post_type = 'STEEL'
  AND active = true;

-- Vs Airtable: Fetch all records, filter in code
```

### Table Structure Philosophy

**Fence-type specific product tables:**
- `wood_vertical_products` - has fields specific to vertical (pickets, rails)
- `wood_horizontal_products` - has fields specific to horizontal (boards, nailers)
- `iron_products` - has fields specific to iron (panels, brackets)

**NOT a generic products table with nullable fields:**
```sql
-- ❌ BAD: Generic table
CREATE TABLE products (
  id UUID,
  fence_type VARCHAR,
  post_material UUID,
  picket_material UUID,    -- null for horizontal/iron
  board_material UUID,     -- null for vertical/iron
  panel_material UUID,     -- null for vertical/horizontal
  ...
);
-- Confusing, hard to validate, nullable hell

-- ✅ GOOD: Specific tables
CREATE TABLE wood_vertical_products (
  id UUID,
  post_material_id UUID NOT NULL,
  picket_material_id UUID NOT NULL,
  rail_material_id UUID NOT NULL,
  ...
);
-- Clear, type-safe, only relevant fields
```

---

## 🔧 Technical Decisions

### Why TypeScript?
- **Type Safety:** Catch errors at compile time
- **IDE Support:** Autocomplete, refactoring
- **Documentation:** Types are living documentation
- **Refactoring:** Rename confidently
- **Team Scale:** Easier for multiple developers

### Why React (not Vue/Svelte)?
- Already in use in larger app
- Large ecosystem
- Team familiarity

### Why Supabase (not Firebase/AWS)?
- PostgreSQL = industry standard
- Better for relational data
- Easier migration path (can export to self-hosted)
- Better developer experience
- Lower cost

### Why Not Data-Driven Formula Engine?
**Considered:**
```javascript
// Store formulas as strings in database
{
  "Component": "Posts",
  "Formula": "Math.ceil({netLength} / 8) + 1"
}
// Parse and execute dynamically
```

**Decided Against Because:**
- ❌ Complex to build (3-4 weeks)
- ❌ Hard to debug (formulas are strings)
- ❌ Security risk (executing user input)
- ❌ Overkill (only 3 fence types, rarely add new ones)
- ✅ Structured code approach is simpler (2-3 hours to add new fence type)

---

## 📦 Module Boundaries

### Within BOM Calculator Module

**Components** (UI)
- Calculator - main interface
- ProjectList - view saved projects
- SKUBuilder - create new products
- MaterialSelector - choose materials (shared)

**Services** (Business Logic)
- FenceCalculator - calculation engine
- DatabaseService - Supabase client wrapper
- ValidationService - input validation

**Types** (TypeScript)
- Models - database entities
- DTOs - data transfer objects
- Enums - constants

### Shared with Larger App

**Auth**
- User authentication (don't duplicate)
- Use app's auth context

**UI Components**
- Button, Input, Select, Modal, etc.
- Use app's design system

**Database**
- Share Supabase client
- BOM tables live in same database

**Navigation**
- Use app's router
- BOM module is route under /bom/*

---

## 👥 User Roles & Permissions

### Current (MVP)
- All users have full access (6-8 estimators)
- No role differentiation yet

### Future
- **Admin:** Full access, can modify materials/labor rates
- **Estimator:** Create estimates, view history
- **Yard:** View BOM only (readonly)
- **Manager:** View reports, analytics

---

## 🧪 Testing Strategy

### Current State
- ✅ Manual testing only
- ✅ Standard test: 100ft, 1 line, 1 gate, ATX-RES
- ❌ No automated tests

### Target State
```typescript
// Unit tests for calculations
describe('FenceCalculator', () => {
  it('calculates wood vertical standard correctly', () => {
    const result = calculator.calculateWoodVertical(sku, {
      netLength: 100,
      numberOfLines: 1,
      numberOfGates: 1
    });
    expect(result.posts).toBe(14);
    expect(result.pickets).toBe(268);
  });
});

// Integration tests for database
describe('SKUBuilder', () => {
  it('creates wood vertical SKU', async () => {
    const sku = await createWoodVerticalSKU({...});
    expect(sku.id).toBeDefined();
    expect(sku.post_material_id).toBe(expectedId);
  });
});

// E2E tests
describe('Calculator Flow', () => {
  it('creates estimate from scratch', () => {
    cy.visit('/bom');
    cy.selectSKU('WV-STD-6-WOOD');
    cy.typeFootage('100');
    cy.clickCalculate();
    cy.contains('Total: $3,500');
  });
});
```

---

## 📈 Success Metrics

### Performance
- ✅ Calculation time: < 100ms (currently ~50ms)
- ✅ Page load: < 2 seconds
- ✅ Database queries: < 200ms average

### Accuracy
- ✅ Calculations match manual estimates: 100%
- ✅ Material usage variance: < 5% (currently 2-3%)
- ✅ Cost estimates within: 5% of actual

### User Experience
- ✅ Time to create estimate: < 5 minutes (was 30-45 min)
- ✅ User errors: < 1% (was 10-15%)
- ✅ User satisfaction: High (informal feedback)

### Business Impact
- ✅ Estimates per day: 3x increase
- ✅ Material waste: 50% reduction
- ✅ Estimator productivity: 6x improvement

---

## 🚀 Future Enhancements

### Phase 1 (After Migration)
- Concrete type selector (3-part, yellow, red)
- Excel export for Service Titan
- Print-friendly BOM for yard

### Phase 2
- Service Titan API integration
- Purchase order generation
- QBO sync

### Phase 3
- Mobile app for crew
- Photo attachments
- GPS tracking
- Historical analysis / ML for predictions

---

## 🎓 Lessons Learned

1. **Start with specific tables, not generic**
   - Easier to query, clearer code
   
2. **Don't optimize prematurely**
   - Data-driven formula engine sounded cool
   - Structured code is simpler and sufficient
   
3. **Post Type matters for labor**
   - Small detail, big impact
   - Must be explicit, no assumptions
   
4. **One calculator, not two**
   - Duplicate code always diverges
   - Refactor to shared service

5. **Concrete is project-level**
   - Per-line would cause waste
   - Aggregate first, then round

---

**This document gives Claude Code the "why" behind every decision. Read 02-BUSINESS_LOGIC.md next for the "how".**
