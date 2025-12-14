# FSM Implementation Master - UI Addendum
## UI Patterns & Specifications Reference

---

**Version:** 1.0  
**Created:** December 2024  
**Parent Document:** FSM_IMPLEMENTATION_MASTER.md  
**Status:** Ready for Implementation

---

## Overview

This addendum to the FSM Implementation Master documents two critical UI patterns that span across the entire application:

1. **Context Sidebar** - Persistent left panel across Quote → Job → Invoice
2. **Smart Lookup** - Unified client/property search without "New vs Existing" choice

These patterns are documented in detail in their respective specification documents.

---

## 1. Context Sidebar Pattern

### Specification Document
📄 **UI_SPEC_CONTEXT_SIDEBAR.md**

### Key Concept

The Context Sidebar is a **persistent left-side panel** (320px width) that travels with entities through their lifecycle:

```
QUOTE → JOB → INVOICE
  ↓       ↓       ↓
Same sidebar position, adaptive content
```

### Implementation Summary

| Aspect | Specification |
|--------|---------------|
| Position | Left side, sticky |
| Width | 320px (280-400px range) |
| Height | Full viewport minus header |
| Scroll | Independent from main content |
| Background | gray-50 with right border |

### Sections by Entity Type

| Section | Quote | Job | Invoice |
|---------|:-----:|:---:|:-------:|
| Entity Header | ✅ | ✅ | ✅ |
| Linked Entities | ✅ | ✅ | ✅ |
| Client & Property | ✅ Edit | ✅ Read | ✅ Read |
| Assignment | ✅ | ✅ | ✅ |
| Builder Info | ✅ | ✅ | ✅ |
| Project Info | ✅ | ✅ | ✅ |
| Custom Fields | ✅ | ✅ | ✅ |
| Material Prep | ❌ | ✅ | ❌ |
| Profitability | ✅ Est. | ✅ Actual | ✅ Final |
| Payment Status | Deposit | ❌ | ✅ |
| QBO Sync | ❌ | ❌ | ✅ |

### Profitability Calculation (Quote)

```typescript
const profitability = {
  materialCost: bom.reduce((sum, item) => sum + (item.qty * item.material.unit_cost), 0),
  laborCost: bol.reduce((sum, item) => sum + (item.qty * item.laborCode.cost_rate), 0),
  totalCost: materialCost + laborCost,
  grossProfit: quoteTotal - totalCost,
  grossMargin: (grossProfit / quoteTotal) * 100,
  requiresApproval: grossMargin < 15 || quoteTotal > 25000 || discountPercent > 10,
};
```

### Component Location
```
src/components/common/ContextSidebar/
├── ContextSidebar.tsx
├── sections/
│   ├── ClientPropertySection.tsx
│   ├── ProfitabilitySection.tsx
│   └── ... (see full spec)
└── hooks/
    └── useProfitability.ts
```

---

## 2. Smart Lookup Pattern

### Specification Document
📄 **UI_SPEC_SMART_LOOKUP.md**

### Key Concept

**NO "New vs Existing" choice.** Users type in a single field, system searches automatically, offers "Create new" when needed.

```
User types → System searches (name, phone, email) → Shows matches + "Create new"
```

### The Flow

```
┌─────────────────────────────────────────────────────┐
│  1. User types in single input                      │
│     "John Sm" or "512-555" or "john@email.com"     │
│                                                     │
│  2. System searches:                                │
│     • clients.name ILIKE '%query%'                  │
│     • clients.phone LIKE '%normalized%'             │
│     • clients.email ILIKE '%query%'                 │
│     • clients.company_name ILIKE '%query%'          │
│                                                     │
│  3. Shows results:                                  │
│     • Matching clients with match highlight         │
│     • Property count, last activity                 │
│     • "Create new client" option at bottom          │
│                                                     │
│  4. On selection:                                   │
│     • Shows selected client card                    │
│     • Property lookup appears below                 │
│                                                     │
│  5. On "Create new":                                │
│     • Right slide-out opens (400px)                 │
│     • Pre-fills name from search query              │
│     • After create, auto-selects new client         │
└─────────────────────────────────────────────────────┘
```

### Property Lookup (After Client Selected)

```
┌─────────────────────────────────────────────────────┐
│  Client selected → Property dropdown appears        │
│                                                     │
│  Shows:                                             │
│  • Client's existing properties (with activity)     │
│  • "Add new property" option                        │
│                                                     │
│  On selection:                                      │
│  • Checks for duplicates (recent requests, etc.)    │
│  • Shows warning if active work exists              │
└─────────────────────────────────────────────────────┘
```

### Builder Cascade (For Home Builder Clients)

When `client.is_builder = true`:

```
Client: ABC Builders ✓
         ↓
Community: [Select...]  →  Cypress Creek ✓
                                  ↓
Lot/Plot: [Select...]  →  Lot 42 ✓
                                  ↓
Property auto-resolved from Lot
```

### New Entity Slide-Out

- **Position**: Right side, 400px width
- **Trigger**: Click "Create new..." option
- **Behavior**: Main form visible but dimmed
- **Pre-fill**: Search query becomes entity name
- **After create**: Auto-selects, closes slide-out, focuses next field

### Component Location
```
src/components/common/SmartLookup/
├── ClientLookup.tsx
├── PropertyLookup.tsx
├── BuilderCascade.tsx
├── slideout/
│   ├── SlideOutPanel.tsx
│   ├── NewClientForm.tsx
│   └── NewPropertyForm.tsx
└── hooks/
    ├── useClientSearch.ts
    └── usePropertySearch.ts
```

---

## 3. Page Layouts Using These Patterns

### Request Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  NEW REQUEST                                                     [Save] [Cancel]│
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────────┐│
│  │  👤 CLIENT                       │    │  📍 SERVICE LOCATION                ││
│  │  [Smart Client Lookup]           │    │  [Address fields OR                 ││
│  │                                 │    │   PropertyLookup after client]      ││
│  └─────────────────────────────────┘    └─────────────────────────────────────┘│
│                                                                                 │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────────┐│
│  │  🔧 JOB DETAILS                  │    │  📅 ASSESSMENT         [Toggle ON]  ││
│  │  Job Type, Source, Description  │    │  Date, Time, Rep Assignment        ││
│  │  Business Unit                  │    │  AI Scheduling Suggestion          ││
│  └─────────────────────────────────┘    └─────────────────────────────────────┘│
│                                                                                 │
│                              [CREATE REQUEST]                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Quote Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Quote for [CLIENT NAME]                                  [Save] [Send] [More ▼]│
├────────────────────┬────────────────────────────────────────────────────────────┤
│                    │                                                            │
│  CONTEXT SIDEBAR   │  QUOTE CONTENT                                             │
│  (320px)           │                                                            │
│                    │  ┌─────────────┬─────────────┬─────────────┐               │
│  📋 Quote Details  │  │    GOOD     │   BETTER ✓  │    BEST     │ ← Option Tabs│
│  #QUO-2024-0042    │  └─────────────┴─────────────┴─────────────┘               │
│  Status: Draft     │                                                            │
│                    │  Product/Service         Qty    Unit Price    Total        │
│  👤 Client &       │  ─────────────────────────────────────────────────────     │
│     Property       │  [Line items with drag-drop reorder]                       │
│                    │                                                            │
│  👥 Assignment     │  [+ Add Line] [+ Optional] [+ Text]                        │
│                    │                                                            │
│  🏗️ Builder Info   │  ─────────────────────────────────────────────────────     │
│                    │                              Subtotal:    $4,725.00        │
│  📁 Project Info   │                              Discount:    [Add]            │
│                    │                              Tax:         $389.81          │
│  🏷️ Custom Fields  │                              ──────────────────────        │
│                    │                              TOTAL:       $5,114.81        │
│  ─────────────────│                                                            │
│  💰 PROFITABILITY │  [Add deposit or payment schedule]                         │
│  Materials: $2,147│                                                            │
│  Labor:     $1,100│  ─────────────────────────────────────────────────────     │
│  ──────────────── │  📎 Attachments    🖼️ Images    📄 Contract                 │
│  Est. Cost: $3,247│                                                            │
│  Gross:     $1,867│                                                            │
│  Margin:    36.5% │                                                            │
│                    │                                                            │
└────────────────────┴────────────────────────────────────────────────────────────┘
```

### Job Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Job [JOB NUMBER] - [CLIENT NAME]                             [Actions ▼]       │
├────────────────────┬────────────────────────────────────────────────────────────┤
│                    │                                                            │
│  CONTEXT SIDEBAR   │  JOB CONTENT                                               │
│  (320px)           │                                                            │
│                    │  ┌────────────────────────────────────────────────────┐    │
│  📋 Job Details    │  │  MATERIAL PREP STATUS                              │    │
│  #JOB-2024-0038    │  │  ✅ ─── ✅ ─── ✅ ─── ○ ─── ○                      │    │
│  Status: staged    │  │  ready  picking staged loaded done                 │    │
│                    │  └────────────────────────────────────────────────────┘    │
│  🔗 From Quote     │                                                            │
│     QUO-2024-0042  │  ┌────────────────────────────────────────────────────┐    │
│                    │  │  VISITS                                            │    │
│  👤 Client &       │  │                                                    │    │
│     Property       │  │  Visit 1 of 2 - Dec 15                             │    │
│                    │  │  ● Scheduled  │  Crew Alpha  │  8:00 AM           │    │
│  👥 Assignment     │  │                                                    │    │
│  Sales: Marcus     │  │  Visit 2 of 2 - Dec 16                             │    │
│  Crew: Alpha       │  │  ○ Unscheduled                                     │    │
│                    │  │                                                    │    │
│  🏗️ Builder Info   │  │  [+ Add Visit]                                     │    │
│                    │  └────────────────────────────────────────────────────┘    │
│  📁 Project Info   │                                                            │
│                    │  ┌────────────────────────────────────────────────────┐    │
│  🏷️ Custom Fields  │  │  SCHEDULE                                          │    │
│                    │  │  [FullCalendar view of visits]                     │    │
│  📦 MATERIAL PREP  │  └────────────────────────────────────────────────────┘    │
│  Status: staged    │                                                            │
│  Location: Bay 3   │  ┌────────────────────────────────────────────────────┐    │
│  [View BOM] [BOL]  │  │  BOM SUMMARY                                       │    │
│                    │  │  150 LF Cedar B-o-B, 1 Gate, 20 Posts...           │    │
│  ─────────────────│  │  [View Full BOM]                                    │    │
│  💰 JOB COSTING   │  └────────────────────────────────────────────────────┘    │
│  Budget:   $3,247  │                                                            │
│  Actual:   $3,089  │                                                            │
│  Variance: +$158 ✅│                                                            │
│                    │                                                            │
└────────────────────┴────────────────────────────────────────────────────────────┘
```

### Invoice Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Invoice [INV NUMBER]                                    [Send] [Record Payment]│
├────────────────────┬────────────────────────────────────────────────────────────┤
│                    │                                                            │
│  CONTEXT SIDEBAR   │  INVOICE CONTENT                                           │
│  (320px)           │                                                            │
│                    │  ┌────────────────────────────────────────────────────┐    │
│  📋 Invoice Details│  │  BILL TO                                           │    │
│  #INV-2024-0055    │  │  John Smith                                        │    │
│  Status: Awaiting  │  │  123 Oak Street, Austin TX 78701                   │    │
│                    │  └────────────────────────────────────────────────────┘    │
│  🔗 From Job       │                                                            │
│     JOB-2024-0038  │  ┌────────────────────────────────────────────────────┐    │
│                    │  │  LINE ITEMS                                        │    │
│  👤 Client &       │  │                                                    │    │
│     Property       │  │  Description               Qty    Price    Total   │    │
│                    │  │  ─────────────────────────────────────────────     │    │
│  🏗️ Builder Info   │  │  Cedar Board-on-Board     150 LF  $28.50  $4,275  │    │
│                    │  │  4ft Single Swing Gate      1 ea  $450.00   $450  │    │
│  📁 Project Info   │  │  ...                                               │    │
│                    │  │                                                    │    │
│  🏷️ Custom Fields  │  │                            Subtotal:    $4,725.00 │    │
│                    │  │                            Tax:           $389.81 │    │
│  ─────────────────│  │                            ─────────────────────── │    │
│  💰 FINAL MARGIN  │  │                            TOTAL:       $5,114.81 │    │
│  Revenue:  $5,114  │  │                                                    │    │
│  Costs:    $3,339  │  │                            Paid:        $2,557.40 │    │
│  Profit:   $1,775  │  │                            BALANCE DUE: $2,557.41 │    │
│  Margin:   34.7%   │  └────────────────────────────────────────────────────┘    │
│                    │                                                            │
│  ─────────────────│  ┌────────────────────────────────────────────────────┐    │
│  💳 PAYMENT STATUS│  │  PAYMENT HISTORY                                   │    │
│  Paid:     $2,557  │  │                                                    │    │
│  Balance:  $2,557  │  │  Dec 10  Deposit (CC)  $2,557.40  ✓               │    │
│  Due: Dec 25       │  │                                                    │    │
│                    │  │  [Record Payment]                                  │    │
│  ─────────────────│  └────────────────────────────────────────────────────┘    │
│  🔄 QBO SYNC      │                                                            │
│  Status: ✅ Synced │                                                            │
│  QBO #: 10542      │                                                            │
│  [Resync] [View↗]  │                                                            │
│                    │                                                            │
└────────────────────┴────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Priority

### Phase 1: Smart Lookup (Week 1-2)
Foundation for all data entry

- [ ] ClientLookup component
- [ ] useClientSearch hook
- [ ] SlideOutPanel component
- [ ] NewClientForm
- [ ] PropertyLookup component
- [ ] NewPropertyForm

### Phase 2: Context Sidebar Structure (Week 2-3)
Reusable sidebar framework

- [ ] ContextSidebar container
- [ ] CollapsibleSection component
- [ ] ContextSidebarHeader
- [ ] StatusBadge component

### Phase 3: Quote Sidebar Sections (Week 3-4)
Quote-specific content

- [ ] ClientPropertySection
- [ ] AssignmentSection
- [ ] BuilderInfoSection
- [ ] ProjectInfoSection
- [ ] CustomFieldsSection
- [ ] ProfitabilitySection

### Phase 4: Job Sidebar Sections (Week 5)
Job-specific content

- [ ] MaterialPrepSection
- [ ] JobCostingSection

### Phase 5: Invoice Sidebar Sections (Week 6)
Invoice-specific content

- [ ] FinalMarginSection
- [ ] PaymentStatusSection
- [ ] QboSyncSection

### Phase 6: Builder Cascade (Week 7)
Home builder workflow

- [ ] BuilderCascade component
- [ ] Community lookup
- [ ] Lot lookup
- [ ] NewCommunityForm

---

## 5. Reference Documents

| Document | Description | Location |
|----------|-------------|----------|
| FSM Implementation Master | Full system specification | FSM_IMPLEMENTATION_MASTER.md |
| Context Sidebar Spec | Detailed sidebar specification | UI_SPEC_CONTEXT_SIDEBAR.md |
| Smart Lookup Spec | Detailed lookup specification | UI_SPEC_SMART_LOOKUP.md |

---

*Document Version: 1.0*  
*Addendum to FSM Implementation Master*
