# Implementation Checklist - FSM Architecture Overhaul

> **DEPRECATED**: This checklist uses old phase numbering (1-10).
>
> **USE INSTEAD**: `docs/FSM Planning/FSM_SYSTEM_STANDARDS.md`
> - New phases: A (Foundation), B (Entity Unification), C (Files/Pricing), D (Advanced), E (Integrations)
> - Phase A is COMPLETE
> - Current work: Phase B

---

## Status Summary (Updated: 2026-01-05) - OUTDATED

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Database | ✅ COMPLETE | 100% |
| Phase 2: Types | ✅ MOSTLY COMPLETE | 90% |
| Phase 3: Hooks | ⚠️ PARTIAL | 60% |
| Phase 4: Shared Components | ⚠️ PARTIAL | 70% |
| Phase 5: Job Components | ❌ NOT STARTED | 0% |
| Phase 6: Invoice Components | ❌ NOT STARTED | 0% |
| Phase 7: Unified Pages | ⚠️ PARTIAL | 50% |
| Phase 8: Routing | ⚠️ PARTIAL | 40% |
| Phase 9: Testing | ⚠️ PARTIAL | 30% |
| Phase 10: Cleanup | ❌ NOT STARTED | 0% |

**Overall Progress: ~50%**

### Notes on Implementation Approach

The actual implementation diverged from the original plan in some areas:
- **QuoteCard component** was built instead of a separate QuotePage - handles create/edit/view modes
- **ProjectCreateWizard** was built to enforce Project-First architecture
- **ProjectContextHeader** shows project context when editing child entities
- **Database migrations** used different numbering (202-207 instead of plan's YYYYMMDDHHMMSS pattern)

---

## Overview

This document provides a step-by-step implementation guide. Complete tasks in order as later tasks depend on earlier ones.

---

## Pre-Flight Checks

Before starting, verify the following:

```bash
# Check current database state
# Run in Supabase SQL Editor

-- Verify jobs table exists with expected columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs'
ORDER BY ordinal_position;

-- Verify projects table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects'
ORDER BY ordinal_position;

-- Verify quotes table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'quotes'
ORDER BY ordinal_position;

-- Check existing triggers
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;
```

---

## Phase 1: Database Migrations

### Step 1.1: Create job_visits Table

**File**: `supabase/migrations/YYYYMMDDHHMMSS_create_job_visits.sql`

**Action**: Copy Migration 1 from `01-DATABASE-MIGRATIONS.md` and run it.

**Verification**:
```sql
-- Should return visit columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'job_visits';

-- Should show trigger
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'job_visits';
```

[x] Migration file created (migrations/205_job_visits.sql)
[x] Migration run successfully
[x] Table verified
[x] Triggers verified

### Step 1.2: Enhance Projects Table ✅

**File**: `supabase/migrations/YYYYMMDDHHMMSS_enhance_projects.sql`

**Action**: Copy Migration 2 from `01-DATABASE-MIGRATIONS.md` and run it.

**Verification**:
```sql
-- Should include new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'projects'
AND column_name IN ('parent_project_id', 'relationship_type', 'source');
```

[x] Migration file created (migrations/202_project_foundation.sql)
[x] Migration run successfully
[x] New columns verified

### Step 1.3: Enhance Jobs Table ✅

**File**: `supabase/migrations/YYYYMMDDHHMMSS_enhance_jobs.sql`

**Action**: Copy Migration 3 from `01-DATABASE-MIGRATIONS.md` and run it.

**Verification**:
```sql
-- Should include budget/actual columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'jobs'
AND column_name LIKE '%budget%' OR column_name LIKE '%actual%';
```

[x] Migration file created (migrations/204_job_enhancements.sql)
[x] Migration run successfully
[x] Budget columns verified
[x] Computed columns working

### Step 1.4: Auto-Create Project Triggers ✅

**File**: `supabase/migrations/YYYYMMDDHHMMSS_auto_create_project_triggers.sql`

**Action**: Copy Migration 4 from `01-DATABASE-MIGRATIONS.md` and run it.

**Verification**:
```sql
-- Test: Create a quote without project_id
-- Should auto-create project
INSERT INTO quotes (client_id, ...) VALUES (...);
-- Check that project_id is now set
SELECT project_id FROM quotes WHERE id = '<new_quote_id>';
```

[x] Migration file created (migrations/206_auto_create_triggers.sql)
[x] Migration run successfully
[x] Quote trigger works (creates project)
[x] Job trigger works (creates project for standalone jobs)

### Step 1.5: Initial Visit Trigger ✅

**File**: `supabase/migrations/YYYYMMDDHHMMSS_auto_create_initial_visit.sql`

**Action**: Copy Migration 5 from `01-DATABASE-MIGRATIONS.md` and run it.

**Verification**:
```sql
-- Test: Schedule a job
UPDATE jobs SET scheduled_date = '2024-12-20', assigned_crew_id = '<crew_id>' WHERE id = '<job_id>';
-- Check visit was created
SELECT * FROM job_visits WHERE job_id = '<job_id>';
```

[x] Migration file created (migrations/205_job_visits.sql includes this)
[x] Migration run successfully
[x] Initial visit auto-created on schedule

### Step 1.6: Helper Functions ✅

**File**: `supabase/migrations/YYYYMMDDHHMMSS_fsm_helper_functions.sql`

**Action**: Copy Migration 6 from `01-DATABASE-MIGRATIONS.md` and run it.

**Verification**:
```sql
-- Test helper functions
SELECT * FROM get_project_entities('<project_id>');
SELECT * FROM calculate_true_profitability('<project_id>');
```

[x] Migration file created (migrations/207_project_views.sql)
[x] Migration run successfully
[x] Helper functions working

---

## Phase 2: TypeScript Types ✅ (90% complete)

### Step 2.1: Add Job Visit Types

**File**: `src/features/fsm/types.ts`

**Action**: Add all types from the "Job Visits" section of `02-TYPESCRIPT-INTERFACES.md`

[x] VisitType added
[x] VisitStatus added
[x] JobVisit interface added
☐ JobVisitFormData added (partial - needs completion)
[x] Label/color maps added

### Step 2.2: Add Project Enhancement Types ✅

**File**: `src/features/fsm/types.ts`

**Action**: Add types from the "Project Enhancements" section

[x] ProjectRelationshipType added
[x] ProjectSource added
[x] Project interface updated with new fields
[x] CreateWarrantyProjectData added

### Step 2.3: Add Job Enhancement Types ✅

**File**: `src/features/fsm/types.ts`

**Action**: Add types from the "Job Enhancements" section

[x] Job interface updated with budget/actual fields
[x] JobWithVisits interface added
☐ JobBudgetSummary interface added (not implemented)
☐ computeJobBudgetSummary helper added (not implemented)

### Step 2.4: Add Shared Component Props ⚠️ (partial)

**File**: `src/features/fsm/types.ts`

**Action**: Add all component prop interfaces from `02-TYPESCRIPT-INTERFACES.md`

[x] EntityHeaderProps added (in shared/EntityHeader.tsx)
[x] ClientPropertySectionProps added (implemented differently as QuoteClientSection)
[x] LineItemsEditorProps added (in QuoteCard/QuoteLineItems.tsx)
[x] TotalsDisplayProps added (in shared/TotalsDisplay.tsx)
☐ SchedulingSectionProps added (not implemented)
☐ VisitsTimelineProps added (not implemented)
☐ PaymentsSectionProps added (not implemented)
[x] EntityActionBarProps added (in shared/EntityActionBar.tsx)

---

## Phase 3: Hooks ⚠️ (60% complete)

### Step 3.1: Create useJobVisits Hook

**File**: `src/features/fsm/hooks/useJobVisits.ts`

**Implementation**:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { JobVisit, JobVisitFormData, VisitCompletionData } from '../types';

export function useJobVisits(jobId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch visits for a job
  const visitsQuery = useQuery({
    queryKey: ['job_visits', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await supabase
        .from('job_visits')
        .select(`
          *,
          assigned_crew:crews(id, name, code)
        `)
        .eq('job_id', jobId)
        .order('visit_number', { ascending: true });
      
      if (error) throw error;
      return data as JobVisit[];
    },
    enabled: !!jobId,
  });

  // Add a new visit
  const addVisitMutation = useMutation({
    mutationFn: async (data: JobVisitFormData & { job_id: string }) => {
      const { data: visit, error } = await supabase
        .from('job_visits')
        .insert({
          job_id: data.job_id,
          visit_type: data.visit_type,
          scheduled_date: data.scheduled_date,
          scheduled_time: data.scheduled_time || null,
          assigned_crew_id: data.assigned_crew_id,
          estimated_hours: parseFloat(data.estimated_hours) || null,
          instructions: data.instructions || null,
          issue_description: data.issue_description || null,
          status: 'scheduled',
        })
        .select()
        .single();
      
      if (error) throw error;
      return visit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job_visits', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  // Complete a visit
  const completeVisitMutation = useMutation({
    mutationFn: async ({ 
      visitId, 
      data 
    }: { 
      visitId: string; 
      data: VisitCompletionData 
    }) => {
      const { data: visit, error } = await supabase
        .from('job_visits')
        .update({
          actual_hours: parseFloat(data.actual_hours) || null,
          labor_cost: parseFloat(data.labor_cost) || null,
          completion_notes: data.completion_notes || null,
          resolution_notes: data.resolution_notes || null,
          completed_at: new Date().toISOString(),
          status: 'completed',
        })
        .eq('id', visitId)
        .select()
        .single();
      
      if (error) throw error;
      return visit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job_visits', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  // Cancel a visit
  const cancelVisitMutation = useMutation({
    mutationFn: async (visitId: string) => {
      const { error } = await supabase
        .from('job_visits')
        .update({ status: 'cancelled' })
        .eq('id', visitId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job_visits', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  // Computed values
  const visits = visitsQuery.data || [];
  const reworkVisits = visits.filter(v => 
    v.visit_type === 'callback' || v.visit_type === 'rework'
  );
  const totalActualHours = visits
    .filter(v => v.status === 'completed')
    .reduce((sum, v) => sum + (v.actual_hours || 0), 0);
  const totalLaborCost = visits
    .filter(v => v.status === 'completed')
    .reduce((sum, v) => sum + (v.labor_cost || 0), 0);

  return {
    visits,
    isLoading: visitsQuery.isLoading,
    error: visitsQuery.error,
    
    addVisit: addVisitMutation.mutateAsync,
    completeVisit: completeVisitMutation.mutateAsync,
    cancelVisit: cancelVisitMutation.mutateAsync,
    
    isAddingVisit: addVisitMutation.isPending,
    isCompletingVisit: completeVisitMutation.isPending,
    
    // Computed
    totalVisits: visits.length,
    completedVisits: visits.filter(v => v.status === 'completed').length,
    reworkVisits,
    totalActualHours,
    totalLaborCost,
  };
}
```

☐ Hook file created (NOT IMPLEMENTED - HIGH PRIORITY)
☐ visitsQuery working
☐ addVisitMutation working
☐ completeVisitMutation working
☐ Computed values correct

**Note**: useJobVisits is a key missing piece. Job visits are tracked in DB but no hook exists to fetch/manage them.

### Step 3.2: Create useProjectWithEntities Hook ✅

**File**: `src/features/fsm/hooks/useProjectWithEntities.ts`

**Implementation**:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProjectWithEntities, CreateWarrantyProjectData } from '../types';

export function useProjectWithEntities(projectId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch project with all related entities
  const projectQuery = useQuery({
    queryKey: ['project_with_entities', projectId],
    queryFn: async () => {
      if (!projectId) return null;

      // Fetch project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          client:clients(id, name, code),
          community:communities(id, name),
          parent_project:projects!parent_project_id(id, project_number, name)
        `)
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // Fetch related entities in parallel
      const [requestsResult, quotesResult, jobsResult, invoicesResult, childProjectsResult] = 
        await Promise.all([
          supabase
            .from('service_requests')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true }),
          supabase
            .from('quotes')
            .select('*, line_items:quote_line_items(*)')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true }),
          supabase
            .from('jobs')
            .select(`
              *,
              assigned_crew:crews(id, name, code),
              visits:job_visits(*)
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: true }),
          supabase
            .from('invoices')
            .select('*, payments:invoice_payments(*)')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true }),
          supabase
            .from('projects')
            .select('*')
            .eq('parent_project_id', projectId)
            .order('created_at', { ascending: true }),
        ]);

      return {
        ...project,
        requests: requestsResult.data || [],
        quotes: quotesResult.data || [],
        jobs: jobsResult.data || [],
        invoices: invoicesResult.data || [],
        child_projects: childProjectsResult.data || [],
      } as ProjectWithEntities;
    },
    enabled: !!projectId,
  });

  // Create warranty project
  const createWarrantyMutation = useMutation({
    mutationFn: async (data: CreateWarrantyProjectData) => {
      // Get parent project details
      const { data: parent, error: parentError } = await supabase
        .from('projects')
        .select('client_id, community_id, property_id, address_line1, city, state, zip')
        .eq('id', data.parent_project_id)
        .single();

      if (parentError) throw parentError;

      // Create warranty project
      const { data: warrantyProject, error } = await supabase
        .from('projects')
        .insert({
          ...parent,
          name: data.name,
          parent_project_id: data.parent_project_id,
          relationship_type: 'warranty',
          source: 'warranty',
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return warrantyProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_with_entities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return {
    project: projectQuery.data,
    isLoading: projectQuery.isLoading,
    error: projectQuery.error,

    requests: projectQuery.data?.requests || [],
    quotes: projectQuery.data?.quotes || [],
    jobs: projectQuery.data?.jobs || [],
    invoices: projectQuery.data?.invoices || [],
    childProjects: projectQuery.data?.child_projects || [],

    createWarrantyProject: createWarrantyMutation.mutateAsync,
    isCreatingWarranty: createWarrantyMutation.isPending,
  };
}
```

[x] Hook file created (useProjectFull in useProjects.ts)
[x] Project query working
[x] Related entities loading (via useProjectQuotes, useProjectJobs)
☐ createWarrantyProject working (not implemented)

**Note**: Implemented differently - useProjectFull fetches project, separate hooks fetch quotes/jobs.

---

## Phase 4: Shared Components ⚠️ (70% complete)

### Step 4.1: Create EntityHeader Component

**File**: `src/features/fsm/components/shared/EntityHeader.tsx`

**Reference**: See `03-SHARED-COMPONENTS.md` for design spec

[x] Component created (src/features/fsm/components/shared/EntityHeader.tsx)
[x] Shows entity type icon
[x] Shows entity number or "New Quote/Job/Invoice"
[x] Shows status badge with correct color
☐ Shows timestamps (created, updated) - not implemented
☐ Shows linked entities as clickable chips - not implemented
[x] Back button works
☐ View Project button works (when projectId exists) - not implemented

### Step 4.2: Create ClientPropertySection Component ✅

**File**: `src/features/fsm/components/shared/ClientPropertySection.tsx`

[x] Component created (QuoteCard/QuoteClientSection.tsx + SmartLookup/ClientLookup.tsx)
[x] Client search works (universal search via ClientLookup)
[x] Community dropdown filters by client
[x] Property dropdown filters by community
[x] "Use Property Address" button works (via property selection)
[x] Address fields work
[x] Read-only mode works (locked when project-linked)
☐ Validation errors display - partial

**Note**: Implemented as QuoteClientSection instead of generic ClientPropertySection.

### Step 4.3: Create LineItemsEditor Component ✅

**File**: `src/features/fsm/components/shared/LineItemsEditor.tsx`

[x] Component created (QuoteCard/QuoteLineItems.tsx)
[x] Displays existing line items
[x] Inline quantity/price editing works
[x] Add from Products modal works (SKU search via SkuSearchCombobox)
[x] Add custom line item works
[x] Delete line item works (with confirmation)
☐ Drag to reorder works - not implemented
[x] Totals auto-calculate
[x] Read-only mode works

**Note**: Implemented as QuoteLineItems with SKU catalog integration.

### Step 4.4: Create TotalsDisplay Component ✅

**File**: `src/features/fsm/components/shared/TotalsDisplay.tsx`

[x] Component created (src/features/fsm/components/shared/TotalsDisplay.tsx)
[x] Shows subtotal, tax, total
[x] Shows discount if present
[x] Shows payment summary (for invoices)
☐ Shows budget comparison (for jobs) - separate BudgetActualDisplay component
[x] Formats currency correctly

### Step 4.5: Create NotesAttachments Component ❌

**File**: `src/features/fsm/components/shared/NotesAttachments.tsx`

☐ Component created (NOT IMPLEMENTED)
☐ Notes textarea works
☐ File upload works
☐ Attachment list displays
☐ View attachment works
☐ Delete attachment works
☐ Read-only mode works

**Note**: Notes handled inline in QuoteCard sidebar. Attachments not implemented.

### Step 4.6: Create EntityActionBar Component ✅

**File**: `src/features/fsm/components/shared/EntityActionBar.tsx`

[x] Component created (src/features/fsm/components/shared/EntityActionBar.tsx)
[x] Shows correct actions for entity type + status
[x] Save button works (disabled when not dirty)
[x] Cancel button works
[x] Delete button shows confirmation
[x] Primary action highlighted
[x] Loading states work
☐ Sticky positioning works - inline instead

---

## Phase 5: Job-Specific Components ❌ (NOT STARTED)

### Step 5.1: Create SchedulingSection Component

**File**: `src/features/fsm/components/job/SchedulingSection.tsx`

☐ Component created
☐ Date picker works
☐ Time picker works
☐ Crew selector works
☐ Filters crews by territory (optional)
☐ Shows crew availability hint
☐ Estimated duration displays

### Step 5.2: Create VisitsTimeline Component

**File**: `src/features/fsm/components/job/VisitsTimeline.tsx`

☐ Component created
☐ Displays visits in order
☐ Shows visit type with icon/color
☐ Shows status badge
☐ Expandable visit details
☐ Action buttons per visit (Start, Complete, Cancel)
☐ Summary footer with totals
☐ Rework cost highlighted

### Step 5.3: Create AddVisitModal Component

**File**: `src/features/fsm/components/job/AddVisitModal.tsx`

☐ Component created
☐ Visit type selector
☐ Date/time picker
☐ Crew selector
☐ Issue description (for callbacks)
☐ Form validation
☐ Submit creates visit

### Step 5.4: Create CompleteVisitModal Component

**File**: `src/features/fsm/components/job/CompleteVisitModal.tsx`

☐ Component created
☐ Actual hours input
☐ Labor cost input (auto-calculate or override)
☐ Completion notes
☐ Resolution notes (for callbacks)
☐ Submit completes visit

**Note**: Phase 5 not started. Existing JobDetailPage uses inline sections, not modular components.

---

## Phase 6: Invoice-Specific Components ❌ (NOT STARTED)

### Step 6.1: Create PaymentsSection Component

**File**: `src/features/fsm/components/invoice/PaymentsSection.tsx`

☐ Component created
☐ Shows balance summary
☐ Shows payment history
☐ Record Payment button opens modal

### Step 6.2: Create RecordPaymentModal Component

**File**: `src/features/fsm/components/invoice/RecordPaymentModal.tsx`

☐ Component created
☐ Amount input with "Pay Full" button
☐ Payment method selector
☐ Date picker
☐ Reference number input
☐ Notes input
☐ Submit records payment

**Note**: Phase 6 not started. Existing InvoiceDetailPage uses inline sections.

---

## Phase 7: Unified Entity Pages ⚠️ (50% complete)

### Step 7.1: Create QuotePage (Unified) ✅

**File**: `src/features/fsm/pages/QuotePage.tsx`

**Key Points**:
- Single component handles both create and edit
- Route: `/quotes/new` and `/quotes/:id` both use this page
- Load quote data if `quoteId` param exists
- Status controls which fields are editable

[x] Page component created (QuoteCard component - not separate page)
[x] Loads existing quote when ID provided
[x] Empty form when no ID
[x] EntityHeader integrated (via QuoteHeader sub-component)
[x] ClientPropertySection integrated (QuoteClientSection)
[x] LineItemsEditor integrated (QuoteLineItems)
[x] TotalsDisplay integrated (QuoteTotals)
☐ NotesAttachments integrated - notes inline, no attachments
[x] EntityActionBar integrated (in QuoteHeader)
[x] Save creates or updates correctly
[x] Status-based editability works

**Note**: Implemented as QuoteCard (unified create/edit/view component) rather than QuotePage.

### Step 7.2: Create JobPage (Unified) ❌ (HIGH PRIORITY)

**File**: `src/features/fsm/pages/JobPage.tsx`

☐ Page component created (uses existing JobDetailPage - not unified)
☐ Inherits from quote when converting
☐ SchedulingSection integrated
☐ VisitsTimeline integrated
☐ Budget vs Actual display
☐ All shared components integrated
☐ Save creates or updates correctly

**Note**: JobDetailPage exists but is view-only. Need JobCard similar to QuoteCard for create/edit/view.

### Step 7.3: Create InvoicePage (Unified) ❌

**File**: `src/features/fsm/pages/InvoicePage.tsx`

☐ Page component created (uses existing InvoiceDetailPage - not unified)
☐ PaymentsSection integrated
☐ All shared components integrated
☐ Save creates or updates correctly
☐ Payment recording works

**Note**: InvoiceDetailPage exists but is view-only. Need InvoiceCard similar to QuoteCard for create/edit/view.

---

## Phase 8: Update Routing ⚠️ (40% complete)

### Step 8.1: Update Route Configuration

**File**: `src/App.tsx` or route config file

**Changes**:
```typescript
// Old routes (remove)
// <Route path="/quotes/new" element={<QuoteBuilderPage />} />
// <Route path="/quotes/:id" element={<QuoteDetailPage />} />

// New routes
<Route path="/quotes/new" element={<QuotePage />} />
<Route path="/quotes/:id" element={<QuotePage />} />

<Route path="/jobs/new" element={<JobPage />} />
<Route path="/jobs/:id" element={<JobPage />} />

<Route path="/invoices/new" element={<InvoicePage />} />
<Route path="/invoices/:id" element={<InvoicePage />} />
```

[x] Quote routes updated (QuotesHub uses QuoteCard inline)
☐ Job routes updated (still using JobDetailPage)
☐ Invoice routes updated (still using InvoiceDetailPage)
☐ Old page components marked for deletion

**Note**: Routes use Hub pattern (QuotesHub, JobsHub, InvoicesHub) with entity context in URL.

---

## Phase 9: Integration Testing ⚠️ (30% complete)

### Step 9.1: Test Complete Flow

**Test Script**:

1. [x] Create a new Request
2. [x] Convert Request to Quote → Verify Project created
3. [x] Edit Quote → Changes save correctly
4. ☐ Send Quote → Status changes to 'sent' (not tested)
5. [x] Mark Quote as Won → Status changes (via Approve)
6. ☐ Convert Quote to Job → Job created with same Project (not fully tested)
7. ☐ Schedule Job → Visit auto-created (not tested)
8. ☐ Start Job → Status changes (not tested)
9. ☐ Add Callback Visit → Rework flag set on job (not tested)
10. ☐ Complete all Visits → Job status changes (not tested)
11. ☐ Create Invoice → Invoice linked to Project (not tested)
12. ☐ Record Payment → Balance updates (not tested)
13. [x] View Project → All entities visible (ProjectPage works)

### Step 9.2: Test Warranty Flow ❌

1. ☐ Complete and pay a project fully
2. ☐ Create Warranty Project from original
3. ☐ Verify parent_project_id linked
4. ☐ Verify original project shows warranty_cost_total
5. ☐ Verify true profitability calculation includes warranty

### Step 9.3: Test Edge Cases

1. ☐ Create Quote directly (no Request) → Project auto-created
2. ☐ Create Job directly (no Quote) → Project auto-created
3. ☐ Multiple quotes for same project
4. ☐ Multiple jobs for same project
5. ☐ Cancel a visit mid-job
6. ☐ Reschedule a visit

---

## Phase 10: Cleanup ❌ (NOT STARTED)

### Step 10.1: Remove Old Components

**Files to Delete** (after verification):
- `src/features/fsm/pages/QuoteBuilderPage.tsx`
- `src/features/fsm/pages/QuoteDetailPage.tsx`
- (any other superseded components)

☐ Old files identified
☐ No remaining imports
☐ Files deleted

### Step 10.2: Update Documentation

☐ Update CLAUDE.md with new patterns
☐ Update component README if exists
☐ Document new hooks

---

## Completion Checklist (Updated Status)

### Database ✅
- [x] All migrations run successfully (202-207)
- [x] job_visits table exists and works
- [x] Projects auto-create on quote/job creation
- [x] Job budget/actual tracking works
- [ ] Visits update job aggregates (triggers exist, not fully tested)

### Types ✅
- [x] All new types added to types.ts
- [x] No TypeScript errors

### Components ⚠️
- [x] 4 of 6 shared components built (EntityHeader, TotalsDisplay, EntityActionBar, BudgetActualDisplay)
- [ ] Job-specific components NOT built (VisitsTimeline, AddVisitModal, etc.)
- [ ] Invoice-specific components NOT built (PaymentsSection, RecordPaymentModal)

### Pages ⚠️
- [x] QuotePage unified (QuoteCard handles create + edit + view)
- [ ] JobPage unified - NOT DONE (still uses JobDetailPage view-only)
- [ ] InvoicePage unified - NOT DONE (still uses InvoiceDetailPage view-only)

### Flow ⚠️
- [x] Request → Quote works
- [x] Quote → Job works (basic)
- [ ] Job → Invoice flow not tested
- [x] Projects auto-created correctly
- [ ] Visits track budget vs actual - not implemented
- [ ] Warranty projects link to original - not implemented

### Polish ⚠️
- [x] No console errors (in tested flows)
- [x] Loading states work
- [x] Error states work
- [ ] Old files NOT removed (cleanup phase not started)

---

## Next Priority Items

1. **useJobVisits hook** - Critical for visit management
2. **VisitsTimeline component** - Display visits on JobDetailPage
3. **JobCard component** - Unified create/edit/view like QuoteCard
4. **InvoiceCard component** - Unified create/edit/view
5. **Warranty project flow** - Create child projects

---

## END OF IMPLEMENTATION CHECKLIST
