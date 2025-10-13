# BOM Calculator Database Migration Summary

## ✅ What We've Built

### Database Schema Design
**Location**: `src/features/bom_calculator/database/01_schema.sql`

A complete PostgreSQL schema supporting:
- ✅ Two calculator types (SKU Builder + Project Calculator)
- ✅ Fence-type specific tables (wood_vertical, wood_horizontal, iron)
- ✅ Labor rates by Business Unit (Location + Client Type)
- ✅ Decimal storage to prevent rounding errors
- ✅ Project-level aggregation with manual overrides
- ✅ Post type determines labor codes (WOOD→W03, STEEL→M03)

### Key Tables Created

#### Reference Tables (6)
1. **business_units** - ATX-RES, SA-HB, HOU-RES, etc. (6 BUs)
2. **materials** - Posts, pickets, rails, hardware, concrete (136 items)
3. **labor_codes** - Activity definitions (29 codes: W01-W18, M03-M07, IR01-IR07)
4. **labor_rates** - BU-specific rates (junction: 29 codes × 6 BUs = 174 combinations)

#### Product Tables (3)
5. **wood_vertical_products** - A01-A06, B01-B06, C01-C06, D01-D06 series
6. **wood_horizontal_products** - Horizontal fence SKUs
7. **iron_products** - Iron/metal fence SKUs

#### Project Tables (4)
8. **bom_projects** - Project header with totals
9. **project_line_items** - Individual SKUs in project (stores decimals!)
10. **project_materials** - Aggregated BOM (project-level rounding)
11. **project_labor** - Aggregated BOL

### Critical Design Features

#### 1. Labor Rate Hierarchy
```
Business Unit → Activity → Rate
ATX-RES → W03 → $2.00/LF
ATX-HB → W03 → $1.65/LF
SA-RES → W03 → $1.50/LF
```

#### 2. Decimal Precision
```sql
-- Line Item: Store decimals
calculated_posts DECIMAL(10,2) -- 14.23

-- Project Materials: Round once at project level
calculated_quantity DECIMAL(10,2) -- 21.47 (sum)
rounded_quantity INTEGER -- 22 (project-level round)
manual_quantity INTEGER -- 25 (user override)
final_quantity INTEGER -- COALESCE(manual, rounded)
```

#### 3. Post Type Logic
```typescript
if (sku.post_type === 'WOOD') {
  laborCodes = ['W03', 'W04', 'W06', 'W07'];
} else if (sku.post_type === 'STEEL') {
  laborCodes = ['M03', 'M04', 'M06', 'M07'];
}
```

## 📊 Data Flow Example

### Input
```
Project: "Smith Backyard"
Business Unit: ATX-RES
Line 1: A01 (WOOD posts), 100ft, 1 gate
Line 2: C04 (STEEL posts), 50ft, 0 gates
```

### Processing
```
Line 1 Calculation:
  Posts: 14.25 (decimal)
  Pickets: 229.4
  Rails: 26.0

Line 2 Calculation:
  Posts: 7.125 (decimal)
  Pickets: 114.7
  Rails: 19.5

Aggregation:
  Wood Posts (PS13): 14.25 → 15 (rounded)
  Steel Posts (PS04): 7.125 → 8 (rounded)
  Pickets (P601): 344.1 → 345 (rounded once!)
  Rails (RA01): 45.5 → 46

Concrete (based on 23 total posts):
  CTS: Math.ceil(23/10) = 3 bags
  CTP: Math.ceil(23/20) = 2 bags
  CTQ: 23 × 0.5 = 11.5 → 12 bags

Labor (different codes for wood vs steel):
  W02: 100ft × $2.00 = $200 (Line 1 set posts)
  W03: 100ft × $2.00 = $200 (Line 1 wood nail up)
  W02: 50ft × $2.00 = $100 (Line 2 set posts)
  M03: 50ft × $2.25 = $112.50 (Line 2 STEEL nail up)
  W10: 1 gate × $30 = $30 (Line 1 gate)
  Total Labor: $642.50
```

### Output
```
Total Materials: $2,145.00
Total Labor: $642.50
Total Project: $2,787.50
Cost per foot: $18.58/ft (150ft total)
```

## 🗂️ Files Created

```
src/features/bom_calculator/database/
├── 01_schema.sql          ← Complete schema (RUN THIS FIRST)
├── README.md              ← Usage documentation
└── MIGRATION_SUMMARY.md   ← This file
```

## 📋 Next Steps

### Immediate (Data Migration)
1. **Create seed data SQL files** from Airtable CSV exports:
   - `02_seed_business_units.sql` (6 BUs)
   - `03_seed_materials.sql` (136 materials)
   - `04_seed_labor_codes.sql` (29 labor codes)
   - `05_seed_labor_rates.sql` (174 rate combinations)
   - `06_seed_products.sql` (50+ SKUs)

2. **Run migrations in Supabase**:
   ```bash
   # In Supabase SQL Editor:
   1. Run 01_schema.sql
   2. Run 02_seed_business_units.sql
   3. Run 03_seed_materials.sql
   4. Run 04_seed_labor_codes.sql
   5. Run 05_seed_labor_rates.sql
   6. Run 06_seed_products.sql
   ```

### Short-term (Implementation)
3. **Build TypeScript types** matching schema
4. **Implement FenceCalculator** class with formulas
5. **Build SKU Builder UI** (create/edit SKUs)
6. **Build Project Calculator UI** (multi-SKU estimates)

### Medium-term (Integration)
7. **Add Row Level Security (RLS)** policies
8. **Create database functions** for common queries
9. **Build API layer** (Supabase client + hooks)
10. **Add data validation** and error handling

### Long-term (Enhancement)
11. **Historical tracking** (rate changes over time)
12. **Project templates** (common configurations)
13. **Export to QuickBooks** integration
14. **Mobile optimization**

## 🎯 Success Metrics

Schema is successful when:
- ✅ All formulas from 02-BUSINESS_LOGIC.md can be implemented
- ✅ Supports both SKU Builder and Project Calculator workflows
- ✅ Labor rates vary correctly by BU (ATX-RES ≠ ATX-HB)
- ✅ Post type correctly determines labor codes (W vs M)
- ✅ Decimal precision prevents rounding errors
- ✅ Project-level aggregation works correctly
- ✅ Manual overrides don't affect SKU definitions
- ✅ Calculations match Airtable system exactly

## ❓ Questions Answered

### Q: Do labor rates vary by Business Unit?
**A:** YES. Each BU (ATX-RES, ATX-HB, SA-RES, etc.) has different rates for the same labor code.

### Q: How do we avoid premature rounding?
**A:** Store decimals in `project_line_items`, round once at project level in `project_materials`.

### Q: What determines labor codes (W vs M)?
**A:** The `post_type` field in the product definition:
- `post_type='WOOD'` → W03, W04, W06, W07
- `post_type='STEEL'` → M03, M04, M06, M07

### Q: Can users override quantities at project level?
**A:** YES. `manual_quantity` overrides `rounded_quantity` via generated column.

### Q: Does concrete calculate per-SKU or per-project?
**A:** PER-PROJECT. Aggregate all posts first, then calculate concrete once.

### Q: Are material substitutions handled?
**A:** By creating new SKUs (A01-WRC, A01-Cedar, etc.)

### Q: Do we use fence-type specific tables?
**A:** YES. `wood_vertical_products`, `wood_horizontal_products`, `iron_products` for type safety and clarity.

## 🔧 Tools Needed

- **Supabase** (PostgreSQL database)
- **CSV to SQL converter** (or manual seed data creation)
- **TypeScript** (for type-safe implementation)
- **React** (for UI components)

## 📚 Additional Resources

- **Business Logic**: `../02-BUSINESS_LOGIC.md` (all formulas)
- **Original Context**: `../00-README.md` (project overview)
- **CSV Data**: `../Airtable Sample Tables/*.csv` (source data)

---

**Status**: ✅ Schema design complete and ready for implementation
**Next Action**: Create seed data SQL files from CSV exports
