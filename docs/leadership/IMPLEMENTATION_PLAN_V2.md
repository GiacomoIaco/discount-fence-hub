# Leadership System - Implementation Plan v2.0

## Executive Summary

**Goal:** Redesign Leadership system with Monday.com-style UI for maximum usability and transparency

**Timeline:** 3-4 weeks (Phases 1-3)

**Key Decisions:**
- ✅ Layout: Dedicated Leadership app with function sidebar (Option A)
- ✅ Tasks: Implement nested task rows under initiatives
- ✅ Weekly Updates: Enhanced inline editing with submit banner (Option 2)
- ✅ Goals: Show in Plans tab (not always visible)
- ✅ Platform: Desktop only

---

## What's Changing from Current Implementation

### UI Changes
| Current | New |
|---------|-----|
| Dashboard → Function cards | Function sidebar (always visible) |
| Cards default, table hidden | Table default (Monday-style) |
| Goals in separate menu | Goals in Plans tab |
| 3 clicks to initiatives | 1 click |
| Manual individual saves | Batch submit with notifications |
| No tasks | Nested task rows |

### UX Flow Changes
```
CURRENT:
Main Dashboard → Click Function Card → Click Table Toggle → Edit inline

NEW:
Click Function (sidebar) → Already in table view → Edit inline → Submit all
```

---

## Phase 1: Core Restructure (Week 1)

### Goal: Build the new Monday.com-style layout

#### 1.1 Create Dedicated Leadership Layout Component
**File:** `src/features/leadership/LeadershipLayout.tsx`

```typescript
// New full-screen layout with sidebar
- Left sidebar with function list
- Main content area
- Top bar with actions
- No main app navigation visible
```

**Tasks:**
- [ ] Create `LeadershipLayout.tsx` component
- [ ] Build function sidebar with:
  - [ ] List all functions with initiative counts
  - [ ] Quick status indicators (% on track)
  - [ ] "+ New Function" button
  - [ ] Search/filter functions
- [ ] Create top bar with:
  - [ ] Function name/breadcrumb
  - [ ] Action buttons (Settings, Team, Export)
  - [ ] "Back to Main App" link
- [ ] Update routing to use new layout

**Acceptance Criteria:**
- ✅ Clicking "Leadership" in main app enters dedicated view
- ✅ Function sidebar shows all functions with counts
- ✅ Clicking function loads its content
- ✅ Can return to main app easily

---

#### 1.2 Implement Tab Navigation
**File:** `src/features/leadership/components/FunctionTabs.tsx`

```typescript
// Tab bar for switching views
Tabs: [Initiatives] [Plans] [Reports]
```

**Tasks:**
- [ ] Create tab navigation component
- [ ] Implement tab routing
- [ ] Make "Initiatives" default tab
- [ ] Style to match Monday.com

**Acceptance Criteria:**
- ✅ Tabs switch content areas
- ✅ Active tab highlighted
- ✅ URL reflects current tab
- ✅ Initiatives tab loads by default

---

#### 1.3 Make Table View Default
**Files:** `src/features/leadership/components/FunctionView.tsx`

**Tasks:**
- [ ] Remove cards/table toggle
- [ ] Set table as only view
- [ ] Remove card view components (or deprecate)
- [ ] Update table to fill full width

**Acceptance Criteria:**
- ✅ Table view loads immediately
- ✅ No toggle needed
- ✅ Uses full content width

---

## Phase 2: Monday-Style Table Enhancements (Week 2)

### Goal: Build the collapsible, nested table with tasks

#### 2.1 Implement Nested Task Rows
**File:** `src/features/leadership/components/InitiativeTableView.tsx`

**Current Structure:**
```
▶ Initiative
```

**New Structure:**
```
▶ Initiative (parent row)
  ├─ Task 1 (child row)
  ├─ Task 2 (child row)
  └─ Task 3 (child row)
```

**Tasks:**
- [ ] Add expand/collapse icons to initiative rows
- [ ] Create `TaskRow` sub-component
- [ ] Implement collapse/expand state management
- [ ] Style child rows (indented, different bg)
- [ ] Add quick "Add Task" button on initiative row
- [ ] Implement task CRUD operations:
  - [ ] Create task (inline in table)
  - [ ] Edit task (inline)
  - [ ] Delete task
  - [ ] Reorder tasks

**Acceptance Criteria:**
- ✅ Click arrow to expand/collapse initiative
- ✅ Tasks show indented under initiative
- ✅ Can add task inline with [+ Add Task] button
- ✅ Can edit task fields inline
- ✅ Can delete tasks
- ✅ Collapse state persists during session

---

#### 2.2 Add Grouping by Area (Default)
**File:** `src/features/leadership/components/InitiativeTableView.tsx`

**Visual:**
```
▼ 📁 Inventory Management (5 initiatives)
  ├─ Initiative 1
  ├─ Initiative 2
  └─ Initiative 3

▼ 📁 Fulfillment (3 initiatives)
  ├─ Initiative 4
  └─ Initiative 5

[+ Add Area]
```

**Tasks:**
- [ ] Group rows by area by default
- [ ] Add area header rows
- [ ] Make area groups collapsible
- [ ] Show initiative count in header
- [ ] Add [+ Add Initiative] to area groups
- [ ] Add [+ Add Area] at bottom

**Acceptance Criteria:**
- ✅ Initiatives grouped by area
- ✅ Can collapse entire area
- ✅ Quick add buttons work
- ✅ Empty areas show placeholder

---

#### 2.3 Implement Advanced Inline Editing
**File:** `src/features/leadership/components/InitiativeTableView.tsx`

**Tasks:**
- [ ] Track all pending changes in state
- [ ] Show visual indicator for unsaved changes (yellow highlight)
- [ ] Add keyboard shortcuts:
  - [ ] Enter: Save and move to next cell
  - [ ] Tab: Move to next field
  - [ ] Esc: Cancel edit
- [ ] Prevent navigation with unsaved changes (confirm dialog)

**Acceptance Criteria:**
- ✅ Unsaved cells highlighted
- ✅ Keyboard navigation works
- ✅ Warning before losing changes

---

## Phase 3: Weekly Update Flow (Week 3)

### Goal: Implement Option 2 - Enhanced Inline Editing

#### 3.1 Visual Highlights for Updates Needed
**File:** `src/features/leadership/components/InitiativeTableView.tsx`

**Tasks:**
- [ ] Detect initiatives with empty This Week/Next Week
- [ ] Add visual indicator (border/icon) to rows needing updates
- [ ] Add counter badge: "⚠️ 3 initiatives need weekly updates"
- [ ] Add filter: "Show only needs update"
- [ ] Highlight This Week/Next Week columns

**Acceptance Criteria:**
- ✅ Empty updates clearly visible
- ✅ Badge shows count
- ✅ Can filter to see only updates needed

---

#### 3.2 Batch Submit with Notifications
**File:** `src/features/leadership/components/SubmitUpdatesBanner.tsx`

**Visual:**
```
┌─────────────────────────────────────────────────────┐
│ You have updates to 3 initiatives                   │
│ [Discard] [Save Without Notifying] [Submit Updates]│
└─────────────────────────────────────────────────────┘
```

**Tasks:**
- [ ] Create submit banner component
- [ ] Show banner when user has pending changes
- [ ] Track which initiatives were updated
- [ ] Implement "Submit Updates" action:
  - [ ] Save all changes
  - [ ] Create activity log entries
  - [ ] Send email notification to function lead
  - [ ] Show success toast
- [ ] Add email notification system:
  - [ ] Create email template
  - [ ] Send to function lead
  - [ ] Include summary of updates

**Acceptance Criteria:**
- ✅ Banner appears with pending changes
- ✅ Submit saves all changes at once
- ✅ Email sent to function lead
- ✅ Email includes all updated initiatives
- ✅ User sees confirmation

---

#### 3.3 Email Notification System
**File:** `netlify/functions/send-weekly-update-notification.ts`

**Email Template:**
```
Subject: Weekly Updates Submitted - [Function Name]

Hi [Function Lead],

[User Name] has submitted weekly updates for [X] initiatives:

1. Vendor Consolidation Project (Progress: 75% → 85%)
   This week: Completed vendor audit...
   Next week: Finalize pricing...

2. Automate PO Creation (Progress: 45% → 50%)
   This week: Completed software selection...
   Next week: Begin workflow config...

[View in Leadership System →]
```

**Tasks:**
- [ ] Create Netlify function for email
- [ ] Design email template
- [ ] Query function lead email
- [ ] Format initiative updates
- [ ] Add unsubscribe option
- [ ] Test email delivery

**Acceptance Criteria:**
- ✅ Email sent on submit
- ✅ Includes all updates
- ✅ Links back to system
- ✅ Professional formatting

---

## Phase 4: Plans Tab & Goal Integration (Week 4)

### Goal: Integrate goal planning into new layout

#### 4.1 Move Goal Planning to Plans Tab
**File:** `src/features/leadership/components/PlansTab.tsx`

**Tasks:**
- [ ] Create Plans tab component
- [ ] Move `AnnualGoalPlanning` into tab
- [ ] Move `QuarterlyBreakdown` into tab
- [ ] Add navigation between annual/quarterly views
- [ ] Remove separate routes for goals

**Acceptance Criteria:**
- ✅ Plans tab shows annual goals
- ✅ Can navigate to quarterly breakdown
- ✅ All goal planning accessible from tab

---

#### 4.2 Reports Tab
**File:** `src/features/leadership/components/ReportsTab.tsx`

**Tasks:**
- [ ] Create Reports tab component
- [ ] Move `ProgressDashboard` content into tab
- [ ] Add PDF export buttons
- [ ] Keep existing analytics

**Acceptance Criteria:**
- ✅ Reports tab shows progress analytics
- ✅ PDF export works
- ✅ All metrics visible

---

## Phase 5: Polish & Settings (Week 5 - Optional)

### Goal: Refinements and settings integration

#### 5.1 Settings Dropdown
**File:** `src/features/leadership/components/SettingsDropdown.tsx`

**Tasks:**
- [ ] Create settings dropdown menu (top right)
- [ ] Add menu items:
  - [ ] Manage Functions & Areas
  - [ ] Grant Access
  - [ ] Email Settings
  - [ ] Export All Data
- [ ] Move settings modals to dropdown

**Acceptance Criteria:**
- ✅ Settings accessible from dropdown
- ✅ All settings functions work

---

#### 5.2 Performance Optimization
**Tasks:**
- [ ] Implement virtual scrolling for long tables
- [ ] Optimize re-renders on inline edit
- [ ] Add loading states
- [ ] Cache function sidebar data

**Acceptance Criteria:**
- ✅ Table smooth with 100+ initiatives
- ✅ No lag on typing in cells
- ✅ Fast function switching

---

## Database Updates Needed

### New Tables
```sql
-- Tasks table (already exists, need UI)
CREATE TABLE IF NOT EXISTS quarterly_goal_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quarterly_goal_id UUID REFERENCES quarterly_goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  assigned_to UUID REFERENCES auth.users(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log for update notifications
CREATE TABLE IF NOT EXISTS initiative_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiative_id UUID REFERENCES project_initiatives(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  changes JSONB,
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## File Structure Changes

### New Files to Create
```
src/features/leadership/
├── LeadershipLayout.tsx              [NEW - Main layout]
├── components/
│   ├── FunctionSidebar.tsx          [NEW - Left sidebar]
│   ├── FunctionTabs.tsx             [NEW - Tab navigation]
│   ├── SubmitUpdatesBanner.tsx      [NEW - Submit updates UI]
│   ├── TaskRow.tsx                  [NEW - Task table row]
│   ├── PlansTab.tsx                 [NEW - Goals tab]
│   ├── ReportsTab.tsx               [NEW - Analytics tab]
│   └── SettingsDropdown.tsx         [NEW - Settings menu]
├── hooks/
│   ├── useTaskMutations.ts          [NEW - Task CRUD]
│   └── useUpdateNotifications.ts    [NEW - Notification logic]
└── lib/
    └── emailTemplates.ts             [NEW - Email templates]

netlify/functions/
└── send-weekly-update-notification.ts [NEW - Email function]
```

### Files to Update
```
src/features/leadership/
├── LeadershipHub.tsx                [UPDATE - Use new layout]
├── components/
│   ├── InitiativeTableView.tsx      [UPDATE - Add tasks, grouping]
│   ├── FunctionView.tsx             [UPDATE - Remove toggle, add tabs]
│   └── Dashboard.tsx                [UPDATE - Simplify or remove]
└── hooks/
    └── useLeadershipQuery.ts         [UPDATE - Add task queries]
```

---

## Testing Plan

### Phase 1 Testing
- [ ] Function sidebar navigation works
- [ ] Tabs switch correctly
- [ ] Table loads as default
- [ ] All current features still work

### Phase 2 Testing
- [ ] Tasks expand/collapse smoothly
- [ ] Inline task editing works
- [ ] Area grouping displays correctly
- [ ] Performance with 50+ initiatives

### Phase 3 Testing
- [ ] Update highlights appear correctly
- [ ] Submit banner shows/hides appropriately
- [ ] Email notifications send correctly
- [ ] All changes save properly

### Phase 4 Testing
- [ ] Plans tab shows goals correctly
- [ ] Reports tab shows analytics
- [ ] Navigation between tabs smooth

---

## Migration Strategy

### For Existing Users
1. **No data migration needed** - all data stays the same
2. **UI changes only** - backend unchanged
3. **Gradual rollout:**
   - Week 1: Deploy Phase 1 (new layout)
   - Week 2: Deploy Phase 2 (tasks)
   - Week 3: Deploy Phase 3 (notifications)
   - Week 4: Deploy Phase 4 (tabs)

### Rollback Plan
- Keep old routes accessible during rollout
- Add feature flag to switch between old/new UI
- Monitor for 1 week before removing old code

---

## Success Metrics

### Usability
- ✅ < 1 click to reach initiatives (vs 3 now)
- ✅ 100% of updates submitted via batch (vs individual)
- ✅ Email notifications 100% delivery rate
- ✅ 0 reports of "forgot to update" (vs current baseline)

### Performance
- ✅ < 2 seconds initial load
- ✅ < 100ms inline edit response
- ✅ Smooth scrolling with 100+ initiatives

### Adoption
- ✅ 90%+ weekly update completion rate
- ✅ < 5 minutes average time to submit updates
- ✅ Positive user feedback on new UI

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | Week 1 | New layout, sidebar, tabs |
| Phase 2 | Week 2 | Nested tasks, grouping, inline editing |
| Phase 3 | Week 3 | Update highlights, submit banner, notifications |
| Phase 4 | Week 4 | Plans tab, Reports tab integration |
| Phase 5 | Week 5 | Polish, settings, optimization (optional) |

**Total:** 4-5 weeks for complete implementation

---

## Next Steps

1. ✅ Get approval on this plan
2. ⏭️ Start Phase 1: Create new layout component
3. ⏭️ Build function sidebar
4. ⏭️ Implement tab navigation
5. ⏭️ Make table default view

**Ready to start building?** Let me know and I'll begin with Phase 1!
