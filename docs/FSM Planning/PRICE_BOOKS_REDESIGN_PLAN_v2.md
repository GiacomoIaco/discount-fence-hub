# Price Books & Rate Sheets Architecture v2

**Created**: January 14, 2026
**Status**: DRAFT - Pending Approval

---

## Executive Summary

Two separate concepts working together:

| Concept | Purpose | Example |
|---------|---------|---------|
| **Price Book** | What products can they buy? (Catalog) | "Builder Fence Products" - 47 SKUs |
| **Rate Sheet** | What price do they pay? (Pricing Tier) | "Preferred Builder" - 10% off catalog |

A client gets assigned **Price Book + Rate Sheet pairs**.

---

## Why Two Concepts?

### The Math

**Merged approach** (one concept):
- 20 builders × unique pricing = **20 Price Books** to manage
- Change pricing for 5 builders = edit 5 separate objects

**Separated approach** (two concepts):
- 4 product catalogs × 5 pricing tiers = 20 combinations
- Only **9 objects** to manage
- Change pricing for 5 builders = edit **1 Rate Sheet**

### Real Example

```
Perry Homes Assignment:
├── "Builder Fence Products" → "Perry Custom" Rate Sheet (negotiated prices)
└── "Builder Deck Products" → "Standard Builder" Rate Sheet (catalog prices)

Lennar Assignment:
├── "Builder Fence Products" → "Volume Builder" Rate Sheet (-10%)
└── "Builder Deck Products" → "Volume Builder" Rate Sheet (-10%)

Taylor Morrison Assignment:
├── "Builder Fence Products" → "Preferred Builder" Rate Sheet (-5%)
└── (No deck access)
```

**Result**: 3 builders, but only:
- 2 Price Books (Fence, Deck)
- 3 Rate Sheets (Perry Custom, Volume, Preferred)
- = **5 objects** instead of 6+ merged price books

---

## Architecture

### 1. Price Books (Product Catalogs)

**Purpose**: Define which SKUs a client can purchase.

```sql
price_books
├── id, name, code, description
├── availability_mode: 'explicit_only' | 'all_minus_exclusions'
├── tags[] -- for organization: 'builders', 'fence', 'austin'
├── is_active, is_template
└── created_at, updated_at, created_by

price_book_items
├── price_book_id, sku_id
├── is_featured -- for price list generation
├── sort_order
└── notes
```

**Key Points**:
- NO pricing columns - that's the Rate Sheet's job
- `explicit_only`: Only listed SKUs available
- `all_minus_exclusions`: Full catalog minus specific exclusions
- `is_featured`: Mark priority SKUs for client-facing price lists

**Example Price Books**:
| Name | Mode | SKU Count | Use Case |
|------|------|-----------|----------|
| Full Residential Catalog | all_minus_exclusions | 200+ | Residential sales reps |
| Builder Fence Products | explicit_only | 47 | Builder fence quotes |
| Builder Deck Products | explicit_only | 12 | Builder deck quotes |
| Chain Link Only | explicit_only | 30 | Chain link specialists |
| Wood Fence Only | explicit_only | 80 | Wood fence specialists |

---

### 2. Rate Sheets (Pricing Tiers)

**Purpose**: Define pricing rules for SKUs.

```sql
rate_sheets
├── id, name, code, description
├── pricing_type: 'custom' | 'formula' | 'hybrid'
├── default_labor_markup, default_material_markup, default_margin_target
├── tags[] -- for organization
├── is_active, is_template
├── effective_date, expires_at
└── created_at, updated_at, created_by

rate_sheet_items
├── rate_sheet_id, sku_id
├── pricing_method: 'fixed' | 'markup' | 'margin'
├── fixed_price, fixed_labor_price, fixed_material_price
├── labor_markup_percent, material_markup_percent, margin_target_percent
└── notes
```

**Key Points**:
- Pricing ONLY - no availability restrictions
- Can be formula-based (applies to all SKUs) or custom (per-SKU prices)
- `hybrid`: Some SKUs have fixed prices, others use formula

**Example Rate Sheets**:
| Name | Type | Rule | Use Case |
|------|------|------|----------|
| Catalog Pricing | formula | 0% (use catalog price) | Default/baseline |
| Preferred Builder | formula | -5% off catalog | Good builder relationships |
| Volume Builder | formula | -10% off catalog | High-volume builders |
| Perry Custom | custom | Specific prices per SKU | Negotiated contract |
| Lennar 2026 Contract | custom | Per-SKU from contract | Annual contract pricing |

---

### 3. Client Assignments

**Purpose**: Link clients to Price Book + Rate Sheet combinations.

```sql
client_price_book_assignments
├── id
├── client_id
├── price_book_id -- which products they can buy
├── rate_sheet_id -- what prices they pay (NULL = catalog pricing)
├── is_default -- if client has multiple, which is primary?
├── effective_date, expires_at
└── created_at, created_by
```

**Key Points**:
- A client can have MULTIPLE assignments (different catalogs)
- Each assignment pairs a Price Book with a Rate Sheet
- `rate_sheet_id = NULL` means use catalog prices
- Community can override the rate_sheet_id (not the price_book)

**Example**:
```
Perry Homes (client_id: abc123)
├── Assignment 1:
│   ├── price_book: "Builder Fence Products"
│   ├── rate_sheet: "Perry Custom"
│   └── is_default: true
└── Assignment 2:
    ├── price_book: "Builder Deck Products"
    ├── rate_sheet: "Standard Builder"
    └── is_default: false
```

---

### 4. Community Overrides

Communities can override the RATE SHEET (not the Price Book):

```sql
communities
├── ...existing fields...
├── rate_sheet_override_id -- override client's rate sheet for this community
└── -- NOTE: They inherit client's price_book assignments
```

**Example**:
```
Perry Homes → Sienna Plantation (community)
├── Inherits: "Builder Fence Products" price book
├── Override: "Sienna Special" rate sheet (community-negotiated pricing)
└── Result: Perry's product access, but Sienna's pricing
```

---

### 5. Price Resolution Order

When creating a quote for Client X at Community Y:

```
1. AVAILABILITY: What can they buy?
   → Client's assigned Price Book(s)
   → Filter SKU picker to those products

2. PRICING: What price?
   a. Community price override (community_products.price_override)
   b. Community rate sheet override (community.rate_sheet_override_id)
   c. Client's rate sheet (from assignment)
   d. Catalog price (fallback)

3. RESULT: Available SKUs with resolved prices
```

---

## UI Design

### Client Hub Tabs

```
┌─────────────────────────────────────────────────────────────────┐
│ Client Hub                                                      │
├─────────────────────────────────────────────────────────────────┤
│ [Clients] [Communities] [Price Books] [Rate Sheets]             │
└─────────────────────────────────────────────────────────────────┘
```

### Price Books Tab (Product Catalogs)

```
┌─────────────────────────────────────────────────────────────────┐
│ Price Books                                    [+ New Price Book]│
├─────────────────────────────────────────────────────────────────┤
│ Filter: [builders ×] [fence ×]                    [Clear all]   │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Builder Fence Products                                      │ │
│ │ Tags: [builders] [fence]                                    │ │
│ │ 47 SKUs • 30 Featured • Mode: Explicit Only                │ │
│ │ Assigned to: Perry Homes, Lennar, Taylor Morrison          │ │
│ │ [Edit] [Clone] [Delete]                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Full Residential Catalog                                    │ │
│ │ Tags: [residential] [full-catalog]                         │ │
│ │ All SKUs minus 12 exclusions • Mode: All Minus Exclusions  │ │
│ │ Assigned to: (default for residential)                     │ │
│ │ [Edit] [Clone] [Delete]                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Rate Sheets Tab (Pricing Tiers)

```
┌─────────────────────────────────────────────────────────────────┐
│ Rate Sheets                                    [+ New Rate Sheet]│
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Perry Custom                                    [Custom]    │ │
│ │ 47 SKU prices defined • Effective: 2026-01-01             │ │
│ │ Assigned to: Perry Homes (all communities)                 │ │
│ │ [Edit] [Clone] [Compare] [Export PDF]                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Volume Builder                                  [Formula]   │ │
│ │ -10% off catalog • All SKUs                               │ │
│ │ Assigned to: Lennar, DR Horton, KB Homes                  │ │
│ │ [Edit] [Clone] [Compare] [Export PDF]                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Client Detail → Pricing Tab

```
┌─────────────────────────────────────────────────────────────────┐
│ Perry Homes                                                     │
├─────────────────────────────────────────────────────────────────┤
│ [Overview] [Communities] [Pricing] [Projects] [Documents]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PRODUCT & PRICING ASSIGNMENTS              [+ Add Assignment]   │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ★ Builder Fence Products → Perry Custom           [Remove] │ │
│ │   47 products • Custom pricing • Default                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │   Builder Deck Products → Standard Builder        [Remove] │ │
│ │   12 products • Catalog pricing                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ COMMUNITY OVERRIDES                                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Sienna Plantation: Uses "Sienna Special" rate sheet        │ │
│ │ (instead of Perry Custom)                                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Fix Current State (Migration 233)
- [ ] Rename `price_books` back to `rate_sheets`
- [ ] Keep new columns: `tags[]`, `is_featured`
- [ ] Rename FK columns back: `price_book_id` → `rate_sheet_id`
- [ ] Update UI labels back to "Rate Sheets"
- [ ] Restore hooks to query `rate_sheets`

### Phase 2: Create Price Books Table (Migration 234)
- [ ] Create `price_books` table (product catalogs)
- [ ] Create `price_book_items` table (SKU list)
- [ ] Create `client_price_book_assignments` table
- [ ] Add `rate_sheet_override_id` to communities

### Phase 3: Price Books UI
- [ ] Add "Price Books" tab to Client Hub
- [ ] Price Book list view
- [ ] Price Book editor (add/remove SKUs, bulk add)
- [ ] Featured toggle for SKUs

### Phase 4: Client Assignment UI
- [ ] Client detail → Pricing tab
- [ ] Add/edit/remove assignments
- [ ] Show which Price Book + Rate Sheet
- [ ] Community override indicator

### Phase 5: Rate Sheets Enhancements
- [ ] Tags support
- [ ] Clone functionality
- [ ] Comparison matrix
- [ ] PDF export

### Phase 6: Quote Integration
- [ ] SKU picker respects client's Price Books
- [ ] Prices resolve from Rate Sheet
- [ ] Show pricing source in quote

---

## Questions to Confirm

1. **Default behavior**: If a client has NO assignments, do they get:
   - a) Full catalog at catalog prices? (most permissive)
   - b) No products available? (most restrictive)
   - c) Depends on BU type? (residential = full, builders = explicit only)

2. **Sales rep restrictions**: Should sales reps also be assigned Price Books to limit what they can quote?

3. **Rate Sheet required?**: Can a Price Book assignment have NULL rate sheet (= catalog prices)?

4. **Multiple Price Books**: When a client has multiple Price Books, how does the SKU picker work?
   - a) Merged list from all Price Books
   - b) User selects which Price Book first
   - c) Based on quote type (fence vs deck)

---

## Approval

- [ ] Architecture approved by stakeholder
- [ ] UI design approved
- [ ] Ready for implementation

