# FSM System Standards & Requirements

> **Source of Truth** for FSM development. Check this document before implementing any feature.
>
> **Last Updated**: 2026-01-07
> **Phase A**: COMPLETED (0.1, 0.3)
> **Current Phase**: B (Entity Unification)

---

## Purpose

This document defines **standards and requirements that must ALWAYS be true** as we build the FSM system. Before implementing any new feature, check this document.

---

## Part 0: Core Philosophy & Architecture

These are foundational principles that guide ALL FSM development decisions.

### 0.1 Desktop-First, Mobile-Aware - COMPLETED

**Target Users**: Office staff (desktop) + Field Reps/PMs (tablets/phones)

| Platform | Priority | UI Approach |
|----------|----------|-------------|
| Desktop | **PRIMARY** | Dense, tabular, information-rich |
| Tablet | Secondary | Same layout, touch-friendly targets |
| Mobile | Tertiary | Simplified views, critical actions only |

**Implementation Strategy**:
- Build desktop version FIRST
- Use responsive breakpoints (`md:`, `lg:`) to adapt, not separate builds
- Lists: `variant: 'table' | 'cards'` prop, switches at `md:` breakpoint
- Some features desktop-only (complex editors, bulk operations)

**List Views**:
```
Desktop (>=768px): Tabular grid, maximize data density
+---------------------------------------------------------------------+
| Client          | Property      | Value   | Status | Rep | Due |
+---------------------------------------------------------------------+
| Perry - Creek   | 123 Main St   | $4,500  | Won | JD  | 1/15|
| Smith Homes     | 456 Oak Ave   | $12,200 | Sent| MK  | 1/18|
+---------------------------------------------------------------------+

Mobile (<768px): Card-based, scannable
+---------------------+
| Perry - Creek Hollow|
| 123 Main St         |
| $4,500  *  Won   |
| JD  *  Due: 1/15    |
+---------------------+
```

**Implementation**: `src/features/fsm/components/shared/ResponsiveList.tsx`

### 0.2 Unified Entity Page Layout (Jobber Pattern)

Quote, Job, and Invoice pages share the **SAME layout structure**:

```
+-----------------------------------------------------------------------+
| [PROJECT CONTEXT HEADER - always visible when in project context]     |
+-----------------------------------------------------------------------+
|                                                                       |
|  +-------------------------------------+  +--------------------------+|
|  |                                     |  |    RIGHT SIDEBAR         ||
|  |         MAIN BODY (75%)             |  |       (25%)              ||
|  |                                     |  |                          ||
|  |  * Entity header + status           |  |  * Quick actions         ||
|  |  * Client/Property info             |  |  * Assignment            ||
|  |  * Line items (ALWAYS visible)      |  |  * Dates/Schedule        ||
|  |  * Totals                           |  |  * Custom fields         ||
|  |  * Notes/Attachments                |  |  * Activity log          ||
|  |                                     |  |                          ||
|  +-------------------------------------+  +--------------------------+|
|                                                                       |
+-----------------------------------------------------------------------+
```

**CRITICAL**: Same component handles create/edit/view modes (like QuoteCard).

### 0.3 Project-First Architecture with Rich Header - COMPLETED

**Principle**: Project is the primary container. Client, Community, BU, Property, Rep are set at project level and inherited by all child entities.

**Project Tabs Structure**:
```
PROJECT (Container)
├── Overview Tab
│   └── ProjectPipelineProgress, financial summary, activity
├── Estimates Tab
│   └── List of Quotes for this project
│   └── [+ Add Quote] opens QuoteCard in create mode
├── Work Tab
│   └── List of Jobs for this project
│   └── Job visits timeline
│   └── [+ Add Job] opens JobCard in create mode
├── Billing Tab
│   └── List of Invoices for this project
│   └── Payment history
│   └── [+ Add Invoice] opens InvoiceCard in create mode
├── Files Tab
│   └── All attachments across all entities
└── Activity Tab
    └── Combined timeline of all changes
```

**Project Context Header** (3 rows, always visible when in project):

```
+-----------------------------------------------------------------------+
| Row 1: Identity                                                       |
| <- Back  |  Perry Homes - Creek Hollow  |  123 Main St, ATX          |
+-----------------------------------------------------------------------+
| Row 2: Project Meta                                                   |
| ATX-HB  |  John Doe  |  $45,000  |  Due: Jan 15                      |
+-----------------------------------------------------------------------+
| Row 3: Pipeline Status (visual)                                       |
|   o--------o--------o--------o                                        |
|  Quote    Job    Invoice   Paid                                       |
|  Done    Done    Sent       -                                         |
+-----------------------------------------------------------------------+
```

**Implementation**:
- `src/features/fsm/components/project/ProjectContextHeader.tsx`
- `src/features/fsm/components/shared/ProjectPipelineProgress.tsx`

**Consistency Rule**: Opening a Quote from `/quotes/:id` OR from `/projects/:pid/quotes/:id` shows the SAME page with Project Header visible.

### 0.4 Navigation Flow

```
Projects Hub (list)
    → Project Detail (tabs)
        → QuoteCard (create/edit/view within project)
        → JobCard (create/edit/view within project)
        → InvoiceCard (create/edit/view within project)

Quotes Hub (list)
    → QuoteCard (standalone, auto-creates project if needed)

Jobs Hub (list)
    → JobCard (standalone, requires quote/project context)

Invoices Hub (list)
    → InvoiceCard (standalone, requires job context)
```

### 0.5 Material Prep Pipeline (Unique Advantage)

> **IMPORTANT**: This connects to the **Ops Hub** (`src/features/bom_calculator/`) which manages BOM/BOL generation and yard workflows.

**This is what NO competitor has.** The yard workflow between "Job Won" and "Installation":

```
COMPETITORS:
Quote Won → Job → Scheduled → Work → Complete
                    (hope tech has materials?)

BOM CALCULATOR HUB (Ops Hub):
Quote Won → Job → ready → picking → staged → loaded → Install → Complete
                    ↓         ↓         ↓        ↓
               BOM/BOL    Materials  Materials  On truck,
               to yard    picked     verified   crew has
                                               pick list
```

**Material Prep Statuses** (align with existing `bom_projects.status`):

| Status | Description | Action |
|--------|-------------|--------|
| `ready` | BOM/BOL sent to yard | Office clicks "Send to Yard" |
| `picking` | Yard is picking materials | Yard claims pick |
| `staged` | Materials staged & verified | Yard completes staging |
| `loaded` | Materials on truck | Morning of install |

**DO NOT change these values** - they're already in production yard workflows.

**Related Files**:
- `src/features/bom_calculator/` - Ops Hub with BOM/BOL generation
- `bom_projects` table - Material workflow status tracking

### 0.6 Job Visits System

Jobs can have multiple visits for continuations, rework, callbacks:

```
JOB (parent)
├── Visit 1: Initial Installation (scheduled: Dec 20)
│   └── 8 hours, 3 crew, completed
├── Visit 2: Inspection Fix (scheduled: Dec 22)
│   └── 2 hours, 1 crew, completed
└── Visit 3: Rework - Customer Complaint (scheduled: Dec 28)
    └── 4 hours, 2 crew, pending
```

**Visit Types**:
- `initial` - First/main installation
- `continuation` - Multi-day continuation
- `inspection` - HOA/City inspection
- `rework` - Fix issues from previous visit
- `callback` - Customer-requested return
- `warranty` - Warranty service

### 0.7 Quote Options (Good/Better/Best) - FUTURE

> **Priority**: LOW - implement after core FSM is stable.

Quotes can have multiple pricing options presented to customer:

**UI Pattern**: Tab or card layout showing all options side-by-side.

**Concept**: Each quote can have Good/Better/Best tiers with different fence configurations, materials, and pricing. Customer selects which option they want.

### 0.8 Human-Readable Identifiers

**Principle**: Entity IDs (Q-2024-001) are secondary. Human-readable context is PRIMARY.

**Display Priority** (most important first):
1. **Client - Community** (e.g., "Perry Homes - Creek Hollow")
2. **Property Address** (e.g., "123 Main St")
3. **Title/Description** (e.g., "6ft Cedar Privacy")
4. **Value** (e.g., "$4,500")
5. **Key Dates** (e.g., "Due: Jan 15")
6. **Entity ID** (e.g., "Q-2024-001") - smallest, often in header

**In Lists**: Client-Community is the primary row identifier, not the entity ID.

### 0.9 Hierarchical Entity Numbering System

**Recommended Approach**: Hybrid - Flat sequential in DB, hierarchical display when relevant.

**Display Number Formats**:
```
Format: [Prefix]-[Letter][3-digit] = 26,000 combinations per entity type

Standalone:        P-A001, Q-B142, J-C089, INV-D201
Project-linked:    P-A001 -> Q-A001-A, Q-A001-B -> J-A001-A1, J-A001-A2 -> INV-A001-A1-1

Visual Example:
  Project P-A001 (Smith Fence)
    +-- Quote Q-A001-A (accepted)
    |     +-- Job J-A001-A1 (install)
    |     +-- Job J-A001-A2 (gate)
    |           +-- Invoice INV-A001-A2-1
    +-- Quote Q-A001-B (rejected alternate)
```

**Why Letter+3-digit Format**:
- 26 × 1000 = 26,000 projects (vs 999 with 3-digit only)
- Letters could map to location (A=Austin, S=San Antonio, H=Houston) if desired
- Easy to speak: "P-Alpha-zero-zero-one"

### 0.10 In-Project Team Chat

**Purpose**: Discussion threads saved with project context (like GitHub issues or Asana).

**UI Location**: Right sidebar "Activity" tab or dedicated "Discussion" tab

**Features**:
- @mention team members
- Notifications when mentioned
- Link to specific entities ("See Quote Q-A001-A")
- Timestamps with user avatars

### 0.11 Custom Fields (Jobber Pattern)

**Reference**: https://help.getjobber.com/hc/en-us/articles/115009735928-Custom-Fields

**Field Types Supported**: Text, Text Area, Number, Currency, Date, Dropdown, Checkbox, URL/Link

**UI Rendering**:
- Sidebar placement (default): Appears in right sidebar "Details" section
- Main body placement: Appears after standard fields, before notes

### 0.12 Project File Attachments (Cross-Entity)

**Best Practice** (Hybrid Model):
- **Project-level files** (drawings, permits, contracts) -> Available to all child entities
- **Entity-specific files** (before/after photos) -> Stay with that entity
- **Automatic inheritance** tracking for audit trail

**Predefined Categories** (Fence Industry): drawing_plan, contract, permit, property_survey, material_spec, before_photo, after_photo, progress_photo, inspection, warranty, internal_note, other

### 0.13 PriceBooks & Rate Sheets

**Existing Implementation**: Rate sheets are **PRODUCTION READY**:
- `rate_sheets` table with pricing_type, markups, effective dates
- `rate_sheet_items` for SKU-level overrides
- `rate_sheet_assignments` for client/community assignment
- `get_effective_rate_sheet()` function
- `usePricingResolution` hook

**Rate Sheet Hierarchy** (Most specific wins):
```
Priority 1: Quote/Invoice-level (one-off pricing)
Priority 2: Project-level
Priority 3: Property-level
Priority 4: Community-level (builder contracts)
Priority 5: Client-level (customer contracts)
Priority 6: QBO Class/BU default
Priority 7: System default
```

---

## Part 1: UI Standards

### 1.1 Component Structure Patterns

#### Modal/Dialog Pattern
```
Header: flex items-center justify-between px-6 py-4 border-b
  - Title (left)
  - Close button X (right)
Content: flex-1 overflow-y-auto p-4
Footer: flex justify-end gap-3 border-t bg-gray-50
  - Cancel button (left)
  - Primary action (right)
```

#### Card Pattern (Unified Create/Edit/View)
- **CRITICAL**: Component must look IDENTICAL when creating vs viewing
- Mode prop: `'create' | 'edit' | 'view'`
- Line items ALWAYS visible (not on separate tab)
- Edit mode = editable fields, View mode = read-only fields (same layout)
- NO separate "Builder" page vs "Detail" page

#### List/Table Pattern
- Grid-based layout (not `<table>` element)
- Header row: `bg-gray-50`
- Row hover: `hover:bg-gray-50`
- Empty state: icon + message + CTA button
- Action buttons on right side

### 1.2 Form Input Standards

```tsx
// Text Input / Textarea
className="w-full px-3 py-2 border border-gray-300 rounded-lg
           focus:ring-2 focus:ring-{color}-500 focus:border-{color}-500"

// Select
className="w-full px-3 py-2 border border-gray-300 rounded-lg
           focus:ring-2 focus:ring-{color}-500"

// Checkbox
className="w-4 h-4 rounded border-gray-300 text-{color}-600
           focus:ring-{color}-500"
```

**Required field marker**: `<span className="text-red-500">*</span>` next to label

### 1.3 Status Badge Colors

| Status Category | Tailwind Classes |
|-----------------|------------------|
| Draft/Inactive | `bg-gray-100 text-gray-700` |
| Pending/Active | `bg-blue-100 text-blue-700` |
| Success/Approved | `bg-green-100 text-green-700` |
| Warning/Review | `bg-amber-100 text-amber-700` |
| Error/Lost/Overdue | `bg-red-100 text-red-700` |

### 1.4 Loading States

```tsx
// Page loading spinner
<div className="animate-spin w-8 h-8 border-4 border-purple-500
                border-t-transparent rounded-full" />

// Button loading spinner
<div className="w-4 h-4 border-2 border-white/30 border-t-white
                rounded-full animate-spin" />

// Button with loading state
<button disabled={isPending} className="... disabled:opacity-50 disabled:cursor-not-allowed">
  {isPending ? 'Saving...' : 'Save'}
</button>
```

### 1.5 Error Handling Standards

**ALWAYS use toast notifications, NEVER use alert()**

```tsx
import { showError, showSuccess } from '@/lib/toast';

// On error
showError('Failed to save quote');

// On success
showSuccess('Quote saved successfully');
```

**Inline validation errors**: `text-red-600 text-sm` below field

### 1.6 Semantic Color Usage

| Color | Use For |
|-------|---------|
| Blue | Default actions, primary flows |
| Green | Success, FSM operations, active states |
| Purple | Quote/product operations |
| Red | Errors, destructive actions, past due |
| Amber | Warnings, pending approval |
| Gray | Neutral, disabled, metadata |

---

## Part 2: Data Integrity Requirements

### 2.1 Required Fields by Entity

#### Request
- `source` - REQUIRED (phone, web, referral, walk_in, builder_portal)
- `request_type` - REQUIRED, defaults to 'new_quote'
- `priority` - REQUIRED (low, normal, high, urgent)
- ONE of: `address_line1` OR `property_id` - REQUIRED
- ONE of: `client_id` OR `contact_name` - REQUIRED

#### Quote
- `client_id` - REQUIRED
- `billing_address` - REQUIRED (AddressSnapshot)
- `job_address` - REQUIRED (AddressSnapshot)
- `subtotal`, `total` - REQUIRED (>= 0)

#### Job
- `client_id` - REQUIRED
- `job_address` - REQUIRED (AddressSnapshot)
- **BOTH** `scheduled_date` AND `assigned_crew_id` required for status = 'scheduled'

#### Invoice
- `client_id` - REQUIRED
- `billing_address` - REQUIRED (AddressSnapshot)
- `subtotal`, `total` - REQUIRED
- `invoice_date` - REQUIRED (defaults to today)

### 2.2 Status is COMPUTED, Not Stored

**NEVER manually set status field.** Update the underlying data fields, triggers compute status.

| To Get Status | Set This Data |
|---------------|---------------|
| `assessment_scheduled` | `assessment_scheduled_at = [date]` |
| `assessment_completed` | `assessment_completed_at = [date]` |
| `converted` (request) | Create Quote with `request_id` |
| `converted` (quote) | Create Job with `quote_id` |
| `scheduled` (job) | `scheduled_date` AND `assigned_crew_id` |
| `in_progress` (job) | `work_started_at = [timestamp]` |
| `completed` (job) | `work_completed_at = [timestamp]` |
| `requires_invoicing` (job) | Create Invoice with `job_id` |
| `sent` (invoice) | `sent_at = [timestamp]` |
| `paid` (invoice) | Record Payment until `balance_due <= 0` |

### 2.3 Lifecycle Cascade Rules

Conversions auto-update parent entities:

```
Insert Quote with request_id
  -> request.converted_to_quote_id = quote.id (auto)
  -> request.status = 'converted' (computed)

Insert Job with quote_id
  -> quote.converted_to_job_id = job.id (auto)
  -> quote.status = 'converted' (computed)

Insert Invoice with job_id
  -> job.invoiced_at = NOW() (auto)
  -> job.status = 'requires_invoicing' (computed)

Record Payment on invoice
  -> invoice.amount_paid += payment.amount
  -> invoice.balance_due = total - amount_paid
  -> invoice.status = 'paid' (when balance_due <= 0)
```

### 2.4 Quote Approval Thresholds

A Quote requires manager approval if ANY of:
- Total > $25,000
- Margin < 15%
- Discount > 10%

When `requires_approval = true`: Quote cannot be sent until `approval_status = 'approved'`

### 2.5 Address Snapshot Pattern

Addresses in Quote/Job are SNAPSHOTS, not live references:

```typescript
AddressSnapshot {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}
```

**Why**: If Property address changes, historical Quotes/Jobs preserve the original address.

### 2.6 Critical Invariants (NEVER BREAK)

| Rule | Why |
|------|-----|
| Quote's `client_id` NEVER changes | Prevents double-billing |
| Job's `client_id` NEVER changes | Cost tracking integrity |
| Converted Quote NEVER reverts to draft | Prevents re-use |
| Scheduled Job MUST have crew | Capacity planning |
| Only ONE Quote per Project is accepted | Accounting clarity |
| Payment amount <= invoice total | Accounting accuracy |
| Invoiced Job status is TERMINAL | Prevents duplicate invoicing |

---

## Part 3: Hook & Query Standards

### 3.1 React Query Patterns

```typescript
// Fetch hook
export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ['quote', id],
    queryFn: async () => { /* ... */ },
    enabled: !!id,  // ALWAYS guard with enabled
  });
}

// Mutation hook with cache invalidation
export function useUpdateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => { /* ... */ },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
    },
  });
}
```

### 3.2 Form State Hook Pattern

```typescript
export function useQuoteForm(quoteId?: string) {
  const [form, setForm] = useState<QuoteFormState>(initialState);

  // Field setters
  const setField = (key: keyof QuoteFormState, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Computed values
  const totals = useMemo(() => calculateTotals(form), [form]);
  const validation = useMemo(() => validateForm(form), [form]);

  // Mutations
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();

  return {
    form,
    setField,
    totals,
    validation,
    isDirty: /* track changes */,
    save: async () => { /* create or update */ },
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}
```

---

## Part 4: Shared Components

### 4.1 Component Status

| Component | Status | File |
|-----------|--------|------|
| EntityHeader | DONE | `components/shared/EntityHeader.tsx` |
| EntityActionBar | DONE | `components/shared/EntityActionBar.tsx` |
| TotalsDisplay | DONE | `components/shared/TotalsDisplay.tsx` |
| BudgetActualDisplay | DONE | `components/shared/BudgetActualDisplay.tsx` |
| WorkflowProgress | DONE | `components/shared/WorkflowProgress.tsx` |
| ProjectPipelineProgress | DONE | `components/shared/ProjectPipelineProgress.tsx` |
| ResponsiveList | DONE | `components/shared/ResponsiveList.tsx` |
| VisitsTimeline | TODO | - |
| SchedulingSection | TODO | Integrate with Schedule Hub |
| PaymentsSection | TODO | - |

### 4.2 VisitsTimeline (To Build)

Shows job visits as vertical timeline:

```
+-------------------------------------------------------------+
|  VISITS                                        [+ Add Visit] |
+-------------------------------------------------------------+
|  * Visit 1: Initial Installation              [Completed]   |
|  | Dec 20, 2024 * 8:00 AM - 4:30 PM                        |
|  | Austin Crew Alpha * 8.5 hours                            |
|  | Notes: Installed 200 LF cedar privacy...                 |
|  |                                                          |
|  * Visit 2: HOA Inspection Fix                [Completed]   |
|  | Dec 22, 2024 * 10:00 AM - 12:00 PM                      |
|  | Mike S. * 2 hours                                        |
|  | Notes: Adjusted post heights per HOA...                  |
|  |                                                          |
|  o Visit 3: Final Walkthrough                 [Scheduled]   |
|    Dec 28, 2024 * 2:00 PM                                   |
|    John Rep                                                 |
+-------------------------------------------------------------+
```

### 4.3 SchedulingSection (To Build)

> **Note**: This should integrate with the existing **Schedule Hub** at `src/features/schedule/`. The Schedule Hub has drag-drop calendar functionality that needs enhancement.

For scheduling jobs/visits:

```
+-------------------------------------------------------------+
|  SCHEDULE                                                    |
+-------------------------------------------------------------+
|  Date         [Dec 20, 2024        v]                       |
|  Time         [8:00 AM] to [4:00 PM]                        |
|                                                             |
|  [ ] Schedule later (send to Schedule Hub)                  |
|  [ ] Anytime (flexible scheduling)                          |
|                                                             |
|  Assigned Crew  [Austin Crew Alpha  v]                      |
|  Team Members   [+ Add team member]                         |
|                 * Mike S. (Lead)                            |
|                 * Juan R.                                    |
|                                                             |
|  Est. Duration  [8] hours                                   |
+-------------------------------------------------------------+
```

**Related Files**:
- `src/features/schedule/SchedulePage.tsx` - Main schedule calendar
- `src/features/schedule/components/` - Schedule components
- `src/features/schedule/hooks/` - Schedule hooks

### 4.4 PaymentsSection (To Build)

For invoice payment tracking:

```
+-------------------------------------------------------------+
|  PAYMENTS                                    [+ Add Payment] |
+-------------------------------------------------------------+
|  Dec 21, 2024    Check #4521          $2,000.00             |
|  Dec 28, 2024    Credit Card          $2,763.00             |
|                                       ---------             |
|                          Total Paid:  $4,763.00             |
|                          Balance:         $0.00   PAID      |
+-------------------------------------------------------------+
```

---

## Part 5: Entity Cards

### 5.1 QuoteCard - DONE

Location: `src/features/fsm/components/QuoteCard/`

```
QuoteCard/
├── QuoteCard.tsx          # Main component
├── QuoteHeader.tsx        # Header with actions
├── QuoteClientSection.tsx # Client/property display
├── QuoteLineItems.tsx     # Line items table
├── QuoteSidebar.tsx       # Right sidebar
├── QuoteTotals.tsx        # Totals display
├── useQuoteForm.ts        # Form state management
├── types.ts               # Local types
└── index.ts
```

Features:
- Create/Edit/View modes in single component
- Line items always visible
- SKU search with rate sheet pricing
- Mark Lost modal with reasons
- Integrated with ProjectCreateWizard

### 5.2 JobCard - TODO

To Build: `src/features/fsm/components/JobCard/`

```
JobCard/
├── JobCard.tsx          # Main component
├── JobHeader.tsx        # Header with actions
├── JobClientSection.tsx # Client/property (read-only from quote/project)
├── JobVisitsSection.tsx # Visits timeline
├── JobBudgetSection.tsx # Budget vs actual
├── JobSidebar.tsx       # Assignment, scheduling, materials
├── useJobForm.ts        # Form state management
├── types.ts
└── index.ts
```

**Key Differences from QuoteCard**:
- Visits timeline instead of line items editor
- Budget vs Actual display
- Scheduling section (integrate with Schedule Hub)
- Crew assignment
- Material tracking per visit

### 5.3 InvoiceCard - TODO

To Build: `src/features/fsm/components/InvoiceCard/`

```
InvoiceCard/
├── InvoiceCard.tsx      # Main component
├── InvoiceHeader.tsx    # Header with actions
├── InvoiceLineItems.tsx # Line items (from job/quote, adjustable)
├── InvoicePayments.tsx  # Payments section
├── InvoiceSidebar.tsx   # Dates, terms, send options
├── useInvoiceForm.ts    # Form state management
├── types.ts
└── index.ts
```

**Key Differences from QuoteCard**:
- Payments section
- Line items pulled from job (editable for adjustments)
- Send invoice action (email/SMS)
- Due date tracking
- Past due highlighting

---

## Part 6: Implementation Phases

### Phase A: Foundation - COMPLETED

- [x] ResponsiveList component with useListVariant hook
- [x] ProjectPipelineProgress component
- [x] ProjectContextHeader (3 rows)
- [x] ProjectsListView table/cards responsive
- [x] Hover-to-expand sidebars
- [x] QuoteCard unified component
- [x] ProjectCreateWizard

### Phase B: Entity Unification - CURRENT

- [x] JobCard unified component (JobCard.tsx, JobHeader, JobVisitsSection, JobBudgetSection, JobSidebar)
- [x] InvoiceCard unified component (InvoiceCard.tsx, InvoiceHeader, InvoiceLineItems, InvoicePayments, InvoiceSidebar)
- [x] useJobVisits hook (exists in useJobs.ts: useJobVisits, useAddJobVisit, useCompleteJobVisit)
- [x] VisitsTimeline component (included in JobVisitsSection)
- [x] PaymentsSection component (included in InvoicePayments)
- [ ] SchedulingSection component (integrate with Schedule Hub)

### Phase C: Hub Integration

- [ ] QuotesHub uses QuoteCard for all modes
- [ ] JobsHub uses JobCard for all modes
- [ ] InvoicesHub uses InvoiceCard for all modes
- [ ] Remove legacy detail pages (QuoteDetailPage, JobDetailPage, InvoiceDetailPage)
- [ ] Right sidebar actions panel

### Phase D: Project-First Flow

- [ ] ProjectCreateWizard fully functional
- [ ] Project tabs (Overview, Estimates, Work, Billing, Files, Activity)
- [ ] Entity creation within project context
- [ ] Back navigation preserves project context

### Phase E: Polish & Integration

- [ ] Entity chat threads
- [ ] Attachment system
- [ ] Activity timeline aggregation
- [ ] Keyboard shortcuts
- [ ] Print/PDF generation
- [ ] Email/SMS sending

---

## Appendix A: Status Reference

### Request Statuses

| Status | Trigger |
|--------|---------|
| pending | Initial state |
| assessment_scheduled | assessment_scheduled_at set |
| assessment_today | Date = today |
| assessment_overdue | Date < today |
| assessment_completed | assessment_completed_at set |
| converted | converted_to_quote_id OR converted_to_job_id set |
| archived | archived_at set |

### Quote Statuses

| Status | Trigger |
|--------|---------|
| draft | Initial state |
| pending_approval | Needs internal approval |
| sent | sent_at set |
| follow_up | sent_at > 3 days ago |
| changes_requested | Client requested changes |
| approved | client_approved_at set |
| converted | converted_to_job_id set |
| lost | lost_at set |

### Job Statuses

| Status | Trigger |
|--------|---------|
| won | Initial state |
| scheduled | scheduled_date AND assigned_crew_id set |
| ready_for_yard | Material request submitted |
| picking | Materials being picked |
| staged | Materials staged |
| loaded | Materials loaded on truck |
| in_progress | started_at set |
| completed | work_completed_at set |
| requires_invoicing | completed AND no invoice |
| cancelled | cancelled_at set |

### Invoice Statuses

| Status | Trigger |
|--------|---------|
| draft | Initial state |
| sent | sent_at set |
| past_due | due_date < today AND balance > 0 |
| paid | balance = 0 |
| bad_debt | marked_bad_debt_at set |

### QBO Integration Fields

Invoices and Payments sync to QuickBooks Online:

- `qbo_invoice_id` / `qbo_payment_id` - QBO reference
- `qbo_sync_status` - 'pending' | 'synced' | 'error'
- `qbo_synced_at` - Last sync timestamp

**Sync triggers**: Invoice sent -> create QBO Invoice. Payment recorded -> create QBO Payment.

---

## Appendix B: Hooks Reference

### Existing Hooks (in src/features/fsm/hooks/)

| Hook | Status | Purpose |
|------|--------|---------|
| useRequests | DONE | Request CRUD + convert to Quote/Job |
| useQuotes | DONE | Quote CRUD + line items + convert to Job |
| useJobs | DONE | Job CRUD + scheduling |
| useInvoices | DONE | Invoice CRUD + payments |
| useProjects | DONE | Project CRUD + aggregates |
| useCrews | DONE | Crew management |
| useTerritories | DONE | Territory lookup |
| useFsmTeamProfiles | DONE | Team member management |
| useSalesReps | DONE | Rep selection (uses user_profiles) |
| useSkuSearch | DONE | SKU catalog search |
| useSkuLaborCost | DONE | BU-specific labor costs |

### Hooks To Build

| Hook | Purpose |
|------|---------|
| useJobVisits | Job visit CRUD (create, update, start, complete) |
| usePayments | Payment recording |
| useEntityAttachments | File attachments per entity |
| useEntityChat | Team chat threads per entity |

---

## Appendix C: Key Files Reference

| File | Contains |
|------|----------|
| `src/features/fsm/types.ts` | All FSM types, statuses, transitions |
| `src/features/fsm/components/shared/` | Shared UI components |
| `src/features/fsm/components/QuoteCard/` | QuoteCard implementation |
| `src/features/fsm/components/project/` | Project components |
| `src/features/fsm/hooks/` | All FSM hooks |
| `src/features/fsm/pages/` | Hub pages |
| `src/features/schedule/` | Schedule Hub |
| `src/features/bom_calculator/` | Ops Hub (material prep) |
| `src/lib/toast.ts` | Error/success notifications |
| `CLAUDE.md` | FSM system documentation |

---

## Appendix D: Implementation Checklist

Before implementing ANY FSM feature, verify:

- [ ] Does it follow modal/card/list patterns from Part 1?
- [ ] Does it use toast notifications (not alert)?
- [ ] Does it use correct status badge colors?
- [ ] Does it update data fields to change status (not set status directly)?
- [ ] Does it invalidate relevant query caches after mutations?
- [ ] Does it guard useQuery with `enabled: !!id`?
- [ ] Does it preserve address as snapshot (not live reference)?
- [ ] Does it handle loading/error/empty states?
- [ ] Does it have disabled states on buttons during mutations?

---

## END OF STANDARDS DOCUMENT
