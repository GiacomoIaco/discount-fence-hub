# FSM Implementation Master Document
## Discount Fence USA - BOM Calculator Hub
### Unified Field Service Management Blueprint

---

**Version:** 2.0  
**Created:** December 2024  
**Status:** Active Implementation Guide

**Primary Source:** BOM_CALCULATOR_HUB_FSM_MASTER_PLAN.md
**Incorporated From:** FSM-MASTER-PLAN.md, FSM_00_IMPLEMENTATION_GUIDE.md

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [UI_SPEC_CONTEXT_SIDEBAR.md](./UI_SPEC_CONTEXT_SIDEBAR.md) | Complete Context Sidebar specification (320px persistent panel) |
| [UI_SPEC_SMART_LOOKUP.md](./UI_SPEC_SMART_LOOKUP.md) | Smart Client/Property Lookup with Builder Cascade |
| [FSM_IMPLEMENTATION_MASTER_UI_ADDENDUM.md](./FSM_IMPLEMENTATION_MASTER_UI_ADDENDUM.md) | UI patterns and page layouts |
| [FSM_TESTING_AND_DEPLOYMENT.md](./FSM_TESTING_AND_DEPLOYMENT.md) | Testing scenarios, environment variables, week-by-week phases |
| [FSM_01_DATABASE_SCHEMA.sql](./FSM_01_DATABASE_SCHEMA.sql) | SQL schema for FSM tables (reference for migrations) |
| [FSM_02_TYPES.ts](./FSM_02_TYPES.ts) | TypeScript types template (reference for implementation) |

---

## Table of Contents

1. [Executive Summary](#part-1-executive-summary)
2. [Core Pipeline Architecture](#part-2-core-pipeline-architecture)
3. [Stage 1: Request](#part-3-stage-1---request)
4. [Stage 2: Quote](#part-4-stage-2---quote)
5. [Stage 3: Job](#part-5-stage-3---job)
6. [Stage 4: Invoice](#part-6-stage-4---invoice)
7. [Stage 5: Payment](#part-7-stage-5---payment)
8. [Smart Client Lookup](#part-8-smart-client-lookup)
9. [Team Management](#part-9-team-management)
10. [Territory & Capacity Planning](#part-10-territory--capacity-planning)
11. [Inventory Management](#part-11-inventory-management)
12. [Approval Workflows](#part-12-approval-workflows)
13. [Reporting & Analytics](#part-13-reporting--analytics)
14. [Database Schema](#part-14-database-schema)
15. [Status Transitions](#part-15-status-transitions)
16. [Project Structure](#part-16-project-structure)
17. [Implementation Roadmap](#part-17-implementation-roadmap)
18. [Testing Scenarios](#part-18-testing-scenarios)
19. [Library Reference](#part-19-library-reference)

---

## Part 1: Executive Summary

### The "Best of All Worlds" Architecture

| Source | What We Take | Why |
|--------|--------------|-----|
| **Jobber** | 5-stage pipeline with action-driven sub-statuses | Clean separation, clear workflow |
| **Workiz** | Single-screen UX, AI scheduling, geographic/skill assignment | Best-in-class user experience |
| **ServiceTitan** | Business Units, capacity planning, inventory, reporting | Enterprise-grade operations |
| **BOM Calculator Hub** | BOM/BOL calculation, material prep pipeline | **UNIQUE competitive advantage** |

### Your Unique Differentiator

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

**This material preparation pipeline is what NO competitor has.**

---

## Part 2: Core Pipeline Architecture

### The 5-Stage Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   REQUEST   │───▶│    QUOTE    │───▶│     JOB     │───▶│   INVOICE   │───▶│   PAYMENT   │
│ (Opportunity)│    │  (Estimate) │    │   (Work)    │    │  (Billing)  │    │(Collection) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Conversion Tracking Fix (Your Jobber Complaint)

**Problem**: Jobber tracks conversion at Quote level  
- 1 Request → 2 Quotes sent → 1 Won = **50% conversion** (wrong!)

**Solution**: Track at REQUEST (Opportunity) level  
- 1 Request → 2 Quotes sent → 1 Won = **100% opportunity conversion** (correct!)

---

## Part 3: Stage 1 - REQUEST

### Sub-Status Flow

```
    ┌─────────────┐
    │   pending   │ ← New request submitted
    └──────┬──────┘
           │
           ▼
┌───────────────────┐     ┌────────────────────┐
│   unscheduled     │────▶│     scheduled      │
│ (Needs assessment)│     │ (Assessment set)   │
└───────────────────┘     └─────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
        ┌───────────┐        ┌───────────┐        ┌───────────┐
        │   today   │        │  upcoming │        │  overdue  │
        │(Assessment│        │ (Future   │        │ (Missed   │
        │ today)    │        │  date)    │        │  date)    │
        └─────┬─────┘        └─────┬─────┘        └─────┬─────┘
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   ▼
                    ┌──────────────────────────┐
                    │   assessment_complete    │
                    │   (Ready to quote)       │
                    └────────────┬─────────────┘
                                 │
               ┌─────────────────┴─────────────────┐
               ▼                                   ▼
      ┌─────────────────┐                ┌─────────────────┐
      │    converted    │                │    archived     │
      │ (Became Quote   │                │ (Won't proceed) │
      │  or Job)        │                │                 │
      └─────────────────┘                └─────────────────┘
           [FINAL]                            [FINAL]
```

### Request Entity

```typescript
interface ServiceRequest {
  // Identity
  id: string;
  request_number: string;                    // AUTO: REQ-2024-0001
  
  // Status
  status: RequestStatus;
  status_updated_at: Date;
  
  // Client (Smart Lookup - see Part 8)
  client_id?: string;                        // Linked after lookup/creation
  client_name: string;                       // Quick capture
  client_phone: string;
  client_email?: string;
  company_name?: string;
  
  // Property/Service Location
  property_id?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  
  // Job Details
  job_type_id: string;                       // Links to skills
  job_source_id: string;                     // Marketing attribution
  description: string;
  
  // Assessment (optional)
  has_assessment: boolean;
  assessment?: {
    scheduled_date: Date;
    scheduled_time_start: string;
    scheduled_time_end: string;
    assigned_rep_id: string;
    completed_at?: Date;
    notes?: string;
    photos?: string[];
  };
  
  // Assignment
  business_unit_id: string;
  territory_id?: string;
  suggested_rep_id?: string;                 // AI suggestion
  
  // Conversion Tracking
  converted_to_quote_ids: string[];          // Can have MULTIPLE quotes!
  converted_to_job_id?: string;
  conversion_date?: Date;
  
  // Metadata
  created_at: Date;
  created_by: string;
  updated_at: Date;
  archived_reason?: string;
}

type RequestStatus = 
  | 'pending'
  | 'unscheduled'
  | 'scheduled'
  | 'today'
  | 'upcoming'
  | 'overdue'
  | 'assessment_complete'
  | 'converted'
  | 'archived';
```

### Request Creation UI (Workiz-Inspired)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NEW REQUEST                                                    [Minimize]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐   ┌─────────────────────────────────────┐ │
│  │     CLIENT DETAILS          │   │     SERVICE LOCATION                │ │
│  │                             │   │                                     │ │
│  │  🔍 [Start typing name,     │   │  [Address]                 [Unit]   │ │
│  │     phone, or email...]     │   │                                     │ │
│  │                             │   │  [City]              [State ▼]      │ │
│  │  ┌─────────────────────────┐│   │                                     │ │
│  │  │ Matching: "John Sm..."  ││   │  [Zip]               [Country: US]  │ │
│  │  │ ─────────────────────── ││   │                                     │ │
│  │  │ John Smith (512)555-1234││   │  [🔍 Verify] [📍 Map]               │ │
│  │  │ Johnson LLC             ││   │                                     │ │
│  │  │ ─────────────────────── ││   └─────────────────────────────────────┘ │
│  │  │ ➕ Create "John Sm..."  ││                                           │
│  │  └─────────────────────────┘│                                           │
│  └─────────────────────────────┘                                           │
│                                                                             │
│  ┌─────────────────────────────┐   ┌─────────────────────────────────────┐ │
│  │     JOB DETAILS             │   │     ASSESSMENT          [Toggle: ON]│ │
│  │                             │   │                                     │ │
│  │  [Job type ▼]               │   │  [Date]              [Time ▼]       │ │
│  │                             │   │                                     │ │
│  │  [Job source ▼]             │   │  [Duration ▼]        [End Time]     │ │
│  │                             │   │                                     │ │
│  │  [Description               │   │  [Assign sales rep ▼]               │ │
│  │                         ]   │   │                                     │ │
│  │                             │   │  💡 Suggested: John S. (closest,    │ │
│  │  Business Unit: [ATX-RES ▼] │   │     available, wood specialist)     │ │
│  └─────────────────────────────┘   │                                     │ │
│                                     │  [📅 View Schedule]                │ │
│                                     └─────────────────────────────────────┘ │
│                                                                             │
│                          ┌───────────────────────┐                          │
│                          │   CREATE REQUEST      │                          │
│                          └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Stage 2 - QUOTE

### Sub-Status Flow

```
    ┌─────────────┐
    │    draft    │ ← Being created/edited
    └──────┬──────┘
           │ [Send to Client]
           ▼
┌───────────────────────┐
│   awaiting_response   │ ← Sent, waiting
└───────────┬───────────┘
            │
      ┌─────┴─────┬─────────────────┐
      ▼           ▼                 ▼
┌──────────┐ ┌───────────────┐ ┌──────────┐
│ approved │ │changes_requested│ │ declined │
└────┬─────┘ └───────┬───────┘ └────┬─────┘
     │               │               │
     │ [Convert]     │ [Revise]      │
     ▼               ▼               ▼
┌──────────┐   Back to draft   ┌──────────┐
│converted │                   │ archived │
└──────────┘                   └──────────┘
   [FINAL]                       [FINAL]
```

### Quote Entity

```typescript
interface Quote {
  // Identity
  id: string;
  quote_number: string;                      // AUTO: QUO-2024-0001
  version: number;                           // v1, v2, v3...
  
  // Relationships
  request_id: string;                        // Links back to Request!
  client_id: string;
  property_id: string;
  business_unit_id: string;
  
  // Status
  status: QuoteStatus;
  status_updated_at: Date;
  sent_at?: Date;
  approved_at?: Date;
  
  // Approval Workflow (see Part 12)
  requires_approval: boolean;
  approval_reason?: string;
  approved_by_manager_id?: string;
  approved_by_manager_at?: Date;
  
  // Options (Good/Better/Best)
  options: QuoteOption[];
  selected_option_id?: string;
  
  // BOM Calculator Integration
  fence_project: {
    fence_type: 'wood_vertical' | 'wood_horizontal' | 'iron';
    sections: FenceSection[];
    gates: Gate[];
    calculated_bom: BOMItem[];
    calculated_bol: BOLItem[];
    total_linear_feet: number;
    calculation_version: string;
    calculated_at: Date;
  };
  
  // Financials
  materials_subtotal: number;
  labor_subtotal: number;
  subtotal: number;
  discount_amount: number;
  discount_percent: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  margin_percent: number;                    // For approval workflow
  
  // Deposit/Terms
  deposit_required: boolean;
  deposit_amount?: number;
  valid_until: Date;
  
  // Client Approval
  approved_by_name?: string;
  approved_by_signature?: string;
  
  // Metadata
  created_at: Date;
  created_by: string;
  updated_at: Date;
}

interface QuoteOption {
  id: string;
  name: string;                              // "Good", "Better", "Best"
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

type QuoteStatus =
  | 'draft'
  | 'awaiting_response'
  | 'changes_requested'
  | 'approved'
  | 'converted'
  | 'declined'
  | 'archived';
```

---

## Part 5: Stage 3 - JOB

### Sub-Status Flow (Including Material Prep Pipeline)

```
                              ┌─────────────┐
                              │   created   │ ← Quote converted
                              └──────┬──────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │ unscheduled │ ← Needs crew + date
                              └──────┬──────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         │              MATERIAL PREPARATION PIPELINE            │
         │              (Your Competitive Advantage)             │
         │                                                       │
         │   ┌─────────────┐    ┌─────────────┐                 │
         │   │    ready    │───▶│   picking   │                 │
         │   │ (BOM/BOL to │    │ (Yard is    │                 │
         │   │  yard)      │    │  picking)   │                 │
         │   └─────────────┘    └──────┬──────┘                 │
         │                             │                         │
         │   ┌─────────────┐    ┌──────▼──────┐                 │
         │   │   loaded    │◀───│   staged    │                 │
         │   │ (On truck)  │    │ (Verified)  │                 │
         │   └──────┬──────┘    └─────────────┘                 │
         │          │                                            │
         └──────────┼────────────────────────────────────────────┘
                    │
                    ▼
             ┌─────────────┐
             │  scheduled  │
             └──────┬──────┘
                    │
      ┌─────────────┼─────────────┐
      ▼             ▼             ▼
┌───────────┐ ┌───────────┐ ┌───────────┐
│   today   │ │  upcoming │ │  overdue  │
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘
      │             │             │
      └─────────────┼─────────────┘
                    ▼
           ┌───────────────┐
           │  in_progress  │ ← Crew on site
           └───────┬───────┘
                   │
      ┌────────────┼────────────┐
      ▼            │            ▼
┌─────────────┐    │     ┌─────────────┐
│action_needed│    │     │   paused    │
│(Issue arose)│    │     │(Weather,etc)│
└──────┬──────┘    │     └──────┬──────┘
       │           │            │
       └───────────┼────────────┘
                   ▼
         ┌─────────────────┐
         │requires_invoicing│ ← Work done
         └────────┬────────┘
                  │
                  ▼
           ┌───────────┐
           │ completed │
           └───────────┘
              [FINAL]
```

### ⚠️ CRITICAL: Yard Status Alignment

The material prep statuses **MUST** match existing `bom_projects.status` values:

| Status | Description | Existing in Production |
|--------|-------------|----------------------|
| `ready` | Sent to yard | ✅ Yes |
| `picking` | Being picked | ✅ Yes |
| `staged` | Materials staged | ✅ Yes |
| `loaded` | On truck | ✅ Yes |
| `completed` | Done | ✅ Yes |

**DO NOT** change these values - they're already in production yard workflows.

### Job Entity

```typescript
interface Job {
  // Identity
  id: string;
  job_number: string;                        // AUTO: JOB-2024-0001
  
  // Relationships
  quote_id: string;
  request_id: string;
  client_id: string;
  property_id: string;
  business_unit_id: string;
  
  // Status
  status: JobStatus;
  status_updated_at: Date;
  
  // Type
  job_type: 'one_off' | 'recurring';
  
  // From Quote
  fence_project: FenceProject;
  bom: BOMItem[];
  bol: BOLItem[];
  
  // Material Prep Status
  material_status: {
    ready_at?: Date;
    ready_by?: string;
    picking_started_at?: Date;
    picking_by?: string;
    staged_at?: Date;
    staged_location?: string;
    staged_verified_by?: string;
    loaded_at?: Date;
    loaded_to_truck?: string;
    loaded_verified_by?: string;
    crew_sign_off?: string;
    crew_sign_off_at?: Date;
  };
  
  // Crew Assignment
  assigned_crew_id?: string;
  assigned_crew?: Crew;
  
  // Visits
  visits: JobVisit[];
  
  // Scheduling
  scheduled_start_date?: Date;
  scheduled_end_date?: Date;
  estimated_duration_days: number;
  
  // Financials
  quoted_total: number;
  actual_materials_cost?: number;
  actual_labor_cost?: number;
  
  // Metadata
  created_at: Date;
  created_by: string;
  updated_at: Date;
}

type JobStatus =
  | 'created'
  | 'unscheduled'
  | 'ready'                                  // Material prep: sent to yard
  | 'picking'                                // Material prep: being picked
  | 'staged'                                 // Material prep: verified
  | 'loaded'                                 // Material prep: on truck
  | 'scheduled'
  | 'today'
  | 'upcoming'
  | 'overdue'
  | 'in_progress'
  | 'action_needed'
  | 'paused'
  | 'requires_invoicing'
  | 'completed';
```

### Job Visit Entity

```typescript
interface JobVisit {
  id: string;
  job_id: string;
  visit_number: number;                      // Visit 1 of 3
  
  status: 'scheduled' | 'today' | 'in_progress' | 'completed' | 'cancelled';
  
  // Scheduling
  scheduled_date: Date;
  scheduled_time_start: string;
  scheduled_time_end: string;
  actual_start?: Date;
  actual_end?: Date;
  
  // Assignment
  assigned_crew_id: string;
  
  // Work
  description: string;
  completed_work?: string;
  notes?: string;
  photos?: string[];
  client_signature?: string;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
}
```

---

## Part 6: Stage 4 - INVOICE

### Sub-Status Flow

```
    ┌─────────────┐
    │    draft    │ ← Being created
    └──────┬──────┘
           │ [Send]
           ▼
┌───────────────────────┐
│   awaiting_payment    │
└───────────┬───────────┘
            │
      ┌─────┴─────────────────┐
      ▼                       ▼
┌──────────┐           ┌───────────┐
│ past_due │           │   paid    │
│(Due date │           │(Full      │
│ passed)  │           │ payment)  │
└────┬─────┘           └───────────┘
     │                    [FINAL]
     ▼
┌──────────┐
│ bad_debt │
│(Write-off)│
└──────────┘
   [FINAL]
```

### Invoice Entity (with QBO Integration)

```typescript
interface Invoice {
  // Identity
  id: string;
  invoice_number: string;                    // AUTO: INV-2024-0001
  
  // Relationships
  job_id: string;
  client_id: string;
  business_unit_id: string;
  
  // Status
  status: InvoiceStatus;
  status_updated_at: Date;
  
  // Amounts
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  
  // Terms
  due_date: Date;
  payment_terms: string;                     // "Net 30", "Due on Receipt"
  
  // Line Items
  line_items: InvoiceLineItem[];
  
  // Status Dates
  sent_at?: Date;
  paid_at?: Date;
  
  // ═══════════════════════════════════════════
  // QBO INTEGRATION (from FSM-MASTER-PLAN)
  // ═══════════════════════════════════════════
  qbo_invoice_id?: string;
  qbo_sync_status: 'pending' | 'synced' | 'error';
  qbo_synced_at?: Date;
  qbo_sync_error?: string;
  
  // Metadata
  created_at: Date;
  created_by: string;
  updated_at: Date;
}

type InvoiceStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'past_due'
  | 'paid'
  | 'bad_debt';
```

---

## Part 7: Stage 5 - PAYMENT

### Payment Entity

```typescript
interface Payment {
  id: string;
  invoice_id: string;
  
  // Amount
  amount: number;
  tip_amount: number;
  total_amount: number;
  
  // Method
  method: 'credit_card' | 'debit_card' | 'ach' | 'check' | 'cash' | 'financing';
  
  // Status
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'partial_refund';
  
  // Processing
  processor?: string;                        // Stripe, Square
  transaction_id?: string;
  processed_at?: Date;
  
  // QBO Integration
  qbo_payment_id?: string;
  qbo_sync_status: 'pending' | 'synced' | 'error';
  
  // Metadata
  created_at: Date;
  created_by: string;
  notes?: string;
}
```

---

## Part 8: Smart Client Lookup

### Universal Client Search Pattern

**Requirement**: When entering a client ANYWHERE in the system, users should NOT choose between "existing" or "new". They should start typing and the system searches automatically.

### Search Behavior

```
User types: "512-555" or "John" or "john@email.com"
         ↓
┌─────────────────────────────────────────────────────┐
│ 🔍 Searching...                                     │
├─────────────────────────────────────────────────────┤
│ 📋 MATCHES FOUND:                                   │
│                                                     │
│    John Smith                                       │
│    📞 (512) 555-1234  ✉️ john@email.com            │
│    🏢 ABC Builders                                  │
│                                                     │
│    Johnson Smithfield                               │
│    📞 (512) 555-9876  ✉️ jsmith@xyz.com            │
│                                                     │
├─────────────────────────────────────────────────────┤
│ ➕ Create new client "512-555..."                   │
└─────────────────────────────────────────────────────┘
```

### Search Implementation

```typescript
interface ClientSearchParams {
  query: string;
  business_unit_id?: string;
  limit?: number;
}

interface ClientSearchResult {
  id: string;
  name: string;
  company_name?: string;
  phone: string;
  email?: string;
  match_type: 'name' | 'phone' | 'email' | 'company';
  match_score: number;
}

// Backend search query (PostgreSQL)
const searchClientsSQL = `
  SELECT 
    id, name, company_name, phone, email,
    CASE
      WHEN phone LIKE $1 THEN 'phone'
      WHEN email ILIKE $1 THEN 'email'
      WHEN name ILIKE $1 THEN 'name'
      WHEN company_name ILIKE $1 THEN 'company'
    END as match_type,
    CASE
      WHEN phone LIKE $1 THEN 100
      WHEN email ILIKE $1 THEN 90
      WHEN name ILIKE $1 THEN 80
      WHEN company_name ILIKE $1 THEN 70
    END as match_score
  FROM clients
  WHERE 
    phone LIKE $2 OR
    email ILIKE $3 OR
    name ILIKE $3 OR
    company_name ILIKE $3
  ORDER BY match_score DESC
  LIMIT $4
`;

// Phone normalization for matching
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');  // Remove all non-digits
}
```

### Reusable Component

```typescript
// src/components/common/ClientLookup.tsx

interface ClientLookupProps {
  onSelect: (client: Client) => void;
  onCreate: (partialData: Partial<Client>) => void;
  businessUnitId?: string;
  placeholder?: string;
}

function ClientLookup({ onSelect, onCreate, businessUnitId, placeholder }: ClientLookupProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchClients({ query, businessUnitId });
      setResults(results);
      setIsSearching(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query, businessUnitId]);
  
  return (
    <div className="client-lookup">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder || "Start typing name, phone, or email..."}
      />
      
      {isSearching && <Spinner />}
      
      {results.length > 0 && (
        <div className="results-dropdown">
          {results.map(client => (
            <ClientResultItem 
              key={client.id}
              client={client}
              onClick={() => onSelect(client)}
            />
          ))}
          <CreateNewOption 
            query={query}
            onClick={() => onCreate({ name: query })}
          />
        </div>
      )}
      
      {!isSearching && query.length >= 2 && results.length === 0 && (
        <div className="no-results">
          <CreateNewOption 
            query={query}
            onClick={() => onCreate({ name: query })}
          />
        </div>
      )}
    </div>
  );
}
```

### Usage Throughout System

```typescript
// In Request creation
<ClientLookup
  onSelect={(client) => setValue('client_id', client.id)}
  onCreate={(partial) => openClientModal(partial)}
  businessUnitId={selectedBU}
/>

// In Quote creation (pre-filled from Request but editable)
<ClientLookup
  defaultValue={request.client}
  onSelect={(client) => setValue('client_id', client.id)}
  onCreate={(partial) => openClientModal(partial)}
/>

// In Job scheduling
<ClientLookup
  onSelect={(client) => setValue('client_id', client.id)}
  onCreate={(partial) => openClientModal(partial)}
/>
```

---

## Part 9: Team Management

### User Types

```typescript
type UserType =
  // Internal - Office
  | 'admin'                                  // Full access
  | 'operations'                             // Office staff
  | 'dispatcher'                             // Scheduling focus
  
  // Internal - Sales
  | 'sales_rep'                              // Does assessments
  | 'sales_manager'                          // Manages reps
  
  // Internal - Crews
  | 'crew_lead'                              // Leads installation
  | 'crew_member'                            // Installation worker
  
  // Internal - Yard
  | 'yard_manager'                           // Oversees material prep
  | 'yard_worker'                            // Picks/stages
  
  // External
  | 'contractor';                            // External crews

interface TeamMember {
  id: string;
  user_id?: string;                          // Auth user link
  user_type: UserType;
  
  // Profile
  name: string;
  email: string;
  phone: string;
  photo_url?: string;
  
  // Assignment
  business_unit_ids: string[];
  territory_ids: string[];
  
  // Skills
  skills: Skill[];
  certifications: string[];
  
  // Capacity
  daily_capacity_hours: number;
  max_jobs_per_day?: number;
  
  // For Crews
  crew_id?: string;
  truck_id?: string;
  
  // For Sales
  commission_rate?: number;
  
  // Performance
  metrics: {
    conversion_rate?: number;
    jobs_completed?: number;
    avg_rating?: number;
    on_time_rate?: number;
  };
  
  // Status
  status: 'active' | 'inactive' | 'on_leave';
  
  // Contractor-specific
  contractor_info?: {
    company_name: string;
    insurance_expiry: Date;
    license_number: string;
    rate_type: 'hourly' | 'per_job' | 'percentage';
    rate: number;
  };
}

interface Crew {
  id: string;
  name: string;                              // "Crew Alpha"
  lead_id: string;
  member_ids: string[];
  business_unit_id: string;
  territory_ids: string[];
  truck_id: string;
  capabilities: string[];                    // Fence types
  typical_daily_lf: number;
  status: 'available' | 'on_job' | 'off_duty';
  current_job_id?: string;
}
```

---

## Part 10: Territory & Capacity Planning

### Territory Management

```typescript
interface Territory {
  id: string;
  name: string;                              // "North Austin"
  business_unit_id: string;
  
  // Definition
  definition_type: 'zip_codes' | 'drawn' | 'city' | 'county';
  zip_codes?: string[];
  boundary?: GeoJSON.Polygon;
  cities?: string[];
  counties?: string[];
  
  // Assignment
  assigned_sales_reps: string[];
  assigned_crews: string[];
  
  // Metrics
  total_requests: number;
  total_revenue: number;
  avg_job_value: number;
}
```

### Capacity Planning (ServiceTitan-Style)

```typescript
interface CapacityPlan {
  id: string;
  business_unit_id: string;
  
  mode: 'manual' | 'skills_based';
  
  time_windows: TimeWindow[];
  
  capacity: {
    [date: string]: {
      [windowId: string]: {
        total_hours: number;
        booked_hours: number;
        available_hours: number;
        manual_adjustment: number;
        available_reps: string[];
        available_crews: string[];
      };
    };
  };
  
  rules: CapacityRule[];
}

interface CapacityRule {
  id: string;
  name: string;
  
  trigger_type: 'job_type' | 'season' | 'weather' | 'manual';
  trigger_conditions: Record<string, any>;
  
  effect: {
    multiply_capacity?: number;
    add_hours?: number;
    restrict_job_types?: string[];
    require_skills?: string[];
  };
  
  active_dates?: { start: Date; end: Date };
  active_days?: number[];
}
```

### AI Scheduling Suggestion

```typescript
interface SchedulingSuggestion {
  rep_id: string;
  rep_name: string;
  confidence_score: number;                  // 0-100
  reasons: string[];
  available_slots: TimeSlot[];
}

// Factors considered:
const schedulingFactors = {
  geographic: {
    territory_match: boolean,
    proximity_minutes: number,
    drive_time: number,
  },
  skills: {
    job_type_match: boolean,
    fence_type_experience: string[],
  },
  availability: {
    has_capacity: boolean,
    conflicts: Job[],
  },
  performance: {
    conversion_rate: number,
    customer_rating: number,
  },
  workload: {
    daily_job_count: number,
    fairness_score: number,
  }
};
```

---

## Part 11: Inventory Management

### Multi-Location Inventory

```typescript
interface InventoryLocation {
  id: string;
  type: 'warehouse' | 'yard' | 'truck';
  name: string;
  business_unit_id: string;
  address?: Address;
  truck_id?: string;                         // If type = 'truck'
}

interface InventoryItem {
  id: string;
  material_id: string;
  location_id: string;
  
  // Quantities
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;                // on_hand - reserved
  quantity_on_order: number;
  
  // Thresholds
  reorder_point: number;
  reorder_quantity: number;
  max_quantity: number;
  
  // Costing
  unit_cost: number;
  costing_method: 'weighted_average' | 'fifo' | 'standard';
  total_value: number;
  
  // Tracking
  last_counted_at?: Date;
  last_movement_at?: Date;
}

interface InventoryTransaction {
  id: string;
  item_id: string;
  
  type: 'receive' | 'issue' | 'transfer' | 'adjustment' | 'count';
  
  from_location_id?: string;
  to_location_id?: string;
  quantity: number;
  
  // Reference
  reference_type?: 'purchase_order' | 'job' | 'transfer';
  reference_id?: string;
  job_id?: string;
  bom_item_id?: string;
  
  created_at: Date;
  created_by: string;
  notes?: string;
}
```

### Auto-Consumption on Job Completion

```typescript
async function consumeJobMaterials(job: Job): Promise<void> {
  for (const bomItem of job.bom) {
    const inventoryItem = await findInventoryItem({
      material_id: bomItem.material_id,
      location_id: job.assigned_crew.truck_id,
    });
    
    await createTransaction({
      type: 'issue',
      item_id: inventoryItem.id,
      quantity: bomItem.quantity,
      reference_type: 'job',
      reference_id: job.id,
      bom_item_id: bomItem.id,
      notes: `Auto-consumed for ${job.job_number}`,
    });
    
    await updateInventoryQuantity(inventoryItem.id, -bomItem.quantity);
    
    if (inventoryItem.quantity_available < inventoryItem.reorder_point) {
      await createReplenishmentAlert(inventoryItem);
    }
  }
}
```

---

## Part 12: Approval Workflows

### Configurable Thresholds (per Business Unit)

```typescript
interface ApprovalSettings {
  business_unit_id: string;
  
  // Quote Approval Triggers
  quote_total_threshold: number;             // Default: $25,000
  quote_margin_minimum: number;              // Default: 15%
  quote_discount_maximum: number;            // Default: 10%
  
  // Invoice Escalation
  invoice_past_due_escalation_days: number;  // Default: 30
  
  // Approvers
  quote_approvers: string[];                 // User IDs
  invoice_escalation_contacts: string[];
}

// Default values (from FSM-MASTER-PLAN)
const DEFAULT_APPROVAL_THRESHOLDS = {
  quote_total_threshold: 25000,
  quote_margin_minimum: 15,
  quote_discount_maximum: 10,
  invoice_past_due_escalation_days: 30,
};
```

### Approval Check Function

```typescript
interface ApprovalCheckResult {
  requires_approval: boolean;
  reasons: string[];
}

function checkQuoteApproval(
  quote: Quote, 
  settings: ApprovalSettings
): ApprovalCheckResult {
  const reasons: string[] = [];
  
  if (quote.total > settings.quote_total_threshold) {
    reasons.push(`Total ($${quote.total}) exceeds $${settings.quote_total_threshold} threshold`);
  }
  
  if (quote.margin_percent < settings.quote_margin_minimum) {
    reasons.push(`Margin (${quote.margin_percent}%) below ${settings.quote_margin_minimum}% minimum`);
  }
  
  if (quote.discount_percent > settings.quote_discount_maximum) {
    reasons.push(`Discount (${quote.discount_percent}%) exceeds ${settings.quote_discount_maximum}% maximum`);
  }
  
  return {
    requires_approval: reasons.length > 0,
    reasons,
  };
}
```

### Approval UI Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ APPROVAL REQUIRED                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  This quote requires manager approval:                          │
│                                                                 │
│  • Total ($32,500) exceeds $25,000 threshold                   │
│  • Margin (12%) below 15% minimum                              │
│                                                                 │
│  Approver: [Select Manager ▼]                                   │
│                                                                 │
│  [Request Approval]     [Save as Draft]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 13: Reporting & Analytics

### Opportunity Funnel View (Fixes Jobber Problem)

```sql
-- From FSM-MASTER-PLAN: True conversion tracking at Request level
CREATE OR REPLACE VIEW opportunity_funnel AS
SELECT
  DATE_TRUNC('month', r.created_at) as month,
  COUNT(r.id) as requests,
  COUNT(q.id) as quotes_generated,
  COUNT(DISTINCT r.id) FILTER (WHERE q.status = 'converted') as opportunities_won,
  
  -- TRUE conversion rate (your fix!)
  ROUND(
    COUNT(DISTINCT r.id) FILTER (WHERE q.status = 'converted')::NUMERIC /
    NULLIF(COUNT(r.id), 0) * 100, 1
  ) as true_conversion_rate,
  
  -- Quote-level rate (for comparison, secondary metric)
  ROUND(
    COUNT(q.id) FILTER (WHERE q.status = 'converted')::NUMERIC /
    NULLIF(COUNT(q.id), 0) * 100, 1
  ) as quote_approval_rate

FROM service_requests r
LEFT JOIN request_quotes rq ON rq.request_id = r.id
LEFT JOIN quotes q ON q.id = rq.quote_id
GROUP BY DATE_TRUNC('month', r.created_at)
ORDER BY month DESC;
```

### Dashboard KPIs

```typescript
interface DashboardMetrics {
  // Pipeline
  pipeline: {
    requests_pending: number;
    requests_today: number;
    assessments_scheduled: number;
    quotes_awaiting_response: number;
    jobs_in_progress: number;
    jobs_ready_for_yard: number;
    invoices_past_due: number;
  };
  
  // Conversion (at REQUEST level!)
  conversion: {
    requests_created: number;
    requests_quoted: number;
    requests_converted: number;
    opportunity_conversion_rate: number;     // THIS is what matters
  };
  
  // Revenue
  revenue: {
    mtd: number;
    ytd: number;
    avg_job_value: number;
    by_business_unit: Record<string, number>;
    by_fence_type: Record<string, number>;
  };
  
  // Team Performance
  team: {
    sales_leaderboard: SalesMetric[];
    crew_leaderboard: CrewMetric[];
    yard_efficiency: YardMetric;
  };
  
  // Operational
  operational: {
    avg_days_request_to_job: number;
    avg_days_job_to_completion: number;
    material_prep_avg_hours: number;
    jobs_with_material_delays: number;
  };
}
```

---

## Part 14: Database Schema

### Auto-Number Generation (from FSM-MASTER-PLAN)

```sql
-- Sequences for each entity type
CREATE SEQUENCE IF NOT EXISTS request_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS job_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Universal number generator function
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

-- Usage examples:
-- SELECT generate_fsm_number('REQ', 'request_number_seq');  → REQ-2024-0001
-- SELECT generate_fsm_number('QUO', 'quote_number_seq');    → QUO-2024-0001
-- SELECT generate_fsm_number('JOB', 'job_number_seq');      → JOB-2024-0001
-- SELECT generate_fsm_number('INV', 'invoice_number_seq');  → INV-2024-0001
```

### Enum Types

```sql
-- Request statuses
CREATE TYPE request_status AS ENUM (
  'pending', 'unscheduled', 'scheduled', 'today', 'upcoming',
  'overdue', 'assessment_complete', 'converted', 'archived'
);

-- Quote statuses
CREATE TYPE quote_status AS ENUM (
  'draft', 'awaiting_response', 'changes_requested',
  'approved', 'converted', 'declined', 'archived'
);

-- Job statuses (aligned with existing yard system!)
CREATE TYPE job_status AS ENUM (
  'created', 'unscheduled',
  'ready', 'picking', 'staged', 'loaded',    -- Material prep (existing!)
  'scheduled', 'today', 'upcoming', 'overdue',
  'in_progress', 'action_needed', 'paused',
  'requires_invoicing', 'completed'
);

-- Invoice statuses
CREATE TYPE invoice_status AS ENUM (
  'draft', 'awaiting_payment', 'past_due', 'paid', 'bad_debt'
);

-- Payment statuses
CREATE TYPE payment_status AS ENUM (
  'pending', 'completed', 'failed', 'refunded', 'partial_refund'
);

-- User types
CREATE TYPE user_type AS ENUM (
  'admin', 'operations', 'dispatcher',
  'sales_rep', 'sales_manager',
  'crew_lead', 'crew_member',
  'yard_manager', 'yard_worker',
  'contractor'
);

-- QBO sync status
CREATE TYPE qbo_sync_status AS ENUM (
  'pending', 'synced', 'error'
);
```

### Core Tables

```sql
-- ═══════════════════════════════════════════════════════════════
-- STAGE 1: SERVICE REQUESTS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(20) UNIQUE NOT NULL 
    DEFAULT generate_fsm_number('REQ', 'request_number_seq'),
  
  -- Status
  status request_status NOT NULL DEFAULT 'pending',
  status_updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Client (Smart Lookup)
  client_id UUID REFERENCES clients(id),
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(20) NOT NULL,
  client_email VARCHAR(255),
  company_name VARCHAR(255),
  
  -- Property
  property_id UUID REFERENCES properties(id),
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  zip VARCHAR(10) NOT NULL,
  
  -- Job Details
  job_type_id UUID REFERENCES job_types(id),
  job_source_id UUID REFERENCES job_sources(id),
  description TEXT,
  
  -- Assessment
  has_assessment BOOLEAN DEFAULT false,
  assessment_date DATE,
  assessment_time_start TIME,
  assessment_time_end TIME,
  assessment_rep_id UUID REFERENCES team_members(id),
  assessment_completed_at TIMESTAMPTZ,
  assessment_notes TEXT,
  
  -- Assignment
  business_unit_id UUID REFERENCES business_units(id) NOT NULL,
  territory_id UUID REFERENCES territories(id),
  
  -- Conversion
  converted_to_job_id UUID REFERENCES jobs(id),
  conversion_date TIMESTAMPTZ,
  archived_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Request to Quotes junction (multiple quotes per request)
CREATE TABLE request_quotes (
  request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, quote_id)
);

-- ═══════════════════════════════════════════════════════════════
-- STAGE 2: QUOTES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number VARCHAR(20) UNIQUE NOT NULL
    DEFAULT generate_fsm_number('QUO', 'quote_number_seq'),
  version INTEGER DEFAULT 1,
  
  -- Status
  status quote_status NOT NULL DEFAULT 'draft',
  status_updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Relationships
  client_id UUID REFERENCES clients(id) NOT NULL,
  property_id UUID REFERENCES properties(id) NOT NULL,
  business_unit_id UUID REFERENCES business_units(id) NOT NULL,
  
  -- Fence Project (JSONB)
  fence_project JSONB NOT NULL,
  
  -- Financials
  materials_subtotal DECIMAL(10,2),
  labor_subtotal DECIMAL(10,2),
  subtotal DECIMAL(10,2),
  discount_amount DECIMAL(10,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  tax_rate DECIMAL(5,4),
  tax_amount DECIMAL(10,2),
  total DECIMAL(10,2),
  margin_percent DECIMAL(5,2),
  
  -- Approval Workflow
  requires_approval BOOLEAN DEFAULT false,
  approval_reason TEXT,
  approved_by_manager_id UUID REFERENCES team_members(id),
  approved_by_manager_at TIMESTAMPTZ,
  
  -- Terms
  deposit_required BOOLEAN DEFAULT true,
  deposit_amount DECIMAL(10,2),
  valid_until DATE,
  
  -- Client Approval
  sent_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by_name VARCHAR(255),
  approved_signature TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Quote Options (Good/Better/Best)
CREATE TABLE quote_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  fence_config JSONB NOT NULL,
  bom JSONB NOT NULL,
  bol JSONB NOT NULL,
  materials_total DECIMAL(10,2),
  labor_total DECIMAL(10,2),
  total DECIMAL(10,2),
  is_selected BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0
);

-- ═══════════════════════════════════════════════════════════════
-- STAGE 3: JOBS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number VARCHAR(20) UNIQUE NOT NULL
    DEFAULT generate_fsm_number('JOB', 'job_number_seq'),
  
  -- Status
  status job_status NOT NULL DEFAULT 'created',
  status_updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Relationships
  quote_id UUID REFERENCES quotes(id) NOT NULL,
  request_id UUID REFERENCES service_requests(id) NOT NULL,
  client_id UUID REFERENCES clients(id) NOT NULL,
  property_id UUID REFERENCES properties(id) NOT NULL,
  business_unit_id UUID REFERENCES business_units(id) NOT NULL,
  
  -- Type
  job_type VARCHAR(20) DEFAULT 'one_off',
  
  -- Fence Project
  fence_project JSONB NOT NULL,
  bom JSONB NOT NULL,
  bol JSONB NOT NULL,
  
  -- Material Prep Status
  material_status JSONB DEFAULT '{}'::jsonb,
  
  -- Crew Assignment
  assigned_crew_id UUID REFERENCES crews(id),
  
  -- Scheduling
  scheduled_start_date DATE,
  scheduled_end_date DATE,
  estimated_duration_days INTEGER,
  
  -- Financials
  quoted_total DECIMAL(10,2),
  actual_materials_cost DECIMAL(10,2),
  actual_labor_cost DECIMAL(10,2),
  
  -- Billing
  billing_method VARCHAR(20) DEFAULT 'on_completion',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Job Visits
CREATE TABLE job_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  visit_number INTEGER NOT NULL,
  
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  
  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  
  -- Assignment
  assigned_crew_id UUID REFERENCES crews(id),
  
  -- Work
  description TEXT,
  completed_work TEXT,
  notes TEXT,
  client_signature TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- STAGE 4: INVOICES (with QBO Integration)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(20) UNIQUE NOT NULL
    DEFAULT generate_fsm_number('INV', 'invoice_number_seq'),
  
  -- Status
  status invoice_status NOT NULL DEFAULT 'draft',
  status_updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Relationships
  job_id UUID REFERENCES jobs(id) NOT NULL,
  client_id UUID REFERENCES clients(id) NOT NULL,
  business_unit_id UUID REFERENCES business_units(id) NOT NULL,
  
  -- Amounts
  subtotal DECIMAL(10,2),
  tax_rate DECIMAL(5,4),
  tax_amount DECIMAL(10,2),
  total DECIMAL(10,2),
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2),
  
  -- Terms
  due_date DATE,
  payment_terms VARCHAR(50),
  
  -- Status Dates
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- ═══════════════════════════════════════════
  -- QBO INTEGRATION (from FSM-MASTER-PLAN)
  -- ═══════════════════════════════════════════
  qbo_invoice_id VARCHAR(50),
  qbo_sync_status qbo_sync_status DEFAULT 'pending',
  qbo_synced_at TIMESTAMPTZ,
  qbo_sync_error TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Invoice Line Items
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  
  line_type VARCHAR(20) NOT NULL,          -- 'material', 'labor', 'other'
  description TEXT NOT NULL,
  quantity DECIMAL(10,2),
  unit_price DECIMAL(10,2),
  total DECIMAL(10,2),
  
  -- Reference
  material_id UUID REFERENCES materials(id),
  labor_code_id UUID REFERENCES labor_codes(id),
  
  sort_order INTEGER DEFAULT 0
);

-- ═══════════════════════════════════════════════════════════════
-- STAGE 5: PAYMENTS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) NOT NULL,
  
  -- Amount
  amount DECIMAL(10,2) NOT NULL,
  tip_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Method
  method VARCHAR(20) NOT NULL,
  
  -- Status
  status payment_status NOT NULL DEFAULT 'pending',
  
  -- Processing
  processor VARCHAR(50),
  transaction_id VARCHAR(255),
  processed_at TIMESTAMPTZ,
  
  -- QBO Integration
  qbo_payment_id VARCHAR(50),
  qbo_sync_status qbo_sync_status DEFAULT 'pending',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- ═══════════════════════════════════════════════════════════════
-- TEAM MANAGEMENT
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_type user_type NOT NULL,
  
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  photo_url TEXT,
  
  daily_capacity_hours DECIMAL(4,2) DEFAULT 8,
  max_jobs_per_day INTEGER,
  
  commission_rate DECIMAL(5,4),
  
  status VARCHAR(20) DEFAULT 'active',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Team Member Business Units (many-to-many)
CREATE TABLE team_member_business_units (
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  business_unit_id UUID REFERENCES business_units(id) ON DELETE CASCADE,
  PRIMARY KEY (team_member_id, business_unit_id)
);

-- Team Member Territories (many-to-many)
CREATE TABLE team_member_territories (
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  territory_id UUID REFERENCES territories(id) ON DELETE CASCADE,
  PRIMARY KEY (team_member_id, territory_id)
);

-- Team Member Skills
CREATE TABLE team_member_skills (
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  proficiency_level INTEGER DEFAULT 1,
  PRIMARY KEY (team_member_id, skill_id)
);

-- Crews
CREATE TABLE crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  lead_id UUID REFERENCES team_members(id),
  business_unit_id UUID REFERENCES business_units(id),
  truck_id UUID REFERENCES trucks(id),
  typical_daily_lf INTEGER,
  status VARCHAR(20) DEFAULT 'available',
  current_job_id UUID REFERENCES jobs(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Crew Members (many-to-many)
CREATE TABLE crew_members (
  crew_id UUID REFERENCES crews(id) ON DELETE CASCADE,
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (crew_id, team_member_id)
);

-- Crew Territories (many-to-many)
CREATE TABLE crew_territories (
  crew_id UUID REFERENCES crews(id) ON DELETE CASCADE,
  territory_id UUID REFERENCES territories(id) ON DELETE CASCADE,
  PRIMARY KEY (crew_id, territory_id)
);

-- ═══════════════════════════════════════════════════════════════
-- TERRITORIES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  business_unit_id UUID REFERENCES business_units(id),
  
  definition_type VARCHAR(20) NOT NULL,
  zip_codes TEXT[],
  boundary JSONB,                            -- GeoJSON
  cities TEXT[],
  counties TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- INVENTORY
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL,                 -- warehouse, yard, truck
  name VARCHAR(100) NOT NULL,
  business_unit_id UUID REFERENCES business_units(id),
  address JSONB,
  truck_id UUID REFERENCES trucks(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES materials(id) NOT NULL,
  location_id UUID REFERENCES inventory_locations(id) NOT NULL,
  
  quantity_on_hand DECIMAL(10,2) DEFAULT 0,
  quantity_reserved DECIMAL(10,2) DEFAULT 0,
  quantity_on_order DECIMAL(10,2) DEFAULT 0,
  
  reorder_point DECIMAL(10,2),
  reorder_quantity DECIMAL(10,2),
  max_quantity DECIMAL(10,2),
  
  unit_cost DECIMAL(10,4),
  costing_method VARCHAR(20) DEFAULT 'weighted_average',
  
  last_counted_at TIMESTAMPTZ,
  last_movement_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(material_id, location_id)
);

CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(id) NOT NULL,
  
  type VARCHAR(20) NOT NULL,                 -- receive, issue, transfer, adjustment, count
  quantity DECIMAL(10,2) NOT NULL,
  
  from_location_id UUID REFERENCES inventory_locations(id),
  to_location_id UUID REFERENCES inventory_locations(id),
  
  reference_type VARCHAR(50),
  reference_id UUID,
  job_id UUID REFERENCES jobs(id),
  bom_item_id UUID,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- ═══════════════════════════════════════════════════════════════
-- APPROVAL SETTINGS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE approval_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_id UUID REFERENCES business_units(id) UNIQUE,
  
  quote_total_threshold DECIMAL(10,2) DEFAULT 25000,
  quote_margin_minimum DECIMAL(5,2) DEFAULT 15,
  quote_discount_maximum DECIMAL(5,2) DEFAULT 10,
  invoice_past_due_escalation_days INTEGER DEFAULT 30,
  
  quote_approvers UUID[],
  invoice_escalation_contacts UUID[],
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- REPORTING VIEWS
-- ═══════════════════════════════════════════════════════════════

-- Opportunity Funnel (fixes Jobber conversion tracking issue)
CREATE OR REPLACE VIEW opportunity_funnel AS
SELECT
  DATE_TRUNC('month', r.created_at) as month,
  r.business_unit_id,
  COUNT(r.id) as requests,
  COUNT(DISTINCT rq.quote_id) as quotes_generated,
  COUNT(DISTINCT r.id) FILTER (WHERE q.status = 'converted') as opportunities_won,
  
  -- TRUE conversion rate (at Request level!)
  ROUND(
    COUNT(DISTINCT r.id) FILTER (WHERE q.status = 'converted')::NUMERIC /
    NULLIF(COUNT(r.id), 0) * 100, 1
  ) as true_conversion_rate,
  
  -- Quote approval rate (secondary)
  ROUND(
    COUNT(DISTINCT rq.quote_id) FILTER (WHERE q.status = 'converted')::NUMERIC /
    NULLIF(COUNT(DISTINCT rq.quote_id), 0) * 100, 1
  ) as quote_approval_rate

FROM service_requests r
LEFT JOIN request_quotes rq ON rq.request_id = r.id
LEFT JOIN quotes q ON q.id = rq.quote_id
GROUP BY DATE_TRUNC('month', r.created_at), r.business_unit_id
ORDER BY month DESC;
```

### Indexes

```sql
-- Service Requests
CREATE INDEX idx_requests_status ON service_requests(status);
CREATE INDEX idx_requests_business_unit ON service_requests(business_unit_id);
CREATE INDEX idx_requests_assessment_date ON service_requests(assessment_date) WHERE has_assessment = true;
CREATE INDEX idx_requests_created_at ON service_requests(created_at);

-- Quotes
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_quotes_business_unit ON quotes(business_unit_id);

-- Jobs
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_crew ON jobs(assigned_crew_id);
CREATE INDEX idx_jobs_scheduled_start ON jobs(scheduled_start_date);

-- Invoices
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_qbo_sync ON invoices(qbo_sync_status);

-- Client Search
CREATE INDEX idx_clients_name_trgm ON clients USING gin(name gin_trgm_ops);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_email ON clients(email);
```

---

## Part 15: Status Transitions

### TypeScript Status Transition Maps

```typescript
// src/features/fsm/services/statusTransitions.ts

export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ['unscheduled', 'scheduled', 'converted', 'archived'],
  unscheduled: ['scheduled', 'converted', 'archived'],
  scheduled: ['today', 'upcoming', 'overdue', 'assessment_complete', 'archived'],
  today: ['assessment_complete', 'archived'],
  upcoming: ['today', 'overdue', 'assessment_complete', 'archived'],
  overdue: ['assessment_complete', 'archived'],
  assessment_complete: ['converted', 'archived'],
  converted: [],  // Final
  archived: [],   // Final
};

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['awaiting_response', 'archived'],
  awaiting_response: ['approved', 'changes_requested', 'declined'],
  changes_requested: ['draft', 'archived'],
  approved: ['converted'],
  converted: [],  // Final
  declined: ['archived'],
  archived: [],   // Final
};

export const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  created: ['unscheduled'],
  unscheduled: ['ready'],
  
  // Material prep pipeline (CRITICAL - matches existing yard system)
  ready: ['picking'],
  picking: ['staged'],
  staged: ['loaded'],
  loaded: ['scheduled'],
  
  scheduled: ['today', 'upcoming', 'overdue'],
  today: ['in_progress'],
  upcoming: ['today', 'overdue'],
  overdue: ['in_progress', 'action_needed'],
  
  in_progress: ['action_needed', 'paused', 'requires_invoicing'],
  action_needed: ['in_progress', 'paused'],
  paused: ['in_progress', 'action_needed'],
  
  requires_invoicing: ['completed'],
  completed: [],  // Final
};

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['awaiting_payment'],
  awaiting_payment: ['past_due', 'paid'],
  past_due: ['paid', 'bad_debt'],
  paid: [],      // Final
  bad_debt: [],  // Final
};

// Validation function
export function canTransition<T extends string>(
  currentStatus: T,
  newStatus: T,
  transitionMap: Record<T, T[]>
): boolean {
  const allowedTransitions = transitionMap[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

// Usage
if (!canTransition(request.status, newStatus, REQUEST_TRANSITIONS)) {
  throw new Error(`Cannot transition from ${request.status} to ${newStatus}`);
}
```

### Auto-Status Updates (Date-Based)

```typescript
// Scheduled job to run daily at midnight
async function updateDateBasedStatuses(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Requests: scheduled → today (assessment date is today)
  await supabase
    .from('service_requests')
    .update({ status: 'today', status_updated_at: new Date() })
    .eq('status', 'scheduled')
    .eq('assessment_date', today.toISOString().split('T')[0]);
  
  // Requests: scheduled/upcoming → overdue (assessment date passed)
  await supabase
    .from('service_requests')
    .update({ status: 'overdue', status_updated_at: new Date() })
    .in('status', ['scheduled', 'upcoming'])
    .lt('assessment_date', today.toISOString().split('T')[0]);
  
  // Jobs: scheduled → today (start date is today)
  await supabase
    .from('jobs')
    .update({ status: 'today', status_updated_at: new Date() })
    .eq('status', 'scheduled')
    .eq('scheduled_start_date', today.toISOString().split('T')[0]);
  
  // Invoices: awaiting_payment → past_due (due date passed)
  await supabase
    .from('invoices')
    .update({ status: 'past_due', status_updated_at: new Date() })
    .eq('status', 'awaiting_payment')
    .lt('due_date', today.toISOString().split('T')[0]);
}
```

---

## Part 16: Project Structure

### Folder Organization

```
src/features/fsm/
├── types.ts                           # All FSM types
├── constants.ts                       # Status enums, transitions
│
├── pages/
│   ├── RequestsPage.tsx               # Request queue/list
│   ├── RequestDetailPage.tsx          # Single request view
│   ├── NewRequestPage.tsx             # Request creation (Workiz-style)
│   ├── QuotesPage.tsx                 # Quote list
│   ├── QuoteBuilderPage.tsx           # Quote creation with BOM
│   ├── QuoteDetailPage.tsx            # Single quote view
│   ├── JobsPage.tsx                   # Job list
│   ├── JobDetailPage.tsx              # Single job view
│   ├── ScheduleCalendarPage.tsx       # Calendar view
│   ├── InvoicesPage.tsx               # Invoice list
│   └── InvoiceDetailPage.tsx          # Single invoice view
│
├── components/
│   ├── common/
│   │   ├── StatusBadge.tsx            # Status display
│   │   ├── StatusTransitionButton.tsx # Action buttons
│   │   ├── ClientLookup.tsx           # Smart client search
│   │   ├── PropertyLookup.tsx         # Smart property search
│   │   └── AssignmentSelector.tsx     # Rep/Crew selector with AI
│   │
│   ├── requests/
│   │   ├── RequestCard.tsx
│   │   ├── RequestForm.tsx
│   │   ├── AssessmentScheduler.tsx
│   │   └── RequestTimeline.tsx
│   │
│   ├── quotes/
│   │   ├── QuoteCard.tsx
│   │   ├── QuoteOptionEditor.tsx
│   │   ├── QuoteSummary.tsx
│   │   ├── ApprovalBanner.tsx
│   │   └── QuotePDF.tsx
│   │
│   ├── jobs/
│   │   ├── JobCard.tsx
│   │   ├── MaterialPrepStatus.tsx     # Your unique pipeline UI
│   │   ├── VisitScheduler.tsx
│   │   ├── CrewAssignment.tsx
│   │   └── JobTimeline.tsx
│   │
│   ├── invoices/
│   │   ├── InvoiceCard.tsx
│   │   ├── InvoiceLineItems.tsx
│   │   ├── PaymentRecorder.tsx
│   │   └── InvoicePDF.tsx
│   │
│   └── scheduling/
│       ├── CalendarView.tsx
│       ├── CapacityBoard.tsx
│       └── TerritoryMap.tsx
│
├── services/
│   ├── requestService.ts
│   ├── quoteService.ts
│   ├── jobService.ts
│   ├── invoiceService.ts
│   ├── paymentService.ts
│   ├── statusTransitions.ts
│   ├── clientSearch.ts
│   ├── schedulingAI.ts
│   └── qboSync.ts
│
├── hooks/
│   ├── useRequests.ts
│   ├── useQuotes.ts
│   ├── useJobs.ts
│   ├── useInvoices.ts
│   ├── useClientSearch.ts
│   ├── useSchedulingSuggestions.ts
│   └── useStatusTransition.ts
│
└── utils/
    ├── formatters.ts
    ├── validators.ts
    └── calculations.ts
```

---

## Part 17: Implementation Roadmap

### Phase 1: Request Module (Weeks 1-4)

**Week 1: Database & Types**
- [ ] Create service_requests table
- [ ] Create request_quotes junction table
- [ ] Add FSM types to types.ts
- [ ] Create status transition map
- [ ] Create auto-number sequence

**Week 2: Request Creation UI**
- [ ] Build NewRequestPage with Workiz-style layout
- [ ] Build ClientLookup component (smart search)
- [ ] Build PropertyLookup component
- [ ] Build AssessmentScheduler toggle

**Week 3: Request Queue & Detail**
- [ ] Build RequestsPage with filters
- [ ] Build RequestCard component
- [ ] Build RequestDetailPage
- [ ] Build StatusTransitionButton

**Week 4: Assessment Flow**
- [ ] Build AI scheduling suggestion
- [ ] Build territory lookup
- [ ] Build Convert to Quote action
- [ ] Set up daily status update job

### Phase 2: Quote Enhancement (Weeks 5-7)

**Week 5: Quote Options**
- [ ] Add quote_options table
- [ ] Build QuoteOptionEditor (Good/Better/Best)
- [ ] Integrate BOM Calculator for each option

**Week 6: Approval Workflow**
- [ ] Add approval_settings table
- [ ] Build ApprovalBanner component
- [ ] Build approval check logic
- [ ] Manager approval flow

**Week 7: Quote Sending**
- [ ] Build QuotePDF generator
- [ ] Client approval flow
- [ ] Convert to Job action

### Phase 3: Job & Material Prep (Weeks 8-11)

**Week 8: Job Creation**
- [ ] Create jobs table (aligned with existing statuses!)
- [ ] Create job_visits table
- [ ] Quote → Job conversion service
- [ ] JobDetailPage

**Week 9: Material Prep Pipeline**
- [ ] MaterialPrepStatus component
- [ ] Integration with existing yard workflow
- [ ] Send to Yard action
- [ ] Yard mobile app updates

**Week 10: Crew Assignment**
- [ ] Build CrewAssignment component
- [ ] Build CapacityBoard
- [ ] AI crew suggestion

**Week 11: Job Visits**
- [ ] Build VisitScheduler
- [ ] Build CalendarView with FullCalendar
- [ ] Job completion flow

### Phase 4: Inventory (Weeks 12-14)

**Week 12: Inventory Schema**
- [ ] Create inventory_locations table
- [ ] Create inventory_items table
- [ ] Create inventory_transactions table

**Week 13: Inventory UI**
- [ ] Inventory dashboard
- [ ] Stock management
- [ ] Transfer workflow

**Week 14: Auto-Consumption**
- [ ] BOM → Inventory consumption on job complete
- [ ] Replenishment alerts
- [ ] Inventory reports

### Phase 5: Invoicing & Payment (Weeks 15-16)

**Week 15: Invoices**
- [ ] Create invoices table with QBO fields
- [ ] Job → Invoice creation
- [ ] InvoicePDF generator
- [ ] Invoice sending

**Week 16: Payments**
- [ ] Create payments table
- [ ] Payment recording
- [ ] QBO sync implementation

### Phase 6: Reporting (Weeks 17-18)

**Week 17: Dashboard**
- [ ] Opportunity funnel view
- [ ] Pipeline metrics
- [ ] Conversion tracking

**Week 18: Team Performance**
- [ ] Sales scorecards
- [ ] Crew scorecards
- [ ] Operational metrics

---

## Part 18: Testing Scenarios

### Happy Path

1. **Create Request** (phone call from new customer)
   - Start typing customer name → No match found → Create new client inline
   - Enter property address → Territory auto-assigned
   - Toggle assessment ON → AI suggests best available rep
   - Save → Status: `pending`

2. **Schedule Assessment**
   - Dispatcher assigns date/time/rep
   - Status: `scheduled`
   - Day arrives → Status: `today`

3. **Complete Assessment**
   - Rep visits, takes photos, notes
   - Mark assessment complete
   - Status: `assessment_complete`

4. **Create Quote**
   - Convert Request to Quote
   - Use BOM Calculator for fence specs
   - Create Good/Better/Best options
   - Margin = 18% → No approval needed
   - Send to client
   - Status: `awaiting_response`

5. **Client Approves**
   - Client views in portal
   - Selects "Better" option
   - Signs digitally
   - Status: `approved`

6. **Convert to Job**
   - Convert Quote to Job
   - Status: `created`

7. **Schedule & Send to Yard**
   - Assign crew + date
   - Send to yard → Status: `ready`

8. **Yard Workflow**
   - Yard claims pick → Status: `picking`
   - Materials staged → Status: `staged`
   - Loaded on truck → Status: `loaded`

9. **Installation**
   - Scheduled day → Status: `today`
   - Crew arrives → Status: `in_progress`
   - Work complete → Status: `requires_invoicing`

10. **Invoice & Payment**
    - Create invoice from job
    - Send to client
    - Client pays
    - Invoice Status: `paid`
    - Job Status: `completed`

### Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Unknown zip code | Show warning, allow manual territory assignment |
| Client not in system | Smart lookup offers "Create new" option |
| Phone/email matches existing | Show existing client, prevent duplicate |
| Quote > $25,000 | Requires manager approval before sending |
| Margin < 15% | Requires manager approval |
| Discount > 10% | Requires manager approval |
| No crew available | Show capacity warning, suggest alternative dates |
| Material out of stock | Block "Send to Yard" until inventory available |
| Weather delay | Status → `paused`, can resume |
| Client requests changes | Quote status → `changes_requested`, back to draft |
| Invoice past due 30+ days | Auto-escalate to configured contacts |

---

## Part 19: Library Reference

| Need | Library | Status | Notes |
|------|---------|--------|-------|
| Calendar | FullCalendar | Recommended | For crew scheduling |
| Drag & Drop | @dnd-kit | Already installed | For calendar, kanban |
| Forms | React Hook Form + Zod | Already using | All forms |
| PDF Generation | @react-pdf/renderer | Already installed | Quotes, invoices |
| CSV Import/Export | Papa Parse | Recommended | Bulk operations |
| Data Tables | TanStack Table | Already using | All list views |
| Charts | Recharts | Recommended | Dashboard |
| Maps | Mapbox GL or Google Maps | Recommended | Territory management |
| Date Handling | date-fns | Already using | Date calculations |

---

## Appendix A: QBO API Endpoints

```typescript
// QuickBooks Online API endpoints for integration

// Customers
POST   /v3/company/{realmId}/customer
GET    /v3/company/{realmId}/customer/{customerId}
POST   /v3/company/{realmId}/query?query=SELECT * FROM Customer

// Invoices
POST   /v3/company/{realmId}/invoice
GET    /v3/company/{realmId}/invoice/{invoiceId}
POST   /v3/company/{realmId}/invoice?operation=send  // Email invoice
DELETE /v3/company/{realmId}/invoice/{invoiceId}?operation=void

// Payments
POST   /v3/company/{realmId}/payment
GET    /v3/company/{realmId}/payment/{paymentId}

// Classes (Business Units)
GET    /v3/company/{realmId}/query?query=SELECT * FROM Class

// Webhooks (for sync status)
POST   /v3/company/{realmId}/webhooks
```

---

## Appendix B: Supabase Edge Function for Daily Status Updates

```typescript
// supabase/functions/daily-status-update/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  const today = new Date().toISOString().split('T')[0]
  
  // Requests: scheduled → today
  await supabase.rpc('update_request_statuses_to_today', { target_date: today })
  
  // Requests: scheduled/upcoming → overdue
  await supabase.rpc('update_request_statuses_to_overdue', { target_date: today })
  
  // Jobs: scheduled → today
  await supabase.rpc('update_job_statuses_to_today', { target_date: today })
  
  // Jobs: scheduled/upcoming → overdue
  await supabase.rpc('update_job_statuses_to_overdue', { target_date: today })
  
  // Invoices: awaiting_payment → past_due
  await supabase.rpc('update_invoice_statuses_to_past_due', { target_date: today })
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

---

*Document Version: 2.0*  
*Last Updated: December 2024*  
*Status: Ready for Implementation*

---

## Next Steps

1. **Review this document** for any adjustments
2. **Share UI mockups** for fine-tuning specific pages
3. **Create first handoff document** for Claude Code (suggest: Request Module)
4. **Begin Phase 1 implementation**
