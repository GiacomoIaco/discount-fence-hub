# Project-First Architecture Plan

## Executive Summary

**Core Principle**: Project is the PRIMARY container. Quote, Job, and Invoice are aspects/tabs within a Project, not standalone entities.

**Key Benefits**:
- Client, Property, BU, Rep stored ONCE at Project level
- No data duplication or sync issues
- Natural model for multiple quotes (client picks 1)
- Natural model for phased jobs
- Warranty work as linked projects

---

## Critical UX Requirements

### 1. Unified Create/View Mode

**Quote, Job, and Invoice must look IDENTICAL when creating vs viewing.**

- Line items are ALWAYS visible (not on a separate page)
- Edit mode = editable fields
- View mode = read-only fields, same layout
- NO separate "Builder" page vs "Detail" page

```
┌────────────────────────────────────────────────────────────┐
│  Quote #Q-2024-0042                    [Edit] [Send] [✓]  │
├────────────────────────────────────────────────────────────┤
│  LINE ITEMS (always visible)                               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 6ft Cedar Privacy Fence    150 LF × $45    $6,750   │ │
│  │ Post Holes                 25 ea × $35     $875     │ │
│  │ Auto Gate                  1 ea × $2,500   $2,500   │ │
│  └──────────────────────────────────────────────────────┘ │
│  Subtotal: $10,125  |  Tax: $0  |  Total: $10,125         │
│  Notes | Activity | Files                                  │
└────────────────────────────────────────────────────────────┘
```

### 2. Preserve Multi-Phase Quote Conversion

**The QuoteToJobsModal feature MUST be preserved.** It allows:

1. **Line Item Selection** → Select which items go to which job
2. **Multiple Jobs (Phases)** → Split quote into Fence job + Auto Gate job
3. **Job Dependencies** → Job 2 runs after Job 1 completes
4. **Invoice Grouping** → Invoice together OR separately

This modal is accessible from the Estimates tab "Create Jobs" action on an accepted quote.

**Existing Implementation**: `src/features/fsm/components/QuoteToJobsModal.tsx`

Key data flow preserved:
```typescript
QuoteToJobConfig {
  name: string;
  quote_line_item_ids: string[];  // Which line items go to this job
  depends_on_previous: boolean;   // Sequence dependency
  assigned_crew_id?: string;
  scheduled_date?: string;
}
```

---

## Data Model

### Current (Problematic)

```
Request → Quote → Job → Invoice
   ↓        ↓       ↓       ↓
client_id  client_id client_id client_id
address    address   address   address
BU         BU        BU        BU
rep        rep       rep       rep
```

Same data stored 4 times - violates DRY, causes sync issues.

### Proposed (Project-First)

```
PROJECT (container)
├── client_id (ONCE)
├── property_id → address, geo_coords (ONCE)
├── qbo_class_id → BU (ONCE)
├── assigned_rep_user_id (ONCE)
│
├── quotes[] (multiple, only 1 accepted)
│   ├── quote_number
│   ├── line_items[]
│   ├── totals
│   └── acceptance_status: pending|accepted|declined|superseded
│
├── jobs[] (multiple phases)
│   ├── job_number
│   ├── job_visits[]
│   ├── budget vs actual
│   └── phase_number
│
└── invoices[] (1 per job typically)
    ├── invoice_number
    ├── line_items[]
    └── payments[]
```

---

## User Flows

### Flow 1: New Quote from Scratch (No Request)

1. User clicks "New Quote" (or "New Project")
2. **ProjectCreateWizard** opens:
   - Step 1: Client (search existing or create new)
   - Step 2: Property/Address (pick from client's properties or enter new)
   - Step 3: BU selection (auto-suggested from territory)
3. Project created → Quote created with `project_id`
4. User lands on **ProjectPage > Estimates tab**
5. Quote only stores: line_items, totals, notes
6. All context (client, address, BU, rep) inherited from Project

### Flow 2: Request → Quote Conversion

1. Request has client_id, address (entered during intake)
2. User clicks "Create Quote" on Request
3. **System auto-creates Project** from Request data
4. Quote created with `project_id`
5. Request marked `converted_to_project_id`
6. User lands on **ProjectPage > Estimates tab**

### Flow 3: Multiple Quotes per Project

**Scenario**: Client wants fence quote, then asks "what about wood instead?"

- Quote tab shows list of quotes with status badges
- "Accept Quote" button → sets `accepted_quote_id`, marks others `superseded`
- Only accepted quote shows "Create Job" button
- Declined/superseded quotes are view-only

### Flow 4: Multiple Jobs per Project (Phases)

**Scenario**: Large project with Phase 1 (demo), Phase 2 (install), Phase 3 (stain)

- Work tab shows jobs in phase order
- Visual pipeline: Phase 1 → Phase 2 → Phase 3
- Each job has its own scheduling, crew assignment
- Project totals aggregate all jobs

### Flow 5: Warranty Job (Linked Project)

**Scenario**: 6 months later, fence needs repair

- **NOT a job within the same project** because:
  - Different timeline (months/years later)
  - May have different pricing (warranty = free labor)
  - May affect profitability differently
- Original ProjectPage shows "Related Projects" section
- "Create Warranty Claim" creates new Project with `parent_project_id`
- Warranty project has its own Quote → Job → Invoice flow

---

## Database Schema Changes

### Migration 202: Project Foundation

```sql
-- Enhance projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS accepted_quote_id UUID REFERENCES quotes(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id UUID REFERENCES projects(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS relationship_type TEXT CHECK (relationship_type IN ('warranty', 'change_order', 'follow_up'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('request', 'direct_quote', 'phone', 'walk_in', 'referral'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_request_id UUID REFERENCES service_requests(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_property ON projects(property_id);
CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id);
```

### Migration 203: Quote Enhancements

```sql
-- Quote acceptance tracking
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS acceptance_status TEXT DEFAULT 'pending'
  CHECK (acceptance_status IN ('pending', 'accepted', 'declined', 'superseded'));
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS superseded_by_quote_id UUID REFERENCES quotes(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

-- Ensure project_id exists
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Index
CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_quotes_acceptance ON quotes(acceptance_status);
```

### Migration 204: Job Enhancements

```sql
-- Phase tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS phase_number INTEGER DEFAULT 1;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS phase_name TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS depends_on_job_id UUID REFERENCES jobs(id);

-- Budget tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budgeted_labor_hours DECIMAL(6,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budgeted_labor_cost DECIMAL(10,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budgeted_material_cost DECIMAL(10,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_labor_hours DECIMAL(6,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_labor_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_material_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS has_rework BOOLEAN DEFAULT false;

-- Ensure project_id exists
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_phase ON jobs(project_id, phase_number);
```

### Migration 205: Job Visits

```sql
CREATE TABLE IF NOT EXISTS job_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  visit_number INTEGER NOT NULL DEFAULT 1,
  visit_type TEXT NOT NULL DEFAULT 'initial' CHECK (visit_type IN ('initial', 'continuation', 'rework', 'callback', 'inspection')),

  -- Scheduling
  scheduled_date DATE,
  scheduled_start_time TIME,
  scheduled_end_time TIME,

  -- Crew
  assigned_crew_id UUID REFERENCES crews(id),

  -- Time tracking
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  labor_hours DECIMAL(5,2),
  labor_rate DECIMAL(10,2),
  labor_cost DECIMAL(10,2),

  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled')),

  -- Issue tracking (for rework/callback)
  issue_description TEXT,
  resolution_notes TEXT,
  is_billable BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,

  UNIQUE(job_id, visit_number)
);

-- Indexes
CREATE INDEX idx_job_visits_job ON job_visits(job_id);
CREATE INDEX idx_job_visits_date ON job_visits(scheduled_date);
CREATE INDEX idx_job_visits_crew ON job_visits(assigned_crew_id);
CREATE INDEX idx_job_visits_status ON job_visits(status);

-- Trigger to update job actuals when visit completed
CREATE OR REPLACE FUNCTION update_job_actuals_from_visit()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE jobs SET
    actual_labor_hours = (SELECT COALESCE(SUM(labor_hours), 0) FROM job_visits WHERE job_id = NEW.job_id AND status = 'completed'),
    actual_labor_cost = (SELECT COALESCE(SUM(labor_cost), 0) FROM job_visits WHERE job_id = NEW.job_id AND status = 'completed'),
    has_rework = EXISTS (SELECT 1 FROM job_visits WHERE job_id = NEW.job_id AND visit_type IN ('rework', 'callback'))
  WHERE id = NEW.job_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_job_actuals
AFTER INSERT OR UPDATE ON job_visits
FOR EACH ROW EXECUTE FUNCTION update_job_actuals_from_visit();
```

### Migration 206: Auto-Create Project Triggers

```sql
-- When Quote created without project_id, auto-create Project
CREATE OR REPLACE FUNCTION auto_create_project_for_quote()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS NULL AND NEW.client_id IS NOT NULL THEN
    INSERT INTO projects (
      client_id,
      property_id,
      qbo_class_id,
      assigned_rep_user_id,
      source,
      name
    )
    VALUES (
      NEW.client_id,
      NEW.property_id,
      NEW.qbo_class_id,
      NEW.sales_rep_user_id,
      'direct_quote',
      COALESCE(NEW.project_name, 'Project ' || to_char(now(), 'YYYY-MM-DD'))
    )
    RETURNING id INTO NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_create_project_for_quote
BEFORE INSERT ON quotes
FOR EACH ROW EXECUTE FUNCTION auto_create_project_for_quote();

-- When Request converted, create Project
CREATE OR REPLACE FUNCTION create_project_from_request()
RETURNS TRIGGER AS $$
DECLARE
  new_project_id UUID;
BEGIN
  -- Only if converting to quote and no project exists
  IF NEW.converted_to_quote_id IS NOT NULL AND NEW.converted_to_project_id IS NULL THEN
    INSERT INTO projects (
      client_id,
      property_id,
      qbo_class_id,
      assigned_rep_user_id,
      source,
      source_request_id,
      name
    )
    VALUES (
      NEW.client_id,
      NEW.property_id,
      NEW.qbo_class_id,
      NEW.assigned_rep_user_id,
      'request',
      NEW.id,
      COALESCE(NEW.description, 'Project from Request ' || NEW.request_number)
    )
    RETURNING id INTO new_project_id;

    NEW.converted_to_project_id := new_project_id;

    -- Update the quote with project_id
    UPDATE quotes SET project_id = new_project_id WHERE id = NEW.converted_to_quote_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_project_from_request
BEFORE UPDATE ON service_requests
FOR EACH ROW
WHEN (OLD.converted_to_quote_id IS NULL AND NEW.converted_to_quote_id IS NOT NULL)
EXECUTE FUNCTION create_project_from_request();

-- When Quote accepted, update Project
CREATE OR REPLACE FUNCTION update_project_accepted_quote()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.acceptance_status = 'accepted' AND OLD.acceptance_status != 'accepted' THEN
    NEW.accepted_at := now();

    -- Update project's accepted_quote_id
    UPDATE projects SET accepted_quote_id = NEW.id WHERE id = NEW.project_id;

    -- Mark other quotes as superseded
    UPDATE quotes
    SET acceptance_status = 'superseded'
    WHERE project_id = NEW.project_id
      AND id != NEW.id
      AND acceptance_status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_project_accepted_quote
BEFORE UPDATE ON quotes
FOR EACH ROW EXECUTE FUNCTION update_project_accepted_quote();
```

### Migration 207: Project Views

```sql
-- Project with full details
CREATE OR REPLACE VIEW v_projects_full AS
SELECT
  p.*,
  c.name as client_name,
  c.company_name as client_company,
  c.email as client_email,
  c.phone as client_phone,
  prop.address_line1 as property_address,
  prop.city as property_city,
  prop.state as property_state,
  prop.zip as property_zip,
  qbo.name as qbo_class_name,
  qbo.labor_code,
  u.full_name as rep_name,
  -- Counts
  (SELECT COUNT(*) FROM quotes WHERE project_id = p.id) as quote_count,
  (SELECT COUNT(*) FROM jobs WHERE project_id = p.id) as job_count,
  (SELECT COUNT(*) FROM invoices WHERE project_id = p.id) as invoice_count,
  -- Totals
  (SELECT COALESCE(SUM(total_amount), 0) FROM quotes WHERE project_id = p.id AND acceptance_status = 'accepted') as quoted_total,
  (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE project_id = p.id) as invoiced_total,
  (SELECT COALESCE(SUM(amount_paid), 0) FROM invoices WHERE project_id = p.id) as paid_total,
  -- Parent project (for warranty)
  parent.name as parent_project_name
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN properties prop ON p.property_id = prop.id
LEFT JOIN qbo_classes qbo ON p.qbo_class_id = qbo.id
LEFT JOIN user_profiles u ON p.assigned_rep_user_id = u.id
LEFT JOIN projects parent ON p.parent_project_id = parent.id;

-- Grant access
GRANT SELECT ON v_projects_full TO authenticated;
```

---

## TypeScript Types

### New Types (types.ts additions)

```typescript
// Project enhancements
export interface Project {
  id: string;
  name: string;
  client_id: string;
  property_id?: string;
  qbo_class_id?: string;
  assigned_rep_user_id?: string;

  // Source tracking
  source?: 'request' | 'direct_quote' | 'phone' | 'walk_in' | 'referral';
  source_request_id?: string;

  // Relationships
  accepted_quote_id?: string;
  parent_project_id?: string;
  relationship_type?: 'warranty' | 'change_order' | 'follow_up';

  // Computed/joined
  client?: Client;
  property?: Property;
  qbo_class?: QboClass;
  assigned_rep?: UserProfile;
  quotes?: Quote[];
  jobs?: Job[];
  invoices?: Invoice[];
  parent_project?: Project;

  // Aggregates
  quote_count?: number;
  job_count?: number;
  invoice_count?: number;
  quoted_total?: number;
  invoiced_total?: number;
  paid_total?: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// Quote acceptance
export type QuoteAcceptanceStatus = 'pending' | 'accepted' | 'declined' | 'superseded';

export interface Quote {
  // ... existing fields ...
  project_id?: string;
  acceptance_status: QuoteAcceptanceStatus;
  superseded_by_quote_id?: string;
  accepted_at?: string;
  declined_at?: string;
}

// Job phases
export interface Job {
  // ... existing fields ...
  project_id?: string;
  phase_number: number;
  phase_name?: string;
  depends_on_job_id?: string;

  // Budget tracking
  budgeted_labor_hours?: number;
  budgeted_labor_cost?: number;
  budgeted_material_cost?: number;
  actual_labor_hours?: number;
  actual_labor_cost?: number;
  actual_material_cost?: number;
  has_rework?: boolean;
}

// Job visits
export type VisitType = 'initial' | 'continuation' | 'rework' | 'callback' | 'inspection';
export type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';

export interface JobVisit {
  id: string;
  job_id: string;
  visit_number: number;
  visit_type: VisitType;

  // Scheduling
  scheduled_date?: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;

  // Crew
  assigned_crew_id?: string;
  assigned_crew?: Crew;

  // Time tracking
  actual_start_time?: string;
  actual_end_time?: string;
  labor_hours?: number;
  labor_rate?: number;
  labor_cost?: number;

  // Status
  status: VisitStatus;

  // Issue tracking
  issue_description?: string;
  resolution_notes?: string;
  is_billable: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at?: string;
}
```

---

## UI Components

### ProjectPage Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Header - EntityHeader component]                           │
│   ← Back to Projects                                        │
│   [Icon] Perry Homes - 123 Oak St  [Status Badge]          │
│   Client: Perry Homes | Property: 123 Oak St, Austin TX    │
│   BU: Austin Builders | Rep: John Smith                    │
├─────────────────────────────────────────────────────────────┤
│ [Tabs]                                                      │
│   Overview | Estimates | Work | Billing | Files | Activity  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Tab Content - varies by tab]                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tab Components

1. **OverviewTab** - Project summary, timeline, totals
2. **EstimatesTab** - List of quotes, acceptance status, inline quote view/edit
3. **WorkTab** - List of jobs by phase, inline job view/edit, visits timeline
4. **BillingTab** - List of invoices, inline invoice view/edit, payments
5. **FilesTab** - Attachments (future)
6. **ActivityTab** - Status history, notes

### Unified Entity Components (Create = View)

Each entity uses a SINGLE component that handles both create and view modes:

**QuoteCard** (replaces QuoteBuilderPage + QuoteDetailPage)
```
┌─────────────────────────────────────────────────────────────┐
│ Quote #Q-2024-0042                 [Draft]  [Edit] [Send]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ LINE ITEMS                                      [+ Add]    │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ SKU        Description              Qty   Price   Total ││
│ │ F-CED-6P   6ft Cedar Privacy Fence  150LF  $45   $6,750 ││
│ │ L-POST     Post Holes               25ea   $35   $875   ││
│ │ G-AUTO     Automatic Gate           1ea  $2,500  $2,500 ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│                    Subtotal: $10,125                       │
│                    Tax (0%):     $0                        │
│                    ─────────────────                       │
│                    Total:    $10,125                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Notes] [Activity] [Attachments]                           │
│                                                             │
│ Notes:                                                      │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Customer wants cedar, no treated wood. Gate must match. ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Edit Mode**: Line items rows are editable, [+ Add] button visible
**View Mode**: Line items read-only, action buttons change to [Accept] [Create Jobs]

**JobCard** (unified create/view)
```
┌─────────────────────────────────────────────────────────────┐
│ Job #J-2024-0087 - Fence Install   [Scheduled] [Edit]      │
├─────────────────────────────────────────────────────────────┤
│ Scheduled: Jan 15, 2026  |  Crew: Alpha  |  Est: $8,625    │
│                                                             │
│ WORK ITEMS (from quote)                                     │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 6ft Cedar Privacy Fence    150 LF × $45    $6,750       ││
│ │ Post Holes                 25 ea × $35     $875         ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ VISITS                                          [+ Visit]  │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Visit 1 - Jan 15  Initial Install  [Completed] 8hrs    ││
│ │ Visit 2 - Jan 16  Finish & Cleanup [Scheduled]         ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Budget: $8,000  |  Actual: $7,200  |  Variance: +$800     │
└─────────────────────────────────────────────────────────────┘
```

**InvoiceCard** (unified create/view)
```
┌─────────────────────────────────────────────────────────────┐
│ Invoice #INV-2024-0123           [Sent]  [Record Payment]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ LINE ITEMS                                                  │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Fence Installation (Job #J-087)              $8,625     ││
│ │ Auto Gate Installation (Job #J-088)          $2,500     ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│                    Subtotal: $11,125                       │
│                    Tax (0%):     $0                        │
│                    ─────────────────                       │
│                    Total:    $11,125                       │
│                                                             │
│ PAYMENTS                                                    │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Jan 20, 2026   Check #4521         $5,000              ││
│ │ Balance Due:                       $6,125              ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### QuoteToJobsModal (PRESERVE EXISTING)

When user clicks "Create Jobs" on an accepted quote, the existing QuoteToJobsModal opens:

```
┌─────────────────────────────────────────────────────────────┐
│ Convert to Jobs                                        [X] │
│ Q-2024-0042 • $10,125                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ LINE ITEMS                    │  JOBS (2)         [+ Add] │
│ ┌───────────────────────────┐ │  ┌─────────────────────┐  │
│ │ [✓] Cedar Fence   $6,750  │ │  │ Job 1: Fence       │  │
│ │ [✓] Post Holes      $875  │ │  │ Items: 2           │  │
│ │ [ ] Auto Gate    $2,500   │ │  │ Value: $7,625      │  │
│ └───────────────────────────┘ │  │ Crew: Alpha        │  │
│                               │  │ Date: Jan 15       │  │
│ [Add to Job 1] [Add to Job 2] │  └─────────────────────┘  │
│                               │  ┌─────────────────────┐  │
│                               │  │ Job 2: Auto Gate   │  │
│                               │  │ ⚠ After Job 1      │  │
│                               │  │ Items: 1           │  │
│                               │  │ Value: $2,500      │  │
│                               │  └─────────────────────┘  │
│                                                             │
│ [✓] Invoice all jobs together                              │
├─────────────────────────────────────────────────────────────┤
│ All items assigned                    [Cancel] [Create 2]  │
└─────────────────────────────────────────────────────────────┘
```

This modal is preserved as-is from `src/features/fsm/components/QuoteToJobsModal.tsx`

---

## Implementation Phases

### Phase 3A: Database Foundation (Migrations 202-207)
- [ ] 202: Project enhancements
- [ ] 203: Quote enhancements
- [ ] 204: Job enhancements
- [ ] 205: Job visits table
- [ ] 206: Auto-create triggers
- [ ] 207: Project views

### Phase 3B: TypeScript Types
- [ ] Add Project enhancements to types.ts
- [ ] Add QuoteAcceptanceStatus
- [ ] Add Job phase/budget fields
- [ ] Add JobVisit interface

### Phase 3C: Hooks
- [ ] useProject(id) - fetch project with relations
- [ ] useProjects(filters) - list projects
- [ ] useCreateProject - create new project
- [ ] useUpdateProject - update project
- [ ] useProjectQuotes(projectId) - quotes for project
- [ ] useProjectJobs(projectId) - jobs for project
- [ ] useProjectInvoices(projectId) - invoices for project
- [ ] useAcceptQuote - mark quote accepted
- [ ] useJobVisits(jobId) - visits for job
- [ ] useCreateJobVisit - add visit

### Phase 3D: ProjectPage Container
- [ ] ProjectPage.tsx - main container with tabs
- [ ] ProjectHeader - uses EntityHeader
- [ ] Tab routing (/projects/:id/overview, /estimates, /work, /billing)
- [ ] ProjectCreateWizard - Client → Property → BU flow

### Phase 3E: Tab Components
- [ ] OverviewTab - summary, timeline
- [ ] EstimatesTab - quotes list + editor
- [ ] WorkTab - jobs list + phases + visits
- [ ] BillingTab - invoices + payments
- [ ] ActivityTab - history

### Phase 3F: Quote Editor (within Project)
- [ ] QuoteEditor component (refactor from QuoteBuilderPage)
- [ ] Line items editor
- [ ] Totals display
- [ ] Accept/Decline actions

### Phase 3G: Job Editor (within Project)
- [ ] JobEditor component
- [ ] Phase management
- [ ] Visit scheduling
- [ ] Budget vs actual display

### Phase 3H: Navigation Updates
- [ ] Add /projects route
- [ ] Update sidebar navigation
- [ ] Redirect /quotes/:id → /projects/:projectId/estimates
- [ ] Redirect /jobs/:id → /projects/:projectId/work

---

## Backward Compatibility

During transition:
1. Quotes/Jobs without project_id continue to work (legacy view)
2. Auto-create triggers add project_id going forward
3. Migration script assigns project_id to orphan entities
4. Eventually deprecate direct /quotes, /jobs routes
