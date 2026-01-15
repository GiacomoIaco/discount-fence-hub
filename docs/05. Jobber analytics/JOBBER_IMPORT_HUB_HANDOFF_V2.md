# Jobber Import Hub - Complete Handoff Document v2

**Created:** January 14, 2026  
**Author:** Giacomo (Technical Lead)  
**Location in App:** Analytics Hub → "Jobber Data" Tab  
**Scope:** Builder Division (Phase 1)

---

## 📊 Executive Summary

| Data Source | Records | Total Value | Key Metric |
|-------------|---------|-------------|------------|
| **Jobs** | 8,305 | $18,257,376 | 14.9 day avg cycle |
| **Quotes** | 3,956 | $19,433,457 | 89.3% conversion rate |
| **Invoices** | 8,391 | $18,740,530 | 0.6 day avg to invoice |

### Full Pipeline Timing (Quote → Job → Invoice)
| Stage | Average | Median |
|-------|---------|--------|
| Quote Draft → Convert | 2.8 days | 0 days |
| Job Create → Schedule | 8.1 days | 5 days |
| Schedule → Close | 7.5 days | 5 days |
| **Total Pipeline** | **18.3 days** | **13 days** |
| Job Close → Invoice | 0.6 days | 0 days |

---

## 🚨 Critical Implementation: Name Normalization

### The Problem
38% of jobs have empty "Salesperson" field but DO have "Builder Rep" populated. Additionally, the same person appears with different name formats:
- "YAMIL" vs "Yamil" vs "Yamil Hernandez"
- "SEAN HOOD" vs "Sean Hood"

### The Solution: Effective Salesperson Logic + Name Mapping

```typescript
// Step 1: Name Normalization Map
const NAME_NORMALIZATION: Record<string, string> = {
  // Yamil variations
  'YAMIL': 'Yamil Hernandez',
  'Yamil': 'Yamil Hernandez',
  
  // Case variations (all caps → proper case)
  'EDWARD SAMARIPA': 'Edward Samaripa',
  'DANNY STORY': 'Danny Story',
  'HECTOR SANDOVAL': 'Hector Sandoval',
  'JASON CASTRO': 'Jason Castro',
  'SEAN HOOD': 'Sean Hood',
  'BRIAN OJEDA': 'Brian Ojeda',
  'JORGE MORALES': 'Jorge Morales',
  'JASON COLEMAN': 'Jason Coleman',
  'ANDREW LUCIO': 'Andrew Lucio',
  'HENRY': 'Henry',
  'PATRICK': 'Patrick',
};

// Step 2: Effective Salesperson Resolution
function getEffectiveSalesperson(row: JobberRow): string {
  // Priority 1: Salesperson field
  let name = (row['Salesperson'] || '').trim();
  
  // Priority 2: Builder Rep field
  if (!name) {
    name = (row['Builder Rep'] || row['BUILDER REP'] || '').trim();
  }
  
  // Priority 3: Visits Assigned To (first person)
  if (!name || name === '[Add Builder Rep]') {
    const visits = (row['Visits assigned to'] || '').trim();
    if (visits) {
      name = visits.split(',')[0].split(' and ')[0].trim();
    }
  }
  
  // Apply normalization
  if (!name) return '(Unassigned)';
  return NAME_NORMALIZATION[name] || name;
}
```

### Corrected Salesperson Leaderboard (After Normalization)

| Rank | Salesperson | Revenue | Jobs | Billable | Warranty | Avg Value |
|------|-------------|---------|------|----------|----------|-----------|
| 1 | **Yamil Hernandez** | $4,620,851 | 1,783 | 1,360 | 343 | $3,398 |
| 2 | Danny Story | $2,794,127 | 876 | 654 | 156 | $4,272 |
| 3 | Sean Hood | $1,998,278 | 834 | 721 | 72 | $2,772 |
| 4 | Jason Castro | $1,573,910 | 791 | 495 | 194 | $3,180 |
| 5 | Michael Hidalgo | $1,571,711 | 314 | 245 | 55 | $6,415 |
| 6 | Edward Samaripa | $1,422,782 | 1,120 | 691 | 354 | $2,059 |
| 7 | Hector Sandoval | $1,194,813 | 746 | 613 | 102 | $1,949 |
| 8 | Brian Ojeda | $878,443 | 616 | 453 | 143 | $1,939 |
| 9 | German Alarcon | $588,704 | 288 | 244 | 39 | $2,413 |
| 10 | Adam Sells | $526,251 | 259 | 196 | 59 | $2,685 |

---

## 🗄️ Database Schema

### Table 1: `jobber_import_logs`
```sql
CREATE TABLE jobber_import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit TEXT NOT NULL CHECK (business_unit IN ('builder', 'residential')),
    report_type TEXT NOT NULL CHECK (report_type IN ('jobs', 'quotes', 'invoices')),
    file_name TEXT NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    
    total_rows INTEGER NOT NULL DEFAULT 0,
    new_records INTEGER NOT NULL DEFAULT 0,
    updated_records INTEGER NOT NULL DEFAULT 0,
    skipped_records INTEGER NOT NULL DEFAULT 0,
    errors JSONB DEFAULT '[]',
    
    data_start_date DATE,
    data_end_date DATE,
    
    status TEXT NOT NULL DEFAULT 'processing' 
        CHECK (status IN ('processing', 'completed', 'failed')),
    error_message TEXT
);

CREATE INDEX idx_import_logs_bu_date ON jobber_import_logs(business_unit, uploaded_at DESC);
```

### Table 2: `jobber_name_normalization`
```sql
CREATE TABLE jobber_name_normalization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_name TEXT NOT NULL UNIQUE,
    canonical_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data
INSERT INTO jobber_name_normalization (original_name, canonical_name) VALUES
('YAMIL', 'Yamil Hernandez'),
('Yamil', 'Yamil Hernandez'),
('EDWARD SAMARIPA', 'Edward Samaripa'),
('DANNY STORY', 'Danny Story'),
('HECTOR SANDOVAL', 'Hector Sandoval'),
('JASON CASTRO', 'Jason Castro'),
('SEAN HOOD', 'Sean Hood'),
('BRIAN OJEDA', 'Brian Ojeda'),
('JORGE MORALES', 'Jorge Morales'),
('JASON COLEMAN', 'Jason Coleman'),
('ANDREW LUCIO', 'Andrew Lucio'),
('HENRY', 'Henry'),
('PATRICK', 'Patrick');

CREATE INDEX idx_name_norm_original ON jobber_name_normalization(original_name);
```

### Table 3: `jobber_builder_jobs`
```sql
CREATE TABLE jobber_builder_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifiers (Job # is unique key for UPSERT)
    job_number INTEGER NOT NULL UNIQUE,
    quote_number INTEGER,
    invoice_numbers TEXT,
    
    -- Client & Location
    client_name TEXT,
    client_email TEXT,
    client_phone TEXT,
    billing_street TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zip TEXT,
    service_street TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,
    
    -- Job details
    title TEXT,
    line_items TEXT,
    project_type TEXT,
    standard_product TEXT,
    standard_product_2 TEXT,
    
    -- People (raw from Jobber)
    salesperson_raw TEXT,
    builder_rep_raw TEXT,
    visits_assigned_to TEXT,
    
    -- Normalized/Computed
    effective_salesperson TEXT,  -- Computed during import
    
    -- Builder-specific
    community TEXT,
    super_name TEXT,
    super_email TEXT,
    po_number TEXT,
    pricing_tier TEXT,
    franchise_location TEXT,
    
    -- Dates
    created_date DATE,
    scheduled_start_date DATE,
    closed_date DATE,
    
    -- Financials
    total_revenue DECIMAL(12,2) DEFAULT 0,
    total_costs DECIMAL(12,2) DEFAULT 0,
    profit DECIMAL(12,2) DEFAULT 0,
    profit_percent DECIMAL(5,2) DEFAULT 0,
    quote_discount DECIMAL(12,2) DEFAULT 0,
    po_budget DECIMAL(12,2) DEFAULT 0,
    procurement_material_estimate DECIMAL(12,2) DEFAULT 0,
    procurement_labor_estimate DECIMAL(12,2) DEFAULT 0,
    
    -- Crew
    crew_1 TEXT,
    crew_1_pay DECIMAL(10,2) DEFAULT 0,
    crew_2 TEXT,
    crew_2_pay DECIMAL(10,2) DEFAULT 0,
    crew_3 TEXT,
    crew_3_pay DECIMAL(10,2) DEFAULT 0,
    
    -- Rock fees
    job_contains_rock_fee TEXT,
    rock_fee_required TEXT,
    pay_crew_rock_fee TEXT,
    
    -- Other
    overage_ft DECIMAL(10,2) DEFAULT 0,
    gps_coordinates TEXT,
    details_811 TEXT,
    on_qbo TEXT,
    
    -- Computed fields
    is_warranty BOOLEAN GENERATED ALWAYS AS (
        project_type ILIKE '%warranty%' OR total_revenue = 0
    ) STORED,
    is_substantial BOOLEAN GENERATED ALWAYS AS (
        total_revenue > 300
    ) STORED,
    days_to_schedule INTEGER GENERATED ALWAYS AS (
        CASE WHEN scheduled_start_date IS NOT NULL AND created_date IS NOT NULL 
             THEN scheduled_start_date - created_date ELSE NULL END
    ) STORED,
    days_to_close INTEGER GENERATED ALWAYS AS (
        CASE WHEN closed_date IS NOT NULL AND scheduled_start_date IS NOT NULL 
             THEN closed_date - scheduled_start_date ELSE NULL END
    ) STORED,
    total_cycle_days INTEGER GENERATED ALWAYS AS (
        CASE WHEN closed_date IS NOT NULL AND created_date IS NOT NULL 
             THEN closed_date - created_date ELSE NULL END
    ) STORED,
    
    -- Import tracking
    first_imported_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    import_log_id UUID REFERENCES jobber_import_logs(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_jobs_effective_sp ON jobber_builder_jobs(effective_salesperson);
CREATE INDEX idx_jobs_created_date ON jobber_builder_jobs(created_date DESC);
CREATE INDEX idx_jobs_closed_date ON jobber_builder_jobs(closed_date DESC);
CREATE INDEX idx_jobs_project_type ON jobber_builder_jobs(project_type);
CREATE INDEX idx_jobs_client ON jobber_builder_jobs(client_name);
CREATE INDEX idx_jobs_community ON jobber_builder_jobs(community);
CREATE INDEX idx_jobs_franchise ON jobber_builder_jobs(franchise_location);
CREATE INDEX idx_jobs_substantial ON jobber_builder_jobs(is_substantial) WHERE is_substantial = true;
```

### Table 4: `jobber_builder_quotes`
```sql
CREATE TABLE jobber_builder_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifiers
    quote_number INTEGER NOT NULL UNIQUE,
    job_numbers TEXT,  -- Can be multiple, comma-separated
    
    -- Client
    client_name TEXT,
    client_email TEXT,
    client_phone TEXT,
    service_street TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,
    
    -- Quote details
    title TEXT,
    status TEXT,  -- Draft, Sent, Awaiting response, Approved, Converted, Archived
    line_items TEXT,
    
    -- People
    salesperson_raw TEXT,
    builder_rep_raw TEXT,
    effective_salesperson TEXT,
    sent_by_user TEXT,
    
    -- Financials
    subtotal DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,
    required_deposit DECIMAL(12,2) DEFAULT 0,
    collected_deposit DECIMAL(12,2) DEFAULT 0,
    
    -- Builder-specific
    community TEXT,
    super_name TEXT,
    super_email TEXT,
    po_number TEXT,
    po_budget DECIMAL(12,2) DEFAULT 0,
    pricing_tier TEXT,
    franchise_location TEXT,
    project_type TEXT,
    standard_product TEXT,
    
    -- Dates
    drafted_date DATE,
    sent_date DATE,
    changes_requested_date DATE,
    approved_date DATE,
    converted_date DATE,
    archived_date DATE,
    
    -- Computed
    is_converted BOOLEAN GENERATED ALWAYS AS (status = 'Converted') STORED,
    days_to_convert INTEGER GENERATED ALWAYS AS (
        CASE WHEN converted_date IS NOT NULL AND drafted_date IS NOT NULL 
             THEN converted_date - drafted_date ELSE NULL END
    ) STORED,
    
    -- Import tracking
    first_imported_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    import_log_id UUID REFERENCES jobber_import_logs(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotes_status ON jobber_builder_quotes(status);
CREATE INDEX idx_quotes_effective_sp ON jobber_builder_quotes(effective_salesperson);
CREATE INDEX idx_quotes_drafted ON jobber_builder_quotes(drafted_date DESC);
CREATE INDEX idx_quotes_client ON jobber_builder_quotes(client_name);
```

### Table 5: `jobber_builder_invoices`
```sql
CREATE TABLE jobber_builder_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifiers
    invoice_number INTEGER NOT NULL UNIQUE,
    job_numbers TEXT,
    
    -- Client
    client_name TEXT,
    client_email TEXT,
    client_phone TEXT,
    billing_street TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zip TEXT,
    service_street TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,
    
    -- Invoice details
    subject TEXT,
    status TEXT,  -- Draft, Awaiting Payment, Paid, Past Due, Bad Debt
    line_items TEXT,
    
    -- People
    salesperson_raw TEXT,
    builder_rep_raw TEXT,
    effective_salesperson TEXT,
    visits_assigned_to TEXT,
    
    -- Financials
    pre_tax_total DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    tip DECIMAL(12,2) DEFAULT 0,
    balance DECIMAL(12,2) DEFAULT 0,
    tax_percent DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    deposit DECIMAL(12,2) DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,
    
    -- Builder-specific
    community TEXT,
    super_name TEXT,
    super_email TEXT,
    po_number TEXT,
    po_budget DECIMAL(12,2) DEFAULT 0,
    pricing_tier TEXT,
    franchise_location TEXT,
    project_type TEXT,
    standard_product TEXT,
    
    -- Crew
    crew_1 TEXT,
    crew_1_pay DECIMAL(10,2) DEFAULT 0,
    crew_2 TEXT,
    crew_2_pay DECIMAL(10,2) DEFAULT 0,
    crew_3 TEXT,
    crew_3_pay DECIMAL(10,2) DEFAULT 0,
    
    -- Dates
    created_date DATE,
    issued_date DATE,
    due_date DATE,
    marked_paid_date DATE,
    last_contacted DATE,
    
    -- Timing
    late_by_days INTEGER,
    days_to_paid INTEGER,
    
    -- Computed
    is_paid BOOLEAN GENERATED ALWAYS AS (
        status = 'Paid' OR marked_paid_date IS NOT NULL
    ) STORED,
    is_overdue BOOLEAN GENERATED ALWAYS AS (
        balance > 0 AND status = 'Past Due'
    ) STORED,
    
    -- Import tracking
    first_imported_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    import_log_id UUID REFERENCES jobber_import_logs(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_status ON jobber_builder_invoices(status);
CREATE INDEX idx_invoices_effective_sp ON jobber_builder_invoices(effective_salesperson);
CREATE INDEX idx_invoices_created ON jobber_builder_invoices(created_date DESC);
CREATE INDEX idx_invoices_client ON jobber_builder_invoices(client_name);
CREATE INDEX idx_invoices_balance ON jobber_builder_invoices(balance) WHERE balance > 0;
```

---

## 🔄 CSV Column Mappings

### Jobs Column Map
```typescript
export const JOBS_COLUMN_MAP: Record<string, string> = {
  'Job #': 'job_number',
  'Client name': 'client_name',
  'Client email': 'client_email',
  'Client phone': 'client_phone',
  'Billing street': 'billing_street',
  'Billing city': 'billing_city',
  'Billing province': 'billing_state',
  'Billing ZIP': 'billing_zip',
  'Service street': 'service_street',
  'Service city': 'service_city',
  'Service province': 'service_state',
  'Service ZIP': 'service_zip',
  'Title': 'title',
  'Created date': 'created_date',
  'Scheduled start date': 'scheduled_start_date',
  'Closed date': 'closed_date',
  'Salesperson': 'salesperson_raw',
  'Builder Rep': 'builder_rep_raw',
  'BUILDER REP': 'builder_rep_raw',  // Alternate column name
  'Visits assigned to': 'visits_assigned_to',
  'Line items': 'line_items',
  'Invoice #s': 'invoice_numbers',
  'Quote #': 'quote_number',
  'Total revenue ($)': 'total_revenue',
  'Total costs ($)': 'total_costs',
  'Profit ($)': 'profit',
  'Profit %': 'profit_percent',
  'Quote discount ($)': 'quote_discount',
  'Community': 'community',
  'COMMUNITY': 'community',
  'Super name': 'super_name',
  'Super email': 'super_email',
  'PO number': 'po_number',
  'PO budget ($)': 'po_budget',
  'Procurement Material Estimate ($)': 'procurement_material_estimate',
  'Procurement Labor Estimate ($)': 'procurement_labor_estimate',
  'Pricing Tier': 'pricing_tier',
  'FRANCHISE LOCATION': 'franchise_location',
  'Project Type': 'project_type',
  'STANDARD PRODUCT': 'standard_product',
  'STANDARD PRODUCT - 2': 'standard_product_2',
  'Crew 1': 'crew_1',
  'Crew 1 Job Pay': 'crew_1_pay',
  'Crew 2': 'crew_2',
  'Crew 2 Job Pay': 'crew_2_pay',
  'Crew 3': 'crew_3',
  'Crew 3 Job Pay': 'crew_3_pay',
  'Overage': 'overage_ft',
  '811 - GPS Coordinates': 'gps_coordinates',
  '811 DETAILS': 'details_811',
  'Job Contains Rock Fee': 'job_contains_rock_fee',
  'Rock fee required?': 'rock_fee_required',
  'On QBO?': 'on_qbo',
  'Pay crew rock fee for this job?': 'pay_crew_rock_fee',
};
```

### Quotes Column Map
```typescript
export const QUOTES_COLUMN_MAP: Record<string, string> = {
  'Quote #': 'quote_number',
  'Client name': 'client_name',
  'Client email': 'client_email',
  'Client phone': 'client_phone',
  'Service street': 'service_street',
  'Service city': 'service_city',
  'Service province': 'service_state',
  'Service ZIP': 'service_zip',
  'Title': 'title',
  'Status': 'status',
  'Line items': 'line_items',
  'Salesperson': 'salesperson_raw',
  'Builder Rep': 'builder_rep_raw',
  'BUILDER REP': 'builder_rep_raw',
  'Sent by user': 'sent_by_user',
  'Job #s': 'job_numbers',
  'Subtotal ($)': 'subtotal',
  'Total ($)': 'total',
  'Discount ($)': 'discount',
  'Required deposit ($)': 'required_deposit',
  'Collected deposit ($)': 'collected_deposit',
  'Community': 'community',
  'COMMUNITY': 'community',
  'Super name': 'super_name',
  'Super email': 'super_email',
  'PO number': 'po_number',
  'PO budget ($)': 'po_budget',
  'Pricing Tier': 'pricing_tier',
  'FRANCHISE LOCATION': 'franchise_location',
  'Project Type': 'project_type',
  'STANDARD PRODUCT': 'standard_product',
  'Drafted date': 'drafted_date',
  'Sent date': 'sent_date',
  'Changes requested date': 'changes_requested_date',
  'Approved date': 'approved_date',
  'Converted date': 'converted_date',
  'Archived date': 'archived_date',
};
```

### Invoices Column Map
```typescript
export const INVOICES_COLUMN_MAP: Record<string, string> = {
  'Invoice #': 'invoice_number',
  'Client name': 'client_name',
  'Client email': 'client_email',
  'Client phone': 'client_phone',
  'Billing street': 'billing_street',
  'Billing city': 'billing_city',
  'Billing province': 'billing_state',
  'Billing ZIP': 'billing_zip',
  'Service street': 'service_street',
  'Service city': 'service_city',
  'Service province': 'service_state',
  'Service ZIP': 'service_zip',
  'Subject': 'subject',
  'Status': 'status',
  'Line items': 'line_items',
  'Salesperson': 'salesperson_raw',
  'Builder Rep': 'builder_rep_raw',
  'BUILDER REP': 'builder_rep_raw',
  'Visits assigned to': 'visits_assigned_to',
  'Job #s': 'job_numbers',
  'Pre-tax total ($)': 'pre_tax_total',
  'Total ($)': 'total',
  'Tip ($)': 'tip',
  'Balance ($)': 'balance',
  'Tax (%)': 'tax_percent',
  'Tax amount ($)': 'tax_amount',
  'Deposit $': 'deposit',
  'Discount ($)': 'discount',
  'Community': 'community',
  'COMMUNITY': 'community',
  'Super name': 'super_name',
  'Super email': 'super_email',
  'PO number': 'po_number',
  'PO budget ($)': 'po_budget',
  'Pricing Tier': 'pricing_tier',
  'FRANCHISE LOCATION': 'franchise_location',
  'Project Type': 'project_type',
  'STANDARD PRODUCT': 'standard_product',
  'Crew 1': 'crew_1',
  'Crew 1 Job Pay': 'crew_1_pay',
  'Crew 2': 'crew_2',
  'Crew 2 Job Pay': 'crew_2_pay',
  'Crew 3': 'crew_3',
  'Crew 3 Job Pay': 'crew_3_pay',
  'Created date': 'created_date',
  'Issued date': 'issued_date',
  'Due date': 'due_date',
  'Marked paid date': 'marked_paid_date',
  'Last contacted': 'last_contacted',
  'Late by': 'late_by_days',
  'Days to paid': 'days_to_paid',
};
```

---

## 🎨 UI Specification

### Navigation Structure
```
Analytics Hub (existing)
├── Overview
├── Requests  
├── Team Performance
├── Sales Coach
├── Photo Gallery
├── App Usage
└── Jobber Data ← NEW TAB
    ├── [Builder Division] ← Active
    └── [Residential Division] ← Grayed "Coming Soon"
```

### Jobber Data Tab Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Jobber Data                                                                │
│  ┌──────────────────┐ ┌─────────────────────┐                              │
│  │ Builder Division │ │ Residential (Soon)  │                              │
│  └──────────────────┘ └─────────────────────┘                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  UPLOAD SECTION                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Report Type: [Jobs ▼] [Quotes] [Invoices]                           │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  📁 Drop Jobber CSV here or click to upload                 │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  Last Import: Jobs - Jan 14, 2026 (8,305 records) [View History]   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  FILTERS                                                                    │
│  [Date Range ▼] [Salesperson ▼] [Location ▼] [☐ Include Warranties]        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DASHBOARD TABS                                                             │
│  ┌──────────┐ ┌────────────┐ ┌─────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ Overview │ │ Salespeople│ │ Clients │ │ Pipeline │ │ Cycle Time      │  │
│  └──────────┘ └────────────┘ └─────────┘ └──────────┘ └─────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Dashboard Sections (All 14)

### Section 1: Executive Summary Cards
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total Revenue│ │ Billable Jobs│ │ Avg Job Value│ │ Avg Cycle    │
│   $18.26M    │ │    6,092     │ │    $2,997    │ │   15 days    │
│ All jobs     │ │ Jobs > $300  │ │ Rev/Billable │ │ Create→Close │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Open Pipeline│ │ Quote Conv % │ │ Speed to Inv │ │ QBO Synced   │
│    $505K     │ │    89.3%     │ │   0.6 days   │ │     64%      │
│ 191 jobs     │ │ Converted    │ │ Close→Invoice│ │ Mat + Labor  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Section 2: Monthly Revenue Trend
- Combo chart: Bars (revenue) + Line (job count)
- X-axis: Months (last 12)
- Ability to split by location or salesperson
- Click month → filter all data to that month

### Section 3: Salesperson Leaderboard
| Rank | Salesperson | Revenue | Jobs>$300 | All Jobs | Warranty | Avg Value | Cycle |
|------|-------------|---------|-----------|----------|----------|-----------|-------|
| 1 | Yamil Hernandez | $4.62M | 1,360 | 1,783 | 343 | $3,398 | - |
| 2 | Danny Story | $2.79M | 654 | 876 | 156 | $4,272 | 21d |
| 3 | Sean Hood | $2.00M | 721 | 834 | 72 | $2,772 | - |

**Click row → Drill into salesperson detail**

### Section 4: Salesperson Detail View
When a salesperson row is clicked:
- Monthly revenue chart for that person
- Top 10 clients by revenue
- Top 10 communities by revenue
- Cycle time trend over months
- Warranty ratio trend
- Recent jobs table

### Section 5: Location Analysis
| Location | Revenue | Jobs | % of Total | Avg Value | Cycle |
|----------|---------|------|------------|-----------|-------|
| Austin | $12.82M | 4,864 | 70.2% | $2,636 | 14.2d |
| San Antonio | $4.30M | 2,878 | 23.6% | $1,495 | 15.8d |
| Houston | $1.13M | 557 | 6.2% | $2,031 | 16.1d |

**Note: Houston started mid-2025**

### Section 6: Project Type Breakdown
| Type | Revenue | Jobs | % | Warranty Rate |
|------|---------|------|---|---------------|
| Fence + | $15.22M | 4,573 | 83.4% | 18% |
| Deck ONLY | $1.57M | 470 | 8.6% | 12% |
| Railing ONLY | $0.95M | 873 | 5.2% | 15% |
| Services/Repairs | $0.33M | 683 | 1.8% | 5% |
| Warranty | $8.7K | 1,461 | 0.0% | 100% |

### Section 7: Client (Builder) Analysis
Top 20 builders with:
- Revenue, Job count, Quote count, Invoice count
- Avg job value, Avg cycle time
- Primary salesperson
- Warranty rate
- Communities served

**Click row → Drill into builder detail**

### Section 8: Community Analysis
Top 20 communities with:
- Revenue, Job count
- Primary builder(s)
- Primary salesperson(s)
- Avg job value

### Section 9: Quote Pipeline
| Status | Count | Value | % |
|--------|-------|-------|---|
| Draft | 115 | $5.23M | 27% |
| Awaiting Response | 298 | $3.98M | 20% |
| Approved | 9 | $40K | 0.2% |
| Converted | 3,534 | $10.18M | 52% |

**Conversion Rate: 89.3%**
**Avg Days to Convert: 2.8 days (median: 0)**

### Section 10: Cycle Time Analysis
| Stage | Average | Median | Target |
|-------|---------|--------|--------|
| Quote Draft → Convert | 2.8 days | 0 days | ≤3 days |
| Job Create → Schedule | 8.1 days | 5 days | ≤7 days |
| Schedule → Close | 7.5 days | 5 days | ≤7 days |
| **Total Pipeline** | **18.3 days** | **13 days** | **≤14 days** |
| Job Close → Invoice | 0.6 days | 0 days | ≤1 day |

**Distribution Chart:**
- 0-7 days: 31% ███████████████
- 8-14 days: 40% ████████████████████
- 15-30 days: 21% ██████████
- 31-60 days: 6% ███
- 61+ days: 2% █

### Section 11: Day of Week Patterns
Two charts:
1. Jobs Created by Day of Week (bar chart)
2. Jobs Scheduled by Day of Week (bar chart)

Insight: Most jobs created Mon-Thu, scheduling more spread across week

### Section 12: Crew Performance
Top 10 crews by job count:
| Crew | Jobs | Avg Pay | Total Pay |
|------|------|---------|-----------|
| DAVID - David Vazquez Albor | 594 | $470 | $279K |
| CHIKITO - Javier Policarpo | 513 | $465 | $238K |
| ... | ... | ... | ... |

**Total Crew Pay: $2,781,590**
**Avg Pay per Job: $470**

### Section 13: Open Pipeline Tracker
Jobs with closed_date = NULL:
- Total: 191 jobs, $505K
- By salesperson breakdown
- By location breakdown
- Age buckets (0-7d, 8-14d, 15-30d, 31+d)

### Section 14: QBO Sync Status
| Status | Jobs | Revenue |
|--------|------|---------|
| Material + Crew Pay | 3,263 | $11.57M |
| Not Started | 3,954 | $5.74M |
| Unable to Complete | 367 | $405K |
| Only Material | 334 | $316K |
| Only Crew Pay | 381 | $228K |

---

## 📁 Component Structure

```
src/features/analytics/
├── components/
│   ├── AnalyticsHub.tsx (existing - add Jobber tab)
│   │
│   └── jobber/
│       ├── JobberDataTab.tsx              # Main container
│       ├── JobberUploadModal.tsx          # Upload flow
│       ├── JobberImportResults.tsx        # Post-import summary
│       ├── JobberFilters.tsx              # Filter bar
│       │
│       ├── dashboard/
│       │   ├── ExecutiveSummaryCards.tsx
│       │   ├── MonthlyTrendChart.tsx
│       │   ├── SalespersonLeaderboard.tsx
│       │   ├── SalespersonDetail.tsx
│       │   ├── LocationAnalysis.tsx
│       │   ├── ProjectTypeBreakdown.tsx
│       │   ├── ClientAnalysis.tsx
│       │   ├── ClientDetail.tsx
│       │   ├── CommunityAnalysis.tsx
│       │   ├── QuotePipeline.tsx
│       │   ├── CycleTimeAnalysis.tsx
│       │   ├── DayOfWeekPatterns.tsx
│       │   ├── CrewPerformance.tsx
│       │   ├── OpenPipelineTracker.tsx
│       │   └── QBOSyncStatus.tsx
│       │
│       └── shared/
│           ├── MetricCard.tsx
│           ├── DataTable.tsx
│           ├── TrendChart.tsx
│           └── DistributionChart.tsx
│
├── hooks/
│   └── jobber/
│       ├── useJobberImport.ts
│       ├── useJobberJobs.ts
│       ├── useJobberQuotes.ts
│       ├── useJobberInvoices.ts
│       ├── useSalespersonMetrics.ts
│       ├── useClientMetrics.ts
│       └── useCycleTimeMetrics.ts
│
├── services/
│   └── jobber/
│       ├── importService.ts
│       ├── columnMapper.ts
│       ├── nameNormalizer.ts
│       ├── analyticsService.ts
│       └── exportService.ts
│
└── types/
    └── jobber.ts
```

---

## ✅ Implementation Checklist

### Phase 1: Database & Core (Days 1-2)
- [ ] Run all table migrations in Supabase
- [ ] Seed name normalization table
- [ ] Create PostgreSQL aggregation functions
- [ ] Test queries with sample data

### Phase 2: Import System (Days 2-3)
- [ ] Create column mappers for all 3 file types
- [ ] Create name normalizer with DB lookup
- [ ] Implement UPSERT logic with deduplication
- [ ] Build upload UI with drag-drop
- [ ] Build import results modal
- [ ] Test with actual Jobber exports

### Phase 3: Dashboard - Overview (Days 3-4)
- [ ] Add Jobber Data tab to Analytics Hub
- [ ] Build ExecutiveSummaryCards
- [ ] Build MonthlyTrendChart
- [ ] Build filter bar (date, salesperson, location)
- [ ] Implement filter state management

### Phase 4: Dashboard - Salespeople (Days 4-5)
- [ ] Build SalespersonLeaderboard (sortable table)
- [ ] Build SalespersonDetail (drill-down)
- [ ] Add click-to-drill functionality

### Phase 5: Dashboard - Clients & Communities (Days 5-6)
- [ ] Build ClientAnalysis
- [ ] Build ClientDetail (drill-down)
- [ ] Build CommunityAnalysis

### Phase 6: Dashboard - Pipeline & Quotes (Days 6-7)
- [ ] Build QuotePipeline
- [ ] Build OpenPipelineTracker

### Phase 7: Dashboard - Cycle Time (Days 7-8)
- [ ] Build CycleTimeAnalysis
- [ ] Build distribution charts
- [ ] Build DayOfWeekPatterns

### Phase 8: Dashboard - Operations (Days 8-9)
- [ ] Build LocationAnalysis
- [ ] Build ProjectTypeBreakdown
- [ ] Build CrewPerformance
- [ ] Build QBOSyncStatus

### Phase 9: Polish & Testing (Days 9-10)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Import history modal
- [ ] Export to Excel functionality

---

## 🎯 Success Criteria

- [ ] Can upload all 3 Jobber CSV types (Jobs, Quotes, Invoices)
- [ ] No duplicate records after multiple uploads
- [ ] Name normalization working correctly
- [ ] All 14 dashboard sections functional
- [ ] Filters apply across all views
- [ ] Drill-down navigation working
- [ ] Page loads in <3 seconds
- [ ] Mobile responsive
- [ ] Revenue matches Jobber exactly ($18,257,376)

---

## 📝 Notes for Claude Code

1. **Start with database schema** - Get tables right first
2. **Name normalization is critical** - Test thoroughly
3. **Effective salesperson logic** must be applied during import
4. **Use the provided column maps** exactly - Jobber exports are finicky
5. **Generated columns** handle computed fields automatically
6. **UPSERT on unique keys** - job_number, quote_number, invoice_number
7. **PostgreSQL functions** for aggregation (more efficient than client-side)
8. **Test with actual CSV files** provided in conversation

---

**Document Complete - Ready for Claude Code Implementation**
