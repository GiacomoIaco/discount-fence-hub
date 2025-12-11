import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const analysis = `## Research Summary (Dec 2024)

### Industry Best Practices

**ServiceTitan's Model** (most relevant for home services):
- **Rate Sheets**: Define labor rates, material markups/discounts - NOT duplicating pricebook items per client
- **Assignment Hierarchy**: Customer → Location → Project (cascades down, lower level overrides higher)
- **Business Units**: Separate pricebooks per division (Residential, Commercial, Builders)
- **Client Specific Pricing**: Overrides dynamic pricing, auto-applies when job is for that client

**Salesforce CPQ Model**:
- Contracted Pricing tied to accounts that override standard pricing
- Buyer Groups for different customer segments
- Account Default Price Book with hierarchy inheritance

### Recommended Architecture

**Data Model**:
\`\`\`
CLIENTS
├── business_unit (Residential, Commercial, Builders)
├── client_type (Large Builder, Custom Builder, Landscaper, Pool Co)
├── default_rate_sheet_id (nullable)
├── invoicing_preferences, contracts
│
└── COMMUNITIES (optional 1:N - some clients have no communities)
    ├── geography_id (Austin, San Antonio - affects labor rates)
    ├── rate_sheet_id (overrides client default if set)
    ├── approved_skus[] (restrict to these SKUs only)
    ├── superintendent contacts
    └── onboarding_status, checklist

RATE SHEETS (not duplicating SKUs!)
├── name ("Perry Homes Standard", "Austin Commercial")
├── labor_rate_multiplier OR fixed_labor_rate
├── material_markup_percent
├── effective_date, expires_at
│
└── RATE_SHEET_ITEMS (M:N overrides for specific SKUs)
    ├── sku_id
    ├── override_price (null = use formula)
    └── override_labor_rate
\`\`\`

**Pricing Resolution Logic**:
1. Get Community's rate_sheet_id OR fall back to Client's default_rate_sheet_id
2. Get Geography's labor_rate for base calculation
3. For each SKU: Check rate_sheet_items for override → else apply rate sheet formulas

**Perry Homes Example**:
- Perry Homes (Client) → "Perry Standard" rate sheet (50 SKUs priced)
- Six Creek (Community) → inherits rate sheet, approved_skus = [5 specific SKUs]
- Bridgeland (Community) → inherits rate sheet, approved_skus = [5 different SKUs]
- Community's approved_skus acts as FILTER, not separate price list

**Highland Example**:
- Highland (Client) → "Highland Default" rate sheet
- Highland Specialty Community → "Highland Premium" rate sheet (override)

### Request Types for Client Hub

| Type | Checklist |
|------|-----------|
| New Client | QB entry, Contract signed, Primary contact, Rate sheet, Business unit |
| New Community | Client, Geography, Super contact, Approved SKUs, Rate sheet |
| Pricing Change | Rate sheet, Old/new prices, Effective date, Approval |
| Contact Update | Client/Community, Role, Old/new contact |

### Phased Implementation

| Phase | Deliverable | Effort |
|-------|-------------|--------|
| 1 | Geography + Labor Rates table | S |
| 2 | Clients table + CRUD in Client Hub | M |
| 3 | Communities table + approved_skus | M |
| 4 | Rate Sheets + Rate Sheet Items | L |
| 5 | Pricing resolution in SKU lookups | M |
| 6 | Request types for onboarding workflow | M |
| 7 | Contact management + document storage | M |

**Phase 1-3 gives immediate value** - SKU restriction by community eliminates quoting errors.

### Sources
- ServiceTitan Client Specific Pricing & Pricing Builder
- Salesforce CPQ Pricing Methods
- Industry construction CRM patterns`;

async function main() {
  const { data, error } = await supabase
    .from('roadmap_items')
    .update({
      claude_analysis: analysis,
      status: 'researched',
      updated_at: new Date().toISOString()
    })
    .eq('code', 'O-027')
    .select('code, title, status');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Updated:', data);
}

main();
