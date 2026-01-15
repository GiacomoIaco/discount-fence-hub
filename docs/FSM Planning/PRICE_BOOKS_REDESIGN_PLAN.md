# Price Books Redesign Plan

**Created**: January 14, 2026
**Status**: Ready for Implementation

---

## Executive Summary

Redesign the Price Books and Rate Sheets system based on industry best practices (ServiceTitan, Salesforce, Housecall Pro) and user feedback.

### Key Changes:
1. **Merge Rate Sheets → Price Books** (one unified concept)
2. **User-created Price Books** (not auto-created per BU)
3. **Bulk SKU management** (filter by category, Excel import)
4. **Featured SKUs** for price list generation
5. **Tags** for organization
6. **Comparison Matrix** with gross margins
7. **Price List Templates** for professional PDFs
8. **Rep Assignment** for access control

---

## Current Problems

| Issue | Current State | Impact |
|-------|---------------|--------|
| Too many Price Books | 19 auto-created (one per BU) | Confusing, unmanageable |
| Can't delete | No delete option | Cluttered UI |
| Two confusing concepts | Price Book ≠ Rate Sheet | Mental model mismatch |
| SKU-by-SKU adding | Search one at a time | Time-consuming |
| Rate Sheet save bug | Name blank, formula doesn't save | Blocking issue |
| No margin visibility | Can't see profitability | Blind pricing decisions |
| No professional PDF | Manual price list creation | Unprofessional |

---

## New Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           REDESIGNED PRICE BOOK SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │ SKU CATALOG (Master, 1000+ products)                                            ││
│  │ • Base prices (catalog prices)                                                  ││
│  │ • bu_types_allowed[] for default filtering                                      ││
│  │ • Used when no price book assigned (NO separate "Standard Price Book")          ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                              │
│       ▼                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │ PRICE BOOKS (User creates as needed)                                            ││
│  │                                                                                  ││
│  │ Each Price Book has:                                                            ││
│  │ • Name, Description                                                             ││
│  │ • Tags (for organization: "large-builders", "austin")                           ││
│  │ • SKU List with:                                                                ││
│  │   - Custom prices (fixed or formula)                                            ││
│  │   - Featured flag (★) for price list generation                                 ││
│  │ • Availability mode (all catalog, or explicit list only)                        ││
│  │                                                                                  ││
│  │ Examples:                                                                        ││
│  │ • "Fence Products" — Limited SKUs, for rep access control                       ││
│  │ • "Perry Homes Special" — Client-specific custom prices                         ││
│  │ • "Builder 10% Discount" — Formula-based, assigned to BUs                       ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                              │
│       ▼                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │ ASSIGNMENTS (Many-to-Many)                                                      ││
│  │                                                                                  ││
│  │ Price Book can be assigned to:                                                  ││
│  │ • Sales Reps → Controls what products they can quote                            ││
│  │ • Clients → Client-specific pricing                                             ││
│  │ • BUs → Default pricing for that market                                         ││
│  │ • Communities → Override for specific subdivision                               ││
│  │                                                                                  ││
│  │ Priority: Community > Client > BU > Rep's Default > Catalog                     ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                              │
│       ▼                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │ COMMUNITY PRODUCTS (unchanged)                                                  ││
│  │ • 2-4 SKUs with spec codes                                                      ││
│  │ • Price overrides (highest priority)                                            ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Unified Price Books (Merge Rate Sheets)

- **Before**: Price Books = availability, Rate Sheets = pricing (confusing)
- **After**: Price Books = both availability AND pricing (industry standard)

### 2. Featured SKUs (★)

Mark priority SKUs that appear on client price lists:
- Toggle star on each SKU
- Filter "Show Featured Only"
- PDF export options: Featured only or All

### 3. Tags for Organization

Instead of folders, use flexible tags:
- `large-builders`, `custom-builders`, `residential`
- `austin`, `san-antonio`, `houston`
- `wood-only`, `chain-link-only`, `full-catalog`

### 4. Comparison Matrix with Margins

Side-by-side view of multiple price books:
- Select BU to see costs and calculate margins
- Visual indicators: ✓ (good) ⚠ (warning) ✗ (danger)
- Inline editing
- Summary row with averages

```
│ SKU         │ Cost  │ Perry ($) │ Perry (%) │ Lennar ($) │ Lennar (%) │
│ WD-6-PT-1X6 │ $7.80 │ $12.95    │ 39.8% ✓   │ $12.75     │ 38.8% ⚠    │
```

### 5. Bulk Add SKUs

Filter by category/type, select all, add to price book:
- Product Type filter
- Product Style filter
- Category filter
- "Select All" / "Select None"
- Apply pricing method on add

### 6. Price List Templates

Custom grouping for professional PDFs:
- Sections: WOOD FENCING, GATES, CHAIN LINK
- Groups: 6' Board-on-Board, 8' Privacy
- SKU slots within groups
- Drag & drop reordering
- Reusable across price books

### 7. PDF Export

Professional price lists with:
- Company logo
- Client name and effective date
- Template-based layout
- Featured items only option
- Section/group formatting

### 8. Rep Assignment (Access Control)

Assign price books to sales reps:
- Rep can only quote from assigned price books
- "Fence Products" → fence rep only
- "Deck Products" → deck specialist
- Intersection with client pricing

---

## Database Changes

### Rename & Extend

```sql
-- Rename rate_sheets to price_books
ALTER TABLE rate_sheets RENAME TO price_books;

-- Add new columns
ALTER TABLE price_books ADD COLUMN tags TEXT[] DEFAULT '{}';
ALTER TABLE price_books ADD COLUMN availability_mode TEXT
  DEFAULT 'all_catalog' CHECK (availability_mode IN ('all_catalog', 'explicit_list'));
ALTER TABLE price_books ADD COLUMN default_template_id UUID;

-- Rename items table
ALTER TABLE rate_sheet_items RENAME TO price_book_items;

-- Add featured flag
ALTER TABLE price_book_items ADD COLUMN is_featured BOOLEAN DEFAULT false;

-- Rename assignments table
ALTER TABLE rate_sheet_assignments RENAME TO price_book_assignments;

-- Add rep assignment support
ALTER TABLE price_book_assignments ADD COLUMN sales_rep_id UUID REFERENCES auth.users(id);

-- Drop old tables
DROP TABLE IF EXISTS bu_price_book_overrides;
DROP TABLE IF EXISTS bu_price_books;
```

### New Tables for Templates

```sql
-- Price List Templates
CREATE TABLE price_list_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Template Sections (WOOD FENCING, GATES, etc.)
CREATE TABLE price_list_template_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES price_list_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Template Groups (6' Board-on-Board, 8' Privacy, etc.)
CREATE TABLE price_list_template_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES price_list_template_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Template SKU Slots
CREATE TABLE price_list_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES price_list_template_groups(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES sku_catalog(id),
  display_name TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, sku_id)
);
```

---

## Implementation Plan

### Phase 1: Fix Bugs + Cleanup (Day 1)
- [ ] Fix Rate Sheet save bug (name blank, formula not saving)
  - Initialize form from `rateSheet` prop immediately
  - Show validation error instead of silent return
- [ ] Delete auto-created bu_price_books (the 19 auto ones)
- [ ] Remove bu_price_books and bu_price_book_overrides tables

### Phase 2: Merge & Rename (Day 1-2)
- [ ] Create migration to rename `rate_sheets` → `price_books`
- [ ] Rename `rate_sheet_items` → `price_book_items`
- [ ] Rename `rate_sheet_assignments` → `price_book_assignments`
- [ ] Add columns: `tags[]`, `availability_mode`
- [ ] Add `is_featured` to price_book_items
- [ ] Update UI: Rename "Rate Sheets" tab to "Price Books"
- [ ] Update all hooks and components to use new names

### Phase 3: Core Features (Day 2-4)
- [ ] Tags UI (add/remove tags, filter by tags)
- [ ] Featured toggle (★ star on each SKU)
- [ ] Bulk Add SKUs modal
  - Filter by: Product Type, Product Style, Category
  - Select All / Select None
  - Preview selected count
  - Apply pricing method on add
- [ ] Clone Price Book with price adjustment
- [ ] Delete Price Book functionality
- [ ] Full CRUD operations

### Phase 4: Comparison Matrix (Day 4-6)
- [ ] Multi-column comparison view
- [ ] BU selector for costs
- [ ] Gross margin calculation and display
- [ ] Margin indicators (✓ ⚠ ✗) with configurable thresholds
- [ ] Summary row with averages
- [ ] Inline editing
- [ ] Filter by tags
- [ ] Show Featured only toggle
- [ ] Color coding for margin health

### Phase 5: Import/Export (Day 6-7)
- [ ] Excel export (selected price books as columns)
- [ ] Excel import (match by SKU, update prices)
- [ ] Validation and error reporting

### Phase 6: Price List Templates (Day 7-9)
- [ ] Create template CRUD
- [ ] Template editor with sections and groups
- [ ] Drag & drop reordering
- [ ] SKU slot assignment
- [ ] Clone template functionality
- [ ] Link template to price book

### Phase 7: PDF Export (Day 9-10)
- [ ] Template-aware PDF generation
- [ ] Section/Group formatting
- [ ] Logo placement and styling
- [ ] Preview mode
- [ ] Export options (Featured only, All items)
- [ ] Mismatch warnings (SKUs in template but not price book)

### Phase 8: Rep Assignment (Day 10-11)
- [ ] Add sales_rep_id to assignments
- [ ] UI for assigning price books to reps
- [ ] Quote creation respects rep's available SKUs
- [ ] Intersection logic with client's price book

### Phase 9: Polish & Testing (Day 11-12)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation update
- [ ] User training notes

---

## UI Mockups

### Price Books List

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Price Books                                           [+ New Price Book]    │
│                                                                              │
│ Filter by tags: [Large Builders ×] [Austin ×]            [Clear all]        │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Perry Homes Special                                                     │ │
│ │ Tags: [large-builders] [austin] [san-antonio]                          │ │
│ │ 47 SKUs • 30 Featured • Assigned to: Perry Homes (client)              │ │
│ │ [Edit] [Clone] [Delete] [Export PDF]                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Builder 10% Discount                                                    │ │
│ │ Tags: [builders] [formula]                                             │ │
│ │ All SKUs • Formula: -10% • Assigned to: ATX-HB, SA-HB, HOU-HB          │ │
│ │ [Edit] [Clone] [Delete] [Export PDF]                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Bulk Add SKUs Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Add SKUs to "Perry Homes Special"                                     [X]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Filter Products                                                              │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐              │
│ │ Product Type  ▼  │ │ Product Style  ▼ │ │ Category      ▼  │              │
│ │ Wood Fencing     │ │ All              │ │ All              │              │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘              │
│                                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [✓] Select All (47 products)                          [Search...]       │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ [✓] WD-6-PT-1X6          6' Wood PT 1x6                    $12.50/LF    │ │
│ │ [✓] WD-6-PT-1X4          6' Wood PT 1x4                    $10.50/LF    │ │
│ │ [✓] WD-6-CEDAR-1X6       6' Cedar 1x6                      $18.00/LF    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ Pricing Method: ○ Inherit from catalog                                       │
│                 ○ Apply markup: [____]%                                      │
│                 ● Apply discount: [-10__]%                                   │
│                 ○ Set custom prices (edit after adding)                      │
│                                                                              │
│                                        [Cancel]  [Add 47 Products]           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Comparison Matrix with Margins

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Price Comparison                                      [Filter: Large Builders ▼]        │
│                                                                                          │
│ BU for Costs: [Austin Builder (ATX-HB) ▼]                                               │
│ View: ○ Prices Only  ● Prices + Margins  ○ Margins Only       [Show Featured Only ☐]   │
│                                                                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│ │ SKU         │ Cost  │ Perry ($) │ Perry (%) │ Lennar ($) │ Lennar (%) │ Highland │   │
│ ├─────────────┼───────┼───────────┼───────────┼────────────┼────────────┼──────────┤   │
│ │ WD-6-PT-1X6 │ $7.80 │ $12.95    │ 39.8% ✓   │ $12.75     │ 38.8% ⚠    │ $13.00   │   │
│ │ WD-6-CEDAR  │ $11.20│ $18.49    │ 39.4% ✓   │ $18.25     │ 38.6% ⚠    │ $18.50   │   │
│ │ WD-8-PT-1X6 │ $10.50│ $16.50    │ 36.4% ⚠   │   —        │    —       │ $16.75   │   │
│ └─────────────┴───────┴───────────┴───────────┴────────────┴────────────┴──────────┘   │
│                                                                                          │
│ Legend: ✓ Above 40%  ⚠ 35-40%  ✗ Below 35%                                             │
│                                                                                          │
│ [Export to Excel]  [Import from Excel]  [Clone Column]                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

### New Files
- `migrations/23X_price_books_redesign.sql`
- `src/features/client_hub/components/PriceBookComparisonMatrix.tsx`
- `src/features/client_hub/components/BulkAddSkusModal.tsx`
- `src/features/client_hub/components/PriceListTemplateEditor.tsx`
- `src/features/client_hub/components/PdfExportModal.tsx`
- `src/features/client_hub/hooks/usePriceListTemplates.ts`

### Modified Files
- `src/features/client_hub/ClientHub.tsx` - Tab rename
- `src/features/client_hub/components/RateSheetsList.tsx` → `PriceBooksList.tsx`
- `src/features/client_hub/components/RateSheetEditorModal.tsx` → `PriceBookEditorModal.tsx`
- `src/features/client_hub/hooks/useRateSheets.ts` → `usePriceBooks.ts`
- `src/features/client_hub/types.ts` - Type updates
- `src/features/fsm/components/QuoteCard/QuoteCard.tsx` - Use new hooks

### Deleted Files
- `src/features/client_hub/components/PriceBooksList.tsx` (old auto-created version)
- `src/features/client_hub/components/PriceBookEditorModal.tsx` (old version)
- `src/features/client_hub/hooks/usePriceBooks.ts` (old version)

---

## Research Sources

- [ServiceTitan Pricebook Pro](https://www.servicetitan.com/features/pro/pricebook)
- [ServiceTitan Help - Pricebook](https://help.servicetitan.com/landing-page/pricebook)
- [ServiceTitan Import/Export Guide](https://help.servicetitan.com/how-to/import-export-pricebook)
- [Salesforce Product Price Books Guide](https://garysmithpartnership.com/guide-to-product-price-books/)
- [Housecall Pro Price Book](https://www.housecallpro.com/features/price-book/)
- [Adobe Commerce Catalog Management](https://experienceleague.adobe.com/en/docs/commerce-operations/implementation-playbook/best-practices/planning/catalog-management)

---

## Success Criteria

1. ✅ User can create/edit/delete price books
2. ✅ User can bulk add SKUs by category
3. ✅ User can mark SKUs as featured
4. ✅ User can tag and filter price books
5. ✅ User can compare price books with margin visibility
6. ✅ User can import/export via Excel
7. ✅ User can create price list templates
8. ✅ User can export professional PDF price lists
9. ✅ Sales reps can be assigned to specific price books
10. ✅ No more auto-created price books per BU
