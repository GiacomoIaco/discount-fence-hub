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

### What You CAN Do for FREE (Builder Tier)

✅ Create Customers (Client -> QBO Customer)
✅ Create Sub-Customers (Community -> QBO Sub-Customer)
✅ Create SalesReceipts with CustomerRef
✅ Create Invoices, Bills, Payments
✅ All "Core" write operations (unlimited)
✅ 500K "CorePlus" read operations/month

### What Requires Silver Tier ($300/mo)

❌ Projects GraphQL API (create projects)
❌ ProjectRef on transactions
❌ Custom Fields API
❌ Advanced project tracking features

### The Cost-Benefit Question

**Option A: Free Builder Tier (No Project Sync)**
- Sync Client -> Customer, Community -> Sub-Customer
- Use Sub-Customers as "jobs" (traditional pre-Projects approach)
- SalesReceipts attach to Sub-Customer, not Project
- Job costing works via Sub-Customer reports
- Cost: $0/mo

**Option B: Silver Tier (Full Project Sync)**
- Everything in Option A, plus:
- Create Projects via GraphQL
- Attach SalesReceipts to Projects via ProjectRef
- Full IES project P&L tracking
- Cost: $300/mo + usage over 1M calls

### Recommendation

**Start with Builder Tier (FREE):**
1. Build Client/Community -> Customer/Sub-Customer sync
2. Use Sub-Customers as jobs (works great for job costing!)
3. SalesReceipts for $0 material transfers to Sub-Customer
4. Test the integration thoroughly

**Upgrade to Silver if:**
- You need native Projects features in IES
- Sub-Customer job costing isn't granular enough
- You want project-level P&L reports in IES

### Technical Notes

- OAuth refresh tokens expire after 100 days (reauth required)
- Private apps work the same as marketplace apps technically
- No app store listing required for internal use
- Production keys available after completing questionnaire

### Alternative: ServiceTitan Approach

Many construction software (ServiceTitan, etc.) skip project sync entirely:
- Keep operational source of truth in app
- Sync only invoices/payments to QBO for accounting
- Avoids API tier costs
- Requires building payment collection in app (not recommended)

### Sources
- Intuit App Partner Program (July 2025)
- Silver Tier Benefits Blog (Oct 2025)
- Projects API Blog (Nov 2025)
- Developer Community discussions`;

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
