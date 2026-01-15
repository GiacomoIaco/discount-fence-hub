import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const analysis = `## Analysis for O-034: Redesign Quote Page Layout

### Summary
Move the Context Sidebar from LEFT to RIGHT on Quote/Job/Invoice pages, and wire up the existing Projects Hub secondary navigation to use the FSM pages instead of "Coming Soon" placeholders.

---

### Current State

**Projects Hub (src/features/projects_hub/ProjectsHub.tsx):**
- Secondary sidebar EXISTS with nav items: Dashboard, Requests, Quotes, Jobs, Invoices, Payments
- Quotes/Jobs/Invoices/Payments show "comingSoon: true" badge and render ComingSoonPlaceholder
- Requests already wired to RequestsList component

**QuoteBuilderPage (just built):**
- Context Sidebar on LEFT (320px)
- Main content on RIGHT
- Has: Client/Community/Property selection, Assignment, Project Info, Profitability sections

**Desired Layout (per Jobber reference):**
\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│ MAIN APP  │ PROJECTS HUB    │ QUOTE PAGE CONTENT      │ CONTEXT SIDEBAR    │
│ SIDEBAR   │ SIDEBAR         │                         │ (RIGHT - 320px)    │
│ (Left)    │ (Secondary Nav) │                         │                    │
│           │                 │ HEADER:                 │ ┌────────────────┐ │
│           │ ├─Dashboard     │ "Quote for CLIENT-NAME" │ │ CLIENT &       │ │
│           │ ├─Requests      │                         │ │ PROPERTY       │ │
│           │ ├─Quotes ◄──────┼─ Active                 │ │ • Name         │ │
│           │ ├─Jobs          │ JOB TITLE: [input]      │ │ • Phone  [copy]│ │
│           │ ├─Invoices      │                         │ │ • Email  [copy]│ │
│           │ └─Payments      │ PROPERTY ADDRESS:       │ │                │ │
│           │                 │ 123 Street, City, TX    │ │ Property addr  │ │
│           │ [+ New Request] │ [Change]                │ │ [Change]       │ │
│           │                 │                         │ └────────────────┘ │
│           │                 │ CONTACT DETAILS:        │ ┌────────────────┐ │
│           │                 │ email@client.com        │ │ ASSIGNMENT     │ │
│           │                 │                         │ │ Sales Rep      │ │
│           │                 │ LINE ITEMS:             │ └────────────────┘ │
│           │                 │ [Name] [Desc] [Qty] [$] │ ┌────────────────┐ │
│           │                 │ [+ Add Line Item]       │ │ PROFITABILITY  │ │
│           │                 │                         │ │ • Materials    │ │
│           │                 │ CLIENT-FACING NOTES     │ │ • Labor        │ │
│           │                 │ INTERNAL NOTES          │ │ • Margin %     │ │
│           │                 │ ATTACHMENTS             │ └────────────────┘ │
│           │                 │                         │                    │
│           │                 │ [Save Draft] [Send]     │                    │
└───────────┴─────────────────┴─────────────────────────┴────────────────────┘
\`\`\`

---

### Implementation Plan

#### Phase 1: Wire Projects Hub to FSM Pages
**File:** \`src/features/projects_hub/ProjectsHub.tsx\`

Changes:
1. Remove \`comingSoon: true\` from Quotes, Jobs, Invoices nav items
2. Import and render QuotesHub, JobsHub, InvoicesHub instead of ComingSoonPlaceholder
3. Pass navigation callbacks for entity routing

#### Phase 2: Move Context Sidebar to RIGHT
**Files:**
- \`src/features/fsm/pages/QuoteBuilderPage.tsx\`
- \`src/features/fsm/pages/QuoteDetailPage.tsx\`
- \`src/features/fsm/pages/JobDetailPage.tsx\`
- \`src/features/fsm/pages/InvoiceDetailPage.tsx\`

Change layout from:
\`\`\`tsx
<div className="flex">
  <aside>Context Sidebar</aside>  {/* LEFT */}
  <main>Content</main>            {/* RIGHT */}
</div>
\`\`\`

To:
\`\`\`tsx
<div className="flex">
  <main>Content</main>            {/* LEFT */}
  <aside>Context Sidebar</aside>  {/* RIGHT */}
</div>
\`\`\`

#### Phase 3: Elevate Header with Client/Title/Property (Jobber Style)
**File:** \`src/features/fsm/pages/QuoteBuilderPage.tsx\`

Add top section (before line items):
- Header: "Quote for CLIENT-NAME" (client name in bold/color)
- Job Title: Required input field below header
- Two-column layout: Property address (left) | Contact details (right)
- Change link: Blue text link to modify property selection
- Contact email: Clickable mailto link

#### Phase 4: Update Context Sidebar Content
Move Client/Property SELECTION to main content, Context Sidebar shows:
- Client info (name, phone with copy, email with copy) - READ ONLY display
- Property address - READ ONLY display
- Assignment (Sales Rep)
- Profitability metrics

#### Phase 5: Add Notes & Attachments Sections
**Database Migration:**
- Add job_title VARCHAR(255) to fsm_quotes
- Add client_facing_notes TEXT to fsm_quotes
- Add internal_notes TEXT to fsm_quotes

**UI:** Add sections at bottom of main content (before action buttons)

#### Phase 6: Smart Client/Property Lookup with Create
Reuse patterns from Client Hub:
- Type-ahead search
- "+ Create New" option if no match
- Modal-based creation (stays on page)

---

### Files to Modify

| File | Changes |
|------|---------|
| ProjectsHub.tsx | Wire nav items to real FSM pages |
| QuoteBuilderPage.tsx | Move sidebar RIGHT, add Jobber-style header |
| QuoteDetailPage.tsx | Move sidebar RIGHT |
| JobDetailPage.tsx | Move sidebar RIGHT |
| InvoiceDetailPage.tsx | Move sidebar RIGHT |
| Migration | Add job_title, notes fields to fsm_quotes |

---

### Key UI Elements (from Jobber reference)

1. **Header**: "Quote for CLIENT-NAME" (client name in bold/color)
2. **Job Title**: Required input field below header
3. **Two-column layout**: Property address (left) | Contact details (right)
4. **Change link**: Blue text link to modify property selection
5. **Contact email**: Clickable mailto link

---

### Complexity: M (Medium)
- Phase 1 (wire nav): Simple - remove comingSoon flags, add imports
- Phase 2 (move sidebar): Simple - swap order in flex container
- Phase 3 (header): Medium - new component/layout
- Phase 4 (sidebar content): Simple - restructure existing
- Phase 5 (notes): Medium - migration + UI
- Phase 6 (smart lookup): Can defer or reuse existing patterns
`;

(async () => {
  const { error } = await supabase
    .from('roadmap_items')
    .update({
      claude_analysis: analysis,
      status: 'researched'
    })
    .eq('code', 'O-034');

  if (error) {
    console.error('Error updating:', error);
  } else {
    console.log('✅ O-034 analysis saved successfully');
  }
})();
