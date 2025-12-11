import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function insertRoadmapItem() {
  const rawIdea = `Sync Client Hub data to Intuit Enterprise Suite: Client -> QBO Customer, Community -> QBO Sub-Customer, Project -> IES Project. Also need to handle material costs from yard to project P&L - currently done via zero-dollar Sales Receipts. Key questions: Can we automate sub-customer to project conversion? How do other software handle this (ServiceTitan keeps source of truth internally)? What about payments/credit card transactions?`;

  const claudeAnalysis = `MAJOR UPDATE (Nov 2025): Intuit has released a NEW Projects GraphQL API that allows CREATE operations! This is a game-changer.

## Architecture Summary

### What We Can Now Do:
1. **Client -> QBO Customer**: Full CRUD via REST API
2. **Community -> QBO Sub-Customer**: Full CRUD via REST API (ParentRef)
3. **Project -> IES Project**: NOW POSSIBLE via GraphQL API (as of Nov 2025)

### Technical Details:
- GraphQL endpoint: https://qb.api.intuit.com/graphql
- Create project mutation: projectManagementCreateProject
- Attach to transactions: Use ProjectRef in REST payloads
- Required permissions: project-management.project + com.intuit.quickbooks.accounting
- Partner tier requirement: Silver, Gold, or Platinum

### Material Cost Flow (Yard -> Project P&L):
Current workflow uses $0 Sales Receipts to move inventory costs to jobs without revenue.
With new API we can:
1. Create project via GraphQL when BOM project is created
2. Create SalesReceipt with ProjectRef attached
3. Inventory cost flows to project P&L automatically

### Implementation Phases:
**Phase 1**: OAuth setup + Customer/Sub-customer sync (Client & Community)
**Phase 2**: Project sync via GraphQL + ProjectRef on transactions
**Phase 3**: SalesReceipt automation for material transfers
**Phase 4**: Two-way sync for status/completion

### Alternative Approaches:
- ServiceTitan approach: Keep source of truth in app, sync financials only
- Buildertrend approach: Two-way sync with job cost mapping
- Hybrid: App owns operational data, QBO owns financial transactions

### Notes:
- API rate limits need careful planning
- Sandbox testing critical before production
- Consider webhook subscriptions for change detection`;

  const { data, error } = await supabase.from('roadmap_items').insert({
    hub: 'ops-hub',
    title: 'Intuit Enterprise Suite (IES) Integration',
    status: 'idea',
    importance: 3,
    complexity: 'XL',
    raw_idea: rawIdea,
    claude_analysis: claudeAnalysis
  }).select('code, title');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  } else {
    console.log('Created roadmap item:', data);
  }
}

insertRoadmapItem();
