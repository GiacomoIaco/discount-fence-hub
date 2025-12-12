# FSM + QBO Integration Master Plan
## Discount Fence USA - Consolidated Implementation Blueprint

**Version:** 1.0
**Created:** December 2024
**Status:** Planning Complete - Ready for Implementation

---

## Executive Summary

This document merges multiple planning sources into a single implementation blueprint:
- FSM Planning folder (Claude Chat) - TypeScript types, workflows, library recommendations
- FSM-QBO-INTEGRATION-PLAN.md - QBO integration strategy, database schemas
- BUILD-VS-REUSE-ANALYSIS.md - Library decisions and cost analysis
- Jobber Workflow Analysis - Action-driven status model
- Existing codebase capabilities - Labor/Materials admin already built

### Your Competitive Advantage

**Jobber's workflow:**
```
Quote Won → Job Scheduled → Work In Progress → Complete → Invoice
                                    ↑
                           (No material prep visibility)
```

**Your workflow:**
```
Quote Won → Job Scheduled → Ready for Yard → Picking → Staged → Loaded → Install → Complete → Invoice
                                    ↑
                    (Full BOM/BOL material preparation pipeline!)
```

This material preparation visibility is a HUGE differentiator for fence installation.

---

## What's Already Built

### Existing Capabilities (Do NOT Rebuild)

| Capability | Status | Location |
|------------|--------|----------|
| Labor Rates Matrix | ✅ Complete | `src/features/bom_calculator/pages/LaborRatesPage.tsx` |
| Materials Catalog | ✅ Complete | `src/features/bom_calculator/pages/MaterialsPage.tsx` |
| Price History | ✅ Complete | `src/features/bom_calculator/components/PriceHistoryModal.tsx` |
| CSV Import/Export | ✅ Complete | Both pages have bulk import |
| BOM Calculator | ✅ Complete | `src/features/bom_calculator/` |
| Client Hub | ✅ Complete | `src/features/client_hub/` |
| Yard Management | ✅ Complete | `src/features/yard/` |
| SKU Catalog | ✅ Complete | SKUCatalogPage, SKUBuilderPage |
| Business Units | ✅ Complete | Used across system |
| Rate Sheets | ✅ Complete | Client-specific pricing |

### Existing Database Tables

```sql
-- Already have:
- clients, communities, properties (O-028 in progress)
- business_units
- materials, labor_codes, labor_rates
- sku_catalog, sku_labor_costs
- bom_projects, bom_sections, bom_line_items
- price_history (for materials and labor)
```

---

## Stage Architecture: Jobber-Inspired with Material Pipeline

### The 5-Stage Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DISCOUNT FENCE FSM PIPELINE                            │
├────────────┬────────────┬────────────┬────────────┬────────────┬───────────────┤
│  REQUEST   │   QUOTE    │    JOB     │   YARD     │  INSTALL   │   BILLING     │
│ (Intake)   │ (Pricing)  │ (Planning) │ (Prep)     │  (Work)    │  (Invoice)    │
├────────────┼────────────┼────────────┼────────────┼────────────┼───────────────┤
│ • pending  │ • draft    │ • won      │ • ready    │ • loaded   │ • invoiced    │
│ • assess-  │ • sent     │ • sched-   │ • picking  │ • in_prog  │ • past_due    │
│   ment     │ • changes  │   uled     │ • staged   │ • complete │ • paid        │
│ • assessed │ • approved │            │            │            │ • bad_debt    │
│ • archived │ • lost     │            │            │            │               │
└────────────┴────────────┴────────────┴────────────┴────────────┴───────────────┘
```

### Status Definitions (Jobber-Style Action-Driven)

#### Stage 1: REQUEST
| Status | Trigger | Auto-Transitions |
|--------|---------|------------------|
| `pending` | Request created | → `assessment_scheduled` when date set |
| `assessment_scheduled` | Assessment date booked | → `assessment_today` on date |
| `assessment_today` | System (date match) | → `assessment_overdue` if not marked complete |
| `assessment_completed` | Rep marks complete | → `converted` when quote created |
| `converted` | Quote created from request | Terminal |
| `archived` | User archives | Terminal |

#### Stage 2: QUOTE
| Status | Trigger | Auto-Transitions |
|--------|---------|------------------|
| `draft` | Quote created | None |
| `sent` | Quote emailed/shared | → `follow_up` after 3 days |
| `follow_up` | System (time-based) | None |
| `changes_requested` | Client requests changes | → `sent` when resent |
| `approved` | Client approves | → `converted` when job created |
| `converted` | Job created | Terminal |
| `lost` | User marks lost | Terminal |

#### Stage 3: JOB (Pre-Yard)
| Status | Trigger | Auto-Transitions |
|--------|---------|------------------|
| `won` | Job created from quote | None |
| `scheduled` | Install date set + crew assigned | → `ready_for_yard` 2 days before |

#### Stage 4: YARD (Material Prep) - YOUR DIFFERENTIATOR
| Status | Trigger | Auto-Transitions |
|--------|---------|------------------|
| `ready_for_yard` | System (2 days before install) | None |
| `picking` | Yard starts pulling | None |
| `staged` | Materials fully picked | None |

#### Stage 5: INSTALL (Field Work)
| Status | Trigger | Auto-Transitions |
|--------|---------|------------------|
| `loaded` | Truck loaded | None |
| `in_progress` | Crew starts work | None |
| `completed` | Crew marks complete | → `requires_invoicing` |

#### Stage 6: BILLING
| Status | Trigger | Auto-Transitions |
|--------|---------|------------------|
| `requires_invoicing` | Job completed | None |
| `invoiced` | Invoice generated | → `past_due` after terms |
| `past_due` | System (due date passed) | None |
| `paid` | Payment recorded | Terminal |
| `bad_debt` | Write-off | Terminal |

---

## Database Schema

### New Tables Required

```sql
-- Migration 142: Core FSM Tables

-- 1. Sales Reps (for assignment)
CREATE TABLE sales_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),

  -- Profile
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),

  -- Assignment criteria
  territories UUID[] DEFAULT '{}',  -- References to territories
  product_skills TEXT[] DEFAULT '{}',  -- e.g., ['Wood Vertical', 'Iron', 'Chain Link']

  -- Capacity
  max_daily_assessments INT DEFAULT 4,

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Territories
CREATE TABLE territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,

  -- Geographic bounds (for map display)
  zip_codes TEXT[] DEFAULT '{}',

  -- Assignment
  business_unit_id UUID REFERENCES business_units(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crews
CREATE TABLE crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,

  -- Capacity
  crew_size INT DEFAULT 2,
  max_daily_lf INT DEFAULT 200,  -- Linear feet capacity

  -- Skills
  product_skills TEXT[] DEFAULT '{}',  -- e.g., ['Wood Vertical', 'Iron']

  -- Assignment
  business_unit_id UUID REFERENCES business_units(id),
  home_territory_id UUID REFERENCES territories(id),

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Service Requests
CREATE TABLE service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(50) UNIQUE NOT NULL,  -- Auto-generated: REQ-2024-0001

  -- Customer
  client_id UUID REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),

  -- Contact (if not existing client)
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address_line1 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2) DEFAULT 'TX',
  zip VARCHAR(20),

  -- Request details
  source VARCHAR(50) DEFAULT 'phone',  -- phone, web, referral, walk-in
  product_type VARCHAR(100),  -- Wood Vertical, Iron, etc.
  description TEXT,
  notes TEXT,

  -- Assessment
  requires_assessment BOOLEAN DEFAULT true,
  assessment_scheduled_at TIMESTAMPTZ,
  assessment_completed_at TIMESTAMPTZ,
  assessment_rep_id UUID REFERENCES sales_reps(id),
  assessment_notes TEXT,

  -- Status (action-driven)
  status VARCHAR(50) DEFAULT 'pending',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Assignment
  assigned_rep_id UUID REFERENCES sales_reps(id),
  territory_id UUID REFERENCES territories(id),

  -- Conversion
  converted_to_quote_id UUID,  -- Set when converted

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 5. Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number VARCHAR(50) UNIQUE NOT NULL,  -- Auto: QUO-2024-0001

  -- Source
  request_id UUID REFERENCES service_requests(id),
  bom_project_id UUID REFERENCES bom_projects(id),  -- Links to BOM Calculator

  -- Customer
  client_id UUID NOT NULL REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),
  billing_address JSONB,  -- Snapshot at quote time
  job_address JSONB,      -- Snapshot at quote time

  -- Pricing
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0.0825,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Margin tracking
  total_material_cost DECIMAL(12,2) DEFAULT 0,
  total_labor_cost DECIMAL(12,2) DEFAULT 0,
  margin_percent DECIMAL(5,2),

  -- Terms
  valid_until DATE,
  payment_terms VARCHAR(100) DEFAULT 'Net 30',
  deposit_required DECIMAL(12,2) DEFAULT 0,
  deposit_percent DECIMAL(5,2) DEFAULT 0,

  -- Approval (for high-value or low-margin)
  requires_approval BOOLEAN DEFAULT false,
  approval_status VARCHAR(50),  -- pending, approved, rejected
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'draft',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Communication
  sent_at TIMESTAMPTZ,
  sent_method VARCHAR(50),  -- email, client_hub, print
  viewed_at TIMESTAMPTZ,    -- Client opened it

  -- Client response
  client_approved_at TIMESTAMPTZ,
  client_signature TEXT,    -- Base64 or URL
  lost_reason TEXT,

  -- Conversion
  converted_to_job_id UUID,  -- Set when converted

  -- Assignment
  created_by UUID REFERENCES auth.users(id),
  sales_rep_id UUID REFERENCES sales_reps(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Quote Line Items (from BOM)
CREATE TABLE quote_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

  -- Item details
  line_type VARCHAR(50) NOT NULL,  -- material, labor, service, adjustment
  description TEXT NOT NULL,

  -- Quantity
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_type VARCHAR(50),  -- LF, SF, EA, etc.

  -- Pricing
  unit_price DECIMAL(12,2) NOT NULL,
  unit_cost DECIMAL(12,2),  -- For margin calc
  total_price DECIMAL(12,2) NOT NULL,

  -- Source reference
  material_id UUID REFERENCES materials(id),
  labor_code_id UUID REFERENCES labor_codes(id),
  bom_line_item_id UUID REFERENCES bom_line_items(id),

  -- Display
  sort_order INT DEFAULT 0,
  is_visible_to_client BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number VARCHAR(50) UNIQUE NOT NULL,  -- Auto: JOB-2024-0001

  -- Source
  quote_id UUID REFERENCES quotes(id),

  -- Customer (denormalized for performance)
  client_id UUID NOT NULL REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),
  job_address JSONB NOT NULL,

  -- Scope
  product_type VARCHAR(100),
  linear_feet DECIMAL(10,2),
  description TEXT,
  special_instructions TEXT,

  -- Pricing (from quote)
  quoted_total DECIMAL(12,2),

  -- Schedule
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  estimated_duration_hours DECIMAL(4,1),

  -- Assignment
  assigned_crew_id UUID REFERENCES crews(id),
  assigned_rep_id UUID REFERENCES sales_reps(id),  -- Who sold it

  -- Status (action-driven)
  status VARCHAR(50) DEFAULT 'won',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Yard workflow
  ready_for_yard_at TIMESTAMPTZ,
  picking_started_at TIMESTAMPTZ,
  staging_completed_at TIMESTAMPTZ,

  -- Field workflow
  loaded_at TIMESTAMPTZ,
  work_started_at TIMESTAMPTZ,
  work_completed_at TIMESTAMPTZ,
  completion_photos TEXT[],  -- URLs
  completion_signature TEXT,  -- Base64 or URL
  completion_notes TEXT,

  -- Invoice link
  invoice_id UUID,  -- Will reference invoices table

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 8. Job Visits (for multi-day jobs)
CREATE TABLE job_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  visit_number INT NOT NULL DEFAULT 1,
  visit_type VARCHAR(50) DEFAULT 'installation',  -- installation, followup, warranty

  -- Schedule
  scheduled_date DATE NOT NULL,
  scheduled_time_start TIME,
  scheduled_time_end TIME,

  -- Assignment
  assigned_crew_id UUID REFERENCES crews(id),

  -- Status
  status VARCHAR(50) DEFAULT 'scheduled',  -- scheduled, today, completed, cancelled

  -- Completion
  completed_at TIMESTAMPTZ,
  notes TEXT,
  photos TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,  -- Auto: INV-2024-0001

  -- Source
  job_id UUID REFERENCES jobs(id),
  quote_id UUID REFERENCES quotes(id),

  -- Customer
  client_id UUID NOT NULL REFERENCES clients(id),
  billing_address JSONB NOT NULL,

  -- Amounts
  subtotal DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,4) DEFAULT 0.0825,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,

  -- Payments
  amount_paid DECIMAL(12,2) DEFAULT 0,
  balance_due DECIMAL(12,2) NOT NULL,

  -- Terms
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  payment_terms VARCHAR(100) DEFAULT 'Net 30',

  -- Status
  status VARCHAR(50) DEFAULT 'draft',  -- draft, sent, past_due, paid, bad_debt
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Communication
  sent_at TIMESTAMPTZ,
  sent_method VARCHAR(50),

  -- QBO Integration
  qbo_invoice_id VARCHAR(50),
  qbo_sync_status VARCHAR(50),  -- pending, synced, error
  qbo_synced_at TIMESTAMPTZ,
  qbo_sync_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 10. Invoice Line Items
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,

  -- Source
  quote_line_item_id UUID REFERENCES quote_line_items(id),

  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),

  -- Amount
  amount DECIMAL(12,2) NOT NULL,

  -- Method
  payment_method VARCHAR(50) NOT NULL,  -- card, check, cash, ach, qbo_payment

  -- Details
  reference_number VARCHAR(100),  -- Check number, transaction ID
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,

  -- QBO
  qbo_payment_id VARCHAR(50),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_requests_status ON service_requests(status);
CREATE INDEX idx_requests_client ON service_requests(client_id);
CREATE INDEX idx_requests_assessment_date ON service_requests(assessment_scheduled_at);

CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_client ON quotes(client_id);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled_date ON jobs(scheduled_date);
CREATE INDEX idx_jobs_crew ON jobs(assigned_crew_id);

CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_qbo ON invoices(qbo_invoice_id);
```

### Auto-Number Generation Functions

```sql
-- Function to generate sequential numbers
CREATE OR REPLACE FUNCTION generate_fsm_number(prefix TEXT, seq_name TEXT)
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_num INT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO seq_num;
  RETURN prefix || '-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Sequences
CREATE SEQUENCE IF NOT EXISTS request_number_seq;
CREATE SEQUENCE IF NOT EXISTS quote_number_seq;
CREATE SEQUENCE IF NOT EXISTS job_number_seq;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

-- Triggers for auto-generation
CREATE OR REPLACE FUNCTION set_request_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := generate_fsm_number('REQ', 'request_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_request_number
  BEFORE INSERT ON service_requests
  FOR EACH ROW EXECUTE FUNCTION set_request_number();

-- Similar triggers for quotes, jobs, invoices...
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Core tables + Request intake

| Task | Description | Priority |
|------|-------------|----------|
| Migration 142 | Create all FSM tables | P0 |
| Territories CRUD | Basic territory management | P0 |
| Sales Reps CRUD | Basic rep management | P0 |
| Crews CRUD | Basic crew management | P0 |
| Request intake form | New request submission | P0 |
| Request list view | Filter by status, date, rep | P0 |

**Deliverables:**
- Can create territories, reps, crews
- Can submit and view service requests
- Assessment scheduling works

### Phase 2: Quoting (Week 3-4)
**Goal:** Quote creation from BOM + approval workflow

| Task | Description | Priority |
|------|-------------|----------|
| Quote from BOM | Convert BOM project to quote | P0 |
| Quote builder UI | Edit line items, pricing | P0 |
| Approval workflow | Flag high-value/low-margin | P1 |
| Quote PDF | Generate professional quote | P1 |
| Quote email | Send via email | P1 |

**Deliverables:**
- BOM Calculator → Quote flow
- Manager approval for quotes >$25K or <15% margin
- PDF quote generation

### Phase 3: Jobs + Scheduling (Week 5-6)
**Goal:** Job creation + calendar scheduling

| Task | Description | Priority |
|------|-------------|----------|
| Job from Quote | Convert approved quote to job | P0 |
| Schedule calendar | FullCalendar integration | P0 |
| Crew assignment | Manual + suggested | P0 |
| Multi-visit jobs | Support for large jobs | P1 |
| Conflict detection | Warn on double-booking | P1 |

**Libraries:**
- **FullCalendar** (not react-big-schedule) - better docs, resource timeline view
- **@dnd-kit** (already have) - for drag-drop scheduling

**Deliverables:**
- Calendar view with jobs
- Crew assignment with availability check
- Multi-day job support

### Phase 4: Yard Integration (Week 7-8)
**Goal:** Connect FSM to existing Yard workflow

| Task | Description | Priority |
|------|-------------|----------|
| Auto-trigger yard | Job scheduled → Ready for Yard | P0 |
| BOL generation | From quote line items | P0 |
| Pick list | From BOM | P0 |
| Status sync | Yard updates → Job status | P0 |

**Deliverables:**
- 2-day auto-trigger before install date
- BOL auto-generated from job
- Yard status flows back to job

### Phase 5: QBO Integration (Week 9-12)
**Goal:** Full invoice + payment sync

| Task | Description | Priority |
|------|-------------|----------|
| Invoice generation | From completed job | P0 |
| QBO customer sync | Create/match customers | P0 |
| QBO invoice push | Send invoice to QBO | P0 |
| QBO payment webhook | Receive payment updates | P1 |
| QBO class mapping | P&L by community | P1 |

**QBO API Endpoints:**
```
POST /v3/company/{realmId}/invoice
POST /v3/company/{realmId}/customer
GET /v3/company/{realmId}/query?query=SELECT * FROM Class
POST /v3/company/{realmId}/webhooks
```

**Deliverables:**
- Invoice created in DFU → pushed to QBO
- Payments in QBO → synced back
- P&L tracking by community via QBO Classes

### Phase 6: Mobile + Field (Week 13-16)
**Goal:** Crew mobile experience

| Task | Description | Priority |
|------|-------------|----------|
| Today's jobs | Mobile view for crews | P0 |
| Job completion | Mark complete + photos | P0 |
| Digital signature | Client sign-off | P1 |
| GPS check-in | Optional location capture | P2 |

**Deliverables:**
- Crews see their jobs on mobile
- Can mark complete with photos
- Client signature capture

---

## Library Decisions (Final)

Based on BUILD-VS-REUSE-ANALYSIS.md and Claude Chat recommendations:

| Need | Library | Reason |
|------|---------|--------|
| Calendar | **FullCalendar** | Better docs than react-big-schedule, resource timeline included |
| Drag & Drop | **@dnd-kit** | Already installed |
| Forms | **React Hook Form + Zod** | Already using zod |
| PDF | **jsPDF** | Already installed |
| Tables | **TanStack Table** | Already have TanStack Query |
| CSV | **Papa Parse** | Recommended by both plans |
| Date Handling | **date-fns** | Already installed |
| Toasts | **Sonner** | Already using |

**NOT adding:**
- shadcn/ui - Keep existing Tailwind patterns
- @react-pdf/renderer - jsPDF works fine
- Dedicated FSM platform - Building custom

---

## TypeScript Types (Summary)

Full types in `FSM_02_TYPES.ts` - key interfaces:

```typescript
// Status enums with transitions
type RequestStatus =
  | 'pending'
  | 'assessment_scheduled'
  | 'assessment_today'
  | 'assessment_overdue'
  | 'assessment_completed'
  | 'converted'
  | 'archived';

type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'follow_up'
  | 'changes_requested'
  | 'approved'
  | 'converted'
  | 'lost';

type JobStatus =
  | 'won'
  | 'scheduled'
  | 'ready_for_yard'
  | 'picking'
  | 'staged'
  | 'loaded'
  | 'in_progress'
  | 'completed'
  | 'requires_invoicing';

type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'past_due'
  | 'paid'
  | 'bad_debt';

// Status transitions map
const REQUEST_TRANSITIONS = {
  pending: ['assessment_scheduled', 'converted', 'archived'],
  assessment_scheduled: ['assessment_today', 'assessment_completed', 'archived'],
  // ... etc
};
```

---

## Approval Workflow Thresholds

From Jobber analysis + Claude Chat:

| Condition | Action |
|-----------|--------|
| Quote total > $25,000 | Requires manager approval |
| Quote margin < 15% | Requires manager approval |
| Quote discount > 10% | Requires manager approval |
| Job status change to `completed` | Triggers invoice reminder |
| Invoice past due > 30 days | Escalate to collections |

---

## Assignment Algorithm (From Claude Chat FSM_05)

```typescript
function scoreCrewForJob(crew: Crew, job: Job): number {
  let score = 0;

  // Territory match (highest weight)
  if (crew.home_territory_id === job.territory_id) {
    score += 40;
  }

  // Skill match
  if (crew.product_skills.includes(job.product_type)) {
    score += 30;
  }

  // Capacity
  const capacityUsed = getCrewCapacityUsed(crew, job.scheduled_date);
  const capacityRemaining = crew.max_daily_lf - capacityUsed;
  if (job.linear_feet <= capacityRemaining) {
    score += 20;
  }

  // Availability
  const hasConflict = hasScheduleConflict(crew, job.scheduled_date);
  if (!hasConflict) {
    score += 10;
  }

  return score;
}
```

---

## Funnel Reporting (Your Jobber Complaint Fixed)

**Problem:** Jobber counts quote conversion rate as `quotes_won / quotes_sent`, which is misleading when multiple quotes are sent for one opportunity.

**Solution:** Track at the **Request** level:

```sql
-- Opportunity Funnel View
CREATE VIEW opportunity_funnel AS
SELECT
  DATE_TRUNC('month', r.created_at) as month,
  COUNT(r.id) as requests,
  COUNT(q.id) as quotes_generated,
  COUNT(DISTINCT r.id) FILTER (WHERE q.status = 'converted') as opportunities_won,
  COUNT(DISTINCT r.id) FILTER (WHERE q.status = 'lost') as opportunities_lost,

  -- TRUE conversion rate
  ROUND(
    COUNT(DISTINCT r.id) FILTER (WHERE q.status = 'converted')::NUMERIC /
    NULLIF(COUNT(r.id), 0) * 100,
    1
  ) as true_conversion_rate

FROM service_requests r
LEFT JOIN quotes q ON q.request_id = r.id
GROUP BY DATE_TRUNC('month', r.created_at)
ORDER BY month DESC;
```

---

## File Structure

```
src/features/fsm/
├── types.ts                    # TypeScript types
├── constants.ts                # Status labels, colors, transitions
├── hooks/
│   ├── useRequests.ts
│   ├── useQuotes.ts
│   ├── useJobs.ts
│   ├── useInvoices.ts
│   ├── useCrews.ts
│   ├── useSalesReps.ts
│   └── useTerritories.ts
├── components/
│   ├── requests/
│   │   ├── RequestList.tsx
│   │   ├── RequestForm.tsx
│   │   └── RequestDetailModal.tsx
│   ├── quotes/
│   │   ├── QuoteList.tsx
│   │   ├── QuoteBuilder.tsx
│   │   ├── QuotePreview.tsx
│   │   └── QuotePDF.tsx
│   ├── jobs/
│   │   ├── JobList.tsx
│   │   ├── JobScheduler.tsx
│   │   ├── JobCalendar.tsx
│   │   └── JobDetailModal.tsx
│   ├── invoices/
│   │   ├── InvoiceList.tsx
│   │   ├── InvoiceDetail.tsx
│   │   └── InvoicePDF.tsx
│   └── shared/
│       ├── StatusBadge.tsx
│       ├── AssignmentSelector.tsx
│       └── Timeline.tsx
├── pages/
│   ├── FSMDashboard.tsx
│   ├── RequestsPage.tsx
│   ├── QuotesPage.tsx
│   ├── JobsPage.tsx
│   ├── InvoicesPage.tsx
│   └── SchedulePage.tsx
└── services/
    ├── statusTransitions.ts
    ├── assignmentScoring.ts
    └── qboSync.ts
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Quote turnaround | < 24 hours | Time from request to quote sent |
| True conversion rate | > 60% | Requests won / Total requests |
| Schedule utilization | > 80% | Crew hours scheduled / Available hours |
| Invoice cycle | < 48 hours | Job completion to invoice sent |
| Payment collection | < 30 days | Invoice sent to payment received |

---

## Next Steps

1. **Complete O-028** (Properties table) - foundation for job addresses
2. **Create Migration 142** - FSM core tables
3. **Build Request intake** - Start capturing leads properly
4. **Connect BOM → Quote** - Leverage existing calculator

This plan consolidates all sources into a single executable blueprint. The key insight is that your **material preparation pipeline** (Yard workflow) is the major differentiator from Jobber/ServiceTitan - lean into this advantage.
