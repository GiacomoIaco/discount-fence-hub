# Jobber Integration Master Plan

> **Created**: 2026-01-15
> **Last Updated**: 2026-01-15
> **Status**: Phase 1 Complete (OAuth), Phase 2 Ready
> **Accounts**: Residential (connected), Builders (pending), Commercial (pending)

---

## Executive Summary

**DFU is the "operational brain"** - all BOM, BOL, yard, scheduling, and profitability lives here.
**Jobber is the "customer-facing layer"** for Residential - consumer payments, Wisetack financing.
**Builders move fully to DFU** - no consumer payment needs, leverage advanced pricing.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Division-Specific Strategy](#2-division-specific-strategy)
3. [Data Flow Diagrams](#3-data-flow-diagrams)
4. [Jobber API Capabilities](#4-jobber-api-capabilities)
5. [Integration Points](#5-integration-points)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Technical Reference](#7-technical-reference)
8. [Concerns & Mitigations](#8-concerns--mitigations)
9. [Alternative Ideas](#9-alternative-ideas)

---

## 1. Architecture Overview

### The Hybrid Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DISCOUNT FENCE HUB (DFU)                            │
│                         "The Operational Brain"                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   ANALYTICS  │  │     BOM      │  │     YARD     │  │    PRICING      │  │
│  │   Unified    │  │  Calculator  │  │  Management  │  │  PriceBooks     │  │
│  │   Dashboard  │  │  + Bill of   │  │  Pick Lists  │  │  Rate Sheets    │  │
│  │   (3 accts)  │  │    Labor     │  │  Staging     │  │  → Sync Jobber  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘  │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  SCHEDULING  │  │   CREW APP   │  │   INVENTORY  │  │   QBO SYNC      │  │
│  │  AI-Optimized│  │   (PWA)      │  │   Tracking   │  │   (All Divs)    │  │
│  │  Centralized │  │  Builders 1st│  │   + POs      │  │                 │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘  │
│                                                                              │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│    BUILDERS   │      │  RESIDENTIAL  │      │  COMMERCIAL   │
│   (ALL DFU)   │      │   (HYBRID)    │      │   (HYBRID)    │
├───────────────┤      ├───────────────┤      ├───────────────┤
│ No Jobber     │      │ Jobber for:   │      │ Similar to    │
│ dependency    │      │ • Requests    │      │ Residential   │
│               │      │ • Quotes      │      │               │
│ DFU handles:  │      │ • Invoices    │      │               │
│ • Everything  │      │ • Payments    │      │               │
│               │      │ • Wisetack    │      │               │
│ Invoice → QBO │      │               │      │               │
│ (Net 30/60)   │      │ DFU handles:  │      │               │
│               │      │ • Pricing sync│      │               │
│               │      │ • BOM/BOL     │      │               │
│               │      │ • Yard        │      │               │
│               │      │ • Scheduling  │      │               │
│               │      │ • QBO sync    │      │               │
└───────────────┘      └───────────────┘      └───────────────┘
```

---

## 2. Division-Specific Strategy

### BUILDERS - Fully DFU

| Component | System | Notes |
|-----------|--------|-------|
| Request | DFU | Builder Portal |
| Assessment | DFU | - |
| Quote | DFU | Full BOM, PriceBook, profitability shown |
| Job Creation | DFU | - |
| Job Sub-status | DFU | picking → staged → loaded → complete |
| BOM / BOL | DFU | Calculated during quoting |
| Yard | DFU | Pick lists, staging |
| Scheduling | DFU | AI-optimized, centralized |
| Crew App | DFU | **Build first for Builders** (currently text messages) |
| Invoice | DFU → QBO | Net 30/60 terms |
| Profitability | DFU | Full visibility |

### RESIDENTIAL - Hybrid (Jobber Sales + DFU Ops)

| Component | System | Notes |
|-----------|--------|-------|
| Request | Jobber | Consumer web forms |
| Assessment | Jobber | Calendar scheduling |
| Quote | Jobber | **Using products synced from DFU PriceBook** |
| PriceBook/Rate Sheet | DFU → Jobber | Sync products when prices change |
| Customer Approval | Jobber | Wisetack financing auto-embeds |
| Job Creation | Jobber → DFU | Webhook triggers DFU job creation |
| Job Sub-status | DFU | picking → staged → loaded → complete |
| BOM / BOL | DFU | **Calculated when job created** (post-approval) |
| Yard | DFU | Pick lists, staging |
| Scheduling | DFU → Jobber | Centralized in DFU, pushed to Jobber for crew visibility |
| Crew App | Jobber (Phase 1) / DFU (Phase 2) | Transition later |
| Invoice | Jobber | Triggers payment collection |
| Invoice Tracking | Jobber → DFU | Webhook syncs to DFU |
| QBO Sync | DFU | Single integration point |
| Profitability | DFU | Reads from QBO |

### COMMERCIAL - Hybrid (Similar to Residential)

Mix of consumer-like jobs and larger projects. Follow Residential pattern with flexibility.

---

## 3. Data Flow Diagrams

### Residential Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RESIDENTIAL FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐                              ┌─────────────┐               │
│  │   DFU APP   │                              │   JOBBER    │               │
│  │  (Backend)  │                              │  (Frontend) │               │
│  └─────────────┘                              └─────────────┘               │
│                                                                              │
│  PRICING SETUP (One-time + Updates)                                         │
│  ═══════════════════════════════════════════════════════════════════════    │
│  PriceBook / Rate Sheet ──────────────────────► Products & Services         │
│  (fence types, pricing)      PUSH              (synced catalog)             │
│                                                                              │
│  REQUEST                                                                     │
│  ═══════════════════════════════════════════════════════════════════════    │
│  DFU Request (mirror) ◄────────────────────── Customer Request              │
│                              WEBHOOK                                         │
│                                                                              │
│  QUOTE                                                                       │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                               Rep builds quote               │
│                                               (using synced products)        │
│                                               Wisetack auto-embeds           │
│                                               Customer approves ─────────┐  │
│                                                                          │  │
│  JOB CREATION                                                            │  │
│  ═══════════════════════════════════════════════════════════════════════ │  │
│  DFU Job created ◄─────────────────────────── Job auto-created ◄─────────┘  │
│       │                      WEBHOOK                                         │
│       │                                                                      │
│       ├── Parse line items → identify products                              │
│       ├── Calculate BOM (materials needed)                                  │
│       ├── Calculate BOL (crew pay)                                          │
│       ├── Track sub-status (won → picking → staged → loaded)               │
│       │                                                                      │
│  SCHEDULING (AI-Optimized)                                                  │
│  ═══════════════════════════════════════════════════════════════════════    │
│       │                                                                      │
│       ├── Assign date + crew                                                │
│       ├── AI considers: location, crew skills, capacity                     │
│       │                                                                      │
│       └── Push schedule ──────────────────────► Job updated                 │
│                              PUSH               (crew sees in Jobber app)    │
│                                                                              │
│  YARD OPERATIONS                                                            │
│  ═══════════════════════════════════════════════════════════════════════    │
│       │                                                                      │
│       ├── Generate pick list from BOM                                       │
│       ├── Yard worker picks materials                                       │
│       ├── Status: picking → staged → loaded                                 │
│       ├── Crew lead signs off                                               │
│       │                                                                      │
│  JOB EXECUTION                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                               Crew sees job in Jobber app   │
│                                               Crew marks complete ───────┐  │
│       │                      WEBHOOK                                     │  │
│  DFU marks complete ◄────────────────────────────────────────────────────┘  │
│       │                                                                      │
│  INVOICE & PAYMENT                                                          │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                               Ops creates invoice            │
│  DFU Invoice (mirror) ◄───────────────────── Invoice sent                   │
│       │                      WEBHOOK          (Wisetack / card available)    │
│       │                                              │                       │
│       │                                       Payment received               │
│  DFU tracks payment ◄─────────────────────────────────┘                     │
│       │                      WEBHOOK                                         │
│       │                                                                      │
│  QBO SYNC                                                                   │
│  ═══════════════════════════════════════════════════════════════════════    │
│       │                                                                      │
│       └── Push to QuickBooks ────────────────► QBO Invoice + Payment        │
│                                                                              │
│  PROFITABILITY                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│       │                                                                      │
│       └── Revenue - Materials - Crew Pay = Margin                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Product Catalog Sync Detail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PRODUCT CATALOG SYNC (DFU → Jobber)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DFU PriceBook (Residential)          Jobber Products/Services              │
│  ─────────────────────────            ────────────────────────              │
│                                                                              │
│  6ft Cedar Privacy Fence              →  "6ft Cedar Privacy Fence"          │
│    Price: $32/LF                          Unit Price: $32                    │
│    Unit: Linear Foot                      Unit: Linear Foot                  │
│                                                                              │
│  8ft Cedar Privacy Fence              →  "8ft Cedar Privacy Fence"          │
│    Price: $42/LF                          Unit Price: $42                    │
│                                                                              │
│  5ft Iron Fence                       →  "5ft Iron Fence"                   │
│    Price: $55/LF                          Unit Price: $55                    │
│                                                                              │
│  Cedar Walk Gate                      →  "Cedar Walk Gate"                  │
│    Price: $450/ea                         Unit Price: $450                   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  SYNC TRIGGERS:                                                              │
│  • Admin updates price in DFU → Auto-push to Jobber                         │
│  • Admin adds new product in DFU → Create in Jobber                         │
│  • Admin deactivates product → Deactivate in Jobber                         │
│                                                                              │
│  MAPPING:                                                                    │
│  • Store jobber_product_id on DFU price_book_items                          │
│  • On sync: match by name or create new                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### BOM Calculation Timing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BOM CALCULATION TIMING                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BUILDERS (Quote in DFU):                                                   │
│  ─────────────────────────                                                  │
│  Rep enters: "200 LF, 6ft Cedar Privacy, Wood Posts"                        │
│       │                                                                      │
│       ▼ BOM runs IMMEDIATELY                                                │
│  • 26 posts, 540 pickets, 78 rails, hardware, concrete                      │
│  • Crew pay calculated                                                      │
│  • Profitability shown BEFORE sending quote                                 │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  RESIDENTIAL (Quote in Jobber):                                             │
│  ─────────────────────────────                                              │
│  Rep quotes: "200 LF, 6ft Cedar Privacy @ $32/LF = $6,400"                  │
│  (No BOM yet - just line item pricing from synced catalog)                  │
│       │                                                                      │
│       ▼ Quote approved → Job created → Webhook                              │
│       │                                                                      │
│       ▼ BOM runs ON JOB CREATION                                            │
│  • Parse line items → identify "6ft Cedar Privacy"                          │
│  • Calculate: 26 posts, 540 pickets, 78 rails, etc.                         │
│  • Generate pick list for yard                                              │
│  • Calculate crew pay                                                       │
│                                                                              │
│  NOTE: Profitability for Residential is based on PriceBook margins          │
│  (prices already set with target margins). Detailed profitability           │
│  calculated post-completion when actual costs known.                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Jobber API Capabilities

### What You CAN Do via API

| Object | Read | Create | Update | Delete | Webhooks |
|--------|------|--------|--------|--------|----------|
| **Clients** | ✅ | ✅ | ✅ | ✅ | CLIENT_CREATE |
| **Properties** | ✅ | ✅ | ✅ | ✅ | - |
| **Requests** | ✅ | ✅ | ✅ | - | REQUEST_CREATE |
| **Quotes** | ✅ | ✅ | ✅ | - | QUOTE_CREATE, QUOTE_APPROVAL |
| **Jobs** | ✅ | ✅ | ✅ | - | JOB_CREATE, JOB_COMPLETE |
| **Invoices** | ✅ | ✅ | ✅ | - | INVOICE_CREATE |
| **Products/Services** | ✅ | ✅ | ✅ | - | - |
| **Custom Fields** | ✅ | ✅ | ✅ | ✅ | - |
| **Users/Team** | ✅ | Limited | Limited | - | - |
| **Scheduled Items** | ✅ | ✅ | ✅ | - | - |

### What's NOT in API (or Limited)

| Feature | API Access | Notes |
|---------|------------|-------|
| **Payments** | ❌ Read-only | Can't process payments via API |
| **Wisetack Financing** | ❌ None | UI-only, auto-added to quotes $500-$25K |
| **GPS/Location** | ❌ None | Mobile app only |
| **Crew Mobile App** | ❌ None | Separate experience |

### GraphQL Endpoint

```
POST https://api.getjobber.com/api/graphql
Headers:
  Authorization: Bearer {access_token}
  Content-Type: application/json
  X-JOBBER-GRAPHQL-VERSION: 2025-01-20
```

---

## 5. Integration Points

### Priority 1: Foundation (Complete)

| # | Integration | Direction | Status |
|---|-------------|-----------|--------|
| ✅ | OAuth Connection | - | **DONE** - Residential connected |
| 🔲 | Connect Builders account | - | Pending |
| 🔲 | Connect Commercial account | - | Pending |

### Priority 2: Product Catalog Sync

| # | Integration | Direction | Trigger |
|---|-------------|-----------|---------|
| 1 | **Product Sync** | DFU → Jobber | PriceBook item created/updated |
| 2 | **Price Update** | DFU → Jobber | Rate sheet changed |

### Priority 3: Request & Job Flow

| # | Integration | Direction | Trigger | Purpose |
|---|-------------|-----------|---------|---------|
| 3 | **Request Sync** | Jobber → DFU | Webhook: REQUEST_CREATE | Mirror for tracking |
| 4 | **Job Creation** | Jobber → DFU | Webhook: JOB_CREATE | Create DFU job, calculate BOM/BOL |
| 5 | **Schedule Push** | DFU → Jobber | Job scheduled in DFU | Crew sees in Jobber app |
| 6 | **Job Completion** | Jobber → DFU | Webhook: JOB_COMPLETE | Update DFU status |

### Priority 4: Billing

| # | Integration | Direction | Trigger | Purpose |
|---|-------------|-----------|---------|---------|
| 7 | **Invoice Sync** | Jobber → DFU | Webhook: INVOICE_CREATE | Track in DFU |
| 8 | **Payment Sync** | Jobber → DFU | Webhook or polling | Update payment status |
| 9 | **QBO Push** | DFU → QBO | Invoice synced to DFU | Accounting |

### Webhooks to Configure in Jobber

| Event | DFU Endpoint | Action |
|-------|--------------|--------|
| `REQUEST_CREATE` | `/.netlify/functions/jobber-webhook` | Create DFU request |
| `JOB_CREATE` | `/.netlify/functions/jobber-webhook` | Create DFU job, run BOM |
| `JOB_COMPLETE` | `/.netlify/functions/jobber-webhook` | Update DFU status |
| `INVOICE_CREATE` | `/.netlify/functions/jobber-webhook` | Track invoice in DFU |
| `QUOTE_UPDATE` | `/.netlify/functions/jobber-webhook` | Sync changes if needed |

---

## 6. Implementation Roadmap

### Phase 1: OAuth + Connection ✅ COMPLETE

- [x] Database: `jobber_tokens`, `jobber_sync_status` tables
- [x] Netlify functions: `jobber-auth`, `jobber-callback`, `jobber-test`, `jobber-status`
- [x] Environment variables configured
- [x] Residential account connected
- [ ] Builders account connected
- [ ] Commercial account connected

### Phase 2: Product Catalog Sync

- [ ] Verify Jobber API supports product create/update
- [ ] Add `jobber_product_id` column to `price_book_items`
- [ ] Create `jobber-sync-products.ts` function
- [ ] Add sync trigger on PriceBook save
- [ ] Test with Residential account

### Phase 3: Webhook Handler

- [ ] Create `jobber-webhook.ts` with HMAC verification
- [ ] Handle REQUEST_CREATE → create DFU request
- [ ] Handle JOB_CREATE → create DFU job + BOM calculation
- [ ] Handle JOB_COMPLETE → update DFU status
- [ ] Handle INVOICE_CREATE → track in DFU
- [ ] Configure webhooks in Jobber Developer Center

### Phase 4: Schedule Push

- [ ] Create `jobber-push-schedule.ts` function
- [ ] Add trigger when job scheduled in DFU
- [ ] Update Jobber job with `scheduledStartAt` and crew info
- [ ] Handle crew assignment (custom field or notes)

### Phase 5: Crew App (Builders)

- [ ] Design DFU Crew PWA
- [ ] Core features: job list, job details, BOM view, completion
- [ ] Deploy to Builders first
- [ ] Iterate based on feedback

### Phase 6: QBO Integration Enhancement

- [ ] Invoice flow: Jobber → DFU → QBO
- [ ] Payment tracking from Jobber
- [ ] Profitability calculation with actual costs

### Phase 7: Crew App (Residential Transition)

- [ ] Evaluate DFU Crew PWA success with Builders
- [ ] Plan transition for Residential crews
- [ ] Maintain Jobber app as fallback

---

## 7. Technical Reference

### OAuth Flow (Implemented)

```
User clicks "Connect Residential"
       │
       ▼
/.netlify/functions/jobber-auth?account=residential
       │
       ▼ Redirect to Jobber
https://api.getjobber.com/api/oauth/authorize?client_id=...&state=jobber_residential_...
       │
       ▼ User authorizes
       │
       ▼ Redirect back
/.netlify/functions/jobber-callback?code=...&state=jobber_residential_...
       │
       ▼ Exchange code for tokens
POST https://api.getjobber.com/api/oauth/token
       │
       ▼ Store in jobber_tokens table
       │
       ▼ Success page
```

### Token Refresh

```typescript
// Tokens expire in 60 minutes
// Auto-refresh on API call if expired

if (tokenExpired) {
  const response = await fetch('https://api.getjobber.com/api/oauth/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: storedRefreshToken,
      client_id: JOBBER_CLIENT_ID,
      client_secret: JOBBER_CLIENT_SECRET,
    }),
  });
  // Update stored tokens
}
```

### Sample GraphQL Queries

```graphql
# Get jobs for sync
query JobsSync($after: ISO8601DateTime) {
  jobs(filter: { updatedAt: { after: $after } }, first: 100) {
    nodes {
      id
      jobNumber
      title
      client { id name }
      property { id street1 city }
      status
      total
      createdAt
      startAt
      endAt
      lineItems {
        nodes {
          name
          quantity
          unitPrice
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

# Update job schedule
mutation UpdateJobSchedule($id: ID!, $startAt: ISO8601DateTime!) {
  jobUpdate(input: { id: $id, startAt: $startAt }) {
    job {
      id
      startAt
    }
    userErrors {
      message
    }
  }
}

# Create/update product
mutation ProductCreate($name: String!, $unitPrice: Float!) {
  productOrServiceCreate(input: {
    name: $name
    unitPrice: $unitPrice
    unitOfMeasure: "Linear Foot"
  }) {
    productOrService {
      id
      name
    }
    userErrors {
      message
    }
  }
}
```

### Environment Variables

```bash
# Jobber OAuth
JOBBER_CLIENT_ID=<your-client-id>
JOBBER_CLIENT_SECRET=<your-client-secret>
JOBBER_REDIRECT_URI=https://discount-fence-hub.netlify.app/.netlify/functions/jobber-callback
JOBBER_API_VERSION=2025-01-20
```

### Database Tables

```sql
-- Token storage (created in migration 243)
CREATE TABLE jobber_tokens (
  id TEXT PRIMARY KEY,  -- 'residential', 'builders', 'commercial'
  account_name TEXT NOT NULL,
  account_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT,
  connected_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync status tracking
CREATE TABLE jobber_sync_status (
  id TEXT PRIMARY KEY,
  last_sync_at TIMESTAMPTZ,
  last_sync_type TEXT,
  last_sync_status TEXT,
  last_error TEXT,
  jobs_synced INTEGER DEFAULT 0,
  quotes_synced INTEGER DEFAULT 0,
  invoices_synced INTEGER DEFAULT 0,
  clients_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Concerns & Mitigations

### Concern 1: Product Catalog Sync API Support

**Issue**: Need to verify Jobber API fully supports product/service create and update.

**Mitigation**:
- Test `productOrServiceCreate` mutation with Residential account
- If limited, alternative: maintain manual product list in Jobber, use custom fields for DFU product ID mapping

### Concern 2: BOM Line Item Parsing

**Issue**: When job comes from Jobber, need to parse line items to identify product types for BOM calculation.

**Mitigation**:
- Establish clear naming conventions (e.g., "6ft Cedar Privacy Fence")
- Store DFU product ID in Jobber line item custom field
- Fallback: fuzzy matching on product name

### Concern 3: Schedule Push - Crew Assignment

**Issue**: Jobber API may not support granular crew assignment the way DFU does.

**Mitigation**:
- Use Jobber's `assignedTo` field if available
- Store crew info in job notes or custom field
- Crew sees schedule in Jobber, detailed assignment in DFU Crew App later

### Concern 4: Race Conditions

**Issue**: If crew marks complete in Jobber while ops updates status in DFU, could conflict.

**Mitigation**:
- DFU is source of truth for detailed status
- Jobber completion webhook triggers DFU update
- DFU status supersedes Jobber status

### Concern 5: Multi-Account Product Sync

**Issue**: Each Jobber account (RES, COM) needs separate product catalog.

**Mitigation**:
- Sync products per account
- Store `jobber_product_id` with account identifier
- Filter PriceBook by BU type when syncing

### Concern 6: Invoice/Payment Timing

**Issue**: Need to understand exact webhook timing for invoices and payments.

**Mitigation**:
- Test INVOICE_CREATE webhook behavior
- May need to poll for payment status if no webhook
- Document exact flow after testing

---

## 9. Alternative Ideas

### Alternative A: BOM Preview Tool for Residential

Instead of calculating BOM only after job creation, provide a "BOM Preview" calculator:
- Rep enters footage in a DFU tool (not full quote)
- Shows material breakdown and profitability
- Rep uses info to confirm pricing in Jobber
- Still quotes in Jobber for Wisetack

**Pros**: Rep sees profitability before committing
**Cons**: Extra step, not integrated into workflow

### Alternative B: Accelerate DFU Crew PWA

Since Builders currently use text messages (no app at all), even a simple PWA would be a major improvement:
- Simple job list view
- Basic job details with address
- Mark complete button
- Could deploy in weeks, not months

**Pros**: Quick win for Builders
**Cons**: Parallel development with other priorities

### Alternative C: Hybrid Scheduling

Keep Jobber calendar for day-of execution view, but use DFU for:
- Multi-day/week planning
- AI optimization
- Capacity analysis
- Push optimized schedule to Jobber daily

**Pros**: Leverages both systems
**Cons**: This is actually the current plan - just documenting it's intentional

---

## Sources

- [Jobber Developer Documentation](https://developer.getjobber.com/docs/)
- [Jobber API Queries and Mutations](https://developer.getjobber.com/docs/using_jobbers_api/api_queries_and_mutations/)
- [Jobber OAuth 2.0](https://developer.getjobber.com/docs/building_your_app/app_authorization/)
- [Jobber Webhooks](https://developer.getjobber.com/docs/building_your_app/webhooks/)
- [Jobber Wisetack Integration](https://help.getjobber.com/hc/en-us/articles/360056100954-Jobber-and-Wisetack-Consumer-Financing-Integration)

---

## Quick Reference URLs

| Function | URL |
|----------|-----|
| Connect Residential | `/.netlify/functions/jobber-auth?account=residential` |
| Connect Builders | `/.netlify/functions/jobber-auth?account=builders` |
| Connect Commercial | `/.netlify/functions/jobber-auth?account=commercial` |
| Test Connection | `/.netlify/functions/jobber-test?account=residential` |
| View All Status | `/.netlify/functions/jobber-status` |
| Status (JSON) | `/.netlify/functions/jobber-status?format=json` |

---

## 10. Integration Readiness Assessment

> **Assessed**: 2026-01-16
> **Status**: DFU features are largely ready for Jobber integration

### Current DFU Feature Status

| Feature | DFU Status | Jobber Integration Potential | Notes |
|---------|------------|------------------------------|-------|
| **PriceBooks / Rate Sheets** | ✅ Fully Built | **HIGH** | 7 tables, RPCs exist, formula pricing |
| **FSM Lifecycle** | ✅ Fully Built | **HIGH** | Request→Quote→Job→Invoice complete |
| **Scheduling** | ✅ Fully Built | **HIGH** | `schedule_entries`, crew capacity tracking |
| **Crews / Team** | ✅ Fully Built | **HIGH** | `fsm_team_profiles`, multi-role, territories |
| **Clients / Properties** | ✅ Fully Built | **HIGH** | Full hierarchy with communities |
| **BOM Calculator** | ✅ Fully Built | **MEDIUM** | V1+V2 tables, formula engine, pick lists |
| **Yard Management** | ✅ Fully Built | **MEDIUM** | Claims, staging, audit trail |
| **QBO Integration** | ⚠️ Partial | **MEDIUM** | Auth works, sync needs completion |

### What's Ready to Integrate NOW

#### Phase 2: Product Catalog Sync ✅ READY
- `rate_sheets` + `rate_sheet_items` have pricing data
- RPCs exist: `get_resolved_price()`, `get_effective_rate_sheet()`
- Can push to Jobber's Products/Services
- **Effort**: 1-2 days

#### Phase 3: Webhooks (Jobber → DFU) ✅ READY

| Webhook | DFU Destination | Readiness |
|---------|-----------------|-----------|
| `REQUEST_CREATE` | `service_requests` table | Full schema, hooks, UI exist |
| `JOB_CREATE` | `jobs` table | Full schema + BOM calculator ready to trigger |
| `JOB_COMPLETE` | Job status update | Triggers auto-compute status (migration 194) |
| `INVOICE_CREATE` | `invoices` table | Full schema, payment tracking ready |

**Effort**: 2-3 days

#### Phase 4: Schedule Push (DFU → Jobber) ✅ READY
- `schedule_entries` table with crew assignment exists
- `crew_daily_capacity` for availability tracking
- Job visits with dates ready to push
- **Effort**: 1-2 days

#### Client/Property Sync ✅ READY
- `clients`, `properties`, `communities` tables fully built
- Custom fields support exists
- Can bidirectionally sync with Jobber Customers/Properties
- **Effort**: 1 day

### What Needs to Be Built

| Missing Piece | Purpose | Effort |
|---------------|---------|--------|
| `jobber_product_id` column on `rate_sheet_items` | Track synced products | Migration (30 min) |
| `jobber-webhook.ts` function | Handle incoming webhooks | 2-3 hours |
| Line item → BOM parsing logic | Map Jobber line items to DFU products for BOM calc | 1 day |
| Webhook HMAC verification | Security for webhook endpoints | 1 hour |
| QBO invoice sync completion | Full Jobber → DFU → QBO flow | 1-2 days |

### Recommended First Integrations

Given the architecture (Builders fully DFU, Residential hybrid):

| Priority | Integration | Effort | Impact |
|----------|-------------|--------|--------|
| 1 | **Product Catalog Sync** | 1-2 days | Enables Jobber quotes with DFU pricing |
| 2 | **Client/Property Sync** | 1 day | Foundation for all other syncs |
| 3 | **Webhook Handler** (`JOB_CREATE`) | 2-3 days | Triggers BOM calculation on job approval |
| 4 | **Schedule Push** | 1-2 days | Crews see DFU schedule in Jobber app |
| 5 | **Invoice Sync** | 1-2 days | Complete billing loop to QBO |

### Key Insight

> **The foundation is solid.** The integrations are primarily **data mapping + API calls** - the hard architectural work (FSM, BOM, Scheduling, Crews, PriceBooks) is already done.
