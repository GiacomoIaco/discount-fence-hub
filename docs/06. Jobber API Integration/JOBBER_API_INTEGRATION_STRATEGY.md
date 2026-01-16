# Jobber API Integration Strategy Analysis

> **Created**: 2026-01-15
> **Status**: Planning Phase
> **Accounts**: Residential, Builders, Commercial (3 separate Jobber accounts)

## Executive Summary

You're in an excellent position to create a **hybrid architecture** that leverages Jobber's strengths (consumer-facing payments, financing, mobile crew app) while using DFU for your unique competitive advantages (BOM calculation, yard management, unified analytics, advanced pricing).

---

## 1. Jobber API Capabilities

Based on [Jobber's Developer Documentation](https://developer.getjobber.com/docs/) and [API Essentials](https://rollout.com/integration-guides/jobber/api-essentials):

### What You CAN Do via API

| Object | Read | Create | Update | Delete | Webhooks |
|--------|------|--------|--------|--------|----------|
| **Clients** | ✅ | ✅ | ✅ | ✅ | CLIENT_CREATE |
| **Properties** | ✅ | ✅ | ✅ | ✅ | - |
| **Requests** | ✅ | ✅ | ✅ | - | REQUEST_CREATE |
| **Quotes** | ✅ | ✅ | ✅ | - | QUOTE_CREATE, QUOTE_APPROVAL |
| **Jobs** | ✅ | ✅ | ✅ | - | JOB_COMPLETE |
| **Invoices** | ✅ | ✅ | ✅ | - | INVOICE_CREATE |
| **Custom Fields** | ✅ | ✅ | ✅ | ✅ | - |
| **Users/Team** | ✅ | Limited | Limited | - | - |
| **Assessments** | ✅ | ✅ | ✅ | - | - |
| **Notes/Tags** | ✅ | ✅ | ✅ | - | - |

### What's NOT in API (or Limited)

| Feature | API Access | Notes |
|---------|------------|-------|
| **Payments** | ❌ Read-only | Can't process payments via API |
| **Wisetack Financing** | ❌ None | UI-only, auto-added to quotes $500-$25K |
| **Time Tracking** | ⚠️ Read-only | Can query timesheet entries, can't start timers |
| **Scheduling Calendar** | ⚠️ Limited | Can set scheduled_start, but not drag/drop UI |
| **GPS/Location** | ❌ None | Mobile app only |
| **Crew Mobile App** | ❌ None | Separate mobile experience |
| **Products/Services** | ⚠️ Limited | Read-only pricing catalog |

---

## 2. Feature Comparison: Jobber vs DFU

### Core FSM Lifecycle

| Stage | Jobber | DFU | Winner | Integration Strategy |
|-------|--------|-----|--------|---------------------|
| **Request Intake** | ✅ Web forms, phone | ✅ Builder portal, phone | Tie | Sync both ways |
| **Quote Building** | ✅ Basic line items | ✅ **BOM-driven, options, pricing tiers** | **DFU** | Create in DFU → Push to Jobber |
| **Quote Approval** | ✅ Customer portal | ✅ Manager approval | Tie | Webhook on approval |
| **Quote → Job** | ✅ One click | ✅ Automated | Tie | Sync on conversion |
| **Job Scheduling** | ✅ Drag/drop calendar | ✅ Crew capacity view | **Jobber** | Jobber = source of truth |
| **Crew Mobile** | ✅ **Full app, GPS, timers** | ⚠️ Limited | **Jobber** | Use Jobber mobile |
| **Time Tracking** | ✅ **Location-based auto** | ❌ None | **Jobber** | Pull timesheet data |
| **Invoicing** | ✅ Send + pay | ✅ QBO sync | Tie | Push invoice from DFU |
| **Payments** | ✅ **Card, ACH, Wisetack** | ❌ QBO only | **Jobber** | Use Jobber payments |
| **Financing** | ✅ **Wisetack 0% APR** | ❌ None | **Jobber** | Use Jobber for Residential |

### Your Unique Advantages (DFU)

| Feature | Jobber | DFU | Notes |
|---------|--------|-----|-------|
| **BOM Calculator** | ❌ None | ✅ **Formula-based, component calculation** | Massive differentiator |
| **Bill of Labor** | ❌ None | ✅ **Labor codes, crew pay, piece rate** | Critical for costing |
| **Yard Management** | ❌ None | ✅ **Pick lists, staging, spot assignment** | Unique capability |
| **Inventory Tracking** | ❌ None | ✅ **SKU catalog, material pricing** | Connects to BOM |
| **Advanced Pricing** | ❌ Basic | ✅ **Price books, rate sheets, tiered** | Builder-specific |
| **Territory Management** | ❌ Basic | ✅ **ZIP-based, rep assignment, QBO class** | Multi-location support |
| **Unified Analytics** | ❌ Per-account | ✅ **Cross-account, cycle time, attribution** | Already built! |
| **Multi-Account** | ❌ Separate silos | ✅ **Unified view across 3 Jobber accounts** | Key advantage |
| **Custom Fields** | ⚠️ Limited | ✅ **Unlimited, typed, per-entity** | More flexible |

---

## 3. Proposed Integration Architecture

### The Hybrid Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DISCOUNT FENCE HUB (DFU)                        │
│                         "The Brain & Unified View"                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   ANALYTICS  │  │     BOM      │  │     YARD     │  │   PRICING   │  │
│  │   Unified    │  │  Calculator  │  │  Management  │  │  PriceBooks │  │
│  │   Dashboard  │  │  + Bill of   │  │  Pick Lists  │  │  Rate Sheets│  │
│  │              │  │    Labor     │  │  Inventory   │  │  Territory  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    FSM ORCHESTRATION LAYER                        │   │
│  │  • Quote creation with BOM → Push to Jobber                      │   │
│  │  • Job lifecycle sync (bidirectional)                            │   │
│  │  • Pull timesheet data for labor costing                         │   │
│  │  • Unified customer/property database                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  JOBBER ACCOUNT │      │  JOBBER ACCOUNT │      │  JOBBER ACCOUNT │
│   RESIDENTIAL   │      │    BUILDERS     │      │   COMMERCIAL    │
├─────────────────┤      ├─────────────────┤      ├─────────────────┤
│ • Crew Mobile   │      │ • Crew Mobile   │      │ • Crew Mobile   │
│ • Scheduling    │      │ • Scheduling    │      │ • Scheduling    │
│ • Time Tracking │      │ • Time Tracking │      │ • Time Tracking │
│ • Payments      │      │ • Payments (?)  │      │ • Payments      │
│ • Wisetack      │      │   (less needed) │      │                 │
│   Financing     │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## 4. Division-Specific Strategy

### Residential Division → **Keep in Jobber + Sync**

**Why**: Wisetack financing is a competitive advantage for residential. Consumer payments are critical.

| Feature | Where | Rationale |
|---------|-------|-----------|
| Request intake | Jobber | Consumer-facing forms |
| Quote creation | **DFU** | BOM calculation, then push |
| Quote sending | Jobber | Wisetack auto-embeds financing |
| Customer approval | Jobber | Portal experience |
| Scheduling | Jobber | Crew calendar, GPS |
| Crew mobile | Jobber | Time tracking, photos |
| Payments | Jobber | Card/ACH/Wisetack |
| Analytics | **DFU** | Unified view |
| Yard prep | **DFU** | Pick lists, staging |

### Builder Division → **Move to DFU + Optional Jobber**

**Why**: Builders don't need Wisetack. Your price books, rate sheets, and BOM are key differentiators. Payment is typically check/ACH 30-60 days.

| Feature | Where | Rationale |
|---------|-------|-----------|
| Request intake | **DFU** | Builder portal |
| Quote creation | **DFU** | BOM + custom pricing |
| Quote sending | **DFU** | PDF or builder portal |
| Job management | **DFU** | Full FSM lifecycle |
| Scheduling | Jobber OR DFU | Could use either |
| Crew mobile | Jobber | Time tracking (pull data) |
| Payments | **QBO** | Net 30/60 invoicing |
| Yard prep | **DFU** | Pick lists, staging |
| Analytics | **DFU** | Unified view |

### Commercial Division → **Hybrid (Similar to Residential)**

**Why**: Mix of consumer-like jobs and larger projects. Keep flexibility.

---

## 5. Data Flow Architecture

### A. Quote Creation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        QUOTE CREATION IN DFU                         │
│                                                                      │
│  1. Rep selects customer/property                                   │
│  2. Chooses product type (wood vertical, horizontal, iron)          │
│  3. Enters linear footage, gates, etc.                              │
│  4. BOM Calculator generates:                                       │
│     • Materials (posts, pickets, rails, hardware)                   │
│     • Labor (codes, hours, crew pay)                                │
│     • Pricing (from price book or rate sheet)                       │
│  5. Rep reviews, adjusts, saves                                     │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PUSH TO JOBBER VIA API                          │
│                                                                      │
│  GraphQL Mutation: quoteCreate                                      │
│  • Map DFU quote to Jobber line items                               │
│  • Attach to Jobber client (sync first if needed)                   │
│  • Set custom fields: DFU_QUOTE_ID, BOM_REFERENCE                   │
│  • On success: Store jobber_quote_id in DFU                         │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      JOBBER HANDLES DELIVERY                         │
│                                                                      │
│  • Wisetack financing auto-embedded (for $500-$25K)                 │
│  • Customer receives quote via email/SMS                            │
│  • Customer can approve via portal                                  │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    WEBHOOK: QUOTE_APPROVAL                           │
│                                                                      │
│  • Jobber POSTs to DFU webhook endpoint                             │
│  • DFU marks quote as accepted                                      │
│  • Auto-creates Job in DFU                                          │
│  • Syncs Job to Jobber if needed                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### B. Unified Analytics Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NIGHTLY SYNC JOB (Netlify Function)               │
│                                                                      │
│  For each Jobber account (RES, BUILDER, COMMERCIAL):                │
│                                                                      │
│  1. Query jobs closed since last sync                               │
│     query { jobs(filter: { closedAfter: "2026-01-14" }) { ... } }   │
│                                                                      │
│  2. Query timesheet entries for labor hours                         │
│     query { timesheetEntries(filter: { ... }) { ... } }             │
│                                                                      │
│  3. Query invoices for payment status                               │
│     query { invoices(filter: { ... }) { ... } }                     │
│                                                                      │
│  4. Upsert into DFU tables:                                         │
│     • jobber_jobs (all accounts in one table)                       │
│     • jobber_timesheet_entries                                      │
│     • jobber_invoices                                               │
│                                                                      │
│  5. Compute derived metrics:                                        │
│     • Cycle time (create → schedule → close)                        │
│     • Effective salesperson (your attribution logic)                │
│     • Labor cost vs revenue (profitability)                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### C. Yard Management Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│                      YARD WORKFLOW (DFU ONLY)                        │
│                                                                      │
│  This is 100% in DFU - Jobber has no equivalent                    │
│                                                                      │
│  1. Job scheduled in Jobber → Webhook to DFU                        │
│  2. DFU sees job is "ready_for_yard" (2 days before)               │
│  3. Yard worker opens DFU Yard Schedule:                            │
│     • Sees list of jobs to pick                                     │
│     • Each job has BOM-generated pick list                          │
│     • Materials linked to SKU catalog with locations                │
│  4. Yard worker picks materials:                                    │
│     • Scans/checks off items                                        │
│     • Assigns to staging spot                                       │
│  5. Status updates: picking → staged → loaded                       │
│  6. Crew lead signs off (CrewSignoffModal)                         │
│  7. Photos captured of loaded truck                                 │
│                                                                      │
│  Jobber only knows: "Job is scheduled"                              │
│  DFU knows: All the material prep details                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Roadmap

### Phase 1: OAuth + Read-Only Sync (Foundation)

| Task | Description |
|------|-------------|
| OAuth flow | Netlify function for Jobber OAuth 2.0, store tokens per account |
| Account linking | UI to connect each Jobber account (RES, BUILDER, COM) |
| Read sync | Pull jobs, quotes, invoices, timesheets nightly |
| Unified tables | `jobber_unified_jobs` with `account_type` column |
| Analytics update | Modify existing Jobber analytics to use unified tables |

### Phase 2: Bidirectional Client/Property Sync

| Task | Description |
|------|-------------|
| Client sync | DFU → Jobber when creating new client |
| Property sync | DFU → Jobber for properties |
| Custom fields | Create DFU_CLIENT_ID, DFU_PROPERTY_ID in Jobber |
| Conflict resolution | DFU is source of truth for client data |

### Phase 3: Quote Push (DFU → Jobber)

| Task | Description |
|------|-------------|
| Quote mapping | Transform DFU quote (with BOM) to Jobber line items |
| API integration | `quoteCreate` mutation |
| Link storage | Store `jobber_quote_id` in DFU |
| Webhook handler | Listen for QUOTE_APPROVAL |

### Phase 4: Job Sync + Yard Integration

| Task | Description |
|------|-------------|
| Job create | When quote approved, create Job in both systems |
| Schedule sync | When Jobber schedules, update DFU |
| Yard trigger | When scheduled_date - 2 days, trigger yard workflow |
| Status sync | Keep DFU and Jobber job status aligned |

### Phase 5: Timesheet + Labor Costing

| Task | Description |
|------|-------------|
| Timesheet pull | Query Jobber timesheets for each job |
| Labor cost calc | Match timesheet hours to DFU labor codes |
| Profitability | Compare actual labor to BOM estimate |
| Dashboard | Add labor cost analysis to analytics |

---

## 7. Key Integration Endpoints

### Webhooks to Configure in Jobber

| Event | DFU Endpoint | Action |
|-------|--------------|--------|
| `CLIENT_CREATE` | `/api/jobber/webhook/client` | Sync to DFU if not exists |
| `REQUEST_CREATE` | `/api/jobber/webhook/request` | Create DFU request |
| `QUOTE_CREATE` | `/api/jobber/webhook/quote` | Link if originated from DFU |
| `QUOTE_APPROVAL` | `/api/jobber/webhook/quote-approval` | Mark DFU quote accepted, create Job |
| `JOB_COMPLETE` | `/api/jobber/webhook/job-complete` | Update DFU, trigger invoice |
| `INVOICE_CREATE` | `/api/jobber/webhook/invoice` | Link to DFU invoice |

### API Queries to Run (Nightly Sync)

```graphql
# Get jobs updated since last sync
query JobsSync($after: DateTime!) {
  jobs(filter: { updatedAfter: $after }) {
    nodes {
      id
      jobNumber
      title
      client { id name }
      property { id address }
      status
      total
      createdAt
      scheduledStartAt
      closedAt
      customFields { ... }
    }
  }
}

# Get timesheet entries for labor costing
query TimesheetSync($after: DateTime!) {
  timesheetEntries(filter: { updatedAfter: $after }) {
    nodes {
      id
      user { id name }
      job { id jobNumber }
      startAt
      endAt
      duration
      laborRate
    }
  }
}
```

---

## 8. Decision Points

### Q1: Where should scheduling live?

| Option | Pros | Cons |
|--------|------|------|
| **Jobber only** | Crews already know it, GPS, mobile | Need to sync to DFU for yard timing |
| **DFU only** | Full control, integrated with yard | Crews learn new tool, no GPS auto-tracking |
| **Both (sync)** | Best of both | Complexity, potential conflicts |

**Recommendation**: Jobber for scheduling, DFU subscribes via webhook.

### Q2: Should Builders move fully to DFU?

| Option | Pros | Cons |
|--------|------|------|
| **Fully DFU** | No Jobber license cost, full control | Crews lose familiar mobile app |
| **Hybrid** | Crews use Jobber mobile, DFU for back office | Need to maintain sync |

**Recommendation**: Hybrid initially. Use Jobber for crew mobile/scheduling, DFU for everything else.

### Q3: How to handle Jobber IDs?

Store Jobber IDs in DFU for linked records:
- `fsm_quotes.jobber_quote_id`
- `fsm_jobs.jobber_job_id`
- `clients.jobber_client_id`
- `properties.jobber_property_id`

---

## 9. Quick Wins (Start Here)

1. **OAuth setup** - Connect your 3 Jobber accounts to DFU
2. **Unified analytics** - You already have the analytics built! Just add API fetch instead of CSV import
3. **Timesheet pull** - Get labor hours to compare against your Bill of Labor estimates
4. **Customer sync** - When creating a customer in DFU, push to the appropriate Jobber account

---

## Sources

- [Jobber Developer Documentation](https://developer.getjobber.com/docs/)
- [Jobber API Queries and Mutations](https://developer.getjobber.com/docs/using_jobbers_api/api_queries_and_mutations/)
- [Jobber API Essentials - Rollout](https://rollout.com/integration-guides/jobber/api-essentials)
- [Jobber Wisetack Integration](https://help.getjobber.com/hc/en-us/articles/360056100954-Jobber-and-Wisetack-Consumer-Financing-Integration)
- [Jobber Time Tracking Features](https://www.getjobber.com/features/time-and-job-tracking-software/)
