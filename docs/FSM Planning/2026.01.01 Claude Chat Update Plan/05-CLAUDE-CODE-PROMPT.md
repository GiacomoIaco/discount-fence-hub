# FSM Architecture Overhaul - Claude Code Prompt

## How to Use This Document

This is the starting prompt to give Claude Code. It summarizes the entire architecture overhaul and points to the detailed documents.

---

## PROMPT FOR CLAUDE CODE

```
I need help implementing a major architecture overhaul for the FSM (Field Service Management) system in my DFU Op Hub application. This is a fence installation company management system.

## Context

We've completed a comprehensive planning phase and have detailed documentation ready. The goal is to:

1. **Unify Entity Pages**: Replace separate "create" and "view/edit" pages with single unified pages per entity (Jobber-style pattern). One page handles both new and existing quotes/jobs/invoices.

2. **Shared Components**: Build reusable components that Quotes, Jobs, and Invoices all share (they're 95% the same UI).

3. **Auto-Create Projects**: Projects should auto-create when Quotes or standalone Jobs are created. Projects are the "folder" that groups related Requests, Quotes, Jobs, and Invoices.

4. **Job Visits**: Track multiple visits per job to capture rework/callbacks. This enables budget vs. actual tracking and crew quality metrics.

5. **Warranty Linking**: Post-close warranty work creates a new Project linked to the original via `parent_project_id`, enabling true profitability calculation.

## Documentation Files

Please read these documents in order before starting:

1. **00-CONTEXT-AND-VISION.md** - The "why" behind this architecture
2. **01-DATABASE-MIGRATIONS.md** - All SQL migrations needed
3. **02-TYPESCRIPT-INTERFACES.md** - TypeScript types and interfaces
4. **03-SHARED-COMPONENTS.md** - Component specifications with visual designs
5. **04-IMPLEMENTATION-CHECKLIST.md** - Step-by-step implementation guide

## Implementation Order

Follow the phases in the checklist:
1. Database migrations first (creates tables and triggers)
2. TypeScript types (so everything compiles)
3. Hooks (data fetching logic)
4. Shared components (building blocks)
5. Entity-specific components (job visits, payments)
6. Unified pages (QuotePage, JobPage, InvoicePage)
7. Routing updates
8. Testing and cleanup

## Key Architectural Decisions

### Status is Computed, Not Set
Never manually set `status` fields. Update the underlying data and let database triggers compute status. For example, to make a job "scheduled", set `scheduled_date` AND `assigned_crew_id`, not `status = 'scheduled'`.

### Project Auto-Creation Rules
- Request created → No project yet
- Request → Quote → Project created (source: 'request')
- Direct Quote → Project created (source: 'direct_quote')
- Direct Job → Project created (source: 'direct_job')
- Quote → Job → Uses existing project
- Job → Invoice → Uses existing project

### Rework vs Warranty
- **Rework**: Before job closes. Add a visit with `visit_type: 'callback'` or `'rework'`. Impacts budget vs. actual on same job.
- **Warranty**: After project closes. Create new project with `parent_project_id` pointing to original. Impacts "true profitability" calculation.

### Unified Pages Pattern
```typescript
// Same component for create and edit
function QuotePage() {
  const { id } = useParams(); // undefined for new
  const isNew = !id;
  
  // Load existing or start fresh
  const quote = useQuote(id);
  
  // Render same UI, editability controlled by status
  return (
    <div>
      <EntityHeader isNew={isNew} ... />
      <ClientPropertySection readOnly={quote?.status === 'converted'} ... />
      <LineItemsEditor readOnly={quote?.status === 'converted'} ... />
      <TotalsDisplay ... />
      <EntityActionBar entityType="quote" status={quote?.status} ... />
    </div>
  );
}
```

## Existing Code References

- Current types: `/src/features/fsm/types.ts`
- Current hooks: `/src/features/fsm/hooks/`
- Current pages: `/src/features/fsm/pages/`
- Project conventions: `/CLAUDE.md`

## Questions to Ask

If you're unsure about something:
1. Check the relevant documentation file
2. Look at existing patterns in the codebase
3. Ask me for clarification

Let's start with Phase 1: Database Migrations. Please read 01-DATABASE-MIGRATIONS.md and create the migration files.
```

---

## Quick Reference Card

### Entity Status Flows

**Request**:
```
pending → assessment_scheduled → assessment_completed → converted
```

**Quote**:
```
draft → sent → approved → converted
      ↘ changes_requested ↗
```

**Job**:
```
won → scheduled → in_progress → completed
                ↘ callback visits can happen here
```

**Invoice**:
```
draft → sent → past_due → paid
             ↘ partial (when partial payment recorded)
```

### Project Source Values
| Source | When Used |
|--------|-----------|
| `request` | Quote created from Request |
| `direct_quote` | Quote created without Request |
| `direct_job` | Job created without Quote |
| `warranty` | Warranty project created |
| `migration` | Imported from legacy system |
| `project_radar` | AI-detected from messages |

### Visit Types
| Type | When Used |
|------|-----------|
| `scheduled` | Original planned work |
| `continuation` | Multi-day job continuation |
| `callback` | Customer reported issue |
| `rework` | We identified issue |
| `punch_list` | Final touch-ups |
| `inspection` | Quality check |

### Shared Components
| Component | Used By |
|-----------|---------|
| EntityHeader | All |
| ClientPropertySection | All |
| LineItemsEditor | Quote, Job, Invoice |
| TotalsDisplay | Quote, Job, Invoice |
| NotesAttachments | All |
| EntityActionBar | All |
| SchedulingSection | Job only |
| VisitsTimeline | Job only |
| PaymentsSection | Invoice only |

---

## File Manifest

After implementation, you should have:

```
src/features/fsm/
├── components/
│   ├── shared/
│   │   ├── EntityHeader.tsx
│   │   ├── ClientPropertySection.tsx
│   │   ├── LineItemsEditor.tsx
│   │   ├── TotalsDisplay.tsx
│   │   ├── NotesAttachments.tsx
│   │   └── EntityActionBar.tsx
│   │
│   ├── job/
│   │   ├── SchedulingSection.tsx
│   │   ├── VisitsTimeline.tsx
│   │   ├── VisitCard.tsx
│   │   ├── AddVisitModal.tsx
│   │   ├── CompleteVisitModal.tsx
│   │   └── BudgetActualDisplay.tsx
│   │
│   └── invoice/
│       ├── PaymentsSection.tsx
│       └── RecordPaymentModal.tsx
│
├── pages/
│   ├── QuotePage.tsx          # Unified (replaces QuoteBuilderPage + QuoteDetailPage)
│   ├── JobPage.tsx            # Unified
│   └── InvoicePage.tsx        # Unified
│
├── hooks/
│   ├── useJobVisits.ts        # NEW
│   ├── useProjectWithEntities.ts  # NEW
│   └── (existing hooks)
│
└── types.ts                   # Updated with new types

supabase/migrations/
├── YYYYMMDD_create_job_visits.sql
├── YYYYMMDD_enhance_projects.sql
├── YYYYMMDD_enhance_jobs.sql
├── YYYYMMDD_auto_create_project_triggers.sql
├── YYYYMMDD_auto_create_initial_visit.sql
└── YYYYMMDD_fsm_helper_functions.sql
```

---

## Success Metrics

The implementation is complete when:

1. ✅ A user can open `/quotes/new` and create a quote
2. ✅ A user can open `/quotes/:id` and edit an existing quote (same UI)
3. ✅ Converting Request→Quote auto-creates a Project
4. ✅ Converting Quote→Job uses the same Project
5. ✅ Scheduling a Job auto-creates the first Visit
6. ✅ Adding a Callback visit sets `has_rework: true` on the Job
7. ✅ Job shows budget vs. actual comparison
8. ✅ Creating warranty work links to original Project
9. ✅ Project detail page shows all related entities
10. ✅ True profitability includes warranty costs

---

## END OF SUMMARY DOCUMENT
