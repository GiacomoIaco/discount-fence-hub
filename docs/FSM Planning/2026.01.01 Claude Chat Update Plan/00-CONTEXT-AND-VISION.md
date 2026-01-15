# DFU Op Hub - FSM Architecture Overhaul

## Context for Claude Code

You are helping build the Field Service Management (FSM) system for Discount Fence USA (DFU), a fence installation company operating in Texas. This document explains the architectural vision and WHY certain decisions were made.

---

## What We're Building

A "best in class" FSM platform that rivals ServiceTitan, Jobber, and Workiz, but tailored for fence installation with unique capabilities around Bill of Materials (BOM) calculation and material preparation workflows.

### The Core Pipeline

```
Request → Quote → Job → Invoice → Payment
```

Each stage has its own lifecycle, but they're all connected through a **Project** container that groups related work together.

---

## Why This Architecture Exists

### Problem 1: The Current System is Fragmented

The existing implementation has:
- Separate "create" and "view" pages for each entity (QuoteBuilderPage vs QuoteDetailPage)
- No way to edit after creation
- Quotes, Jobs, and Invoices have completely different UIs
- No automatic Project container grouping related entities

**User Experience Issue**: "I created a quote but can't edit it. The quote page looks nothing like the job page. I can't see all the work for one customer in one place."

### Problem 2: Jobber Does It Better

After analyzing Jobber's documentation, we identified two critical patterns they use:

1. **Single Page Paradigm**: Create and Edit are the SAME page. You open a quote, it's always editable (until status forbids it). No separate "view mode" and "edit mode."

2. **Shared Entity Layout**: Quotes, Jobs, and Invoices share 95% of the same UI structure. Same header, same client section, same line items, same totals. Only entity-specific sections differ (Jobs have scheduling, Invoices have payments).

### Problem 3: No "Folder" for Related Work

When you do work for a customer, everything should be grouped:
- The initial request
- The quote(s) created
- The job(s) scheduled
- The invoice(s) sent

Currently, these are disconnected. You can't easily see "show me everything related to the Smith fence project."

### Problem 4: No Rework vs. Warranty Distinction

Two different scenarios need different handling:
- **Rework** (before job closes): Crew installed Monday, gate is crooked, back Wednesday to fix. Same job, additional visit, impacts budget vs. actual.
- **Warranty** (after project closes): 6 months later, board warped. New project, linked to original, impacts "true profitability" calculation.

---

## The Solution: Three Architectural Changes

### Change 1: Unified Entity Pages

Instead of separate create/view/edit pages, each entity type has ONE page that handles all modes:

```
/quotes/new     → QuotePage (empty form)
/quotes/:id     → QuotePage (pre-filled, editable based on status)

/jobs/new       → JobPage (empty form)
/jobs/:id       → JobPage (pre-filled, editable based on status)

/invoices/new   → InvoicePage (empty form)
/invoices/:id   → InvoicePage (pre-filled, editable based on status)
```

**Status controls editability, not page type:**

| Status | Editable Fields |
|--------|----------------|
| draft | All fields |
| sent | Most fields (not client) |
| approved | Notes only |
| converted | Nothing (locked) |

### Change 2: Shared Components

Build a library of shared components that all entity pages use:

```
components/
├── EntityHeader.tsx           # ID, status badge, timestamps, breadcrumb
├── ClientPropertySection.tsx  # Client picker, property address
├── LineItemsEditor.tsx        # Add/edit/remove line items with pricing
├── TotalsDisplay.tsx          # Subtotal, tax, discount, total
├── NotesAttachments.tsx       # Internal notes, file uploads
└── EntityActionBar.tsx        # Primary/secondary actions based on status
```

Entity-specific sections:
```
components/
├── SchedulingSection.tsx      # Job only: date, time, crew assignment
├── PaymentsSection.tsx        # Invoice only: balance, payment history
└── VisitsTimeline.tsx         # Job only: list of visits with status
```

### Change 3: Project Container with Automatic Creation

**Rules for when Projects are created:**

| Action | Create Project? | Source Tag |
|--------|----------------|------------|
| Create Request | ❌ No | — |
| Request → Quote | ✅ Yes | `request` |
| Create Quote directly | ✅ Yes | `direct_quote` |
| Create Job directly | ✅ Yes | `direct_job` |
| Quote → Job | ❌ No (use existing) | — |
| Job → Invoice | ❌ No (use existing) | — |
| Warranty work | ✅ Yes (linked) | `warranty` |

**Why not create Project at Request stage?**

Requests are top-of-funnel lead tracking. Many requests never convert. Creating a Project for every phone call pollutes the project list. Instead:
- Use `service_requests` table for funnel analytics
- Create Project when there's "real work" (a Quote)
- Dead requests remain queryable but don't clutter Projects

### Change 4: Visits Model for Pre-Close Rework

A Job can have multiple **Visits** (trips to the site):

```
Job: "Smith Privacy Fence"
├── Visit 1: Scheduled install (completed)
├── Visit 2: Callback - gate alignment (completed) ← REWORK
└── Visit 3: Punch list (completed)
```

Each visit tracks:
- Type: `scheduled`, `continuation`, `callback`, `rework`, `punch_list`, `inspection`
- Scheduled date/time and assigned crew
- Actual hours and labor cost
- Issue description and resolution (for callbacks)

This enables:
- Budget vs. Actual tracking (budgeted hours vs. sum of visit hours)
- Rework cost calculation (sum of callback/rework visit costs)
- Crew quality metrics (which crews have highest rework rates)

### Change 5: Warranty as Linked Project

Post-close warranty work creates a NEW Project linked to the original:

```typescript
interface Project {
  parent_project_id?: string;      // FK to original project
  relationship_type?: 'warranty' | 'callback' | 'phase_2' | 'add_on';
}
```

This enables:
- Clean operational tracking (each piece of work has its own lifecycle)
- True profitability calculation (original profit minus warranty costs)
- Warranty volume reporting
- Navigate between related projects

---

## Key Database Changes Required

### New Tables

1. **job_visits** - Tracks each trip to a job site
2. (Existing tables need modifications, not new tables)

### Modified Tables

1. **projects** - Add `parent_project_id`, `relationship_type`, `source`
2. **jobs** - Add budget vs. actual fields, `has_rework` flag
3. **service_requests** - Ensure `project_id` field exists
4. **quotes** - Ensure `project_id` field exists

### New Database Triggers

1. Auto-create Project when Quote is created (if no project_id)
2. Auto-create Project when Job is created directly (if no project_id and no quote_id)
3. Compute job `actual_labor_cost` from sum of visits
4. Compute job `has_rework` flag from visit types

---

## Implementation Priority

### Phase 1: Database Foundation (Do First)
1. Create `job_visits` table
2. Add new columns to `projects`, `jobs`
3. Create triggers for Project auto-creation
4. Create triggers for Job actual cost computation

### Phase 2: Shared Components
1. Build `EntityHeader`
2. Build `ClientPropertySection`
3. Build `LineItemsEditor`
4. Build `TotalsDisplay`
5. Build `NotesAttachments`
6. Build `EntityActionBar`

### Phase 3: Unified Entity Pages
1. Build unified `QuotePage` (replace QuoteBuilderPage + QuoteDetailPage)
2. Build unified `JobPage` with `SchedulingSection` and `VisitsTimeline`
3. Build unified `InvoicePage` with `PaymentsSection`

### Phase 4: Project Container Integration
1. Update conversion hooks to auto-create Projects
2. Build `ProjectDetailPage` showing all related entities
3. Add "View Project" navigation from entity pages

### Phase 5: Warranty Workflow
1. Build "Create Warranty Project" modal
2. Add warranty cost to original project profitability display
3. Build warranty reporting

---

## Files to Reference

When implementing, check these existing files:

- `/src/features/fsm/types.ts` - Existing type definitions
- `/src/features/fsm/hooks/useQuoteToProject.ts` - Multi-job conversion (good patterns)
- `/src/features/fsm/pages/ProjectDetailPage.tsx` - Existing project view
- `/CLAUDE.md` - Project conventions and trigger patterns

---

## Success Criteria

When complete, a user should be able to:

1. ✅ Open any Quote/Job/Invoice and immediately edit it (no separate edit mode)
2. ✅ See consistent UI across Quote, Job, Invoice pages
3. ✅ Create a Request, convert to Quote, and see them grouped in a Project
4. ✅ Add a callback visit to a job and see budget vs. actual impact
5. ✅ Create warranty work linked to original project
6. ✅ View true profitability including warranty costs
7. ✅ Run reports on conversion funnel, rework rates, warranty costs

---

## Questions to Ask If Stuck

1. "Should this be a new visit or a new project?" → Is the original job closed? If no, visit. If yes, new project.
2. "Should I create a Project here?" → Is a Quote or Job being created? If yes, ensure Project exists.
3. "Which component handles this?" → Line items? `LineItemsEditor`. Client selection? `ClientPropertySection`. Status-based actions? `EntityActionBar`.
4. "How do I update status?" → Don't set status directly. Update the underlying data (e.g., set `scheduled_date` and `assigned_crew_id` to make status = 'scheduled').

---

## END OF CONTEXT DOCUMENT
