import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const analysis = `## Updated Research: Customer vs Partner API Access (Dec 2025)

### Key Finding: You DON'T Need to be a "Partner"

The Intuit App Partner Program is for ALL developers - including companies building internal apps for their own use. You're not a "partner" selling to others; you're a customer building a private integration.

### Tier Structure for Your Use Case

| Tier | Monthly Cost | API Limits | Projects API |
|------|--------------|------------|--------------|
| **Builder** | FREE | 500K CorePlus calls | ❌ No access |
| **Silver** | $300/mo | 1M CorePlus calls | ✅ Yes (request access) |
| Gold | Higher | 2.5M+ | ✅ Yes |

### 🎯 NEGOTIATION OPPORTUNITY

At $20k/year IES spend, you have significant leverage:

**What you have:**
- Dedicated Customer Success Manager (comes with IES)
- Contract-based pricing relationship
- Quote desk access for negotiations
- $300/mo API = only 18% increase on $20k/year

**What to ask for:**
1. "Is Premium API access (Projects API) included or discountable for IES customers?"
2. "Can we bundle Silver tier API access into our IES contract?"
3. "We're building internal integration - are there enterprise API agreements?"

**Why they might say yes:**
- IES customers are their highest-value segment
- They want adoption/stickiness - integrations = retention
- $3,600/year is small vs your $20k contract
- Premium APIs are designed FOR IES (Projects, Custom Fields)

**Who to contact:**
- Your dedicated Customer Success Manager
- Intuit Enterprise sales team (not general support)

### What You CAN Do for FREE (Builder Tier)

✅ Create Customers (Client -> QBO Customer)
✅ Create Sub-Customers (Community -> QBO Sub-Customer)
✅ Create SalesReceipts with CustomerRef
✅ Create Invoices, Bills, Payments
✅ All "Core" write operations (unlimited)
✅ 500K "CorePlus" read operations/month

### What Requires Silver Tier ($300/mo or negotiate)

❌ Projects GraphQL API (create projects)
❌ ProjectRef on transactions
❌ Custom Fields API (12 custom fields - also useful!)
❌ Advanced project tracking features

### Recommended Negotiation Script

"We're IES customers paying $20k/year. We want to build an internal integration
connecting our operations app to IES for:
- Client/Community hierarchy syncing
- Project creation and tracking
- Material cost transfers via Sales Receipts

This requires the Premium API tier (Projects API). Is this included in our IES
subscription, or can we add it to our contract at a preferred rate?"

### Implementation Plan (Assuming API Access)

**Phase 1 - Foundation (2-3 weeks)**
- OAuth 2.0 setup with Intuit
- Developer portal app registration
- Token management (100-day refresh cycle)
- Database columns for QBO IDs

**Phase 2 - Customer Sync (1-2 weeks)**
- Client -> Customer sync
- Community -> Sub-Customer sync
- Bidirectional ID linking

**Phase 3 - Project Sync (1-2 weeks)**
- BOM Project -> IES Project (GraphQL)
- Store project IDs

**Phase 4 - Transaction Sync (2-3 weeks)**
- $0 SalesReceipt for material transfers
- ProjectRef attachment
- BOL -> SalesReceipt automation

**Phase 5 - Polish (1 week)**
- Error handling & retry logic
- Sync status UI in app
- Manual sync triggers

### Technical Notes

- OAuth refresh tokens expire after 100 days (reauth required)
- Private apps work the same as marketplace apps technically
- No app store listing required for internal use
- Production keys available after completing questionnaire
- GraphQL for Projects, REST for everything else

### Sources
- Intuit Enterprise Suite Overview (Fourlane)
- Intuit App Partner Program (July 2025)
- Silver Tier Benefits Blog (Oct 2025)
- Projects API Blog (Nov 2025)`;

async function main() {
  const { data, error } = await supabase
    .from('roadmap_items')
    .update({
      claude_analysis: analysis,
      updated_at: new Date().toISOString()
    })
    .eq('code', 'O-028')
    .select('code, title, status');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Updated:', data);
}

main();
