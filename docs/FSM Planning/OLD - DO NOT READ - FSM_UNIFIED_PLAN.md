# FSM Unified Implementation Plan

> **This is the ONE authoritative source for FSM system architecture and implementation.**
> All other planning documents are superseded by this file.
> Last Updated: 2026-01-06
>
> **Source Merge**: FSM_SYSTEM_STANDARDS.md (philosophy) + 2026.01.01 Claude Chat Update Plan (specs)
> **Future Addition**: Select items from FSM_IMPLEMENTATION_MASTER.md (QBO, inventory, testing)

---

## Table of Contents

1. [Part 0: Core Philosophy](#part-0-core-philosophy)
2. [Part 1: Architecture Overview](#part-1-architecture-overview)
3. [Part 2: Database Schema](#part-2-database-schema)
4. [Part 3: TypeScript Interfaces](#part-3-typescript-interfaces)
5. [Part 4: Shared Components](#part-4-shared-components)
6. [Part 5: Entity Cards (QuoteCard, JobCard, InvoiceCard)](#part-5-entity-cards)
7. [Part 6: Implementation Phases](#part-6-implementation-phases)
8. [Appendix A: Status Reference](#appendix-a-status-reference)
9. [Appendix B: Hooks Reference](#appendix-b-hooks-reference)

---

# Part 0: Core Philosophy

These principles guide ALL FSM decisions. When in doubt, refer here.

## 0.1 Desktop-First, Mobile-Aware

- **Primary users**: Office staff on 1920x1080+ screens
- **Design for**: Dense data grids, side-by-side panels, keyboard shortcuts
- **Mobile**: Graceful degradation, not equal parity
- **Implementation**: Use `useListVariant()` hook for responsive breakpoints

## 0.2 Unified Create/View Layout

Every entity (Quote, Job, Invoice) uses the SAME layout pattern:

```
+----------------------------------------------------------+
|  [Back] Entity Title                    [Actions]        |  <- EntityHeader
+----------------------------------------------------------+
|  Main Content Area           |  Right Sidebar            |
|                              |  - Assignment             |
|  - Client/Property           |  - Scheduling             |
|  - Line Items (always)       |  - Financial Summary      |
|  - Notes/Attachments         |  - Activity Feed          |
|                              |                           |
+----------------------------------------------------------+
```

**Key Rules**:
- Line items ALWAYS visible (not hidden in tabs)
- Mode switching: view -> edit happens in-place (no page navigation)
- Right sidebar persists across modes
- Same component handles create/edit/view (mode prop)

## 0.3 Project Context Header

When viewing a Quote/Job/Invoice within a Project, show persistent context:

```
+----------------------------------------------------------+
| [<-] Perry Homes - Creek Hollow | 123 Main St, Austin    |  Row 1: Identity
|      ATX-HB | John Rep | $45,000 | Dec 15                |  Row 2: Meta
|      [Quote *] --- [Job] --- [Invoice] --- [Paid]        |  Row 3: Pipeline
+----------------------------------------------------------+
| Viewing: Quote QUO-2024-0147                              |  Row 4: Child indicator
+----------------------------------------------------------+
```

**Implementation**: `ProjectContextHeader` component with `extractPipelineData()` helper.

## 0.4 Human-Readable IDs

All entities use formatted IDs for display:

| Entity | Pattern | Example |
|--------|---------|---------|
| Request | REQ-YYYY-NNNN | REQ-2024-0001 |
| Quote | QUO-YYYY-NNNN | QUO-2024-0147 |
| Job | JOB-YYYY-NNNN | JOB-2024-0089 |
| Invoice | INV-YYYY-NNNN | INV-2024-0234 |
| Project | PRJ-YYYY-NNNN | PRJ-2024-0056 |

**Implementation**: Database trigger on insert generates `display_id` from sequence.

## 0.5 Hierarchical Entity Numbering

Related entities share numbering context:

```
PRJ-2024-0056
├── QUO-2024-0056-A  (first quote)
├── QUO-2024-0056-B  (revision)
├── JOB-2024-0056-1  (main job)
├── JOB-2024-0056-2  (add-on)
└── INV-2024-0056-1  (invoice)
```

## 0.6 Actions, Not Status Changes (Jobber Pattern)

**WRONG**: Status dropdown where user picks next status
**RIGHT**: Action buttons that update underlying data, status computed by triggers

| User Action | Data Updated | Computed Status |
|-------------|--------------|-----------------|
| Schedule Assessment | assessment_scheduled_at | assessment_scheduled |
| Create Quote | Insert quote with request_id | request: converted |
| Send Quote | sent_at, sent_via | quote: sent |
| Mark Won | Insert job with quote_id | quote: converted |
| Schedule Job | scheduled_date, assigned_crew_id | job: scheduled |
| Start Job | started_at | job: in_progress |
| Complete Job | work_completed_at | job: completed |
| Create Invoice | Insert invoice with job_id | job: requires_invoicing |
| Record Payment | Insert payment | invoice: paid (if balance=0) |

## 0.7 Team Chat per Entity

Every entity has a chat thread for internal team communication:

```typescript
interface EntityThread {
  entity_type: 'request' | 'quote' | 'job' | 'invoice' | 'project';
  entity_id: string;
  messages: ThreadMessage[];
}
```

**Implementation**: Reuse Message Center infrastructure with entity context.

## 0.8 Custom Fields (Future)

Allow admin-defined fields per entity type:

```typescript
interface CustomFieldDefinition {
  id: string;
  entity_type: string;
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'multiselect';
  options?: string[];  // for select types
  required: boolean;
  show_on_list: boolean;
}
```

## 0.9 Attachments System

Every entity supports file attachments:

```typescript
interface EntityAttachment {
  id: string;
  entity_type: string;
  entity_id: string;
  file_name: string;
  file_type: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
  category?: 'photo' | 'document' | 'contract' | 'other';
}
```

---

# Part 1: Architecture Overview

## 1.1 Project-First Architecture

**Core Concept**: Project is the primary container. Quote, Job, Invoice are aspects/tabs within it.

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

## 1.2 Navigation Flow

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

## 1.3 Material Prep Pipeline (Unique Advantage)

**This is what NO competitor has.** The yard workflow between "Job Won" and "Installation":

```
COMPETITORS:
Quote Won → Job → Scheduled → Work → Complete
                    (hope tech has materials?)

BOM CALCULATOR HUB:
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

## 1.4 Job Visits System

Jobs can have multiple visits:

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

## 1.5 Quote Options (Good/Better/Best)

Quotes can have multiple pricing options:

```typescript
interface QuoteOption {
  id: string;
  quote_id: string;
  name: string;           // "Good", "Better", "Best"
  description: string;
  fence_config: FenceConfig;
  bom: BOMItem[];
  bol: BOLItem[];
  materials_total: number;
  labor_total: number;
  total: number;
  is_selected: boolean;
  sort_order: number;
}
```

**UI Pattern**: Tab or card layout showing all options side-by-side.

## 1.6 Approval Workflows

Configurable thresholds per Business Unit:

| Threshold | Default | Trigger |
|-----------|---------|---------|
| Quote total | $25,000 | Requires manager approval |
| Margin minimum | 15% | Below this needs approval |
| Discount maximum | 10% | Above this needs approval |
| Invoice past due | 30 days | Auto-escalate to contacts |

**Approval UI**: Yellow banner at top of QuoteCard showing reasons + "Request Approval" button.

## 1.7 Budget vs Actual Tracking

Every Job tracks planned vs actual:

| Field | Purpose |
|-------|---------|
| budget_labor_hours | Estimated hours |
| budget_labor_cost | Estimated labor $ |
| budget_material_cost | Estimated materials $ |
| actual_labor_hours | Sum from visits |
| actual_labor_cost | Sum from visits |
| actual_material_cost | Actual materials used |

**Profitability Calculation**:
```
Gross Profit = Total Invoiced - Actual Labor Cost - Actual Material Cost
Margin % = Gross Profit / Total Invoiced * 100
```

---

# Part 2: Database Schema

## 2.1 Core Tables (Already Exist)

```sql
-- service_requests, quotes, jobs, invoices, projects
-- See existing migrations for current schema
```

## 2.2 Job Visits Table (Migration 205)

```sql
CREATE TABLE IF NOT EXISTS job_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  -- Sequencing
  visit_number INTEGER NOT NULL DEFAULT 1,

  -- Type & Status
  visit_type TEXT NOT NULL DEFAULT 'initial'
    CHECK (visit_type IN ('initial', 'continuation', 'inspection', 'rework', 'callback', 'warranty')),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),

  -- Scheduling
  scheduled_date DATE,
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,

  -- Assignment
  assigned_crew_id UUID REFERENCES crews(id),
  assigned_user_ids UUID[] DEFAULT '{}',

  -- Labor Tracking
  estimated_hours NUMERIC(6,2),
  actual_hours NUMERIC(6,2),
  labor_cost NUMERIC(10,2),

  -- Materials
  materials_used JSONB DEFAULT '[]',
  material_cost NUMERIC(10,2),

  -- Notes
  crew_notes TEXT,
  office_notes TEXT,
  customer_notes TEXT,

  -- Rework Tracking
  is_rework BOOLEAN DEFAULT false,
  rework_reason TEXT,
  original_visit_id UUID REFERENCES job_visits(id),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(job_id, visit_number)
);

CREATE INDEX idx_job_visits_job_id ON job_visits(job_id);
CREATE INDEX idx_job_visits_scheduled_date ON job_visits(scheduled_date);
CREATE INDEX idx_job_visits_status ON job_visits(status);
```

## 2.3 Projects Table Enhancements (Migration 202)

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS
  parent_project_id UUID REFERENCES projects(id),
  relationship_type TEXT CHECK (relationship_type IN ('phase', 'add_on', 'warranty', 'related')),
  source TEXT DEFAULT 'direct' CHECK (source IN ('request', 'direct_quote', 'phone', 'walk_in', 'referral', 'repeat')),
  source_request_id UUID REFERENCES service_requests(id);
```

## 2.4 Jobs Budget Columns (Migration 204)

```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS
  budget_labor_hours NUMERIC(8,2),
  budget_labor_cost NUMERIC(12,2),
  budget_material_cost NUMERIC(12,2),
  actual_labor_hours NUMERIC(8,2) DEFAULT 0,
  actual_labor_cost NUMERIC(12,2) DEFAULT 0,
  actual_material_cost NUMERIC(12,2) DEFAULT 0,
  variance_notes TEXT;
```

## 2.5 Helper Views

```sql
-- v_projects_full: Denormalized project view with counts
-- Already created in migration 207
-- Includes: cnt_quotes, cnt_jobs, cnt_invoices, sum_invoiced, etc.
```

---

# Part 3: TypeScript Interfaces

## 3.1 Job Visit Types

```typescript
export type VisitType = 'initial' | 'continuation' | 'inspection' | 'rework' | 'callback' | 'warranty';
export type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface JobVisit {
  id: string;
  job_id: string;
  visit_number: number;

  // Type & Status
  visit_type: VisitType;
  status: VisitStatus;

  // Scheduling
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;

  // Assignment
  assigned_crew_id: string | null;
  assigned_crew?: { id: string; name: string; };
  assigned_user_ids: string[];

  // Labor
  estimated_hours: number | null;
  actual_hours: number | null;
  labor_cost: number | null;

  // Materials
  materials_used: MaterialUsage[];
  material_cost: number | null;

  // Notes
  crew_notes: string | null;
  office_notes: string | null;
  customer_notes: string | null;

  // Rework
  is_rework: boolean;
  rework_reason: string | null;
  original_visit_id: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface MaterialUsage {
  sku_id?: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}
```

## 3.2 Job Budget Summary

```typescript
export interface JobBudgetSummary {
  // Budget
  budgetLaborHours: number;
  budgetLaborCost: number;
  budgetMaterialCost: number;
  budgetTotal: number;

  // Actual
  actualLaborHours: number;
  actualLaborCost: number;
  actualMaterialCost: number;
  actualTotal: number;

  // Variance
  laborHoursVariance: number;
  laborCostVariance: number;
  materialCostVariance: number;
  totalVariance: number;

  // Percentages
  laborHoursVariancePct: number;
  laborCostVariancePct: number;
  materialCostVariancePct: number;
  totalVariancePct: number;
}

export function calculateJobBudget(job: Job): JobBudgetSummary {
  const budgetTotal = (job.budget_labor_cost || 0) + (job.budget_material_cost || 0);
  const actualTotal = (job.actual_labor_cost || 0) + (job.actual_material_cost || 0);

  return {
    budgetLaborHours: job.budget_labor_hours || 0,
    budgetLaborCost: job.budget_labor_cost || 0,
    budgetMaterialCost: job.budget_material_cost || 0,
    budgetTotal,

    actualLaborHours: job.actual_labor_hours || 0,
    actualLaborCost: job.actual_labor_cost || 0,
    actualMaterialCost: job.actual_material_cost || 0,
    actualTotal,

    laborHoursVariance: (job.actual_labor_hours || 0) - (job.budget_labor_hours || 0),
    laborCostVariance: (job.actual_labor_cost || 0) - (job.budget_labor_cost || 0),
    materialCostVariance: (job.actual_material_cost || 0) - (job.budget_material_cost || 0),
    totalVariance: actualTotal - budgetTotal,

    laborHoursVariancePct: job.budget_labor_hours ?
      ((job.actual_labor_hours || 0) - job.budget_labor_hours) / job.budget_labor_hours * 100 : 0,
    laborCostVariancePct: job.budget_labor_cost ?
      ((job.actual_labor_cost || 0) - job.budget_labor_cost) / job.budget_labor_cost * 100 : 0,
    materialCostVariancePct: job.budget_material_cost ?
      ((job.actual_material_cost || 0) - job.budget_material_cost) / job.budget_material_cost * 100 : 0,
    totalVariancePct: budgetTotal ? (actualTotal - budgetTotal) / budgetTotal * 100 : 0,
  };
}
```

## 3.3 Project Types

```typescript
export type ProjectRelationshipType = 'phase' | 'add_on' | 'warranty' | 'related';
export type ProjectSource = 'request' | 'direct_quote' | 'phone' | 'walk_in' | 'referral' | 'repeat';

export interface Project {
  id: string;
  display_id: string;
  name: string;

  // Client & Location
  client_id: string;
  client?: Client;
  community_id?: string;
  community?: Community;
  property_id?: string;
  property?: Property;

  // Classification
  qbo_class_id?: string;
  qbo_class?: QboClass;

  // Relationships
  parent_project_id?: string;
  relationship_type?: ProjectRelationshipType;
  source: ProjectSource;
  source_request_id?: string;

  // Assignment
  assigned_rep_user_id?: string;
  assigned_rep_user?: RepUser;

  // Aggregates (from v_projects_full)
  cnt_quotes?: number;
  cnt_jobs?: number;
  cnt_invoices?: number;
  accepted_quote_id?: string;
  cnt_active_jobs?: number;
  cnt_unpaid_invoices?: number;
  sum_invoiced?: number;
  sum_paid?: number;
  sum_balance_due?: number;

  // Metadata
  status: string;
  created_at: string;
  updated_at: string;
}
```

---

# Part 4: Shared Components

## 4.1 Component Status

| Component | Status | File |
|-----------|--------|------|
| EntityHeader | DONE | components/shared/EntityHeader.tsx |
| EntityActionBar | DONE | components/shared/EntityActionBar.tsx |
| TotalsDisplay | DONE | components/shared/TotalsDisplay.tsx |
| BudgetActualDisplay | DONE | components/shared/BudgetActualDisplay.tsx |
| WorkflowProgress | DONE | components/shared/WorkflowProgress.tsx |
| ProjectPipelineProgress | DONE | components/shared/ProjectPipelineProgress.tsx |
| ResponsiveList | DONE | components/shared/ResponsiveList.tsx |
| VisitsTimeline | TODO | - |
| SchedulingSection | TODO | - |
| PaymentsSection | TODO | - |

## 4.2 VisitsTimeline (To Build)

Shows job visits as vertical timeline:

```
┌─────────────────────────────────────────────────────────────┐
│  VISITS                                        [+ Add Visit] │
├─────────────────────────────────────────────────────────────┤
│  ● Visit 1: Initial Installation              ✓ Completed   │
│  │ Dec 20, 2024 • 8:00 AM - 4:30 PM                        │
│  │ Austin Crew Alpha • 8.5 hours                            │
│  │ Notes: Installed 200 LF cedar privacy...                 │
│  │                                                          │
│  ● Visit 2: HOA Inspection Fix                ✓ Completed   │
│  │ Dec 22, 2024 • 10:00 AM - 12:00 PM                      │
│  │ Mike S. • 2 hours                                        │
│  │ Notes: Adjusted post heights per HOA...                  │
│  │                                                          │
│  ○ Visit 3: Final Walkthrough                 ◐ Scheduled   │
│    Dec 28, 2024 • 2:00 PM                                   │
│    John Rep                                                 │
└─────────────────────────────────────────────────────────────┘
```

```typescript
interface VisitsTimelineProps {
  visits: JobVisit[];
  onAddVisit?: () => void;
  onEditVisit?: (visit: JobVisit) => void;
  onStartVisit?: (visit: JobVisit) => void;
  onCompleteVisit?: (visit: JobVisit) => void;
  readOnly?: boolean;
}
```

## 4.3 SchedulingSection (To Build)

For scheduling jobs/visits:

```
┌─────────────────────────────────────────────────────────────┐
│  SCHEDULE                                                    │
├─────────────────────────────────────────────────────────────┤
│  Date         [Dec 20, 2024        ▼]                       │
│  Time         [8:00 AM] to [4:00 PM]                        │
│                                                             │
│  ☐ Schedule later (send to Schedule Hub)                    │
│  ☐ Anytime (flexible scheduling)                            │
│                                                             │
│  Assigned Crew  [Austin Crew Alpha  ▼]                      │
│  Team Members   [+ Add team member]                         │
│                 • Mike S. (Lead)                            │
│                 • Juan R.                                    │
│                                                             │
│  Est. Duration  [8] hours                                   │
└─────────────────────────────────────────────────────────────┘
```

```typescript
interface SchedulingSectionProps {
  scheduledDate: string | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  assignedCrewId: string | null;
  assignedUserIds: string[];
  estimatedHours: number | null;
  scheduleLater: boolean;
  anytime: boolean;
  onChange: (updates: Partial<SchedulingData>) => void;
  readOnly?: boolean;
}
```

## 4.4 PaymentsSection (To Build)

For invoice payment tracking:

```
┌─────────────────────────────────────────────────────────────┐
│  PAYMENTS                                    [+ Add Payment] │
├─────────────────────────────────────────────────────────────┤
│  Dec 21, 2024    Check #4521          $2,000.00             │
│  Dec 28, 2024    Credit Card          $2,763.00             │
│                                       ─────────             │
│                          Total Paid:  $4,763.00             │
│                          Balance:         $0.00   ✓ PAID    │
└─────────────────────────────────────────────────────────────┘
```

```typescript
interface PaymentsSectionProps {
  payments: Payment[];
  totalAmount: number;
  totalPaid: number;
  balanceDue: number;
  onAddPayment?: () => void;
  onEditPayment?: (payment: Payment) => void;
  onDeletePayment?: (payment: Payment) => void;
  readOnly?: boolean;
}
```

---

# Part 5: Entity Cards

## 5.1 QuoteCard (DONE)

Location: `src/features/fsm/components/QuoteCard/`

```
QuoteCard/
├── QuoteCard.tsx        # Main component
├── QuoteHeader.tsx      # Header with actions
├── QuoteClientSection.tsx # Client/property display
├── QuoteLineItems.tsx   # Line items table
├── QuoteSidebar.tsx     # Right sidebar
├── useQuoteForm.ts      # Form state management
├── types.ts             # Local types
└── index.ts
```

Features:
- Create/Edit/View modes in single component
- Line items always visible
- SKU search with rate sheet pricing
- Mark Lost modal with reasons
- Integrated with ProjectCreateWizard

## 5.2 JobCard (TODO)

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
- Scheduling section
- Crew assignment
- Material tracking per visit

## 5.3 InvoiceCard (TODO)

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

**Key Differences**:
- Payments section
- Line items pulled from job (editable for adjustments)
- Send invoice action (email/SMS)
- Due date tracking
- Past due highlighting

---

# Part 6: Implementation Phases

## Phase A: Foundation (DONE)

- [x] ResponsiveList component with useListVariant hook
- [x] ProjectPipelineProgress component
- [x] ProjectContextHeader (3 rows)
- [x] ProjectsListView table/cards responsive
- [x] Hover-to-expand sidebars

## Phase B: Entity Unification (CURRENT)

- [x] QuoteCard unified component
- [ ] JobCard unified component
- [ ] InvoiceCard unified component
- [ ] useJobVisits hook
- [ ] VisitsTimeline component
- [ ] SchedulingSection component
- [ ] PaymentsSection component

## Phase C: Hub Integration

- [ ] QuotesHub uses QuoteCard for all modes
- [ ] JobsHub uses JobCard for all modes
- [ ] InvoicesHub uses InvoiceCard for all modes
- [ ] Remove legacy detail pages (QuoteDetailPage, JobDetailPage, InvoiceDetailPage)
- [ ] Right sidebar actions panel

## Phase D: Project-First Flow

- [ ] ProjectCreateWizard fully functional
- [ ] Project tabs (Overview, Estimates, Work, Billing, Files, Activity)
- [ ] Entity creation within project context
- [ ] Back navigation preserves project context

## Phase E: Polish & Integration

- [ ] Entity chat threads
- [ ] Attachment system
- [ ] Activity timeline aggregation
- [ ] Keyboard shortcuts
- [ ] Print/PDF generation
- [ ] Email/SMS sending

---

# Appendix A: Status Reference

## Request Statuses

| Status | Trigger |
|--------|---------|
| pending | Initial state |
| assessment_scheduled | assessment_scheduled_at set |
| assessment_today | Date = today |
| assessment_overdue | Date < today |
| assessment_completed | assessment_completed_at set |
| converted | converted_to_quote_id OR converted_to_job_id set |
| archived | archived_at set |

## Quote Statuses

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

## Job Statuses

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

## Invoice Statuses

| Status | Trigger |
|--------|---------|
| draft | Initial state |
| sent | sent_at set |
| past_due | due_date < today AND balance > 0 |
| paid | balance = 0 |
| bad_debt | marked_bad_debt_at set |

## QBO Integration Fields

Invoices and Payments sync to QuickBooks Online:

```typescript
// On Invoice
qbo_invoice_id?: string;
qbo_sync_status: 'pending' | 'synced' | 'error';
qbo_synced_at?: Date;
qbo_sync_error?: string;

// On Payment
qbo_payment_id?: string;
qbo_sync_status: 'pending' | 'synced' | 'error';
```

**Sync triggers**: Invoice sent → create QBO Invoice. Payment recorded → create QBO Payment.

---

# Appendix B: Hooks Reference

## Existing Hooks (in src/features/fsm/hooks/)

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

## Hooks To Build

| Hook | Purpose |
|------|---------|
| useJobVisits | Job visit CRUD (create, update, start, complete) |
| usePayments | Payment recording |
| useEntityAttachments | File attachments per entity |
| useEntityChat | Team chat threads per entity |

---

# Appendix C: What's Built vs TODO

## Built (Phase A Complete)

- [x] EntityHeader, EntityActionBar, TotalsDisplay, BudgetActualDisplay
- [x] WorkflowProgress, ProjectPipelineProgress
- [x] ResponsiveList with useListVariant
- [x] ProjectContextHeader (3 rows)
- [x] ProjectsListView (table/card responsive)
- [x] QuoteCard unified component
- [x] ProjectCreateWizard
- [x] Hover-to-expand sidebars

## TODO (Phase B - Current)

- [ ] **useJobVisits hook** ← PRIORITY
- [ ] **VisitsTimeline component** ← PRIORITY
- [ ] SchedulingSection component
- [ ] **JobCard unified component** ← PRIORITY
- [ ] PaymentsSection component
- [ ] InvoiceCard unified component

## TODO (Phase C+)

- [ ] Hub pages use unified cards for all modes
- [ ] Remove legacy detail pages
- [ ] Right sidebar actions panel
- [ ] Entity chat threads
- [ ] Attachments system

---

# Appendix D: Testing Scenarios

## Happy Path (End-to-End)

1. **Create Request** - Phone call → Smart client lookup → Create new client inline → Auto-territory from ZIP
2. **Schedule Assessment** - Assign date/time/rep → Status: `assessment_scheduled`
3. **Complete Assessment** - Rep visits, photos, notes → Status: `assessment_completed`
4. **Create Quote** - Convert Request → BOM Calculator → Good/Better/Best options → Margin 18% (no approval)
5. **Send Quote** - Email to client → Status: `sent`
6. **Client Approves** - Portal signature → Status: `approved`
7. **Convert to Job** - Create Job → Status: `won`
8. **Send to Yard** - BOM/BOL to yard → Status: `ready`
9. **Yard Workflow** - `picking` → `staged` → `loaded`
10. **Installation** - Crew arrives → `in_progress` → `completed`
11. **Invoice & Pay** - Create invoice → Send → Payment recorded → `paid`

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Unknown ZIP code | Warning, allow manual territory |
| Phone matches existing client | Show existing, prevent duplicate |
| Quote > $25,000 | Requires manager approval |
| Margin < 15% | Requires manager approval |
| Discount > 10% | Requires manager approval |
| Material out of stock | Block "Send to Yard" |
| Weather delay | Status → `paused` |
| Client requests changes | Quote → `changes_requested` → back to draft |
| Invoice 30+ days past due | Auto-escalate |

---

# Appendix E: Future Enhancements (from MASTER)

These items are documented for future implementation:

1. **Inventory Management** - Multi-location tracking, auto-consumption on job complete
2. **AI Scheduling** - Rep/crew suggestions based on territory, skills, capacity
3. **Capacity Planning** - ServiceTitan-style capacity board
4. **Client Portal** - Quote approval, payment, job tracking
5. **Mobile Yard App** - Pick/stage/load workflow on tablet
6. **Dashboards** - Opportunity funnel, team performance, operational metrics

---

# Document History

| Date | Change |
|------|--------|
| 2026-01-06 | Initial unified plan (Standards + 2026.01.01 specs) |
| 2026-01-06 | Added from MASTER: Material Prep Pipeline, Quote Options, Approval Workflows, QBO fields, Testing Scenarios |

---

**END OF UNIFIED FSM PLAN**
