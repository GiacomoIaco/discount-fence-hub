# Strategic Plan: FSM Capabilities + QBO/IES Integration

## Executive Summary

This plan covers two major initiatives for Discount Fence Hub:

1. **QBO/IES Integration** - Complete QuickBooks Online integration for invoicing, customer sync, and payment tracking
2. **FSM Capabilities** - Build Field Service Management features (Request → Quote → Job → Invoice workflow)

**Current State Assessment:**
- Client/Community/Property hierarchy: **COMPLETE**
- SKU Catalog + BOM Calculator: **COMPLETE**
- Rate Sheets/Pricebook: **COMPLETE**
- Yard Management: **COMPLETE**
- QBO OAuth + Classes sync: **COMPLETE**
- Requests system: **PARTIAL** (needs Quote/Job workflow)

**Gap Analysis:**
```
Existing                          Missing (FSM Core)
────────────────────────────────  ────────────────────────────────
✓ Client (bill-to)                ✗ Quote entity
✓ Community (subdivision)         ✗ Job/Work Order entity
✓ Property (job site)             ✗ Project grouping
✓ SKU Catalog                     ✗ Invoice entity
✓ BOM Calculator                  ✗ Pick List workflow
✓ Rate Sheets                     ✗ Crew management
✓ Requests (intake)               ✗ Scheduling calendar
✓ QBO Classes                     ✗ Territory assignment
✓ Geography/Rates                 ✗ Route optimization
```

---

## Part 1: QBO/IES Integration

### Current State
- OAuth 2.0 flow: **Working** (`qbo-auth.ts`, `qbo-callback.ts`)
- Token management: **Working** (`qbo_tokens` table)
- Classes sync: **Working** (`qbo-sync-classes.ts`, `qbo_classes` table)
- Client default class: **Working** (`clients.default_qbo_class_id`)
- Community override class: **Working** (`communities.override_qbo_class_id`)

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Discount Fence Hub                     │
│            (React + Supabase + Netlify)                 │
└────────────┬──────────────────────────────┬─────────────┘
             │                              │
             │ User Actions                 │ Scheduled Jobs
             ▼                              ▼
┌────────────────────────┐      ┌──────────────────────────┐
│  Netlify Functions     │      │   Scheduled Functions    │
│  (Event Handlers)      │      │                          │
├────────────────────────┤      ├──────────────────────────┤
│ - qbo-sync-customer    │      │ - Nightly CDC sync       │
│ - qbo-create-invoice   │      │ - Weekly classes sync    │
│ - qbo-receive-payment  │      │ - Daily token refresh    │
│ - qbo-webhook          │      │                          │
└────────────┬───────────┘      └───────────┬──────────────┘
             │                              │
             │         QuickBooks API       │
             ▼                              ▼
┌─────────────────────────────────────────────────────────┐
│              QuickBooks Online API                       │
├─────────────────────────────────────────────────────────┤
│  Entities: Customer, Invoice, Payment, Class, Item      │
│  Features: Webhooks, CDC, Batch Operations              │
└─────────────────────────────────────────────────────────┘
```

### QBO Integration Phases

#### Phase Q1: Foundation Enhancement (1 week)
**New Migration: `migrations/XXX_qbo_integration_foundation.sql`**

```sql
-- Entity mapping table (bidirectional sync tracking)
CREATE TABLE qbo_entity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_table VARCHAR(50) NOT NULL,  -- 'clients', 'invoices', etc.
  local_id UUID NOT NULL,
  qbo_entity_type VARCHAR(50) NOT NULL,  -- 'Customer', 'Invoice', etc.
  qbo_id VARCHAR(50) NOT NULL,
  qbo_sync_token VARCHAR(50),
  last_synced_at TIMESTAMPTZ,
  sync_direction VARCHAR(20),
  sync_status VARCHAR(20) DEFAULT 'synced',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(local_table, local_id),
  UNIQUE(qbo_entity_type, qbo_id)
);

-- QBO Items (products/services mapping)
CREATE TABLE qbo_items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  fully_qualified_name VARCHAR(500),
  type VARCHAR(50),  -- 'Service', 'NonInventory'
  income_account_ref VARCHAR(50),
  unit_price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  is_selectable BOOLEAN DEFAULT true,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook event log
CREATE TABLE qbo_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(100),
  realm_id VARCHAR(50),
  entity_name VARCHAR(50),
  operation VARCHAR(20),
  entity_id VARCHAR(50),
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  raw_payload JSONB
);

-- Add sync tracking to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS qbo_synced_at TIMESTAMPTZ;
```

**Deliverables:**
- [ ] Migration for new tables
- [ ] `qbo-sync-items.ts` function (similar to classes sync)
- [ ] QBO Items management in Settings
- [ ] useQboItems hook

#### Phase Q2: Customer Sync (1 week)
**Trigger:** When `clients.status` changes to 'active' or 'onboarding'

**New Function: `netlify/functions/qbo-sync-customer.ts`**
```typescript
// Creates or updates QBO Customer from local client record
// Maps: name, email, phone, billing address
// Stores qbo_id in clients.quickbooks_id
// Tracks in qbo_entity_mappings
```

**Deliverables:**
- [ ] `qbo-sync-customer.ts` function
- [ ] Automatic trigger on client status change
- [ ] Manual "Sync to QBO" button in ClientDetailModal
- [ ] Sync status indicator in client list

#### Phase Q3: Invoice Foundation (2 weeks)
**New Migration: `migrations/XXX_invoices.sql`**

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE,

  -- Client/Community linking
  client_id UUID REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),

  -- Job linking (added in FSM phase)
  job_id UUID,

  -- Invoice details
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,

  -- Amounts
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) GENERATED ALWAYS AS (total - amount_paid) STORED,

  -- Status
  status VARCHAR(20) DEFAULT 'draft',  -- draft, sent, partial, paid, overdue, void
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- QBO sync
  quickbooks_id VARCHAR(50),
  qbo_doc_number VARCHAR(50),
  qbo_synced_at TIMESTAMPTZ,
  qbo_class_id VARCHAR(50),

  -- PO tracking
  po_number VARCHAR(100),

  -- Metadata
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,

  -- Line details
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit VARCHAR(20),
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

  -- QBO mapping
  qbo_item_id VARCHAR(50),
  qbo_class_id VARCHAR(50),

  -- Internal tracking
  sku_id UUID,
  job_id UUID,

  line_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,

  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50),  -- check, credit_card, ach, cash
  reference_number VARCHAR(100),

  -- QBO sync
  quickbooks_payment_id VARCHAR(50),
  qbo_synced_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);
```

**Deliverables:**
- [ ] Invoice tables migration
- [ ] Invoice feature folder (`src/features/invoices/`)
- [ ] InvoicesList, InvoiceDetail, InvoiceEditor components
- [ ] useInvoices hooks
- [ ] Invoice PDF generation

#### Phase Q4: QBO Invoice Sync (1 week)
**New Function: `netlify/functions/qbo-create-invoice.ts`**

**Deliverables:**
- [ ] `qbo-create-invoice.ts` function
- [ ] Invoice line items mapping to QBO items
- [ ] Class assignment from client/community
- [ ] "Push to QBO" button in invoice detail
- [ ] Auto-sync option on invoice send

#### Phase Q5: Webhooks + CDC (1 week)
**New Function: `netlify/functions/qbo-webhook.ts`**

**Deliverables:**
- [ ] Webhook endpoint with HMAC verification
- [ ] Event queueing and async processing
- [ ] Handle Customer, Invoice, Payment events
- [ ] CDC scheduled function for reconciliation
- [ ] Sync dashboard in Settings

---

## Part 2: FSM Capabilities

### Industry Best Practices Summary

From researching Jobber, ServiceTitan, Workiz, and Housecall Pro:

**Core Workflow:**
```
Request → Quote → Job → Invoice → Payment
  │         │       │       │
  │         │       │       └── Auto-generate or manual
  │         │       └── Scheduling, crews, materials
  │         └── Line items, approval workflow
  └── Customer intake, initial assessment
```

**Key Features:**
1. **Project Grouping** - Multiple jobs under one project (e.g., multi-phase fence install)
2. **Quote Approval** - Digital signature, auto-convert to job
3. **Job Assignment** - Territory + skill-based crew matching
4. **Scheduling** - Calendar view, drag-drop, route optimization
5. **Materials** - BOM generation, pick list, yard integration
6. **Mobile App** - Field worker access, status updates, photos

### Proposed Data Model

```
┌─────────────────┐
│    Projects     │  (Groups multiple jobs, optional)
│─────────────────│
│ id              │
│ client_id       │
│ community_id    │
│ property_id     │
│ name            │
│ status          │
│ total_value     │
└────────┬────────┘
         │ 1:many
         ▼
┌─────────────────┐      ┌─────────────────┐
│     Quotes      │      │      Jobs       │
│─────────────────│      │─────────────────│
│ id              │      │ id              │
│ project_id      │      │ quote_id        │
│ request_id      │◄────►│ project_id      │
│ client_id       │      │ client_id       │
│ community_id    │      │ community_id    │
│ property_id     │      │ property_id     │
│ status          │      │ status          │
│ total           │      │ scheduled_date  │
│ approved_at     │      │ assigned_crew   │
│ signature       │      │ completed_at    │
└────────┬────────┘      └────────┬────────┘
         │ 1:many                 │ 1:many
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│  Quote Items    │      │  Job Materials  │
│─────────────────│      │─────────────────│
│ sku_id          │      │ sku_id          │
│ quantity        │      │ quantity_planned│
│ unit_price      │      │ quantity_used   │
│ labor_hours     │      │ pulled_from_yard│
└─────────────────┘      └─────────────────┘
```

### FSM Implementation Phases

#### Phase F1: Quote Entity (2 weeks)
**New Migration: `migrations/XXX_quotes.sql`**

```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number VARCHAR(50) UNIQUE,

  -- Entity linking
  request_id UUID REFERENCES requests(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),

  -- Quote details
  title VARCHAR(255),
  description TEXT,

  -- Pricing (computed from items)
  material_total DECIMAL(10,2) DEFAULT 0,
  labor_total DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,

  -- Rate sheet used
  rate_sheet_id UUID,

  -- Status workflow
  status VARCHAR(30) DEFAULT 'draft',
    -- draft, sent, viewed, approved, declined, expired, converted

  -- Approval tracking
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by VARCHAR(255),  -- Customer name
  signature_url TEXT,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Validity
  valid_until DATE,

  -- Metadata
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

  -- Product info
  sku_id UUID,
  description TEXT NOT NULL,

  -- Quantities
  quantity DECIMAL(10,3) DEFAULT 1,
  unit VARCHAR(20),

  -- Pricing
  unit_cost DECIMAL(10,2),
  unit_price DECIMAL(10,2) NOT NULL,
  markup_percent DECIMAL(5,2),
  line_total DECIMAL(10,2),

  -- Labor
  labor_hours DECIMAL(6,2) DEFAULT 0,
  labor_rate DECIMAL(8,2),
  labor_total DECIMAL(10,2),

  -- BOM linkage
  bom_calculation_id UUID,  -- Link to saved BOM

  -- Display
  line_order INTEGER DEFAULT 0,
  is_optional BOOLEAN DEFAULT false,
  category VARCHAR(100),  -- 'Fence', 'Gate', 'Removal', etc.

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link quote items to specific materials (from BOM)
CREATE TABLE quote_item_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_item_id UUID REFERENCES quote_items(id) ON DELETE CASCADE,
  material_sku_id UUID,
  material_name VARCHAR(255),
  quantity DECIMAL(10,3),
  unit VARCHAR(20),
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2)
);
```

**Deliverables:**
- [ ] Quotes migration
- [ ] Quote feature folder (`src/features/quotes/`)
- [ ] QuotesList, QuoteDetail, QuoteEditor components
- [ ] BOM integration - populate quote from calculator
- [ ] Quote PDF generation
- [ ] Customer portal for quote viewing/approval
- [ ] Digital signature capture

#### Phase F2: Job/Work Order Entity (2 weeks)
**New Migration: `migrations/XXX_jobs.sql`**

```sql
-- Crews/Teams table
CREATE TABLE crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,

  -- Capability
  specialties TEXT[],  -- ['wood', 'chain_link', 'commercial']
  max_daily_jobs INTEGER DEFAULT 2,

  -- Territory
  primary_geography_id UUID REFERENCES geographies(id),
  service_radius_miles INTEGER DEFAULT 50,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID REFERENCES crews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  role VARCHAR(50),  -- 'lead', 'installer', 'helper'
  is_crew_lead BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs/Work Orders
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number VARCHAR(50) UNIQUE,

  -- Linking
  quote_id UUID REFERENCES quotes(id),
  project_id UUID,
  client_id UUID NOT NULL REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),

  -- Job details
  title VARCHAR(255),
  description TEXT,
  job_type VARCHAR(50),  -- 'new_install', 'repair', 'removal', 'warranty'
  priority VARCHAR(20) DEFAULT 'normal',  -- low, normal, high, urgent

  -- Pricing (copied from quote)
  material_total DECIMAL(10,2),
  labor_total DECIMAL(10,2),
  total DECIMAL(10,2),

  -- Schedule
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  estimated_duration_hours DECIMAL(4,1),

  -- Assignment
  assigned_crew_id UUID REFERENCES crews(id),
  assigned_by UUID,
  assigned_at TIMESTAMPTZ,

  -- Status workflow
  status VARCHAR(30) DEFAULT 'unscheduled',
    -- unscheduled, scheduled, dispatched, in_progress,
    -- on_hold, completed, cancelled

  -- Timestamps
  dispatched_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,

  -- Completion
  completion_notes TEXT,
  customer_signature_url TEXT,
  customer_signed_at TIMESTAMPTZ,

  -- Invoicing
  invoice_id UUID,
  invoiced_at TIMESTAMPTZ,

  -- Site access
  gate_code VARCHAR(50),
  access_notes TEXT,

  -- Metadata
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Job status history (audit trail)
CREATE TABLE job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Job materials (BOM for the job)
CREATE TABLE job_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,

  sku_id UUID,
  material_name VARCHAR(255) NOT NULL,

  -- Quantities
  quantity_planned DECIMAL(10,3) NOT NULL,
  quantity_pulled DECIMAL(10,3) DEFAULT 0,
  quantity_used DECIMAL(10,3),
  quantity_returned DECIMAL(10,3) DEFAULT 0,

  unit VARCHAR(20),
  unit_cost DECIMAL(10,2),

  -- Yard integration
  pulled_from_yard BOOLEAN DEFAULT false,
  pull_request_id UUID,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job labor (actual time tracking)
CREATE TABLE job_labor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),

  work_date DATE NOT NULL,
  hours_worked DECIMAL(4,2) NOT NULL,
  labor_type VARCHAR(50),  -- 'install', 'travel', 'break', etc.
  hourly_rate DECIMAL(8,2),
  total DECIMAL(10,2),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job photos
CREATE TABLE job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  photo_type VARCHAR(30),  -- 'before', 'during', 'after', 'issue'
  caption TEXT,
  taken_at TIMESTAMPTZ,
  taken_by UUID,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_jobs_client ON jobs(client_id);
CREATE INDEX idx_jobs_community ON jobs(community_id);
CREATE INDEX idx_jobs_property ON jobs(property_id);
CREATE INDEX idx_jobs_crew ON jobs(assigned_crew_id);
CREATE INDEX idx_jobs_date ON jobs(scheduled_date);
CREATE INDEX idx_jobs_status ON jobs(status);
```

**Deliverables:**
- [ ] Jobs/Crews migration
- [ ] Jobs feature folder (`src/features/jobs/`)
- [ ] JobsList, JobDetail, JobEditor components
- [ ] Crew management in Settings
- [ ] Job status workflow UI
- [ ] Convert Quote → Job functionality

#### Phase F3: Project Grouping (1 week)
**New Migration: `migrations/XXX_projects.sql`**

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number VARCHAR(50) UNIQUE,

  -- Linking
  client_id UUID NOT NULL REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),

  -- Details
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Aggregated values (computed)
  total_quote_value DECIMAL(12,2) DEFAULT 0,
  total_invoiced DECIMAL(12,2) DEFAULT 0,
  total_paid DECIMAL(12,2) DEFAULT 0,

  -- Status
  status VARCHAR(30) DEFAULT 'planning',
    -- planning, in_progress, on_hold, completed, cancelled

  -- Dates
  start_date DATE,
  target_completion DATE,
  actual_completion DATE,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Add project reference to existing tables
ALTER TABLE quotes ADD COLUMN project_id UUID REFERENCES projects(id);
ALTER TABLE jobs ADD COLUMN project_id UUID REFERENCES projects(id);
ALTER TABLE invoices ADD COLUMN project_id UUID REFERENCES projects(id);
```

**Deliverables:**
- [ ] Projects migration
- [ ] ProjectsList, ProjectDetail components
- [ ] Project dashboard with quotes/jobs/invoices
- [ ] Project P&L view

#### Phase F4: Scheduling & Calendar (2 weeks)
**Components:**

```typescript
// SchedulingHub - Main calendar view
// - Day/Week/Month views
// - Crew lanes
// - Drag-drop job assignment
// - Filter by territory/crew/job type

// JobCard - Draggable job component
// - Status color coding
// - Quick actions (dispatch, complete)
// - Crew assignment dropdown

// CrewSchedule - Per-crew daily view
// - Jobs in timeline format
// - Travel time estimates
// - Capacity indicators
```

**Deliverables:**
- [ ] Scheduling feature folder (`src/features/scheduling/`)
- [ ] Calendar component (react-big-calendar or custom)
- [ ] Crew lane view
- [ ] Drag-drop job assignment
- [ ] Schedule conflict detection
- [ ] Daily dispatch view

#### Phase F5: Pick List & Yard Integration (1 week)
**Workflow:**
```
Job Created → BOM Generated → Pick List Created → Yard Pulls Materials
     │              │                │                    │
     │              │                │                    ▼
     │              │                │            Material Loaded
     │              │                │                    │
     │              │                │                    ▼
     │              │                │            Job Dispatched
     │              │                │                    │
     │              │                ▼                    ▼
     │              │         Pull Request ──────► Yard Dashboard
     │              ▼                                     │
     │        job_materials table                         │
     │              │                                     │
     ▼              ▼                                     ▼
Job Completed → Reconcile Used vs. Pulled → Return Unused
```

**Deliverables:**
- [ ] Pick list generation from job_materials
- [ ] Yard pull request workflow
- [ ] Material checkout/return tracking
- [ ] Yard dashboard integration

#### Phase F6: Invoice from Job (1 week)
**Auto-Invoice Trigger Options:**
1. Manual - "Create Invoice" button on completed job
2. Semi-auto - Prompt on job completion
3. Auto - Generate invoice on job completion

**Deliverables:**
- [ ] "Create Invoice" action in job detail
- [ ] Pull job materials/labor into invoice lines
- [ ] Apply client's rate sheet pricing
- [ ] Link invoice to job
- [ ] Invoice → QBO sync

---

## Part 3: AI/Optimization Features (Future)

### Smart Scheduling
- Route optimization using Google Maps API
- Crew skill matching
- Territory-based assignment
- Load balancing across crews

### Predictive Analytics
- Job duration estimation based on history
- Material usage prediction
- Seasonal demand forecasting
- Crew performance scoring

### Automation Rules
- Auto-assign jobs by territory + skill
- Auto-generate invoices on completion
- Auto-send reminders for scheduled jobs
- Auto-escalate overdue jobs

---

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- [ ] Q1: QBO foundation tables
- [ ] Q2: Customer sync function
- [ ] F1 start: Quote tables

### Phase 2: Core Entities (Weeks 3-6)
- [ ] F1 complete: Quotes feature
- [ ] Q3: Invoice tables
- [ ] F2: Jobs/Crews feature

### Phase 3: Integration (Weeks 7-9)
- [ ] Q4: QBO invoice sync
- [ ] Q5: Webhooks + CDC
- [ ] F3: Projects feature

### Phase 4: Operations (Weeks 10-12)
- [ ] F4: Scheduling calendar
- [ ] F5: Pick list + Yard integration
- [ ] F6: Job → Invoice workflow

### Phase 5: Polish (Weeks 13-14)
- [ ] Mobile optimization
- [ ] Reporting dashboards
- [ ] User training materials
- [ ] Bug fixes and optimization

---

## Priority Recommendation

**Immediate Priority (Start First):**
1. **F1: Quotes** - Sales needs this now for customer proposals
2. **Q3: Invoices** - Foundation for billing workflow
3. **Q4: QBO Invoice Sync** - Get paid faster

**Second Wave:**
4. **F2: Jobs/Crews** - Operational tracking
5. **F4: Scheduling** - Visual job management
6. **F5: Pick Lists** - Yard integration

**Third Wave:**
7. **F3: Projects** - Multi-job grouping
8. **Q5: Webhooks** - Real-time sync
9. **AI Features** - Optimization

---

## Technical Considerations

### Database Patterns
- Use GENERATED columns for computed fields (balance, line_total)
- Add appropriate indexes for common queries
- Implement RLS policies for all new tables
- Use triggers for audit trails (status_history)

### UI Patterns
- Follow existing Hub pattern (QuotesHub, JobsHub)
- Use existing modal patterns for editors
- Implement optimistic updates with TanStack Query
- Add bulk actions for list views

### Integration Points
- BOM Calculator → Quote Items
- Rate Sheets → Quote Pricing
- Properties → Job Site Info
- Yard → Pick Lists
- QBO Classes → Invoice Line Items

### Mobile Considerations
- Job detail must work on mobile for field crews
- Photo capture needs mobile optimization
- Offline capability for status updates (future)

---

## Success Metrics

### QBO Integration
- Customer sync accuracy: 100%
- Invoice sync time: < 5 seconds
- Payment reconciliation: same-day

### FSM Operations
- Quote creation time: < 10 minutes
- Quote → Job conversion: 1 click
- Job → Invoice time: < 2 minutes
- Schedule visibility: 100% jobs visible

### Business Impact
- Reduce billing cycle by 50%
- Eliminate double-entry (QBO)
- Improve crew utilization by 20%
- Reduce material waste by 15%
